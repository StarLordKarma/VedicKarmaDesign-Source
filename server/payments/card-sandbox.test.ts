import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { CardSandbox, type MockCardEvent } from "./card-sandbox";

const now = 1000000;
const quote = { bookingId: 17, grossCents: 5000, netMicroUsdc: "41750000", brand: "visa" as const };
function setup(brand: "visa" | "mastercard" = "visa") {
  const env = { NODE_ENV: "test", CARD_SANDBOX_ONLY: "true" };
  const model = new CardSandbox(env, "dedicated-mock-secret-at-least-32-characters");
  const session = model.create({ ...quote, brand }, now);
  const event = (status: MockCardEvent["status"] = "settled", fields: Partial<MockCardEvent> = {}) =>
    ({ eventId: randomUUID(), sessionId: session.id, bookingId: 17, grossCents: 5000, currency: "USD" as const, status, ...fields });
  const receive = (e: MockCardEvent) => { const signed = model.sign(e); return model.receive(signed.raw, signed.signature, now); };
  const settle = (fields = {}) => model.recordMockSettlement({ sessionId: session.id, transferId: "mock-transfer-one", netMicroUsdc: quote.netMicroUsdc, network: "mock-polygon", token: "mock-usdc", recipient: "mock-merchant", final: true, ...fields });
  return { model, env, session, event, receive, settle };
}

describe("autonomous card sandbox (no real payment or delivery)", () => {
  it.each(["visa", "mastercard"] as const)("queues one intent after independent settlement for mock %s", brand => {
    const s = setup(brand); s.settle(); const event = s.event();
    expect(s.receive(event)).toMatchObject({ status: "paid", fulfillment: "queued" });
    expect(s.receive(event)).toMatchObject({ status: "paid", fulfillment: "queued" });
    expect(s.receive(s.event("processing")).status).toBe("paid");
    expect(s.model.audit().filter(e => e.event === "settled")).toHaveLength(1);
  });
  it("does not trust a signed paid callback without ledger proof; duplicate can reconcile later", () => {
    const s = setup(), event = s.event();
    expect(s.receive(event)).toMatchObject({ status: "review", fulfillment: "none" });
    s.settle(); expect(s.receive(event).status).toBe("paid");
  });
  it.each([
    { final: false }, { netMicroUsdc: "41749999" }, { network: "wrong-network" },
    { token: "usdt0" }, { recipient: "wrong-wallet" },
  ])("holds a settlement mismatch %j", fields => {
    const s = setup(); s.settle(fields);
    expect(s.receive(s.event())).toMatchObject({ status: "review", fulfillment: "none" });
  });
  it("rejects forged signatures, modified amounts and cross-order callbacks", () => {
    const s = setup(), signed = s.model.sign(s.event());
    expect(() => s.model.receive(signed.raw, "00".repeat(32), now)).toThrow("signature");
    expect(() => s.model.receive(signed.raw + " ", signed.signature, now)).toThrow("signature");
    expect(() => s.receive(s.event("settled", { grossCents: 1 }))).toThrow("match order");
    expect(() => s.receive(s.event("settled", { bookingId: 18 }))).toThrow("match order");
    expect(() => s.model.sign({ ...s.event(), currency: "EUR" } as unknown as MockCardEvent)).toThrow();
    expect(s.model.snapshot(s.session.id).fulfillment).toBe("none");
  });
  it("rejects reuse of an event ID with a changed body", () => {
    const s = setup(), event = s.event("processing"); s.receive(event);
    expect(() => s.receive({ ...event, status: "settled" })).toThrow("reused");
  });
  it.each(["failed", "expired"] as const)("does not fulfill %s", status => {
    const s = setup(); expect(s.receive(s.event(status)).fulfillment).toBe("none");
  });
  it("reuses a checkout and freezes quote without mixing bookings", () => {
    const s = setup();
    expect(s.model.create(quote, now).id).toBe(s.session.id);
    expect(() => s.model.create({ ...quote, grossCents: 100 }, now)).toThrow();
    expect(s.model.create({ ...quote, bookingId: 18 }, now).id).not.toBe(s.session.id);
  });
  it("retains a late settlement for review", () => {
    const s = setup(); s.settle(); const signed = s.model.sign(s.event());
    expect(s.model.receive(signed.raw, signed.signature, s.session.expiresAt)).toMatchObject({ status: "review", fulfillment: "none" });
  });
  it("does not allocate one receipt to two orders", () => {
    const s = setup(); s.settle(); s.receive(s.event());
    const second = s.model.create({ ...quote, bookingId: 18 }, now);
    s.settle({ sessionId: second.id });
    expect(() => s.receive(s.event("settled", { sessionId: second.id, bookingId: 18 }))).toThrow("another order");
  });
  it("keeps dispute holds even after a repeated paid event", () => {
    const s = setup(); s.settle(); s.receive(s.event()); s.receive(s.event("disputed"));
    expect(s.receive(s.event())).toMatchObject({ status: "disputed", fulfillment: "held" });
  });
  it("requires separate crypto refund consent, preserves gross liability and verifies confirmation", () => {
    const s = setup(); s.settle(); s.receive(s.event());
    const refund = { explicitConsent: true, processorAllows: true, recipient: "mock-buyer-one", quotedMicroUsdc: "50000000", customerFeeCents: 0 };
    expect(() => s.model.approveMockCryptoRefund(s.session.id, { ...refund, explicitConsent: false })).toThrow();
    expect(() => s.model.approveMockCryptoRefund(s.session.id, { ...refund, processorAllows: false })).toThrow();
    expect(() => s.model.approveMockCryptoRefund(s.session.id, { ...refund, customerFeeCents: 1 })).toThrow();
    expect(s.model.approveMockCryptoRefund(s.session.id, refund)).toMatchObject({ grossCents: 5000, microUsdc: "50000000" });
    expect(s.receive(s.event())).toMatchObject({ status: "refund_pending", fulfillment: "held" });
    const receipt = { reference: "mock-refund-one", recipient: refund.recipient, microUsdc: refund.quotedMicroUsdc, final: true };
    expect(() => s.model.confirmMockRefund(s.session.id, { ...receipt, final: false })).toThrow();
    expect(() => s.model.confirmMockRefund(s.session.id, { ...receipt, microUsdc: quote.netMicroUsdc })).toThrow();
    expect(s.model.confirmMockRefund(s.session.id, receipt).status).toBe("refunded");
    expect(s.model.confirmMockRefund(s.session.id, receipt).status).toBe("refunded");
    expect(s.receive(s.event()).status).toBe("refunded");
  });
  it("refuses production, missing opt-in and runtime mode changes", () => {
    expect(() => new CardSandbox({ NODE_ENV: "production", CARD_SANDBOX_ONLY: "true" }, "x".repeat(32))).toThrow();
    expect(() => new CardSandbox({ NODE_ENV: "test" }, "x".repeat(32))).toThrow();
    const s = setup(); s.env.NODE_ENV = "production";
    expect(() => s.model.snapshot(s.session.id)).toThrow();
  });
});
