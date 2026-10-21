import { describe, expect, it } from "vitest";
import { formatCurrency, roundCurrencyAmount } from "./currency";
import { buildBookingPriceSnapshot } from "./booking";
import { servicePricingSchema } from "./admin";
describe("prices with cents", () => {
  it("displays both USD packages without rounding to whole dollars", () => {
    expect(formatCurrency(9.99, "USD", "en-US")).toBe("$9.99");
    expect(formatCurrency(14.99, "USD", "en-US")).toBe("$14.99");
    expect(roundCurrencyAmount(9.99, "USD")).toBe(9.99);
  });
  it("retains exact checkout totals and discounted cents", () => {
    expect(buildBookingPriceSnapshot({ addon: false, currency: "USD", basicAmount: 9.99, addonAmount: 5 }).totalAmount).toBe(9.99);
    expect(buildBookingPriceSnapshot({ addon: true, currency: "USD", basicAmount: 9.99, addonAmount: 5 }).totalAmount).toBe(14.99);
    expect(buildBookingPriceSnapshot({ addon: true, currency: "USD", basicAmount: 9.99, addonAmount: 5, promoCode: "WELCOME10" }).totalAmount).toBe(13.49);
  });
  it("accepts cents and rejects more precise admin prices", () => {
    expect(servicePricingSchema.safeParse({ basicUsd: 9.99, numerologyAddonUsd: 5 }).success).toBe(true);
    expect(servicePricingSchema.safeParse({ basicUsd: 9.999, numerologyAddonUsd: 5 }).success).toBe(false);
  });
});
