/** Autonomous model, NOT a RiskPay protocol or a production payment provider.
 * No network, DB, wallet, email or report-generation calls are made here.
 * In-memory state intentionally cannot authorize an actual booking.
 */
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const eventSchema = z.object({
  eventId: z.string().uuid(),
  sessionId: z.string().uuid(),
  bookingId: z.number().int().positive(),
  grossCents: z.number().int().positive().safe(),
  currency: z.literal("USD"),
  status: z.enum(["processing", "settled", "failed", "expired", "disputed"]),
}).strict();
export type MockCardEvent = z.infer<typeof eventSchema>;
type Settlement = {
  sessionId: string;
  transferId: string;
  netMicroUsdc: string;
  network: "mock-polygon";
  token: "mock-usdc";
  recipient: "mock-merchant";
  final: boolean;
};
type Session = {
  id: string;
  bookingId: number;
  brand: "visa" | "mastercard";
  grossCents: number;
  netMicroUsdc: string;
  expiresAt: number;
  status: "pending" | "processing" | "review" | "paid" | "failed" | "expired" | "disputed" | "refund_pending" | "refunded";
  fulfillment: "none" | "queued" | "held";
  refund?: { recipient: string; microUsdc: string; reference?: string };
};

export class CardSandbox {
  private sessions = new Map<string, Session>();
  private bookings = new Map<number, string>();
  private events = new Map<string, string>();
  private settlements = new Map<string, Settlement>();
  private claims = new Map<string, string>();
  private refundClaims = new Map<string, string>();
  private history: Array<{ sessionId: string; event: string }> = [];

  constructor(private env: NodeJS.ProcessEnv, private secret: string) {
    this.guard();
    if (secret.length < 32) throw Error("Use a dedicated mock secret of at least 32 characters");
  }

  private guard() {
    if (!["development", "test"].includes(this.env.NODE_ENV || "") || this.env.CARD_SANDBOX_ONLY !== "true")
      throw Error("Card model requires explicit local sandbox mode");
  }

  private row(id: string) {
    this.guard();
    const row = this.sessions.get(id);
    if (!row) throw Error("Unknown mock session");
    return row;
  }

  create(input: { bookingId: number; grossCents: number; netMicroUsdc: string; brand: "visa" | "mastercard" }, now = Date.now()) {
    this.guard();
    if (!Number.isSafeInteger(input.bookingId) || input.bookingId <= 0 ||
        !Number.isSafeInteger(input.grossCents) || input.grossCents <= 0 ||
        !/^[1-9]\d{0,17}$/.test(input.netMicroUsdc) ||
        BigInt(input.netMicroUsdc) > BigInt(input.grossCents) * BigInt(10000) ||
        !["visa", "mastercard"].includes(input.brand)) throw Error("Invalid mock quote");
    const existing = this.bookings.get(input.bookingId);
    if (existing) {
      const row = this.row(existing);
      if (row.grossCents !== input.grossCents || row.netMicroUsdc !== input.netMicroUsdc || row.brand !== input.brand)
        throw Error("Booking already has a different frozen quote");
      return structuredClone(row);
    }
    const row: Session = { ...input, id: randomUUID(), expiresAt: now + 1800000, status: "pending", fulfillment: "none" };
    this.sessions.set(row.id, row);
    this.bookings.set(row.bookingId, row.id);
    this.history.push({ sessionId: row.id, event: "session_created" });
    return structuredClone(row);
  }

  snapshot(id: string) { return structuredClone(this.row(id)); }
  audit() { this.guard(); return structuredClone(this.history); }

  // Test driver records an independent mock ledger receipt. A webhook cannot
  // manufacture this proof. All identifiers are synthetic, never mainnet hashes.
  recordMockSettlement(receipt: Settlement) {
    this.row(receipt.sessionId);
    if (!/^[1-9]\d{0,17}$/.test(receipt.netMicroUsdc) || !/^mock-transfer-[a-z0-9-]+$/.test(receipt.transferId))
      throw Error("Invalid mock ledger receipt");
    const old = this.settlements.get(receipt.sessionId);
    if (old && old.transferId !== receipt.transferId) throw Error("Investigate multiple mock receipts");
    this.settlements.set(receipt.sessionId, structuredClone(receipt));
  }

