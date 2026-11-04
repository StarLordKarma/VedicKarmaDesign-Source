import { riskPayPolygonRpc, verifyRiskPayOnChain } from "./riskpay-chain";
import { riskPayFixture } from "./riskpay-fixture";
import {
  createRiskPayApi,
  riskPayHostedUrl,
  type RiskPayWallet,
} from "./riskpay-api";
import {
  riskPayCallbackSchema,
  type RiskPayCallback,
} from "./riskpay-settlement";
import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { and, desc, eq, like } from "drizzle-orm";
import {
  bookingRequests,
  clientChangeHistory,
  reportJobs,
  reportVersions,
  reportDeliveryAttempts,
  verifiedPaymentClaims,
} from "../../drizzle/schema";
import { getDb, updateBookingPayment } from "../db";
import { createClientStatusLink } from "../client-status";
import {
  enqueueReportJobForBooking,
  processReportJob,
} from "../report-studio-db";
import { manualCardRefundQuote } from "../../shared/card-refund";
import {
  CARD_TERMS_VERSION,
  CARD_COPY,
} from "../../reading-core/payments/copy.mjs";
import {
  assertCardSandbox,
  sandboxCardCallbackBase,
} from "./card-sandbox-config";
import { summarizeCardFunds } from "./card-reserve";
import {
  verifyRiskPayRefund,
  type RiskPayRefundIntent,
} from "./riskpay-refund-proof";
import { riskPayRefundFixture } from "./riskpay-refund-fixture";

type Refund = {
  status: "requested" | "quoted" | "accepted" | "confirmed";
  reason: string;
  quote?: ReturnType<typeof manualCardRefundQuote>;
  quoteId?: string;
  recipient?: string;
  reference?: string;
  acceptedAt?: string;
  intent?: RiskPayRefundIntent;
  proof?: { mode: "fixture"; claim: string; transactionHash: string };
};
type Card = {
  version: 1;
  sessionId: string;
  tokenHash: string;
  locale: keyof typeof CARD_COPY;
  brand: "visa" | "mastercard" | "apple_pay" | "google_pay";
  consent: { version: string; text: string; at: string };
  expiresAt: number;
  status: string;
  netMicroUsdc: string;
  fundsReceivedAt?: number;
  receipt?: {
    sessionId: string;
    transferId: string;
    netMicroUsdc: string;
    network: string;
    token: string;
    recipient: string;
    final: boolean;
  };
  statusUrl?: string;
  refund?: Refund;
  riskpay?: {
    id: "riskpay";
    mode: "fixture" | "live";
    merchantWallet: string;
    quote?: {
      incomingMicroUsdc: string;
      merchantMicroUsdc: string;
      expiresAt: number;
    };
    verifiedClaim?: string;
    nextVerificationAt?: number;
    wallet: RiskPayWallet;
    hostedUrl: string;
    callbackUrl?: string;
  };
  lastCallback?: RiskPayCallback;
  lastEvent?: string;
};
const digest = (s: string) => createHash("sha256").update(s).digest("hex");
function requireSettlementQuoteIntegration(mode: "fixture" | "live") {
  if (mode === "live")
    throw Error(
      "Live checkout is unavailable until authoritative settlement quoting is integrated"
    );
}
async function database() {
  assertCardSandbox();
  const db = await getDb();
  if (!db) throw Error("Sandbox database unavailable");
  return db;
}
function snapshot(row: any) {
  const all = JSON.parse(row.priceSnapshotJson || "{}");
  if (all.cardSandbox?.version !== 1) throw Error("Not a sandbox card order");
  return { all, card: all.cardSandbox as Card };
}
function parseToken(token: string) {
  const m = token.match(/^([1-9]\d{0,9})\.([a-f0-9]{64})$/);
  if (!m) throw Error("Invalid private checkout link");
  return { id: Number(m[1]), hash: digest(m[2]) };
}
function authorize(row: any, hash: string) {
  const v = snapshot(row);
  if (
    !timingSafeEqual(
      Buffer.from(hash, "hex"),
      Buffer.from(v.card.tokenHash, "hex")
    )
  )
    throw Error("Invalid private checkout link");
  return v;
}
async function mutate(
  token: string,
  event: string,
  action: (tx: any, row: any, card: Card) => Promise<void>
) {
  const db = await database(),
    key = parseToken(token);
  return db.transaction(async tx => {
    const row = (
      await tx
        .select()
        .from(bookingRequests)
        .where(eq(bookingRequests.id, key.id))
        .for("update")
    )[0];
    if (!row) throw Error("Order not found");
    const { all, card } = authorize(row, key.hash);
    await action(tx, row, card);
    all.cardSandbox = card;
    await tx
      .update(bookingRequests)
      .set({ priceSnapshotJson: JSON.stringify(all) })
      .where(eq(bookingRequests.id, row.id));
    await tx.insert(clientChangeHistory).values({
      bookingId: row.id,
      changedBy: "sandbox:card",
      changes: JSON.stringify({ event, sessionId: card.sessionId }),
    });
    return row.id;
  });
}

