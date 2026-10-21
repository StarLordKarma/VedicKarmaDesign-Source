export const PAID_PAYMENT_STATUSES = [
  "confirmed",
  "finished",
  "paid",
  "paid_over",
  "payment_done",
] as const;

const paidStatuses = new Set<string>(PAID_PAYMENT_STATUSES);

export function isPaidPaymentStatus(status: string | null | undefined) {
  return paidStatuses.has((status || "").toLowerCase());
}
