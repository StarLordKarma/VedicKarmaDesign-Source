import { and, desc, eq, inArray } from "drizzle-orm";
import { bookingRequests, clientChangeHistory, directPaymentBindings, paymentRefunds, reportJobs, reportDeliveryAttempts, reportVersions } from "../drizzle/schema";
import { getDb, getBookingRequestById } from "./db";
import { findActiveAccess } from "./client-status";
import { PAYMENT_NETWORKS } from "../shared/payment-networks";
import { TRON_PAYMENT } from "../shared/tron-payment";
import { prepareVerifiedRefund, checkedRefundNetwork, verifyRefundTransfer } from "./refund-proof";
import { transferData, rpc, type Intent } from "./payments/direct";
import { buildTronPayment, broadcastTronPayment, estimateTronPayment, tronApi, assertTronMainnet } from "./payments/direct-tron";
import { nativeUsdPrices } from "./payments/direct-estimates";
import { refundAmount } from "../shared/refund-amount";
import { notifyOwner } from "./_core/notification";

export const refundsEnabled = () => process.env.REFUNDS_ENABLED === "true";
async function database() { if (!refundsEnabled()) throw new Error("Refund management is not enabled yet"); const db = await getDb(); if (!db) throw new Error("Database unavailable"); return db; }
async function row(id: number) { const db = await database(); const value = (await db.select().from(paymentRefunds).where(eq(paymentRefunds.id, id)).limit(1))[0]; if (!value) throw new Error("Refund not found"); return value; }
const audit = (bookingId: number, actor: string, event: string, detail: unknown = {}) => ({ bookingId, changedBy: actor, changes: JSON.stringify({ event, detail }) });
async function accessBooking(token: string) { const access = await findActiveAccess(token); if (access.kind !== "active") throw new Error("A valid private order link is required"); return access.access.bookingId; }
export async function getPublicRefund(token: string) {
  if (!refundsEnabled()) return { enabled: false as const };
  const bookingId = await accessBooking(token), db = await database();
  const booking = await getBookingRequestById(bookingId);
  const binding = (await db.select({ bookingId: directPaymentBindings.bookingId }).from(directPaymentBindings).where(eq(directPaymentBindings.bookingId, bookingId)).limit(1))[0];
  const refund = (await db.select().from(paymentRefunds).where(eq(paymentRefunds.bookingId, bookingId)).limit(1))[0];
  return { enabled: true as const, eligible: !!booking && !!binding && !["refunded", "refund_pending"].includes(booking.paymentStatus || ""), refund: refund ? { status: refund.status, amount: refund.amount, network: refund.network, recipient: refund.recipient, transactionHash: refund.transactionHash, breakdown: refund.intentJson ? JSON.parse(refund.intentJson).refundBreakdown ?? null : null, decisionNote: refund.decisionNote, updatedAt: refund.updatedAt } : null };
}
export async function requestRefund(input: { token: string; reason: string }) { return createRefund(await accessBooking(input.token), input.reason, "client:private-order-link"); }
export async function createRefund(bookingId: number, reason: string, actor: string) {
  reason = reason.trim(); if (reason.length < 10 || reason.length > 1000) throw new Error("Describe the issue in 10–1000 characters");
  const db = await database(), booking = await getBookingRequestById(bookingId);
  if (!booking) throw new Error("Order not found");
  // A client may report an unrecognized payment too. Approval still independently
  // proves funds received; creating a support request never marks an order paid.
  const binding = (await db.select().from(directPaymentBindings).where(eq(directPaymentBindings.bookingId, bookingId)).limit(1))[0];
  if (!binding) throw new Error("Contact the owner for a manual payment investigation");
  const result = await db.insert(paymentRefunds).values({ bookingId, reason }).onDuplicateKeyUpdate({ set: { bookingId } });
  if (Number(result[0].affectedRows) === 1 && Number(result[0].insertId) > 0) {
    await db.insert(clientChangeHistory).values(audit(bookingId, actor, "refund_requested"));
    void notifyOwner({ title: "Refund request needs review", content: `Order #${bookingId}: a refund was requested. Review it in the owner refund dashboard. No transfer has been made.` });
  }
  return getPublicRefundForBooking(bookingId);
}
async function getPublicRefundForBooking(bookingId: number) { const db = await database(); return (await db.select({ id: paymentRefunds.id, status: paymentRefunds.status }).from(paymentRefunds).where(eq(paymentRefunds.bookingId, bookingId)).limit(1))[0]; }
export async function listRefunds() { if (!refundsEnabled()) return { enabled: false, items: [] }; const db = await database(); return { enabled: true, items: await db.select().from(paymentRefunds).orderBy(desc(paymentRefunds.createdAt)).limit(200) }; }
export async function approveRefund(id: number, actor: string, transferFee = "0") {
  const refund = await row(id); if (refund.status !== "requested") throw new Error("Only a new request can be approved");
  const db = await database(), booking = await getBookingRequestById(refund.bookingId);
  if (!booking) throw new Error("Order not found");
  const binding = (await db.select().from(directPaymentBindings).where(eq(directPaymentBindings.bookingId, booking.id)).limit(1))[0];
  const proof = await prepareVerifiedRefund(booking, binding);
  const amounts = refundAmount(proof.amount, transferFee, proof.network);
  proof.amount = amounts.amount;
  proof.intent = { ...proof.intent, amount: amounts.amount, units: amounts.units, refundBreakdown: amounts } as typeof proof.intent;
  await db.transaction(async tx => {
    // A booking lock serializes competing approvals and pauses future fulfillment.
    await tx.select().from(bookingRequests).where(eq(bookingRequests.id, booking.id)).for("update");
    const jobs = await tx.select().from(reportJobs).where(eq(reportJobs.bookingId, booking.id)).for("update");
    if (jobs.some(job => ["calculating", "narrative_draft", "rendering"].includes(job.status))) throw new Error("Report processing is in progress. Wait for it to finish before approving the refund");
    const versions = jobs.length ? await tx.select({ id: reportVersions.id }).from(reportVersions).where(inArray(reportVersions.reportJobId, jobs.map(j => j.id))) : [];
    if (versions.length && (await tx.select().from(reportDeliveryAttempts).where(and(inArray(reportDeliveryAttempts.reportVersionId, versions.map(v => v.id)), eq(reportDeliveryAttempts.status, "sending"))).limit(1)).length) throw new Error("An email is being sent. Wait for delivery reconciliation first");
    const claim = await tx.update(paymentRefunds).set({ status: "approved", network: proof.network, amount: proof.amount, recipient: proof.recipient, merchant: proof.merchant, intentJson: JSON.stringify(proof.intent), approvedBy: actor, approvedAt: new Date() }).where(and(eq(paymentRefunds.id, id), eq(paymentRefunds.status, "requested")));
    if (Number(claim[0].affectedRows) !== 1) throw new Error("Refund was already reviewed");
    await tx.update(bookingRequests).set({ paymentStatus: "refund_pending", status: "cancelled", statusUpdatedAt: new Date(), statusUpdatedBy: actor }).where(eq(bookingRequests.id, booking.id));
    if (jobs.length) await tx.update(reportJobs).set({ status: "rejected", lastErrorCode: "REFUND_APPROVED" }).where(and(eq(reportJobs.bookingId, booking.id), inArray(reportJobs.status, ["queued", "calculation_failed", "render_failed", "needs_review", "approved", "delivery_failed"])));
    await tx.insert(clientChangeHistory).values(audit(booking.id, actor, "refund_approved", { refundId: id, network: proof.network, recipient: proof.recipient, ...amounts }));
  });
  return { approved: true };
}
export async function declineRefund(id: number, note: string, actor: string) {
  const refund = await row(id), db = await database();
  await db.transaction(async tx => {
    const claim = await tx.update(paymentRefunds).set({ status: "declined", decisionNote: note, approvedBy: actor }).where(and(eq(paymentRefunds.id, id), eq(paymentRefunds.status, "requested")));
    if (Number(claim[0].affectedRows) !== 1) throw new Error("Only a new request can be declined");
    await tx.insert(clientChangeHistory).values(audit(refund.bookingId, actor, "refund_declined", { refundId: id, note }));
  });
  return { declined: true };
}
export async function prepareRefundTransfer(id: number) {
  const refund = await row(id);
  // Reuse the exact nonce (EVM) or exact txID (TRON), including after a lost response.
  if (refund.status === "signing" && refund.preparedTransactionJson) return JSON.parse(refund.preparedTransactionJson) as { network: string; merchant: string; chainId: string; transaction: any };
  if (refund.status !== "approved" || refund.transactionHash || !refund.intentJson || !refund.merchant || !refund.network) throw new Error("Refund is not available for a new transfer. Check an existing transaction instead");
  const intent: Intent = JSON.parse(refund.intentJson), network = checkedRefundNetwork(refund.network);
  // Claim before opening the wallet. Two tabs must never offer two independent sends.
  const db = await database();
  const claim = await db.update(paymentRefunds).set({ status: "signing" }).where(and(eq(paymentRefunds.id, id), eq(paymentRefunds.status, "approved")));
  if (Number(claim[0].affectedRows) !== 1) throw new Error("Another session already started this refund. Do not send twice");
  try {
  if (network === "tron") {
    const estimate = await estimateTronPayment(intent, refund.merchant, await nativeUsdPrices());
    if (estimate.status !== "ready" || !estimate.feeLimit) throw new Error("Merchant wallet needs enough USDT and TRX for the refund");
    const prepared = { network, merchant: refund.merchant, transaction: await buildTronPayment(intent, refund.merchant, estimate.feeLimit), chainId: TRON_PAYMENT.chainId };
    await db.update(paymentRefunds).set({ preparedTransactionJson: JSON.stringify(prepared) }).where(eq(paymentRefunds.id, id));
    return prepared;
  }
  const config = PAYMENT_NETWORKS[network];
  if (await rpc("eth_chainId", [], network) !== config.chainId) throw new Error("Wrong refund RPC network");
  const nonce = await rpc("eth_getTransactionCount", [refund.merchant, "pending"], network);
  if (!/^0x[a-f0-9]+$/i.test(nonce)) throw new Error("Invalid refund nonce");
  const prepared = { network, merchant: refund.merchant, chainId: config.chainId, transaction: { from: refund.merchant, to: config.token, value: "0x0", data: transferData(intent), nonce } };
  await db.update(paymentRefunds).set({ preparedTransactionJson: JSON.stringify(prepared) }).where(eq(paymentRefunds.id, id));
  return prepared;
  } catch (error) {
    // No transaction was returned to a browser: a preparation failure can safely retry.
    await db.update(paymentRefunds).set({ status: "approved" }).where(and(eq(paymentRefunds.id, id), eq(paymentRefunds.status, "signing")));
    throw error;
  }
}
export async function renewExpiredTronRefund(id: number) {
  const refund = await row(id), db = await database();
  if (!["signing", "submitted"].includes(refund.status) || refund.network !== "tron" || !refund.preparedTransactionJson) throw new Error("No expired TRON refund can be renewed");
  const cached = JSON.parse(refund.preparedTransactionJson).transaction;
  const expiry = cached?.raw_data?.expiration;
  if (refund.transactionHash && refund.transactionHash !== cached.txID?.toLowerCase()) throw new Error("Investigate the recorded transaction before renewal");
  await assertTronMainnet();
  const block = await tronApi("wallet/getnowblock");
  const currentTimestamp = block.block_header?.raw_data?.timestamp;
  if (!Number.isSafeInteger(expiry) || !Number.isSafeInteger(currentTimestamp) || currentTimestamp <= expiry + 600000) throw new Error("Wait at least 10 minutes after this TRON transaction expires");
  const [latest, solid] = await Promise.all([tronApi("wallet/gettransactionbyid", { value: cached.txID }), tronApi("walletsolidity/gettransactionbyid", { value: cached.txID })]);
  if (latest.txID || solid.txID) return recordRefundTransfer(id, cached.txID, "system:tron-recovery");
  await db.transaction(async tx => {
    const claim = await tx.update(paymentRefunds).set({ status: "approved", preparedTransactionJson: null, transactionHash: null, submittedAt: null }).where(and(eq(paymentRefunds.id, id), eq(paymentRefunds.status, refund.status)));
    if (Number(claim[0].affectedRows) !== 1) throw new Error("Refund changed during renewal");
    await tx.insert(clientChangeHistory).values(audit(refund.bookingId, "owner:expired-tron-recovery", "expired_refund_renewed", { oldTxId: cached.txID }));
  });
  return { renewed: true };
}
export async function recordRefundTransfer(id: number, hash: string, actor: string) {
  const refund = await row(id), db = await database();
  if (!refund.network || !refund.intentJson || !refund.merchant) throw new Error("Refund was not approved");
  const network = checkedRefundNetwork(refund.network), normalized = hash.toLowerCase();
  if (!(network === "tron" ? /^[a-f0-9]{64}$/ : /^0x[a-f0-9]{64}$/).test(normalized)) throw new Error("Invalid refund transaction hash");
  if (refund.transactionHash && refund.transactionHash !== normalized) {
    const prepared = refund.preparedTransactionJson ? JSON.parse(refund.preparedTransactionJson) : null;
    if (network === "tron" || !prepared?.transaction?.nonce) throw new Error("A different transaction is already being tracked. Never send twice");
    const config = PAYMENT_NETWORKS[network], transaction = await rpc("eth_getTransactionByHash", [normalized], network);
    if (await rpc("eth_chainId", [], network) !== config.chainId || !transaction || transaction.from?.toLowerCase() !== refund.merchant.toLowerCase() || transaction.to?.toLowerCase() !== config.token || transaction.input?.toLowerCase() !== transferData(JSON.parse(refund.intentJson)) || !transaction.nonce || BigInt(transaction.nonce) !== BigInt(prepared.transaction.nonce) || BigInt(transaction.value || "0x0") !== BigInt(0)) throw new Error("A different transaction is already being tracked. Only a verified same-nonce replacement can be recorded");
    const candidates = Array.from(new Set([...(prepared.candidateHashes || []), refund.transactionHash, normalized]));
    if (candidates.length > 10) throw new Error("Too many replacements; investigate the wallet history");
    await db.transaction(async tx => {
      const claim = await tx.update(paymentRefunds).set({ transactionHash: normalized, preparedTransactionJson: JSON.stringify({ ...prepared, candidateHashes: candidates }) }).where(and(eq(paymentRefunds.id, id), eq(paymentRefunds.status, "submitted"), eq(paymentRefunds.transactionHash, refund.transactionHash!)));
      if (Number(claim[0].affectedRows) !== 1) throw new Error("Refund state changed. Refresh before recording a replacement");
      await tx.insert(clientChangeHistory).values(audit(refund.bookingId, actor, "refund_same_nonce_replacement", { previous: refund.transactionHash, replacement: normalized }));
    });
  }
  if (!refund.transactionHash) await db.transaction(async tx => {
    const claim = await tx.update(paymentRefunds).set({ transactionHash: normalized, status: "submitted", submittedAt: new Date() }).where(and(eq(paymentRefunds.id, id), inArray(paymentRefunds.status, ["approved", "signing"])));
    if (Number(claim[0].affectedRows) !== 1) throw new Error("Another session already recorded a transaction");
    await tx.insert(clientChangeHistory).values(audit(refund.bookingId, actor, "refund_transfer_recorded", { refundId: id, hash: normalized }));
  });
  return checkRefundTransfer(id);
}
export async function checkRefundTransfer(id: number) {
  const refund = await row(id); if (refund.status === "confirmed") return { confirmed: true };
  if (refund.status !== "submitted" || !refund.transactionHash || !refund.intentJson || !refund.network || !refund.merchant) throw new Error("No submitted refund to check");
  const db = await database();
  try {
    const prepared = refund.preparedTransactionJson ? JSON.parse(refund.preparedTransactionJson) : null;
    const candidates = Array.from(new Set<string>([refund.transactionHash, ...(prepared?.candidateHashes || [])]));
    let confirmedHash: string | undefined, lastError: unknown;
    for (const hash of candidates) {
      try { if (await verifyRefundTransfer(JSON.parse(refund.intentJson), checkedRefundNetwork(refund.network), refund.merchant, hash)) { confirmedHash = hash; break; } }
      catch (error) { lastError = error; }
    }
    if (!confirmedHash) { if (lastError) throw lastError; return { confirmed: false }; }
    await db.transaction(async tx => {
      const claim = await tx.update(paymentRefunds).set({ status: "confirmed", transactionHash: confirmedHash, confirmedAt: new Date(), lastCheckError: null }).where(and(eq(paymentRefunds.id, id), eq(paymentRefunds.status, "submitted")));
      if (Number(claim[0].affectedRows) !== 1) return;
      await tx.update(bookingRequests).set({ paymentStatus: "refunded", status: "cancelled", statusUpdatedAt: new Date() }).where(eq(bookingRequests.id, refund.bookingId));
      await tx.insert(clientChangeHistory).values(audit(refund.bookingId, "system:chain-verifier", "refund_confirmed", { refundId: id, hash: confirmedHash }));
    });
    return { confirmed: true };
  } catch (error) {
    await db.update(paymentRefunds).set({ lastCheckError: (error instanceof Error ? error.message : "Verification unavailable").slice(0, 500) }).where(and(eq(paymentRefunds.id, id), eq(paymentRefunds.status, "submitted")));
    // Uncertain or invalid candidates stay locked; a timeout must not authorize a second refund.
    return { confirmed: false };
  }
}
export async function broadcastRefund(id: number, transaction: any) {
  const refund = await row(id);
  if (refund.status !== "submitted" || refund.network !== "tron" || !refund.intentJson || !refund.merchant || transaction?.txID?.toLowerCase() !== refund.transactionHash) throw new Error("Record this refund transaction before broadcast");
  return { hash: await broadcastTronPayment(JSON.parse(refund.intentJson), transaction, refund.merchant) };
}
let checking = false;
export async function reconcileRefunds() {
  if (!refundsEnabled() || checking) return;
  checking = true;
  try { const db = await database(); const pending = await db.select({ id: paymentRefunds.id }).from(paymentRefunds).where(eq(paymentRefunds.status, "submitted")).limit(20); for (const r of pending) await checkRefundTransfer(r.id); }
  finally { checking = false; }
}
