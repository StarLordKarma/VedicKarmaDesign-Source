import { isDeliveryLeaseExpired } from "./report-delivery-policy";
import {
  createWalletChallenge,
  bindPaymentWallet,
  getPaymentBinding,
  assertPaymentBinding,
} from "./payments/direct-binding";
import { TRON_PAYMENT } from "../shared/tron-payment";
import {
  verifyTronTransfer,
  TronLatePaymentError,
  tronTransferData,
  tronPaymentCandidates,
  estimateTronPayment,
  buildTronPayment,
  broadcastTronPayment,
} from "./payments/direct-tron";
import { nativeUsdPrices } from "./payments/direct-estimates";
import { estimatePaymentNetworks } from "./payments/direct-estimates";
import {
  PAYMENT_NETWORKS,
  recommendPaymentNetwork,
  isPaymentNetwork,
  type PaymentNetworkId,
  type CheckoutNetworkId,
} from "../shared/payment-networks";
import { notifyOwner } from "./_core/notification";
import { assertAutomaticReportQuality } from "./report-auto-policy";
import type { Express } from "express";
import { and, eq, like, inArray, lt, sql } from "drizzle-orm";
import {
  bookingRequests,
  reportJobs,
  reportVersions,
  reportDeliveryAttempts,
} from "../drizzle/schema";
import { getBookingRequestById, getDb } from "./db";
import {
  LatePaymentError,
  DIRECT_CHAIN,
  DIRECT_TOKEN,
  TRANSFER_TOPIC,
  readIntent,
  rpc,
  transferData,
  verifyTransfer,
  type Intent,
  intentOptions,
  selectIntentNetwork,
} from "./payments/direct";
import { processPaymentNotification } from "./payment-notification";
import {
  approveReportVersion,
  deliverApprovedReport,
  enqueueReportJobForBooking,
  getReportReviewJob,
  isReportStudioAutoProcessingEnabled,
  processReportJob,
} from "./report-studio-db";
import { createRateLimit } from "./observability";
import { isPaidPaymentStatus } from "../shared/payment-status";

