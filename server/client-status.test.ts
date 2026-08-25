import { describe, expect, it } from "vitest";
import { getPublicClientStatus, normalizeExpiryHours } from "./client-status";

describe("client status links", () => {
  it("accepts bounded integer expiry values", () => {
    expect(normalizeExpiryHours(1)).toBe(1);
    expect(normalizeExpiryHours(720)).toBe(720);
    expect(() => normalizeExpiryHours(0)).toThrow();
    expect(() => normalizeExpiryHours(721)).toThrow();
    expect(() => normalizeExpiryHours(1.5)).toThrow();
  });

  it("does not query or disclose data for malformed tokens", async () => {
    await expect(getPublicClientStatus("not-a-token")).resolves.toEqual({ kind: "not_found" });
  });
});
