import { describe, expect, it } from "vitest";
import { bookingSchema, getBookingTotal, isProductionSmokeTestBooking } from "@shared/booking";

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
