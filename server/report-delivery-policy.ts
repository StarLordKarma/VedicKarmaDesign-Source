// Stop before the provider's 24-hour idempotency retention expires.
export function assertDeliveryRetryWindow(requestedAt: Date, now = Date.now()) {
  if (now - requestedAt.getTime() >= 23 * 60 * 60 * 1000)
    throw new Error(
      "Delivery retry window expired. Check the provider delivery log before sending again."
    );
}

export function isDeliveryLeaseExpired(
  attempt: { startedAt: Date | null; requestedAt: Date },
  now = Date.now()
) {
  return now - (attempt.startedAt ?? attempt.requestedAt).getTime() > 300000;
}
