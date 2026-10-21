import { describe, expect, it } from "vitest";
import { resolvePaymentProviderId } from "./provider";
import { normalizeNowPaymentsStatus, nowPaymentsProvider } from "./nowpayments-provider";

describe("payment provider contract", () => {
  it("keeps the deployed provider as the explicit default", () => {
    expect(resolvePaymentProviderId({})).toBe("nowpayments");
    expect(resolvePaymentProviderId({ PAYMENT_PROVIDER: "NOWPAYMENTS" })).toBe("nowpayments");
    expect(resolvePaymentProviderId({ PAYMENT_PROVIDER: "heleket" })).toBe("heleket");
    expect(resolvePaymentProviderId({ PAYMENT_PROVIDER: "paycrypto" })).toBe("paycrypto");
    expect(() => resolvePaymentProviderId({ PAYMENT_PROVIDER: "mock" })).toThrow("Unsupported PAYMENT_PROVIDER");
  });

  it("normalizes provider statuses without treating underpayment as paid", () => {
    expect(normalizeNowPaymentsStatus("waiting")).toBe("pending");
    expect(normalizeNowPaymentsStatus("confirmed")).toBe("paid");
    expect(normalizeNowPaymentsStatus("finished")).toBe("paid");
    expect(normalizeNowPaymentsStatus("partially_paid")).toBe("underpaid");
    expect(normalizeNowPaymentsStatus("overpaid")).toBe("overpaid");
    expect(normalizeNowPaymentsStatus("expired")).toBe("expired");
    expect(normalizeNowPaymentsStatus("refunded")).toBe("refunded");
    expect(nowPaymentsProvider.isPaid("partially_paid")).toBe(false);
  });
});