export async function createSandboxCardCheckout(input: {
  bookingId: number;
  grossCents: number;
  email: string;
  currency: string;
  locale: keyof typeof CARD_COPY;
  brand: "visa" | "mastercard" | "apple_pay" | "google_pay";
  consent: boolean;
  termsVersion: string;
}) {
  const db = await database();
  if (
    !input.consent ||
    input.termsVersion !== CARD_TERMS_VERSION ||
    input.currency !== "USD"
  )
    throw Error("Current card terms and USD pricing are required");
  const token = randomBytes(32).toString("hex"),
    sessionId = randomUUID();
  const riskpayMode = process.env.RISKPAY_MODE === "live" ? "live" : "fixture";
  if (riskpayMode === "live" && process.env.RISKPAY_LIVE_ENABLED !== "true")
    throw Error("Live RiskPay is disabled");
  // No documented source currently binds the USD price to BOTH incoming and
  // merchant-net USDC. Do not take real money before that contract exists.
  requireSettlementQuoteIntegration(riskpayMode);
  const callbackUrl = new URL(
    "/api/riskpay/callback",
    riskpayMode === "live"
      ? process.env.RISKPAY_CALLBACK_BASE_URL!
      : sandboxCardCallbackBase()
  );
  callbackUrl.searchParams.set("order", String(input.bookingId));
  callbackUrl.searchParams.set("token", token);
  const wallet = await (
    riskpayMode === "live"
      ? createRiskPayApi({ mode: "live" })
      : riskPayFixture(sessionId)
  ).createWallet({
    merchantWallet:
      riskpayMode === "live"
        ? process.env.RISKPAY_MERCHANT_WALLET!
        : "0x1111111111111111111111111111111111111111",
    callbackUrl: callbackUrl.href,
  });
  const hostedUrl = riskPayHostedUrl({
    wallet,
    email: input.email,
    grossCents: input.grossCents,
    currency: input.currency,
    method:
      input.brand === "apple_pay" || input.brand === "google_pay"
        ? input.brand
        : "card",
  });
  // Illustrative 16.5% fee. This is a mock quote, never a real RiskPay rate.
  const net =
    riskpayMode === "fixture"
      ? (BigInt(input.grossCents) * BigInt(8350)).toString()
      : "0";
  await db.transaction(async tx => {
    const row = (
      await tx
        .select()
        .from(bookingRequests)
        .where(eq(bookingRequests.id, input.bookingId))
        .for("update")
    )[0];
    if (
      !row ||
      Math.round(Number(row.totalUsd) * 100) !== input.grossCents ||
      row.paymentStatus !== "creating"
    )
      throw Error("Order cannot create a card session");
    const all = JSON.parse(row.priceSnapshotJson || "{}");
    all.cardSandbox = {
      version: 1,
      sessionId,
      tokenHash: digest(token),
      locale: input.locale,
      brand: input.brand,
      riskpay: {
        id: "riskpay",
        mode: riskpayMode,
        wallet,
        hostedUrl,
        callbackUrl: callbackUrl.href,
        merchantWallet:
          riskpayMode === "live"
            ? process.env.RISKPAY_MERCHANT_WALLET!
            : "0x1111111111111111111111111111111111111111",
      },
      consent: {
        version: CARD_TERMS_VERSION,
        text: CARD_COPY[input.locale].consent,
        at: new Date().toISOString(),
      },
      expiresAt: Date.now() + 1800000,
      status: "pending",
      netMicroUsdc: net,
    } satisfies Card;
    await tx
      .update(bookingRequests)
      .set({
        priceSnapshotJson: JSON.stringify(all),
        paymentId: "card-sandbox:" + sessionId,
        paymentStatus: "waiting",
      })
      .where(eq(bookingRequests.id, row.id));
  });
  const link = await createClientStatusLink({
    bookingId: input.bookingId,
    expiryHours: 720,
    createdBy: "sandbox:card",
  });
  const privateToken = `${input.bookingId}.${token}`;
  await mutate(
    privateToken,
    "card_session_created",
    async (_tx, _row, card) => {
      card.statusUrl = "/status/" + link.token;
    }
  );
  const invoiceUrl = `/sandbox/card/${privateToken}`;
  await updateBookingPayment({
    id: input.bookingId,
    paymentUrl: invoiceUrl,
    paymentStatus: "waiting",
  });
  return { id: "card-sandbox:" + sessionId, invoice_url: invoiceUrl };
}

