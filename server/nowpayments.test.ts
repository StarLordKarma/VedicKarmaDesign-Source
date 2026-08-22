import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildInvoicePayload, verifyNowPaymentsSignature } from "./nowpayments";
import { mapPaymentStatusToBookingStatus, shouldNotifyPayment } from "./nowpayments.webhook";
import { CHECKOUT_REDIRECT_DELAY_MS, getCheckoutButtonLabel, getCheckoutSuccessMessage } from "@shared/payment-ux";

describe("NOWPayments integration helpers", () => {
  it("builds a hosted invoice payload in USD with callback URLs", () => {
    expect(buildInvoicePayload({
      priceAmount: 35,
      orderId: "booking-42",
      orderDescription: "Vedic astrology reading + Indian numerology add-on",
      callbackUrl: "https://example.com/api/nowpayments/ipn",
      successUrl: "https://example.com/?payment=success",
      cancelUrl: "https://example.com/?payment=cancelled",
    })).toEqual({
      price_amount: 35,
      price_currency: "usd",
      order_id: "booking-42",
      order_description: "Vedic astrology reading + Indian numerology add-on",
      ipn_callback_url: "https://example.com/api/nowpayments/ipn",
      success_url: "https://example.com/?payment=success",
      cancel_url: "https://example.com/?payment=cancelled",
    });
  });

  it("uses the selected fiat currency for the hosted invoice", () => {
    expect(buildInvoicePayload({ priceAmount: 32, priceCurrency: "EUR", orderId: "booking-eur", orderDescription: "Reading", callbackUrl: "https://example.com/ipn", successUrl: "https://example.com/success", cancelUrl: "https://example.com/cancel" }).price_currency).toBe("eur");
  });

  it("accepts a valid IPN signature and rejects a tampered one", () => {
    const body = JSON.stringify({ order_id: "booking-42", payment_status: "finished" });
    const secret = process.env.NOWPAYMENTS_IPN_SECRET ?? "test-secret";
    const signature = createHmac("sha512", secret).update(body).digest("hex");
    expect(verifyNowPaymentsSignature(body, signature)).toBe(true);
    expect(verifyNowPaymentsSignature(body + "x", signature)).toBe(false);
  });

  it("maps settled statuses into an actionable booking status", () => {
    expect(mapPaymentStatusToBookingStatus("finished")).toBe("in_progress");
    expect(mapPaymentStatusToBookingStatus("waiting")).toBe("new");
    expect(mapPaymentStatusToBookingStatus("failed")).toBe("new");
    expect(shouldNotifyPayment("waiting", "finished")).toBe(true);
    expect(shouldNotifyPayment("finished", "finished")).toBe(false);
  });

  it("keeps payment UX states deterministic", () => {
    expect(getCheckoutButtonLabel(true)).toContain("Creating");
    expect(getCheckoutButtonLabel(false)).toBe("Request my reading");
    expect(getCheckoutSuccessMessage(35)).toContain("$35");
    expect(CHECKOUT_REDIRECT_DELAY_MS).toBe(1800);
  });
});
