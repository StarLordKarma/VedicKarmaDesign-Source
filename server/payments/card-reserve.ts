type Funds = {
  bookingId: number;
  receivedMicroUsdc: string;
  refundedMicroUsdc: string;
  committedRefundMicroUsdc: string;
  receivedAt?: number;
  hold?: boolean;
};
export const CARD_RESERVE_DAYS = 14;
export const CARD_RESERVE_HOLD_MS = CARD_RESERVE_DAYS * 24 * 60 * 60 * 1000;
const units = (value: string) => {
  if (!/^(0|[1-9]\d{0,17})$/.test(value)) throw Error("Invalid reserve amount");
  return BigInt(value);
};
/** Internal fixture accounting, not the wallet balance. Each order retains its
 * remaining net for 14 days; unresolved orders and undated legacy receipts stay held. */
export function summarizeCardFunds(rows: Funds[], now = Date.now()) {
  if (!Number.isSafeInteger(now) || now <= 0)
    throw Error("Invalid reserve clock");
  const seen = new Set<number>();
  let received = BigInt(0),
    refunded = BigInt(0),
    committed = BigInt(0),
    required = BigInt(0);
  let undatedReceiptCount = 0;
  for (const row of rows) {
    if (
      !Number.isSafeInteger(row.bookingId) ||
      row.bookingId <= 0 ||
      seen.has(row.bookingId)
    )
      throw Error("Each reserve contribution needs a unique booking");
    seen.add(row.bookingId);
    const incoming = units(row.receivedMicroUsdc),
      outgoing = units(row.refundedMicroUsdc),
      pending = units(row.committedRefundMicroUsdc);
    received += incoming;
    refunded += outgoing;
    committed += pending;
    const remainder = incoming > outgoing ? incoming - outgoing : BigInt(0);
    const dated =
      Number.isSafeInteger(row.receivedAt) &&
      row.receivedAt! > 0 &&
      row.receivedAt! <= now;
    if (!dated) undatedReceiptCount++;
    if (
      !dated ||
      now < row.receivedAt! + CARD_RESERVE_HOLD_MS ||
      row.hold ||
      pending > BigInt(0)
    )
      required += remainder > pending ? remainder : pending;
  }
  const balance = received - refunded;
  const remaining = balance > BigInt(0) ? balance : BigInt(0);
  const shortfall = required - balance;
  const reserved = required < remaining ? required : remaining;
  return {
    policy: "per_order_net_14_days" as const,
    holdDays: CARD_RESERVE_DAYS,
    undatedReceiptCount,
    receivedMicroUsdc: received.toString(),
    refundedMicroUsdc: refunded.toString(),
    committedRefundMicroUsdc: committed.toString(),
    unallocatedMicroUsdc: remaining.toString(),
    reservedMicroUsdc: reserved.toString(),
    distributableMicroUsdc: (remaining - reserved).toString(),
    shortfallMicroUsdc: shortfall > BigInt(0) ? shortfall.toString() : "0",
  };
}
export function formatMicroUsdc(value: string) {
  const n = units(value);
  return `${n / BigInt(1000000)}.${(n % BigInt(1000000)).toString().padStart(6, "0")} USDC`;
}