export async function getSandboxCardCheckout(token: string) {
  const db = await database(),
    key = parseToken(token),
    row = (
      await db
        .select()
        .from(bookingRequests)
        .where(eq(bookingRequests.id, key.id))
        .limit(1)
    )[0];
  if (!row) throw Error("Order not found");
  const { card } = authorize(row, key.hash);
  const jobs = await db
    .select({ id: reportJobs.id, status: reportJobs.status })
    .from(reportJobs)
    .where(eq(reportJobs.bookingId, row.id));
  return {
    bookingId: row.id,
    totalCents: Math.round(Number(row.totalUsd) * 100),
    currency: "USD",
    product: row.packageCode,
    locale: card.locale,
    brand: card.brand,
    status: card.status,
    expiresAt: card.expiresAt,
    statusUrl: card.statusUrl,
    refund: card.refund,
    consent: card.consent,
    report: jobs[0] || null,
    provider: card.riskpay
      ? {
          id: card.riskpay.id,
          mode: card.riskpay.mode,
          hostedMethodsConditional: true,
        }
      : undefined,
    gatewayUrl:
      card.riskpay?.mode === "live" ? card.riskpay.hostedUrl : undefined,
    sandbox: card.riskpay?.mode !== "live",
  };
}

export async function simulateSandboxCard(
  token: string,
  action: "authorized" | "settled" | "declined" | "expired" | "duplicate"
) {
  const id = await mutate(token, "mock_" + action, async (tx, row, card) => {
    if (card.riskpay?.mode === "live")
      throw Error("Live RiskPay sessions cannot use mock confirmations");
    if (["refund_pending", "refunded", "disputed"].includes(card.status))
      return;
    if (action === "authorized") {
      if (["pending", "processing"].includes(card.status))
        card.status = "processing";
      return;
    }
    if (action === "declined" || action === "expired") {
      if (card.status !== "paid") {
        card.status = action === "declined" ? "failed" : "expired";
        await tx
          .update(bookingRequests)
          .set({ paymentStatus: action === "declined" ? "failed" : "expired" })
          .where(eq(bookingRequests.id, row.id));
      }
      return;
    }
    if (action === "settled" && !card.receipt) {
      card.fundsReceivedAt = Date.now();
      card.receipt = {
        sessionId: card.sessionId,
        transferId: "mock-transfer-" + card.sessionId,
        netMicroUsdc: card.netMicroUsdc,
        network: "mock-polygon",
        token: "mock-usdc",
        recipient: "mock-merchant",
        final: true,
      };
    }
    const receipt = card.receipt;
    if (
      !receipt ||
      !receipt.final ||
      receipt.sessionId !== card.sessionId ||
      receipt.netMicroUsdc !== card.netMicroUsdc ||
      receipt.network !== "mock-polygon" ||
      receipt.token !== "mock-usdc" ||
      receipt.recipient !== "mock-merchant"
    ) {
      card.status = "review";
      return;
    }
    if (
      card.status !== "paid" &&
      (Date.now() >= card.expiresAt ||
        ["expired", "failed"].includes(card.status))
    ) {
      card.status = "review";
      return;
    }
    card.status = "paid";
    await tx
      .update(bookingRequests)
      .set({ paymentStatus: "confirmed", status: "in_progress" })
      .where(eq(bookingRequests.id, row.id));
  });
  // Durable paid booking survives a crash before enqueue. Repeated confirmation
  // reuses the existing report job; the worker claims generation once.
  await reconcileSandboxCard(id);
  return getSandboxCardCheckout(token);
}

