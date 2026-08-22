import { describe, expect, it } from "vitest";
import { RECEIPT_EMAIL_COOLDOWN_MS, RECEIPT_EMAIL_FAILURE_THRESHOLD, isReceiptEmailCoolingDown, normalizeReceiptEmail, shouldCreateReceiptEmailFailureAlert } from "./db";

describe("receipt email policy", () => {
  it("normalizes recipient addresses before audit/cooldown checks", () => {
    expect(normalizeReceiptEmail("  Client@Example.COM ")).toBe("client@example.com");
  });

  it("blocks only attempts inside the short cooldown window", () => {
    const requestedAt = new Date("2026-08-22T12:00:00.000Z");
    expect(isReceiptEmailCoolingDown(requestedAt, requestedAt.getTime() + RECEIPT_EMAIL_COOLDOWN_MS - 1)).toBe(true);
    expect(isReceiptEmailCoolingDown(requestedAt, requestedAt.getTime() + RECEIPT_EMAIL_COOLDOWN_MS)).toBe(false);
    expect(isReceiptEmailCoolingDown(undefined, requestedAt.getTime())).toBe(false);
  });

  it("alerts after the threshold once, then deduplicates while an alert is recent", () => {
    expect(RECEIPT_EMAIL_FAILURE_THRESHOLD).toBe(3);
    expect(shouldCreateReceiptEmailFailureAlert(2, false)).toBe(false);
    expect(shouldCreateReceiptEmailFailureAlert(3, false)).toBe(true);
    expect(shouldCreateReceiptEmailFailureAlert(4, true)).toBe(false);
  });
});
