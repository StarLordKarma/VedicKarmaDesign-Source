import {getOrderMailFlow,flowMarker} from '../order-mail-flow';
import { MANUAL_COPY } from "../../reading-core/payments/manual-copy.mjs";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { and, desc, eq, like, sql } from "drizzle-orm";
import {
  bookingRequests,
  clientChangeHistory,
  reportJobs,
  reportVersions,
  reportDeliveryAttempts,
  verifiedPaymentClaims,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { createRiskPayApi, riskPayHostedUrl } from "./riskpay-api";
import { riskPayCallbackSchema } from "./riskpay-settlement";
import { riskPayPolygonRpc } from "./riskpay-chain";
import {
  assertManualOrderUnchanged,
  manualDigest,
  manualOrderIdentity,
  riskPayManualEnabled,
  verifyRiskPayManualReceipt,
} from "./riskpay-manual-policy";
import {
  enqueueReportJobForBooking,
  processReportJob,
  approveReportVersion,
  retryReportDelivery,
} from "../report-studio-db";
import { createClientStatusLink } from "../client-status";
import {
  CARD_COPY,
  CARD_TERMS_VERSION,
} from "../../reading-core/payments/copy.mjs";
import { summarizeCardFunds } from "./card-reserve";

type Receipt = Awaited<ReturnType<typeof verifyRiskPayManualReceipt>>;
export type ManualCard = {
  version: 1;
  identityHash: string;
  tokenHash: string;
  callbackHash: string;
  createdAt: number;
  locale: keyof typeof CARD_COPY;
  method: "card" | "apple_pay" | "google_pay";
  merchantWallet: string;
  wallet?: Awaited<
    ReturnType<ReturnType<typeof createRiskPayApi>["createWallet"]>
  >;
  gatewayUrl?: string;
  statusUrl?: string;
  receipt?: Receipt;
  candidate?: ReturnType<typeof riskPayCallbackSchema.parse>;
  nextCheckAt?: number;
  reviewReason?: string;
  consent: { version: string; text: string; at: string };
  preparation?: { by: string; at: string; claim: string; note: string };
  delivery?: {
    by: string;
    at: string;
    versionId: number;
    pdfSha256: string;
    email: string;
  };
  refundRequest?: { at: string; reason: string };
};
async function database() {
  const db = await getDb();
  if (!db) throw Error("Database unavailable");
  return db;
}
function unpack(row: any): { price: any; card: ManualCard } {
  const price = JSON.parse(row.priceSnapshotJson || "{}"),
    card = price.riskpayManual;
  if (card?.version !== 1) throw Error("RiskPay order not found");
  return { price, card };
}
const tokenMatch = (plain: string, hash: string) =>
  /^[a-f0-9]{64}$/.test(hash) &&
  timingSafeEqual(
    Buffer.from(manualDigest(plain), "hex"),
    Buffer.from(hash, "hex")
  );
export function parseManualToken(token: string) {
  const m = /^([1-9]\d{0,9})\.([a-f0-9]{64})$/.exec(token);
  if (!m) throw Error("Invalid private order link");
  return { id: Number(m[1]), secret: m[2] };
}
async function rowById(id: number) {
  const db = await database();
  const row = (
    await db
      .select()
      .from(bookingRequests)
      .where(eq(bookingRequests.id, id))
      .limit(1)
  )[0];
  if (!row) throw Error("Order not found");
  return row;
}
async function locked<T>(
  id: number,
  action: (tx: any, row: any, card: ManualCard) => Promise<T>,
  actor?: string,
  event?: string
) {
  const db = await database();
  return db.transaction(async tx => {
    const row = (
      await tx
        .select()
        .from(bookingRequests)
        .where(eq(bookingRequests.id, id))
        .for("update")
    )[0];
    if (!row) throw Error("Order not found");
    const { price, card } = unpack(row);
    const result = await action(tx, row, card);
    price.riskpayManual = card;
    await tx
      .update(bookingRequests)
      .set({ priceSnapshotJson: JSON.stringify(price) })
      .where(eq(bookingRequests.id, id));
    if (event)
      await tx.insert(clientChangeHistory).values({
        bookingId: id,
        changedBy: actor || "riskpay:verifier",
        changes: JSON.stringify({
          event,
          claim: card.receipt?.claim,
          versionId: card.delivery?.versionId,
        }),
      });
    return result;
  });
}
export async function createManualRiskPayCheckout(input: {
  bookingId: number;
  grossCents: number;
  currency: string;
  email: string;
  locale: keyof typeof CARD_COPY;
  method: "card" | "apple_pay" | "google_pay";
  consent: boolean;
  termsVersion: string;
}) {
  if (!riskPayManualEnabled())
    throw Error("Owner-reviewed RiskPay checkout is not enabled");
  if (
    !input.consent ||
    input.termsVersion !== CARD_TERMS_VERSION ||
    input.currency !== "USD"
  )
    throw Error("Confirm the current payment and refund terms");
  const row = await rowById(input.bookingId),
    price = JSON.parse(row.priceSnapshotJson || "{}");
  if (
    price.riskpayManual ||
    row.paymentStatus !== "creating" ||
    Math.round(Number(row.totalUsd) * 100) !== input.grossCents ||
    row.email !== input.email
  )
    throw Error("Checkout does not match the order");
  const secret = randomBytes(32).toString("hex"),
    callbackSecret = randomBytes(32).toString("hex");
  const base = new URL(process.env.PUBLIC_BASE_URL!).origin;
  const card: ManualCard = {
    version: 1,
    identityHash: manualDigest(manualOrderIdentity(row)),
    tokenHash: manualDigest(secret),
    callbackHash: manualDigest(callbackSecret),
    createdAt: Date.now(),
    locale: input.locale,
    method: input.method,
    merchantWallet: process.env.RISKPAY_MERCHANT_WALLET!.toLowerCase(),
    consent: {
      version: input.termsVersion,
      text:
        CARD_COPY[input.locale].consent +
        " " +
        MANUAL_COPY[input.locale].notice,
      at: new Date().toISOString(),
    },
  };
  // Persist callback binding before the external request. A failed create cannot
  // become a paid booking and never generates a PDF.
  price.riskpayManual = card;
  const db = await database();
  await db
    .update(bookingRequests)
    .set({
      priceSnapshotJson: JSON.stringify(price),
      paymentId: `riskpay-manual:${row.id}`,
    })
    .where(eq(bookingRequests.id, row.id));
  const callback = new URL("/api/riskpay-manual/callback", base);
  callback.searchParams.set("order", String(row.id));
  callback.searchParams.set("token", callbackSecret);
  try {
    const wallet = await createRiskPayApi({ mode: "live" }).createWallet({
      merchantWallet: card.merchantWallet,
      callbackUrl: callback.href,
    });
    const gatewayUrl = riskPayHostedUrl({
      wallet,
      email: input.email,
      grossCents: input.grossCents,
      currency: input.currency,
      method: input.method,
    });
    const access = await createClientStatusLink({
      bookingId: row.id,
      expiryHours: 720,
      createdBy: "riskpay:checkout",
    });
    const path = `/card-order/${row.id}.${secret}`;
    await locked(row.id, async (tx, _row, stored) => {
      stored.wallet = wallet;
      stored.gatewayUrl = gatewayUrl;
      stored.statusUrl = `/status/${access.token}`;
      await tx
        .update(bookingRequests)
        .set({ paymentUrl: path, paymentStatus: "waiting" })
        .where(eq(bookingRequests.id, row.id));
    });
    return { id: `riskpay-manual:${row.id}`, invoice_url: base + path };
  } catch {
    await db
      .update(bookingRequests)
      .set({ paymentStatus: "failed" })
      .where(eq(bookingRequests.id, row.id));
    throw Error(
      "RiskPay checkout could not be created. No payment has been confirmed."
    );
  }
}
export async function getManualRiskPayPublic(token: string) {
  const key = parseManualToken(token),
    row = await rowById(key.id),
    { card } = unpack(row);
  if (!tokenMatch(key.secret, card.tokenHash))
    throw Error("Private order not found");
  return {
    id: row.id,
    product: row.packageCode,
    totalUsd: row.totalUsd,
    currency: row.currency,
    locale: card.locale,
    payment: row.paymentStatus,
    accepted: !!card.preparation,
    orderFlow: flowMarker(row) ? await getOrderMailFlow(row.id).then(f=>f?{acknowledgement:f.ackState,scheduledAt:f.dueAt?.toISOString()||null}:null) : null,
    received: !!card.receipt,
    refundRequested: !!card.refundRequest,
    statusUrl: card.statusUrl,
    gatewayUrl:
      !card.receipt && !card.refundRequest ? card.gatewayUrl : undefined,
  };
}
export async function requestManualRiskPayRefund(
  token: string,
  reason: string
) {
  const key = parseManualToken(token);
  if (reason.trim().length < 10 || reason.length > 1000)
    throw Error("Describe your request in 10–1000 characters");
  await locked(
    key.id,
    async (tx, row, card) => {
      if (!tokenMatch(key.secret, card.tokenHash))
        throw Error("Private order not found");
      if (!card.receipt) throw Error("A verified receipt is required");
      if (!card.refundRequest)
        card.refundRequest = {
          at: new Date().toISOString(),
          reason: reason.trim(),
        };
      // Same booking lock as generation/delivery; never mark a refund transferred.
      await tx
        .update(bookingRequests)
        .set({ paymentStatus: "refund_pending" })
        .where(eq(bookingRequests.id, row.id));
    },
    undefined,
    "riskpay_manual_refund_requested"
  );
}
export async function recordManualRiskPayCallback(
  order: number,
  secret: string,
  raw: unknown
) {
  const candidate = riskPayCallbackSchema.parse(raw);
  await locked(order, async (_tx, _row, card) => {
    if (
      !tokenMatch(secret, card.callbackHash) ||
      !card.wallet ||
      candidate.address_in.toLowerCase() !== card.wallet.assignedAddress
    )
      throw Error("Invalid callback binding");
    if (card.receipt) return;
    if (
      card.candidate &&
      manualDigest(card.candidate) !== manualDigest(candidate)
    ) {
      card.reviewReason =
        "Получены разные уведомления. Владелец должен сверить хеши переводов.";
      return;
    }
    card.candidate = candidate;
  });
}
export async function setManualRiskPayTransactions(
  id: number,
  input: { txid_in: string; txid_out: string; value_coin: string },
  actor: string
) {
  await locked(
    id,
    async (_tx, _row, card) => {
      if (card.receipt || !card.wallet)
        throw Error("Verified receipt cannot be replaced");
      card.candidate = riskPayCallbackSchema.parse({
        ...input,
        address_in: card.wallet.assignedAddress,
        coin: "polygon_usdc",
      });
      card.nextCheckAt = 0;
      card.reviewReason =
        "Хеши переводов указаны владельцем. Ожидается независимая проверка.";
    },
    actor,
    "riskpay_owner_supplied_transaction_details"
  );
  await verifyManualRiskPayOrder(id);
}
export async function verifyManualRiskPayOrder(id: number) {
  const row = await rowById(id),
    { card } = unpack(row);
  if (
    card.receipt ||
    !card.candidate ||
    !card.wallet ||
    (card.nextCheckAt && card.nextCheckAt > Date.now())
  )
    return;
  const candidateHash = manualDigest(card.candidate);
  // Durable throttle before slow RPC work, also across process restarts.
  await locked(id, async (_tx, _row, fresh) => {
    fresh.nextCheckAt = Date.now() + 60000;
  });
  try {
    const receipt = await verifyRiskPayManualReceipt({
      rpc: riskPayPolygonRpc(process.env.RISKPAY_POLYGON_RPC_URL!),
      callback: card.candidate,
      assignedAddress: card.wallet.assignedAddress,
      merchantAddress: card.merchantWallet,
      createdAt: card.createdAt,
    });
    await locked(
      id,
      async (tx, freshRow, fresh) => {
        if (fresh.receipt || manualDigest(fresh.candidate) !== candidateHash)
          return;
        // Globally unique transaction/log claim. A duplicate key rolls back the
        // complete write; no amount is counted twice or transferred to another order.
        await tx
          .insert(verifiedPaymentClaims)
          .values({ paymentId: receipt.claim, bookingId: id });
        fresh.receipt = receipt;
        fresh.reviewReason =
          "Поступление USDC проверено. Полная сумма списания с карты независимо не подтверждена; требуется принятие владельцем.";
        if (freshRow.paymentStatus !== "refund_pending")
          await tx
            .update(bookingRequests)
            .set({ paymentStatus: "received_review" })
            .where(eq(bookingRequests.id, id));
      },
      undefined,
      "riskpay_receipt_verified"
    );
  } catch {
    await locked(id, async (_tx, _row, fresh) => {
      if (!fresh.receipt)
        fresh.reviewReason =
          "Проверка поступления ожидается или не пройдена. Подготовка и отправка PDF не разрешены.";
    });
  }
}
async function detail(id: number) {
  const row = await rowById(id),
    { card } = unpack(row),
    db = await database();
  const jobs = await db
    .select()
    .from(reportJobs)
    .where(eq(reportJobs.bookingId, id))
    .orderBy(desc(reportJobs.id));
  const job = jobs[0];
  const versions = job
    ? await db
        .select()
        .from(reportVersions)
        .where(eq(reportVersions.reportJobId, job.id))
        .orderBy(desc(reportVersions.versionNumber))
    : [];
  const version = versions[0];
  const attempts = version
    ? await db
        .select()
        .from(reportDeliveryAttempts)
        .where(eq(reportDeliveryAttempts.reportVersionId, version.id))
        .orderBy(desc(reportDeliveryAttempts.id))
    : [];
  let changed = false;
  try {
    assertManualOrderUnchanged(row);
  } catch {
    changed = true;
  }
  const review = {
    identity: manualOrderIdentity(row),
    payment: row.paymentStatus,
    receipt: card.receipt || null,
    preparation: card.preparation || null,
    refund: card.refundRequest || null,
    reviewReason: card.reviewReason || null,
    version: version
      ? { id: version.id, pdfSha256: version.pdfSha256, status: version.status }
      : null,
  };
  return {
    ...review,
    orderFlow: flowMarker(row) ? await getOrderMailFlow(row.id).then(f=>f?{acknowledgement:f.ackState,scheduledAt:f.dueAt?.toISOString()||null}:null) : null,
    changed,
    reviewHash: manualDigest(review),
    paymentReference: row.paymentId,
    merchantWallet: card.merchantWallet,
    assignedAddress: card.wallet?.assignedAddress,
    consent: card.consent,
    job: job
      ? { id: job.id, status: job.status, error: job.lastErrorCode }
      : null,
    version: version
      ? {
          id: version.id,
          number: version.versionNumber,
          status: version.status,
          pdfSha256: version.pdfSha256,
          previewUrl: version.pdfStorageKey
            ? "/manus-storage/" +
              version.pdfStorageKey.split("/").map(encodeURIComponent).join("/")
            : undefined,
        }
      : null,
    attempts: attempts.map(a => ({
      id: a.id,
      recipient: a.recipientEmail,
      status: a.status,
      providerMessageId: a.providerMessageId,
      at: a.completedAt || a.requestedAt,
    })),
  };
}
export const getManualRiskPayDetail = detail;
export async function listManualRiskPayOrders() {
  const db = await database();
  const rows = await db
    .select()
    .from(bookingRequests)
    .where(like(bookingRequests.paymentId, "riskpay-manual:%"))
    .orderBy(desc(bookingRequests.createdAt))
    .limit(200);
  return Promise.all(rows.map(async row => {
    const { card } = unpack(row);
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      product: row.packageCode,
      totalUsd: row.totalUsd,
      payment: row.paymentStatus,
      received: card.receipt?.merchantMicroUsdc,
      accepted: !!card.preparation,
    orderFlow: flowMarker(row) ? await getOrderMailFlow(row.id).then(f=>f?{acknowledgement:f.ackState,scheduledAt:f.dueAt?.toISOString()||null}:null) : null,
      refund: !!card.refundRequest,
      at: row.createdAt,
    };
  }));
}
export async function manualRiskPayFunds() {
  const db = await database(),
    rows = await db
      .select()
      .from(bookingRequests)
      .where(like(bookingRequests.paymentId, "riskpay-manual:%"));
  return summarizeCardFunds(
    rows.flatMap(row => {
      const { card } = unpack(row);
      return card.receipt
        ? [
            {
              bookingId: row.id,
              receivedMicroUsdc: card.receipt.merchantMicroUsdc,
              receivedAt: card.receipt.receivedAt,
              refundedMicroUsdc: "0",
              committedRefundMicroUsdc: "0",
              hold:
                !card.preparation ||
                !!card.refundRequest ||
                !["confirmed", "finished"].includes(row.paymentStatus || ""),
            },
          ]
        : [];
    })
  );
}
export async function acceptManualRiskPayPayment(input: {
  id: number;
  reviewHash: string;
  typedId: number;
  note: string;
  actor: string;
}) {
  if (
    input.typedId !== input.id ||
    input.note.trim().length < 10 ||
    input.note.length > 1000
  )
    throw Error(
      "Confirm the order number and explain acceptance of the actual USDC amount"
    );
  // Lock order first. Both approval steps recompute the exact owner-visible
  // snapshot inside this lock; stale tabs cannot approve changed recipients.
  await locked(
    input.id,
    async (tx, row, card) => {
      const fresh = await detail(input.id);
      if (fresh.reviewHash !== input.reviewHash)
        throw Error("Order changed. Refresh and review again.");
      assertManualOrderUnchanged(row);
      if (
        !card.receipt ||
        card.refundRequest ||
        row.status === "cancelled" ||
        row.paymentStatus !== "received_review" ||
        card.preparation
      )
        throw Error("This payment is not awaiting acceptance");
      card.preparation = {
        by: input.actor,
        at: new Date().toISOString(),
        claim: card.receipt.claim,
        note: input.note.trim(),
      };
      await tx
        .update(bookingRequests)
        .set({ paymentStatus: "confirmed", status: "in_progress" })
        .where(eq(bookingRequests.id, row.id));
    },
    input.actor,
    "riskpay_owner_accepted_receipt"
  );
  await prepareManualRiskPayOrder(input.id, input.actor);
}
export async function prepareManualRiskPayOrder(id: number, actor: string) {
  const row = await rowById(id),
    { card } = unpack(row);
  if (
    !card.preparation ||
    card.refundRequest ||
    row.paymentStatus !== "confirmed" ||
    row.status === "cancelled"
  )
    return;
  assertManualOrderUnchanged(row);
  const result = await enqueueReportJobForBooking(id, actor);
  const jobId =
    "jobId" in result
      ? result.jobId
      : "job" in result
        ? result.job?.id
        : undefined;
  if (jobId)
    void processReportJob({ reportJobId: jobId, actorId: actor }).catch(() =>
      console.error("[RiskPay] Report needs owner attention", id)
    );
}
export async function sendManualRiskPayPdf(input: {
  id: number;
  reviewHash: string;
  typedId: number;
  email: string;
  versionId: number;
  actor: string;
}) {
  if (input.typedId !== input.id) throw Error("Confirm the order number");
  const current = await detail(input.id);
  if (
    current.reviewHash !== input.reviewHash ||
    current.changed ||
    !current.job ||
    !current.version ||
    current.version.id !== input.versionId ||
    !current.version.pdfSha256 ||
    current.identity.email !== input.email.trim().toLowerCase() ||
    !["needs_review", "delivery_failed"].includes(current.job.status)
  )
    throw Error("Review the current PDF and recipient again");
  await locked(
    input.id,
    async (_tx, row, card) => {
      const fresh = await detail(input.id);
      if (
        fresh.reviewHash !== input.reviewHash ||
        !card.preparation ||
        card.refundRequest ||
        row.paymentStatus !== "confirmed" ||
        row.status === "cancelled"
      )
        throw Error("Order changed or delivery is paused");
      assertManualOrderUnchanged(row);
      card.delivery = {
        by: input.actor,
        at: new Date().toISOString(),
        versionId: input.versionId,
        pdfSha256: current.version!.pdfSha256!,
        email: current.identity.email,
      };
    },
    input.actor,
    "riskpay_owner_authorized_pdf_delivery"
  );
  const args = {
    reportJobId: current.job.id,
    versionId: input.versionId,
    actorId: input.actor,
  };
  return current.job.status === "delivery_failed"
    ? retryReportDelivery(args)
    : approveReportVersion({
        ...args,
        summary:
          "RiskPay owner queue: payment, recipient and PDF version explicitly checked.",
      });
}
let started = false,
  busy = false;