export async function reconcileSandboxCard(id: number) {
  const db = await database(),
    row = (
      await db
        .select()
        .from(bookingRequests)
        .where(eq(bookingRequests.id, id))
        .limit(1)
    )[0];
  if (!row || row.paymentStatus !== "confirmed") return;
  const { card } = snapshot(row);
  if (
    card.status !== "paid" ||
    !(card.riskpay?.mode === "live"
      ? card.riskpay.verifiedClaim
      : card.receipt?.final)
  )
    return;
  const queued = await enqueueReportJobForBooking(id, "sandbox:card");
  const jobId =
    "jobId" in queued
      ? queued.jobId
      : "job" in queued
        ? queued.job?.id
        : undefined;
  if (jobId)
    void processReportJob({
      reportJobId: jobId,
      actorId: "sandbox:card",
    }).catch(() =>
      console.error("[Card sandbox] Saved report needs owner review", jobId)
    );
}

export async function requestSandboxCardRefund(token: string, reason: string) {
  if (reason.trim().length < 10 || reason.length > 1000)
    throw Error("Describe the issue in 10–1000 characters");
  await mutate(token, "manual_refund_requested", async (_tx, _row, card) => {
    if (card.status !== "paid") throw Error("Refund needs a verified payment");
    if (!card.refund)
      card.refund = { status: "requested", reason: reason.trim() };
  });
  return getSandboxCardCheckout(token);
}
export async function quoteSandboxCardRefund(
  token: string,
  basis: "voluntary" | "mandatory",
  networkMicroUsdc: string
) {
  await mutate(token, "manual_refund_quote", async (tx, row, card) => {
    if (card.riskpay?.mode === "live")
      throw Error(
        "Live refunds require a verified conversion quote; sandbox rates are forbidden"
      );
    if (
      card.status !== "paid" ||
      !card.refund ||
      !["requested", "quoted"].includes(card.refund.status)
    )
      throw Error("Refund request is not available for review");
    const jobs = await tx
      .select()
      .from(reportJobs)
      .where(eq(reportJobs.bookingId, row.id))
      .for("update");
    if (
      jobs.some((j: any) =>
        ["calculating", "rendering", "narrative_draft"].includes(j.status)
      )
    )
      throw Error("Wait for report processing to finish");
    card.refund = {
      ...card.refund,
      status: "quoted",
      quoteId: randomUUID(),
      quote: manualCardRefundQuote({
        grossMicroUsdc: (
          BigInt(Math.round(Number(row.totalUsd) * 100)) * BigInt(10000)
        ).toString(),
        networkMicroUsdc,
        basis,
      }),
    };
  });
  return getSandboxCardCheckout(token);
}
export async function acceptSandboxCardRefund(
  token: string,
  input: { quoteId: string; recipient: string; accepted: boolean }
) {
  if (
    !input.accepted ||
    !/^0x[0-9a-fA-F]{40}$/.test(input.recipient) ||
    /^0x0{40}$/i.test(input.recipient)
  )
    throw Error(
      "Explicit acceptance and a nonzero Polygon address are required"
    );
  await mutate(token, "manual_refund_accepted", async (tx, row, card) => {
    if (card.riskpay?.mode === "live")
      throw Error(
        "Live refund acceptance requires a verified quote and independent starting block"
      );
    if (
      card.refund?.status !== "quoted" ||
      card.refund.quoteId !== input.quoteId ||
      card.status !== "paid"
    )
      throw Error("Refund quote changed");
    if (
      input.recipient.toLowerCase() ===
      card.riskpay?.merchantWallet.toLowerCase()
    )
      throw Error("Refund recipient must differ from the merchant wallet");
    const sending = await tx
      .select({ id: reportDeliveryAttempts.id })
      .from(reportDeliveryAttempts)
      .innerJoin(
        reportVersions,
        eq(reportVersions.id, reportDeliveryAttempts.reportVersionId)
      )
      .innerJoin(reportJobs, eq(reportJobs.id, reportVersions.reportJobId))
      .where(
        and(
          eq(reportJobs.bookingId, row.id),
          eq(reportDeliveryAttempts.status, "sending")
        )
      )
      .limit(1);
    if (sending.length) throw Error("Wait for email delivery reconciliation");
    const active = await tx
      .select()
      .from(reportJobs)
      .where(eq(reportJobs.bookingId, row.id))
      .for("update");
    if (
      active.some((j: any) =>
        ["calculating", "rendering", "narrative_draft"].includes(j.status)
      )
    )
      throw Error("Report processing is active");
    const acceptedAt = Date.now();
    card.refund = {
      ...card.refund,
      status: "accepted",
      recipient: input.recipient.toLowerCase(),
      acceptedAt: new Date(acceptedAt).toISOString(),
      intent: {
        quoteId: card.refund.quoteId!,
        merchant: card.riskpay!.merchantWallet,
        recipient: input.recipient.toLowerCase(),
        netMicroUsdc: card.refund.quote!.netMicroUsdc,
        acceptedAt,
        startBlock: "0x10",
      }, // Offline fixture block; never used for live.
    };
    card.status = "refund_pending";
    await tx
      .update(bookingRequests)
      .set({ paymentStatus: "refund_pending" })
      .where(eq(bookingRequests.id, row.id));
  });
  return getSandboxCardCheckout(token);
}
export async function confirmSandboxCardRefund(token: string) {
  const db = await database(),
    key = parseToken(token);
  const row = (
    await db
      .select()
      .from(bookingRequests)
      .where(eq(bookingRequests.id, key.id))
      .limit(1)
  )[0];
  if (!row) throw Error("Order not found");
  const { card: before } = authorize(row, key.hash);
  if (before.riskpay?.mode === "live")
    throw Error(
      "Live refunds require independent on-chain proof; mock confirmation is forbidden"
    );
  if (before.refund?.status === "confirmed")
    return getSandboxCardCheckout(token);
  if (
    before.refund?.status !== "accepted" ||
    !before.refund.intent ||
    before.status !== "refund_pending"
  )
    throw Error("Buyer must accept exact refund details first");
  const binding = JSON.stringify(before.refund.intent);
  const fixture = riskPayRefundFixture(before.refund.intent, before.sessionId);
  const proof = await verifyRiskPayRefund({
    rpc: fixture.rpc,
    intent: before.refund.intent,
    transactionHash: fixture.hash,
  });
  if (proof.status !== "verified")
    throw Error("Refund transfer remains unverified");
  // Synthetic claims have a separate namespace and can never occupy real claims.
  const claim = "fixture-refund:" + proof.claim;
  await mutate(token, "mock_manual_refund_verified", async (tx, row, card) => {
    if (card.refund?.status === "confirmed") return;
    if (
      card.riskpay?.mode !== "fixture" ||
      card.refund?.status !== "accepted" ||
      card.status !== "refund_pending" ||
      JSON.stringify(card.refund.intent) !== binding
    )
      throw Error("Refund details changed during verification");
    await tx
      .insert(verifiedPaymentClaims)
      .values({ paymentId: claim, bookingId: row.id })
      .onDuplicateKeyUpdate({ set: { paymentId: claim } });
    const assigned = (
      await tx
        .select()
        .from(verifiedPaymentClaims)
        .where(eq(verifiedPaymentClaims.paymentId, claim))
        .limit(1)
    )[0];
    if (assigned?.bookingId !== row.id)
      throw Error("Refund transfer already belongs to another order");
    card.refund = {
      ...card.refund,
      status: "confirmed",
      reference: "fixture:" + proof.transactionHash,
      proof: { mode: "fixture", claim, transactionHash: proof.transactionHash },
    };
    card.status = "refunded";
    await tx
      .update(bookingRequests)
      .set({ paymentStatus: "refunded", status: "cancelled" })
      .where(eq(bookingRequests.id, row.id));
  });
  return getSandboxCardCheckout(token);
}

