import { describe, expect, it, vi } from "vitest";
import { createCheckoutForBooking } from "./payment-flow";
import { getCheckoutErrorMessage } from "@shared/booking";

describe("payment checkout failure handling", () => {
  it("marks the booking as failed when invoice creation fails", async () => {
    const markFailed = vi.fn(async () => undefined);
    const savePayment = vi.fn(async () => undefined);
    const provider = {
      id: "nowpayments" as const,
      displayName: "NOWPayments",
      webhookPath: "/api/nowpayments/ipn",
      createPayment: vi.fn(async () => { throw new Error("provider unavailable"); }),
      verifyWebhook: vi.fn(() => false),
      normalizeStatus: vi.fn(() => "failed" as const),
      isPaid: vi.fn(() => false),
    };

    await expect(createCheckoutForBooking({
      bookingId: 42,
      totalUsd: 25,
      addon: false,
      origin: "https://example.com",
      provider,
      savePayment,
      markFailed,
    })).rejects.toThrow("provider unavailable");

    expect(markFailed).toHaveBeenCalledWith(42);
    expect(savePayment).not.toHaveBeenCalled();
  });

  it("provides a safe fallback for the client error state", () => {
    expect(getCheckoutErrorMessage()).toBe("We could not create the crypto checkout. Please try again.");
    expect(getCheckoutErrorMessage("Provider unavailable")).toBe("Provider unavailable");
  });
});
