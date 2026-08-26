import { describe, expect, it, vi } from "vitest";
import { signNowPaymentsPayloadForTest } from "./nowpayments";
import { processSignedNowPaymentsIpn, stableStringify } from "./nowpayments.webhook";

describe("signed NOWPayments IPN processing", () => {
  it("accepts a canonical signed confirmation and forwards only verified payload data", async () => {
    const payload = { order_id: "booking-42", payment_id: 9001, payment_status: "confirmed" };
    const processNotification = vi.fn().mockResolvedValue({ notified: true, isConfirmed: true });
    const result = await processSignedNowPaymentsIpn({ body: payload, signature: signNowPaymentsPayloadForTest(stableStringify(payload)), processNotification });
    expect(result).toMatchObject({ accepted: true, status: 200, bookingId: 42 });
    expect(processNotification).toHaveBeenCalledWith({ bookingId: 42, paymentId: 9001, paymentStatus: "confirmed" });
  });

  it("rejects an invalid signature before any payment transition runs", async () => {
    const processNotification = vi.fn();
    const result = await processSignedNowPaymentsIpn({ body: { order_id: "booking-42", payment_id: 9001, payment_status: "confirmed" }, signature: "invalid", processNotification });
    expect(result).toEqual({ accepted: false, status: 401, error: "Invalid payment signature" });
    expect(processNotification).not.toHaveBeenCalled();
  });
});