export function startCardSandboxWorker() {
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      const db = await database();
      const paid = await db
        .select({ id: bookingRequests.id })
        .from(bookingRequests)
        .where(
          and(
            like(bookingRequests.paymentId, "card-sandbox:%"),
            eq(bookingRequests.paymentStatus, "confirmed")
          )
        )
        .limit(50);
      for (const row of paid) await reconcileSandboxCard(row.id);
      if (process.env.RISKPAY_POLYGON_RPC_URL) {
        const pending = await db
          .select()
          .from(bookingRequests)
          .where(
            and(
              like(bookingRequests.paymentId, "card-sandbox:%"),
              eq(bookingRequests.paymentStatus, "waiting")
            )
          )
          .orderBy(desc(bookingRequests.id))
          .limit(50);
        for (const row of pending) {
          const { card } = snapshot(row),
            provider = card.riskpay;
          if (
            provider?.mode !== "live" ||
            !provider.quote ||
            !card.lastCallback ||
            (provider.nextVerificationAt || 0) > Date.now()
          )
            continue;
          const token = row.paymentUrl?.split("/").at(-1);
          if (token)
            await recordSandboxRiskPayCallback(token, card.lastCallback);
        }
      }
    } catch {
      console.error("[Card sandbox] Reconciliation deferred");
    } finally {
      running = false;
    }
  }, 15000);
  timer.unref();
  return timer;
}