async function load(token: string) {
  const intent = await readIntent(token);
  const booking = await getBookingRequestById(intent.bookingId);
  // Exact persisted link prevents a valid token being reused against a different invoice.
  if (!booking || !booking.paymentUrl?.endsWith(`/pay/${token}`))
    throw new Error("Payment link is no longer available");
  return { intent, booking };
}
async function confirm(
  intent: Intent,
  hash: string,
  network: CheckoutNetworkId = intent.network ?? "avalanche"
) {
  const binding = await assertPaymentBinding(intent, network);
  const chainId =
    network === "tron"
      ? TRON_PAYMENT.chainId
      : PAYMENT_NETWORKS[network].chainId;
  try {
    if (
      !(await (network === "tron"
        ? verifyTronTransfer(intent, hash, binding?.payer)
        : verifyTransfer(intent, hash, binding?.payer)))
    )
      return false;
  } catch (error) {
    if (
      !(error instanceof LatePaymentError) &&
      !(error instanceof TronLatePaymentError)
    )
      throw error;
    const db = await getDb();
    if (!db) throw error;
    const claim = await db
      .update(bookingRequests)
      .set({
        paymentStatus: "manual_review",
        paymentId: `${chainId}:${hash.toLowerCase()}`,
      })
      .where(
        and(
          eq(bookingRequests.id, intent.bookingId),
          inArray(bookingRequests.paymentStatus, ["waiting", "expired"])
        )
      );
    if (Number(claim[0].affectedRows ?? 0) === 1)
      await notifyOwner({
        title: "Late USDT payment needs review",
        content: `Booking #${intent.bookingId}: funds received after the payment window. Network ${network}. Review transaction ${hash}.`,
      });
    throw error;
  }
  await processPaymentNotification({
    bookingId: intent.bookingId,
    paymentId: `${chainId}:${hash.toLowerCase()}`,
    paymentStatus: "confirmed",
  });
  return true;
}
export function registerDirectPaymentRoutes(app: Express) {
  app.get("/api/payment-options", (_req, res) => {
    const direct = process.env.PAYMENT_PROVIDER === "direct";
    res.setHeader("Cache-Control", "no-store");
    res.json({
      direct,
      available: process.env.CHECKOUT_ENABLED !== "false",
      currencies: ["USD", "EUR", "GBP"],
    });
  });
  app.use(
    "/api/direct-payment",
    createRateLimit({ name: "wallet-payments", windowMs: 60000, max: 30 })
  );
  app.get("/api/direct-payment/:token", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      const { intent, booking } = await load(req.params.token);
      const binding = intent.bindingRequired
        ? await getPaymentBinding(intent)
        : undefined;
      res.json({
        binding: binding
          ? { network: binding.network, payer: binding.payer }
          : null,
        statusUrl: binding?.statusToken
          ? `/status/${binding.statusToken}`
          : null,
        amount: intent.amount,
        recipient: intent.recipient,
        chainId: DIRECT_CHAIN,
        token: DIRECT_TOKEN,
        data: transferData(intent),
        deadline: intent.deadline,
        paid: isPaidPaymentStatus(booking.paymentStatus),
        manualReview: booking.paymentStatus === "manual_review",
        language: booking.language,
        networks: [
          ...intentOptions(intent).map(option => ({
            ...PAYMENT_NETWORKS[option.network],
            protocol: "evm",
            recipient: intent.recipient,
            data: transferData(selectIntentNetwork(intent, option.network)),
          })),
          ...(intent.tron
            ? [
                {
                  ...TRON_PAYMENT,
                  recipient: intent.tron.recipient,
                  data: tronTransferData(intent),
                },
              ]
            : []),
        ],
      });
    } catch {
      res.status(404).json({ error: "Payment link unavailable" });
    }
  });
  app.post("/api/direct-payment/:token/challenge", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      const { intent, booking } = await load(req.params.token);
      if (
        isPaidPaymentStatus(booking.paymentStatus) ||
        booking.paymentStatus === "manual_review"
      )
        throw new Error("Invoice closed");
      const origin = new URL(
        process.env.PUBLIC_BASE_URL || "http://localhost:3000"
      ).origin;
      res.json(
        await createWalletChallenge(
          intent,
          req.body.network,
          req.body.address,
          origin
        )
      );
    } catch {
      res.status(400).json({ error: "Could not create wallet challenge" });
    }
  });
  app.post("/api/direct-payment/:token/bind", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      const { intent, booking } = await load(req.params.token);
      if (
        isPaidPaymentStatus(booking.paymentStatus) ||
        booking.paymentStatus === "manual_review"
      )
        throw new Error("Invoice closed");
      const binding = await bindPaymentWallet(
        intent,
        req.body.challengeToken,
        req.body.signature
      );
      res.json({
        network: binding.network,
        payer: binding.payer,
        statusUrl: binding.statusToken
          ? `/status/${binding.statusToken}`
          : null,
      });
    } catch {
      res
        .status(409)
        .json({ error: "Wallet signature rejected or order is already bound" });
    }
  });
  app.post("/api/direct-payment/:token/estimate", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      const { intent, booking } = await load(req.params.token);
      if (
        isPaidPaymentStatus(booking.paymentStatus) ||
        Date.now() / 1000 >= intent.deadline
      ) {
        res.status(409).json({ error: "Invoice is closed" });
        return;
      }
      const estimates =
        req.body?.network === "tron"
          ? [
              await estimateTronPayment(
                intent,
                req.body?.address,
                await nativeUsdPrices()
              ),
            ]
          : await estimatePaymentNetworks(
              intent,
              req.body?.address,
              req.body.onlySelected && isPaymentNetwork(req.body.network)
                ? req.body.network
                : undefined
            );
      res.json({ estimates, recommended: recommendPaymentNetwork(estimates) });
    } catch {
      res
        .status(400)
        .json({ error: "Could not estimate this wallet's payment" });
    }
  });
  app.post("/api/direct-payment/:token/tron-transaction", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      const { intent, booking } = await load(req.params.token);
      if (
        !intent.tron ||
        isPaidPaymentStatus(booking.paymentStatus) ||
        booking.paymentStatus === "manual_review" ||
        Date.now() / 1000 >= intent.deadline
      ) {
        res.status(409).json({ error: "Invoice is closed" });
        return;
      }
      const binding = await assertPaymentBinding(intent, "tron");
      if (binding && binding.payer !== req.body.address)
        throw new Error("Wrong payer");
      const estimate = await estimateTronPayment(
        intent,
        req.body?.address,
        await nativeUsdPrices()
      );
      if (estimate.status !== "ready" || !estimate.feeLimit) {
        res.status(409).json({ error: "Insufficient balance or resources" });
        return;
      }
      res.json({
        transaction: await buildTronPayment(
          intent,
          req.body.address,
          estimate.feeLimit
        ),
        estimate,
      });
    } catch {
      res.status(400).json({ error: "Could not prepare TRON transfer" });
    }
  });
  app.post("/api/direct-payment/:token/tron-broadcast", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      const { intent, booking } = await load(req.params.token);
      if (
        !intent.tron ||
        isPaidPaymentStatus(booking.paymentStatus) ||
        Date.now() / 1000 >= intent.deadline ||
        JSON.stringify(req.body).length > 16000
      ) {
        res
          .status(409)
          .json({ error: "Invoice closed or invalid transaction" });
        return;
      }
      const binding = await assertPaymentBinding(intent, "tron");
      res.json({
        hash: await broadcastTronPayment(
          intent,
          req.body.transaction,
          binding?.payer
        ),
      });
    } catch {
      res
        .status(400)
        .json({
          error:
            "Broadcast uncertain. Check transaction status before sending again.",
        });
    }
  });
  // The browser supplies a candidate hash only. Every payment fact is checked via server RPC.
  app.post("/api/direct-payment/:token", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      const { intent, booking } = await load(req.params.token);
      if (isPaidPaymentStatus(booking.paymentStatus)) {
        res.json({ paid: true });
        return;
      }
      if (
        typeof req.body?.hash !== "string" ||
        !(
          req.body.network === "tron"
            ? /^[0-9a-fA-F]{64}$/
            : /^0x[0-9a-fA-F]{64}$/
        ).test(req.body.hash)
      ) {
        res.status(400).json({ error: "Invalid transaction hash" });
        return;
      }
      const network = req.body.network ?? "avalanche";
      const selected =
        network === "tron" ? intent : selectIntentNetwork(intent, network);
      res.json({ paid: await confirm(selected, req.body.hash, network) });
    } catch (error) {
      res.status(400).json({
        error:
          error instanceof Error ? error.message : "Payment check unavailable",
      });
    }
  });
}