export function startManualRiskPayWorker() {
  if (started || !riskPayManualEnabled()) return;
  started = true;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      const db = await database();
      const waiting = await db
        .select({ id: bookingRequests.id })
        .from(bookingRequests)
        .where(
          and(
            like(bookingRequests.paymentId, "riskpay-manual:%"),
            sql`json_extract(${bookingRequests.priceSnapshotJson}, '$.riskpayManual.receipt') is null`,
            sql`json_extract(${bookingRequests.priceSnapshotJson}, '$.riskpayManual.candidate') is not null`,
            sql`coalesce(json_extract(${bookingRequests.priceSnapshotJson}, '$.riskpayManual.nextCheckAt'),0) <= ${Date.now()}`
          )
        )
        .limit(10);
      for (const row of waiting) await verifyManualRiskPayOrder(row.id);
      const accepted = await db
        .select({ id: bookingRequests.id })
        .from(bookingRequests)
        .where(
          and(
            like(bookingRequests.paymentId, "riskpay-manual:%"),
            eq(bookingRequests.paymentStatus, "confirmed"),
            sql`not exists(select 1 from report_jobs j where j.bookingId = ${bookingRequests.id} and j.status not in ('queued','paid'))`
          )
        )
        .limit(10);
      for (const row of accepted)
        await prepareManualRiskPayOrder(row.id, "riskpay:reconcile");
    } catch {
      console.error("[RiskPay] Manual queue reconciliation requires attention");
    } finally {
      busy = false;
    }
  };
  setInterval(() => void tick(), 30000).unref();
  void tick();
}
