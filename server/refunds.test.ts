import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { bookingRequests, directPaymentBindings, paymentRefunds, reportJobs, reportVersions, reportDeliveryAttempts, clientChangeHistory } from "../drizzle/schema";
const mocks = vi.hoisted(() => ({ db: undefined as any, booking: undefined as any, proof: vi.fn(), verify: vi.fn(), rpc: vi.fn(), tron: vi.fn() }));
vi.mock("./db", () => ({ getDb: async () => mocks.db, getBookingRequestById: async () => mocks.booking }));
vi.mock("./client-status", () => ({ findActiveAccess: vi.fn() }));
vi.mock("./_core/notification", () => ({ notifyOwner: vi.fn(async () => true) }));
vi.mock("./refund-proof", async original => ({ ...await original<typeof import("./refund-proof")>(), prepareVerifiedRefund: mocks.proof, verifyRefundTransfer: mocks.verify }));
vi.mock("./payments/direct", async original => ({ ...await original<typeof import("./payments/direct")>(), rpc: mocks.rpc }));
vi.mock("./payments/direct-tron", async original => ({ ...await original<typeof import("./payments/direct-tron")>(), assertTronMainnet: vi.fn(), tronApi: mocks.tron }));
import { approveRefund, prepareRefundTransfer, recordRefundTransfer, checkRefundTransfer, renewExpiredTronRefund } from "./refunds";
let refund: any, jobs: any[], audit: any[];
const payer = `0x${"23".repeat(20)}`, merchant = `0x${"45".repeat(20)}`, hash = `0x${"aa".repeat(32)}`;
const intent = { bookingId: 7, id: "ab".repeat(32), recipient: payer, units: "9990000", amount: "9.99", network: "polygon", startBlock: "0x100", deadline: Number.MAX_SAFE_INTEGER, options: [{ network: "polygon", startBlock: "0x100" }] };
function matches(condition: any) {
  const { sql, params } = new MySqlDialect().sqlToQuery(condition);
  for (const match of sql.matchAll(/`payment_refunds`\.`(status|id)`\s*(=|in)\s*(\?|\([^)]*\))/g)) {
    const start = (sql.slice(0, match.index).match(/\?/g) || []).length;
    const values = params.slice(start, start + (match[3].match(/\?/g) || []).length);
    if (!values.includes(refund[match[1]])) return false;
  }
  return true;
}
beforeEach(() => {
  vi.stubEnv("REFUNDS_ENABLED", "true"); vi.clearAllMocks(); jobs = []; audit = [];
  mocks.booking = { id: 7, paymentStatus: "confirmed", paymentId: "original", paymentUrl: "original" };
  refund = { id: 1, bookingId: 7, status: "requested", reason: "Report was not delivered", intentJson: null, transactionHash: null, preparedTransactionJson: null };
  mocks.proof.mockResolvedValue({ intent, merchant, network: "polygon", recipient: payer, amount: "9.99" });
  mocks.verify.mockResolvedValue(false);
  mocks.rpc.mockImplementation(async method => method === "eth_chainId" ? "0x89" : "0x2");
  const rows = (table: any) => table === paymentRefunds ? [structuredClone(refund)] : table === bookingRequests ? [structuredClone(mocks.booking)] : table === directPaymentBindings ? [{ network: "polygon", payer, intentId: intent.id }] : table === reportJobs ? jobs : table === reportVersions || table === reportDeliveryAttempts ? [] : [];
  mocks.db = {
    select: () => { let table: any; const q: any = { from: (t: any) => { table = t; return q; }, where: () => q, limit: () => q, orderBy: () => q, for: () => q, then: (resolve: any, reject: any) => Promise.resolve(rows(table)).then(resolve, reject) }; return q; },
    update: (table: any) => ({ set: (values: any) => ({ where: async (condition: any) => { if (table === paymentRefunds) { if (!matches(condition)) return [{ affectedRows: 0 }]; Object.assign(refund, values); } else if (table === bookingRequests) Object.assign(mocks.booking, values); return [{ affectedRows: 1 }]; } }) }),
    insert: (table: any) => ({ values: async (value: any) => { if (table === clientChangeHistory) audit.push(value); return [{ affectedRows: 1 }]; } }),
    transaction: async (callback: any) => { const previous = structuredClone({ refund, booking: mocks.booking, audit }); try { return await callback(mocks.db); } catch (e) { refund = previous.refund; mocks.booking = previous.booking; audit = previous.audit; throw e; } },
  };
});
afterEach(() => vi.unstubAllEnvs());
async function approved() { await approveRefund(1, "owner"); }
describe("refund ledger safety", () => {
  it("freezes the independently verified destination and pauses the paid order before sending", async () => {
    await approved(); expect(refund).toMatchObject({ status: "approved", recipient: payer, merchant, amount: "9.99" }); expect(mocks.booking.paymentStatus).toBe("refund_pending"); expect(audit).toHaveLength(1);
  });
  it("does not approve during active report generation", async () => {
    jobs = [{ id: 4, status: "calculating" }]; await expect(approved()).rejects.toThrow("in progress"); expect(refund.status).toBe("requested"); expect(mocks.booking.paymentStatus).toBe("confirmed");
  });
  it("allows only one fresh wallet preparation and reuses its exact reserved nonce on recovery", async () => {
    await approved(); const results = await Promise.allSettled([prepareRefundTransfer(1), prepareRefundTransfer(1)]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    const first = (results.find(r => r.status === "fulfilled") as PromiseFulfilledResult<any>).value;
    const recovered = await prepareRefundTransfer(1); expect(recovered).toEqual(first); expect(first.transaction.nonce).toBe("0x2"); expect(mocks.rpc.mock.calls.filter(([method]) => method === "eth_getTransactionCount")).toHaveLength(1);
  });
  it("never treats a recorded hash or RPC failure as a completed refund, and never substitutes a second hash", async () => {
    await approved(); await prepareRefundTransfer(1); expect(await recordRefundTransfer(1, hash, "owner")).toEqual({ confirmed: false }); expect(refund.status).toBe("submitted"); expect(mocks.booking.paymentStatus).toBe("refund_pending");
    mocks.verify.mockRejectedValue(new Error("RPC unavailable")); expect(await checkRefundTransfer(1)).toEqual({ confirmed: false }); expect(refund.status).toBe("submitted");
    await expect(recordRefundTransfer(1, `0x${"bb".repeat(32)}`, "owner")).rejects.toThrow("already being tracked"); await expect(prepareRefundTransfer(1)).rejects.toThrow("not available");
  });
  it("tracks a wallet speed-up only with the frozen nonce, token, recipient and calldata", async () => {
    await approved(); const prepared = await prepareRefundTransfer(1); await recordRefundTransfer(1, hash, "owner");
    const replacement = `0x${"bb".repeat(32)}`;
    mocks.rpc.mockImplementation(async method => method === "eth_chainId" ? "0x89" : { from: merchant, to: prepared.transaction.to, input: prepared.transaction.data, nonce: prepared.transaction.nonce, value: "0x0" });
    await recordRefundTransfer(1, replacement, "owner"); expect(refund.transactionHash).toBe(replacement);
    mocks.verify.mockImplementation(async (_intent, _network, _merchant, candidate) => candidate === hash);
    await checkRefundTransfer(1); expect(refund.status).toBe("confirmed"); expect(refund.transactionHash).toBe(hash);
  });
  it("rejects replacement transactions that would pay twice with a different nonce", async () => {
    await approved(); const prepared = await prepareRefundTransfer(1); await recordRefundTransfer(1, hash, "owner");
    mocks.rpc.mockImplementation(async method => method === "eth_chainId" ? "0x89" : { from: merchant, to: prepared.transaction.to, input: prepared.transaction.data, nonce: "0x3", value: "0x0" });
    await expect(recordRefundTransfer(1, `0x${"bb".repeat(32)}`, "owner")).rejects.toThrow("same-nonce"); expect(refund.transactionHash).toBe(hash);
  });
  it("marks funds returned only after final proof, with idempotent repeated checks", async () => {
    await approved(); await recordRefundTransfer(1, hash, "owner"); mocks.verify.mockResolvedValue(true); await checkRefundTransfer(1); const count = audit.length; await checkRefundTransfer(1);
    expect(refund.status).toBe("confirmed"); expect(mocks.booking.paymentStatus).toBe("refunded"); expect(audit).toHaveLength(count);
    expect(mocks.verify.mock.calls.at(-1)?.[2]).toBe(merchant);
  });
  it("never renews a TRON transfer without a valid chain timestamp", async () => {
    refund = { ...refund, status: "signing", network: "tron", preparedTransactionJson: JSON.stringify({ transaction: { txID: "aa".repeat(32), raw_data: { expiration: 1 } } }) }; mocks.tron.mockResolvedValue({});
    await expect(renewExpiredTronRefund(1)).rejects.toThrow("10 minutes"); expect(refund.status).toBe("signing");
  });
});