async function scanNetwork(root: Intent, network: PaymentNetworkId) {
  const intent = selectIntentNetwork(root, network);
  const call = (method: string, params: unknown[] = []) =>
    rpc(method, params, network);
  if ((await call("eth_chainId")) !== PAYMENT_NETWORKS[network].chainId)
    throw new Error("Wrong scan network");
  const end = await call("eth_getBlockByNumber", ["finalized", false]);
  if (!end || BigInt(end.number) < BigInt(intent.startBlock))
    return { matched: false, expired: false };
  // Bound each RPC log range; scan all ranges before expiring an invoice.
  let lastBlock = BigInt(end.number);
  if (Number(BigInt(end.timestamp)) > intent.deadline + 600) {
    let lo = BigInt(intent.startBlock),
      hi = lastBlock;
    while (lo < hi) {
      const mid = (lo + hi + BigInt(1)) / BigInt(2);
      const block = await call("eth_getBlockByNumber", [
        `0x${mid.toString(16)}`,
        false,
      ]);
      if (!block) throw new Error("Missing block");
      if (Number(BigInt(block.timestamp)) <= intent.deadline + 600) lo = mid;
      else hi = mid - BigInt(1);
    }
    lastBlock = lo;
  }
  let matched = false;
  for (
    let start = BigInt(intent.startBlock);
    start <= lastBlock;
    start += BigInt(1000)
  ) {
    const stop =
      start + BigInt(999) < lastBlock ? start + BigInt(999) : lastBlock;
    const logs = await call("eth_getLogs", [
      {
        address: PAYMENT_NETWORKS[network].token,
        fromBlock: `0x${start.toString(16)}`,
        toBlock: `0x${stop.toString(16)}`,
        topics: [
          TRANSFER_TOPIC,
          null,
          `0x${intent.recipient.slice(2).toLowerCase().padStart(64, "0")}`,
        ],
      },
    ]);
    for (const log of logs) {
      if (BigInt(log.data) !== BigInt(intent.units)) continue;
      const tx = await call("eth_getTransactionByHash", [log.transactionHash]);
      if (tx?.input?.toLowerCase() !== transferData(intent)) continue;
      if (await confirm(intent, log.transactionHash)) {
        matched = true;
        break;
      }
    }
    if (matched) break;
  }

  return {
    matched,
    expired: !matched && Number(BigInt(end.timestamp)) > intent.deadline + 600,
  };
}

