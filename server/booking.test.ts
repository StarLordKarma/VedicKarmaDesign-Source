import { describe, expect, it } from "vitest";
import { applyPromoDiscount, bookingSchema, buildBookingPriceSnapshot, getBookingTotal, isProductionSmokeTestBooking, validatePromoCode } from "@shared/booking";

describe("booking validation", () => {
  const validBooking = {
    name: "Maya",
    email: "maya@example.com",
    birthDate: "1990-04-12",
    birthTime: "08:30",
    birthCity: "Berlin",
    birthCountry: "Germany",
    language: "English" as const,
    addon: false,
    interest: "Career themes",
  };

  it("accepts a complete booking request", () => {
    expect(bookingSchema.safeParse(validBooking).success).toBe(true);
  });

  it("rejects missing birth details and invalid email", () => {
    const result = bookingSchema.safeParse({
      ...validBooking,
      email: "not-an-email",
      birthTime: "",
      birthCity: "",
    });
    expect(result.success).toBe(false);
  });

  it("defaults missing currency to USD and rejects unsupported currencies", () => {
    expect(bookingSchema.parse(validBooking).currency).toBe("USD");
    expect(bookingSchema.safeParse({ ...validBooking, currency: "JPY" }).success).toBe(false);
  });

  it("creates immutable package snapshots with deterministic totals", () => {
    expect(buildBookingPriceSnapshot({ addon: false, currency: "USD", basicAmount: 25, addonAmount: 10 })).toEqual({ packageCode: "basic", packageVersion: 1, currency: "USD", basicAmount: 25, addonAmount: 0, totalAmount: 25 });
    expect(buildBookingPriceSnapshot({ addon: true, currency: "EUR", basicAmount: 23, addonAmount: 9 })).toEqual({ packageCode: "basic_plus", packageVersion: 1, currency: "EUR", basicAmount: 23, addonAmount: 9, totalAmount: 32 });
  });

  it("validates supported promo codes and applies deterministic discounts", () => {
    expect(validatePromoCode(" welcome10 ")).toEqual({ valid: true, code: "WELCOME10", discountPercent: 10 });
    expect(validatePromoCode("invalid").valid).toBe(false);
    expect(applyPromoDiscount(35, "WELCOME10")).toEqual({ valid: true, code: "WELCOME10", discountPercent: 10, discountAmount: 3.5, totalAmount: 31.5 });
    expect(applyPromoDiscount(35, "invalid").totalAmount).toBe(35);
  });

  it("recognizes only explicitly marked production smoke-test bookings for cleanup", () => {
    expect(isProductionSmokeTestBooking({ email: "production-smoke-1234567890@example.com", interest: "Automated production checkout verification", smokeTest: true, smokeTestRunId: "production-smoke-1234567890" })).toBe(true);
    expect(isProductionSmokeTestBooking({ email: "client@example.com", interest: "Automated production checkout verification", smokeTest: true, smokeTestRunId: "production-smoke-1234567890" })).toBe(false);
    expect(isProductionSmokeTestBooking({ email: "production-smoke-1234567890@example.com", interest: "Career themes", smokeTest: true, smokeTestRunId: "production-smoke-1234567890" })).toBe(false);
    expect(isProductionSmokeTestBooking({ email: "production-smoke-1234567890@example.com", interest: "Automated production checkout verification", smokeTest: false, smokeTestRunId: "production-smoke-1234567890" })).toBe(false);
  });

  it("calculates Basic and Add-on totals", () => {
    expect(getBookingTotal(false)).toBe(25);
    expect(getBookingTotal(true)).toBe(35);
  });
});
