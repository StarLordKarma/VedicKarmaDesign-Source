import { describe, expect, it, vi } from "vitest";
import { processPaymentNotification } from "./payment-notification";

describe("payment notification processor", () => {
  it("notifies once when payment transitions to confirmed", async () => {
    const sendNotification = vi.fn(async () => true);
    const updateStatus = vi.fn(async () => ({ previousStatus: "waiting", isConfirmed: true }));
    const result = await processPaymentNotification({ bookingId: 7, paymentId: 99, paymentStatus: "finished", updateStatus, sendNotification });
    expect(result.notified).toBe(true);
    expect(sendNotification).toHaveBeenCalledOnce();
  });

  it("ignores callbacks for a booking already cleaned up by a smoke test", async () => {
    const sendNotification = vi.fn(async () => true);
    const result = await processPaymentNotification({ bookingId: 77, paymentId: 99, paymentStatus: "finished", updateStatus: vi.fn(async () => ({ previousStatus: null, isConfirmed: false, missing: true })), sendNotification });
    expect(result).toEqual(expect.objectContaining({ notified: false, ignored: true, missing: true }));
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("does not notify on repeated or non-confirmed statuses", async () => {
    const sendNotification = vi.fn(async () => true);
    const repeated = await processPaymentNotification({ bookingId: 7, paymentStatus: "finished", updateStatus: vi.fn(async () => ({ previousStatus: "finished", isConfirmed: true })), sendNotification });
    const waiting = await processPaymentNotification({ bookingId: 7, paymentStatus: "waiting", updateStatus: vi.fn(async () => ({ previousStatus: "waiting", isConfirmed: false })), sendNotification });
    expect(repeated.notified).toBe(false);
    expect(waiting.notified).toBe(false);
    expect(sendNotification).not.toHaveBeenCalled();
  });
});