let busy = false;
export async function runDirectPaymentWorker() {
  if (busy || process.env.PAYMENT_PROVIDER !== "direct") return;
  busy = true;
  try {
    const db = await getDb();
    if (!db) return;
    const pending = await db
      .select()
      .from(bookingRequests)
      .where(
        and(
          eq(bookingRequests.paymentStatus, "waiting"),
          like(bookingRequests.paymentUrl, "%/pay/%")
        )
      )
      .limit(100);
    for (const booking of pending) {
      try {
        const token = booking.paymentUrl!.split("/pay/")[1];
        const { intent } = await load(token);
        const binding = intent.bindingRequired
          ? await getPaymentBinding(intent)
          : undefined;
        if (intent.bindingRequired && !binding) {
          if (Date.now() / 1000 > intent.deadline + 600)
            await db
              .update(bookingRequests)
              .set({ paymentStatus: "expired" })
              .where(
                and(
                  eq(bookingRequests.id, booking.id),
                  eq(bookingRequests.paymentStatus, "waiting")
                )
              );
          continue;
        }
        let matched = false;
        let allExpired = true;
        for (const option of intentOptions(intent).filter(
          o => !binding || o.network === binding.network
        )) {
          try {
            const result = await scanNetwork(intent, option.network);
            matched ||= result.matched;
            allExpired &&= result.expired;
            if (matched) break;
          } catch {
            allExpired = false;
          }
        }
        if (
          !matched &&
          intent.tron &&
          (!binding || binding.network === "tron")
        ) {
          try {
            const candidates = await tronPaymentCandidates(intent);
            allExpired &&= candidates.complete && candidates.expired;
            for (const hash of candidates.hashes) {
              try {
                if (await confirm(intent, hash, "tron")) {
                  matched = true;
                  break;
                }
              } catch {
                allExpired = false;
              }
            }
          } catch {
            allExpired = false;
          }
        }
        if (!matched && allExpired)
          await db
            .update(bookingRequests)
            .set({ paymentStatus: "expired" })
            .where(
              and(
                eq(bookingRequests.id, booking.id),
                eq(bookingRequests.paymentStatus, "waiting")
              )
            );
      } catch {
        console.error(
          `[Wallet] Could not reconcile booking ${booking.id}; will retry`
        );
      }
    }
    // Payment-to-job recovery is independent of callback delivery and survives restarts.
    const paid = await db
      .select()
      .from(bookingRequests)
      .where(
        and(
          eq(bookingRequests.paymentStatus, "confirmed"),
          like(bookingRequests.paymentUrl, "%/pay/%")
        )
      );
    for (const booking of paid)
      await enqueueReportJobForBooking(booking.id, "wallet-worker");
    const directBookingIds = paid.map(b => b.id);
    if (
      !directBookingIds.length ||
      !(
        process.env.DIRECT_AUTO_PROCESS === "true" ||
        (await isReportStudioAutoProcessingEnabled())
      )
    )
      return;
    // Interrupted generation is recoverable after the maximum external-call window.
    const interrupted = await db
      .select()
      .from(reportJobs)
      .where(
        and(
          inArray(reportJobs.bookingId, directBookingIds),
          inArray(reportJobs.status, [
            "calculating",
            "narrative_draft",
            "rendering",
          ]),
          lt(reportJobs.startedAt, new Date(Date.now() - 20 * 60000))
        )
      )
      .limit(5);
    for (const job of interrupted) {
      const detail = await getReportReviewJob(job.id);
      await db
        .update(reportJobs)
        .set({
          status:
            detail?.versions[0]?.status === "needs_review"
              ? "needs_review"
              : "calculation_failed",
          lastErrorCode: "WORKER_INTERRUPTED",
        })
        .where(
          and(eq(reportJobs.id, job.id), eq(reportJobs.status, job.status))
        );
    }
    const queued = await db
      .select()
      .from(reportJobs)
      .where(
        and(
          inArray(reportJobs.bookingId, directBookingIds),
          inArray(reportJobs.status, [
            "queued",
            "calculation_failed",
            "render_failed",
          ]),
          lt(reportJobs.attemptCount, 3)
        )
      )
      .limit(5);
    for (const job of queued) {
      try {
        await processReportJob({
          reportJobId: job.id,
          actorId: "wallet-worker",
        });
      } catch {
        console.error(`[Reports] Job ${job.id} needs attention`);
      }
    }
    if (process.env.REPORT_AUTO_DELIVERY !== "true") return;
    const ready = await db
      .select()
      .from(reportJobs)
      .where(
        and(
          inArray(reportJobs.bookingId, directBookingIds),
          eq(reportJobs.status, "needs_review"),
          sql`coalesce(${reportJobs.lastErrorCode}, '') <> 'AUTO_REVIEW_REQUIRED'`
        )
      )
      .limit(5);
    for (const job of ready) {
      if (job.testJob) continue;
      const detail = await getReportReviewJob(job.id);
      const version = detail?.versions[0];
      if (!version) continue;
      if (!detail?.calculation?.factsJson || !detail.narrative?.narrativeJson)
        continue;
      try {
        assertAutomaticReportQuality({
          factsJson: detail.calculation.factsJson,
          narrativeJson: detail.narrative.narrativeJson,
          locale: job.language,
        });
      } catch {
        await db
          .update(reportJobs)
          .set({ lastErrorCode: "AUTO_REVIEW_REQUIRED" })
          .where(eq(reportJobs.id, job.id));
        continue;
      }
      try {
        await approveReportVersion({
          reportJobId: job.id,
          versionId: version.id,
          actorId: "system:auto-delivery",
          summary: "Automatic delivery enabled by operator",
        });
      } catch {
        console.error(`[Reports] Auto delivery ${job.id} needs attention`);
      }
    }
    const approved = await db
      .select()
      .from(reportJobs)
      .where(
        and(
          inArray(reportJobs.bookingId, directBookingIds),
          inArray(reportJobs.status, ["approved", "delivery_failed"]),
          sql`coalesce(${reportJobs.lastErrorCode}, '') <> 'AUTO_DELIVERY_STOPPED'`
        )
      )
      .limit(5);
    for (const job of approved) {
      const version = (
        await db
          .select()
          .from(reportVersions)
          .where(
            and(
              eq(reportVersions.reportJobId, job.id),
              eq(reportVersions.status, "approved")
            )
          )
          .limit(1)
      )[0];
      if (job.testJob) continue;
      if (!version) {
        const sent = (
          await db
            .select()
            .from(reportVersions)
            .where(
              and(
                eq(reportVersions.reportJobId, job.id),
                eq(reportVersions.status, "sent")
              )
            )
            .limit(1)
        )[0];
        if (sent)
          await db
            .update(reportJobs)
            .set({ status: "sent", finishedAt: new Date() })
            .where(eq(reportJobs.id, job.id));
        continue;
      }
      const attempt = (
        await db
          .select()
          .from(reportDeliveryAttempts)
          .where(eq(reportDeliveryAttempts.reportVersionId, version.id))
          .limit(1)
      )[0];
      // Resend's deduplication window is 24h. Automatic retries stop within one hour.
      if (
        attempt &&
        (Date.now() - attempt.requestedAt.getTime() > 3600000 ||
          attempt.errorCode === "PERMANENT_DELIVERY_ERROR")
      ) {
        await db
          .update(reportJobs)
          .set({ lastErrorCode: "AUTO_DELIVERY_STOPPED" })
          .where(eq(reportJobs.id, job.id));
        continue;
      }
      if (
        attempt?.status === "failed" &&
        attempt.completedAt &&
        Date.now() - attempt.completedAt.getTime() < 300000
      )
        continue;
      if (
        attempt?.status === "sending" &&
        isDeliveryLeaseExpired(attempt)
      ) {
        await db
          .update(reportDeliveryAttempts)
          .set({ status: "failed", completedAt: new Date() })
          .where(
            and(
              eq(reportDeliveryAttempts.id, attempt.id),
              eq(reportDeliveryAttempts.status, "sending"),
              sql`coalesce(${reportDeliveryAttempts.startedAt}, ${reportDeliveryAttempts.requestedAt}) < ${new Date(Date.now() - 300000)}`
            )
          );
      }
      try {
        await deliverApprovedReport({
          reportJobId: job.id,
          versionId: version.id,
          actorId: "wallet-worker",
        });
      } catch {
        console.error(
          `[Reports] Delivery ${job.id} will be retried if eligible`
        );
      }
    }
  } finally {
    busy = false;
  }
}
export function startDirectPaymentWorker() {
  if (process.env.PAYMENT_PROVIDER !== "direct") return;
  const run = () =>
    void runDirectPaymentWorker().catch(() =>
      console.error("[Wallet] Worker failed; will retry")
    );
  run();
  setInterval(run, 30000).unref();
}
