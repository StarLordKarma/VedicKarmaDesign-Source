import { describe, expect, it, vi } from "vitest";
import { processPaymentNotification } from "./payment-notification";

describe("payment notification processor", () => {
  it("notifies once when payment transitions to confirmed", async () => {
    const sendNotification = vi.fn(async () => true);
    const updateStatus = vi.fn(async () => ({ previousStatus: "waiting", isConfirmed: true }));
    const enqueueJob = vi.fn(async () => ({ created: true, jobId: 42, idempotencyKey: "7:1:hash:template" }));
    const processJob = vi.fn(async () => ({ skipped: false, status: "needs_review" as const, pdfUrl: "/manus-storage/report.pdf" }));
    const result = await processPaymentNotification({ bookingId: 7, paymentId: 99, paymentStatus: "finished", updateStatus, sendNotification, enqueueJob, processJob, isAutoProcessingEnabled: vi.fn(async () => true) });
    expect(result.notified).toBe(true);
    expect(sendNotification).toHaveBeenCalledOnce();
    expect(enqueueJob).toHaveBeenCalledWith(7, "system");
    expect(processJob).toHaveBeenCalledWith({ reportJobId: 42, actorId: "system" });
  });

  it("ignores callbacks for a booking already cleaned up by a smoke test", async () => {
    const sendNotification = vi.fn(async () => true);
    const result = await processPaymentNotification({ bookingId: 77, paymentId: 99, paymentStatus: "finished", updateStatus: vi.fn(async () => ({ previousStatus: null, isConfirmed: false, missing: true })), sendNotification });
    expect(result).toEqual(expect.objectContaining({ notified: false, ignored: true, missing: true }));
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("does not notify on repeated or non-confirmed statuses", async () => {
    const sendNotification = vi.fn(async () => true);
    const enqueueJob = vi.fn(async () => ({ created: true, jobId: 42, idempotencyKey: "7:1:hash:template" }));
    const processJob = vi.fn(async () => ({ skipped: false, status: "needs_review" as const, pdfUrl: "/manus-storage/report.pdf" }));
    const repeated = await processPaymentNotification({ bookingId: 7, paymentStatus: "finished", updateStatus: vi.fn(async () => ({ previousStatus: "finished", isConfirmed: true })), sendNotification, enqueueJob, processJob, isAutoProcessingEnabled: vi.fn(async () => false) });
    const waiting = await processPaymentNotification({ bookingId: 7, paymentStatus: "waiting", updateStatus: vi.fn(async () => ({ previousStatus: "waiting", isConfirmed: false })), sendNotification, enqueueJob });
    expect(repeated.notified).toBe(false);
    expect(waiting.notified).toBe(false);
    expect(sendNotification).not.toHaveBeenCalled();
    expect(enqueueJob).toHaveBeenCalledOnce();
  });
});