  sign(event: MockCardEvent) {
    this.guard();
    const raw = JSON.stringify(eventSchema.parse(event));
    return { raw, signature: this.mac(raw) };
  }

  private mac(raw: string) { return createHmac("sha256", this.secret).update(raw).digest("hex"); }

  receive(raw: string, signature: string, now = Date.now()) {
    this.guard();
    if (Buffer.byteLength(raw) > 4096 || !/^[a-f0-9]{64}$/.test(signature) ||
        !timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(this.mac(raw), "hex")))
      throw Error("Invalid mock signature");
    const event = eventSchema.parse(JSON.parse(raw));
    const row = this.row(event.sessionId);
    if (event.bookingId !== row.bookingId || event.grossCents !== row.grossCents)
      throw Error("Mock payment does not match order");
    const previous = this.events.get(event.eventId);
    if (previous && previous !== raw) throw Error("Mock event ID reused with different payload");
    this.events.set(event.eventId, raw);
    // Recheck duplicates: ledger proof may have arrived after the first callback.
    if (["refund_pending", "refunded"].includes(row.status)) return this.snapshot(row.id);
    if (event.status === "disputed") {
      row.status = "disputed";
      row.fulfillment = "held";
    } else if (row.status === "disputed") {
      // Only manual resolution can release a dispute hold.
    } else if (event.status === "settled") {
      const receipt = this.settlements.get(row.id);
      const valid = receipt?.final && receipt.netMicroUsdc === row.netMicroUsdc &&
        receipt.network === "mock-polygon" && receipt.token === "mock-usdc" && receipt.recipient === "mock-merchant";
      if (!valid || (now >= row.expiresAt && row.status !== "paid")) {
        if (row.status !== "paid") row.status = "review";
      } else {
        const owner = this.claims.get(receipt.transferId);
        if (owner && owner !== row.id) throw Error("Mock transfer already belongs to another order");
        this.claims.set(receipt.transferId, row.id);
        row.status = "paid";
        if (row.fulfillment === "none") row.fulfillment = "queued";
      }
    } else if (row.status !== "paid" && row.status !== "review") row.status = event.status;
    if (!previous) this.history.push({ sessionId: row.id, event: event.status });
    return this.snapshot(row.id);
  }

  // Approval represents the owner's decision, not an automatic policy of
  // crypto-only refunds. Full refund uses gross USD value, never net proceeds.
  approveMockCryptoRefund(id: string, input: {
    explicitConsent: boolean;
    processorAllows: boolean;
    recipient: string;
    quotedMicroUsdc: string;
    customerFeeCents: number;
  }) {
    const row = this.row(id);
    if (row.status !== "paid") throw Error("Only undisputed paid orders can enter mock refund");
    if (!input.explicitConsent || !input.processorAllows || input.customerFeeCents !== 0 ||
        !/^mock-buyer-[a-z0-9-]+$/.test(input.recipient) || !/^[1-9]\d{0,17}$/.test(input.quotedMicroUsdc))
      throw Error("Alternative refund needs consent, processor permission, quote and no customer fee");
    row.refund = { recipient: input.recipient, microUsdc: input.quotedMicroUsdc };
    row.status = "refund_pending";
    row.fulfillment = "held";
    this.history.push({ sessionId: id, event: "refund_approved" });
    // A quote must be obtained for grossCents. No 1 USD = 1 USDC assumption.
    return { grossCents: row.grossCents, currency: "USD" as const, ...row.refund };
  }

  confirmMockRefund(id: string, input: { reference: string; recipient: string; microUsdc: string; final: boolean }) {
    const row = this.row(id);
    if (row.status === "refunded" && row.refund?.reference === input.reference) return this.snapshot(id);
    if (row.status !== "refund_pending" || !row.refund || !input.final ||
        !/^mock-refund-[a-z0-9-]+$/.test(input.reference) ||
        input.recipient !== row.refund.recipient || input.microUsdc !== row.refund.microUsdc)
      throw Error("Mock refund is not independently confirmed");
    const owner = this.refundClaims.get(input.reference);
    if (owner && owner !== id) throw Error("Mock refund already belongs to another order");
    this.refundClaims.set(input.reference, id);
    row.refund.reference = input.reference;
    row.status = "refunded";
    this.history.push({ sessionId: id, event: "refund_confirmed" });
    return this.snapshot(id);
  }
}