export async function listSandboxCardOrders() {
  const db = await database();
  const rows = await db
    .select()
    .from(bookingRequests)
    .where(like(bookingRequests.paymentId, "card-sandbox:%"))
    .orderBy(desc(bookingRequests.id))
    .limit(200);
  return rows
    .filter(row =>
      /^\/sandbox\/card\/[1-9]\d{0,9}\.[a-f0-9]{64}$/.test(row.paymentUrl || "")
    )
    .map(row => {
      const { card } = snapshot(row);
      return {
        id: row.id,
        url: row.paymentUrl!,
        status: card.status,
        refund: card.refund?.status || "—",
      };
    });
}

export async function getSandboxCardFunds() {
  const db = await database();
  const rows = await db
    .select({
      id: bookingRequests.id,
      priceSnapshotJson: bookingRequests.priceSnapshotJson,
    })
    .from(bookingRequests)
    .where(like(bookingRequests.paymentId, "card-sandbox:%"));
  const facts = [];
  for (const row of rows) {
    const { card } = snapshot(row);
    // This dashboard models fixture receipts only; real funds must never be
    // mixed into a test balance. Failed/approved-only sessions contribute zero.
    if (
      card.riskpay?.mode !== "fixture" ||
      !card.receipt?.final ||
      card.receipt.sessionId !== card.sessionId ||
      card.receipt.network !== "mock-polygon" ||
      card.receipt.token !== "mock-usdc" ||
      card.receipt.recipient !== "mock-merchant"
    )
      continue;
    facts.push({
      bookingId: row.id,
      receivedMicroUsdc: card.receipt.netMicroUsdc,
      receivedAt: card.fundsReceivedAt,
      hold:
        !["paid", "refunded"].includes(card.status) ||
        (!!card.refund && card.refund.status !== "confirmed"),
      refundedMicroUsdc:
        card.refund?.status === "confirmed"
          ? card.refund.quote!.netMicroUsdc
          : "0",
      committedRefundMicroUsdc:
        card.refund?.status === "accepted"
          ? card.refund.quote!.netMicroUsdc
          : "0",
    });
  }
  return summarizeCardFunds(facts);
}

