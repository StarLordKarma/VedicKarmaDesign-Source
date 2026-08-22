import { describe, expect, it } from "vitest";

describe("Resend credentials", () => {
  it("authenticates against the domains endpoint", async () => {
    const apiKey = process.env.RESEND_API_KEY;
    expect(apiKey, "RESEND_API_KEY must be configured").toBeTruthy();
    const response = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${apiKey as string}` },
      signal: AbortSignal.timeout(10_000),
    });
    expect(response.ok).toBe(true);
    expect(await response.json()).toHaveProperty("data");
  }, 20_000);
});
