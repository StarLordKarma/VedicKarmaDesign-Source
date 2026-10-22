import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";
const mocks = vi.hoisted(() => ({ verify: vi.fn(), tronVerify: vi.fn(), rpc: vi.fn(), tronApi: vi.fn() }));
vi.mock("./payments/direct", async original => ({ ...await original<typeof import("./payments/direct")>(), verifyTransfer: mocks.verify, rpc: mocks.rpc }));
vi.mock("./payments/direct-tron", async original => ({ ...await original<typeof import("./payments/direct-tron")>(), verifyTronTransfer: mocks.tronVerify, assertTronMainnet: vi.fn(), tronApi: mocks.tronApi }));
import { prepareVerifiedRefund, refundPaymentHash, isRefundHeld } from "./refund-proof";
import { orderSigningKey } from "./payments/order-signing";
import { LatePaymentError } from "./payments/direct";
const payer = `0x${"23".repeat(20)}`, merchant = `0x${"45".repeat(20)}`, id = "ab".repeat(32), hash = `0x${"cd".repeat(32)}`;
let intent: any;
beforeEach(() => { vi.stubEnv("ORDER_SIGNING_SECRET", "refund-test-secret-".repeat(4)); vi.clearAllMocks(); intent = { bookingId: 7, id, recipient: merchant, units: "14990000", amount: "14.99", startBlock: "0x1", deadline: 1, options: [{ network: "bnb", startBlock: "0x1" }], tron: { recipient: "TLjWhpJwVAmYYv55CVYDVppenstMXvX3si", startBlock: 1 } }; mocks.verify.mockResolvedValue(true); mocks.tronVerify.mockResolvedValue(true); mocks.rpc.mockImplementation(async (method: string) => method === "eth_chainId" ? "0x38" : "0x100"); mocks.tronApi.mockResolvedValue({ block_header: { raw_data: { number: 123 } } }); });
afterEach(() => vi.unstubAllEnvs());
async function booking(status = "confirmed", network = "0x38", tx = hash) { const token = await new SignJWT({ intent }).setProtectedHeader({ alg: "HS256" }).setIssuer("vedic-karma").setAudience("direct-payment").setExpirationTime(1).sign(orderSigningKey()); return { id: 7, paymentUrl: `https://site.test/pay/${token}`, paymentId: `${network}:${tx}`, paymentStatus: status }; }
describe("refund proof and frozen amount", () => {
  it("accepts an expired but valid signed invoice and returns original 18-decimal BNB amount only to its payer", async () => {
    const proof = await prepareVerifiedRefund(await booking(), { network: "bnb", payer, intentId: id });
    expect(proof).toMatchObject({ amount: "14.99", recipient: payer, merchant, network: "bnb" });
    expect(proof.intent.units).toBe("14990000000000000000");
    expect(proof.intent.id).not.toBe(id);
    expect(mocks.verify.mock.calls[0][0].recipient).toBe(merchant);
    expect(mocks.verify.mock.calls[0][2]).toBe(payer);
    expect(proof.intent.recipient).toBe(payer);
  });
  it("never refunds a pending, failed or already-refunded order", async () => {
    for (const status of ["waiting", "failed", "refunded", "refund_pending"]) await expect(prepareVerifiedRefund(await booking(status), { network: "bnb", payer, intentId: id })).rejects.toThrow("verified payment");
    expect(mocks.verify).not.toHaveBeenCalled();
  });
  it("requires the correct binding and independently finalized incoming payment", async () => {
    await expect(prepareVerifiedRefund(await booking(), { network: "bnb", payer, intentId: "00".repeat(32) })).rejects.toThrow("binding");
    mocks.verify.mockResolvedValue(false);
    await expect(prepareVerifiedRefund(await booking(), { network: "bnb", payer, intentId: id })).rejects.toThrow("not final");
  });
  it("can return a late transfer, but never ignores other payment verification errors", async () => {
    mocks.verify.mockRejectedValue(new LatePaymentError("late"));
    await expect(prepareVerifiedRefund(await booking("manual_review"), { network: "bnb", payer, intentId: id })).resolves.toMatchObject({ amount: "14.99" });
    mocks.verify.mockRejectedValue(new Error("Wrong payer"));
    await expect(prepareVerifiedRefund(await booking(), { network: "bnb", payer, intentId: id })).rejects.toThrow("Wrong payer");
  });
  it("uses the distinct TRON payer, original token amount and original merchant", async () => {
    const tronPayer = "TJRabPrwbZy45sbavfcjinPJC18kjpRTv8";
    const proof = await prepareVerifiedRefund(await booking("confirmed", "0x2b6653dc", "cd".repeat(32)), { network: "tron", payer: tronPayer, intentId: id });
    expect(proof.intent.tron).toEqual({ recipient: tronPayer, startBlock: 123 });
    expect(proof.intent.units).toBe("14990000");
    expect(proof.merchant).toBe(intent.tron.recipient);
    expect(mocks.tronVerify.mock.calls[0][2]).toBe(tronPayer);
  });
  it("rejects tampering, a wrong chain and missing receipt identity", async () => {
    const order = await booking(); order.paymentUrl = order.paymentUrl.slice(0, -4) + "xxxx";
    await expect(prepareVerifiedRefund(order, { network: "bnb", payer, intentId: id })).rejects.toThrow();
    expect(() => refundPaymentHash(`0x89:${hash}`, "bnb")).toThrow();
    expect(() => refundPaymentHash(null, "bnb")).toThrow();
    expect(isRefundHeld("refund_pending")).toBe(true); expect(isRefundHeld("refunded")).toBe(true); expect(isRefundHeld("confirmed")).toBe(false);
  });
});
