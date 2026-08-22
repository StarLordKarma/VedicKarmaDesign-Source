import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  createBookingRequest: vi.fn(),
  createSmokeTestRun: vi.fn(),
  deleteBookingRequest: vi.fn(),
  finishSmokeTestRun: vi.fn(),
  getServicePricing: vi.fn(),
  updateBookingPayment: vi.fn(),
  updateSmokeTestRunProgress: vi.fn(),
}));
const paymentMocks = vi.hoisted(() => ({ createCheckoutForBooking: vi.fn() }));

vi.mock("./db", () => dbMocks);
vi.mock("./payment-flow", () => paymentMocks);

import { runManualSmokeTest } from "./manual-smoke-test";

describe("manual smoke-test orchestration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.getServicePricing.mockImplementation(async (currency: string) => ({ currency, basicUsd: 25, numerologyAddonUsd: 10 }));
    dbMocks.createBookingRequest.mockResolvedValue({ id: 321 });
    paymentMocks.createCheckoutForBooking.mockResolvedValue({ id: "payment-321", invoice_url: "https://nowpayments.io/payment/?iid=321" });
  });

  it("records progress, creates an EUR checkout, and cleans up a successful run", async () => {
    const result = await runManualSmokeTest("https://example.com");
    expect(result).toEqual(expect.objectContaining({ ok: true, checkoutCurrency: "EUR", bookingId: 321, cleanup: "completed" }));
    expect(dbMocks.createSmokeTestRun).toHaveBeenCalledWith(expect.stringMatching(/^manual-smoke-/));
    expect(dbMocks.updateSmokeTestRunProgress).toHaveBeenCalledTimes(5);
    expect(paymentMocks.createCheckoutForBooking).toHaveBeenCalledWith(expect.objectContaining({ bookingId: 321, priceCurrency: "EUR", origin: "https://example.com" }));
    expect(dbMocks.deleteBookingRequest).toHaveBeenCalledWith(321);
    expect(dbMocks.finishSmokeTestRun).toHaveBeenCalledWith(expect.objectContaining({ status: "succeeded", durationMs: expect.any(Number), result: expect.stringContaining("cleanup") }));
  });

  it("cleans up the marked booking and records a failed run when checkout creation fails", async () => {
    paymentMocks.createCheckoutForBooking.mockRejectedValue(new Error("provider unavailable"));
    await expect(runManualSmokeTest("https://example.com")).rejects.toThrow("provider unavailable");
    expect(dbMocks.deleteBookingRequest).toHaveBeenCalledWith(321);
    expect(dbMocks.finishSmokeTestRun).toHaveBeenCalledWith(expect.objectContaining({ status: "failed", result: expect.stringContaining("provider unavailable") }));
  });
});
