import { describe, expect, it } from "vitest";
import { normalizeReceiptEmail } from "./db";

describe("SLA email allowlist helpers", () => {
  it("normalizes recipient emails before allowlist checks", () => {
    expect(normalizeReceiptEmail("  Owner@Example.COM ")).toBe("owner@example.com");
  });
});