/** A documented callback is a reconciliation hint, not a signed payment proof. */
export async function recordSandboxRiskPayCallback(
  token: string,
  payload: unknown
) {
  const event = riskPayCallbackSchema.parse(payload);
  await mutate(token, "riskpay_callback_received", async (_tx, _row, card) => {
    if (
      !card.riskpay ||
      card.riskpay.wallet.assignedAddress !== event.address_in.toLowerCase()
    )
      throw Error("RiskPay callback wallet mismatch");
    if (
      ["paid", "refund_pending", "refunded", "disputed"].includes(card.status)
    )
      return;
    card.status = "review";
    card.lastCallback = event;
    card.riskpay.nextVerificationAt = Date.now() + 60000;
    card.lastEvent = "awaiting_independent_settlement_verification";
  });
  const db = await database(),
    key = parseToken(token);
  const current = (
    await db
      .select()
      .from(bookingRequests)
      .where(eq(bookingRequests.id, key.id))
      .limit(1)
  )[0];
  const { card } = authorize(current, key.hash),
    provider = card.riskpay!;
  // A retry must never reopen fulfillment or repeat RPC verification after a
  // terminal state, especially after manual refund processing has started.
  if (["paid", "refund_pending", "refunded", "disputed"].includes(card.status))
    return { accepted: true, paid: card.status === "paid" };
  if (
    provider.mode !== "live" ||
    !provider.quote ||
    !process.env.RISKPAY_POLYGON_RPC_URL
  )
    return { accepted: true, paid: false };
  try {
    const quoteSnapshot = JSON.stringify(provider.quote);
    const proof = await verifyRiskPayOnChain({
      rpc: riskPayPolygonRpc(process.env.RISKPAY_POLYGON_RPC_URL),
      callback: event,
      assignedAddress: provider.wallet.assignedAddress,
      merchantAddress: provider.merchantWallet,
      quote: provider.quote,
    });
    if (proof.status !== "verified") return { accepted: true, paid: false };
    const id = await mutate(
      token,
      "riskpay_settlement_verified",
      async (tx, row, fresh) => {
        if (
          ["paid", "refund_pending", "refunded", "disputed"].includes(
            fresh.status
          )
        )
          return;
        if (
          JSON.stringify(fresh.riskpay?.quote) !== quoteSnapshot ||
          fresh.riskpay?.wallet.assignedAddress !==
            provider.wallet.assignedAddress ||
          fresh.riskpay?.merchantWallet !== provider.merchantWallet
        )
          throw Error("Settlement binding changed during verification");
        await tx
          .insert(verifiedPaymentClaims)
          .values({ paymentId: proof.claim, bookingId: row.id })
          .onDuplicateKeyUpdate({ set: { paymentId: proof.claim } });
        const claim = (
          await tx
            .select()
            .from(verifiedPaymentClaims)
            .where(eq(verifiedPaymentClaims.paymentId, proof.claim))
            .limit(1)
        )[0];
        if (claim?.bookingId !== row.id)
          throw Error("RiskPay transfer already belongs to another order");
        fresh.riskpay!.verifiedClaim = proof.claim;
        fresh.netMicroUsdc = proof.merchantMicroUsdc;
        fresh.fundsReceivedAt ??= Date.now();
        fresh.status = "paid";
        await tx
          .update(bookingRequests)
          .set({ paymentStatus: "confirmed", status: "in_progress" })
          .where(eq(bookingRequests.id, row.id));
      }
    );
    await reconcileSandboxCard(id);
    const status = await getSandboxCardCheckout(token);
    return { accepted: true, paid: status.status === "paid" };
  } catch {
    console.error("[RiskPay] Settlement remains under review", key.id);
    return { accepted: true, paid: false };
  }
}
