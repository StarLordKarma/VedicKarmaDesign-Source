import { describe, expect, it } from "vitest";

describe("NOWPayments credentials", () => {
  it("authenticates against the NOWPayments status endpoint", async () => {
    const apiKey = process.env.NOWPAYMENTS_API_KEY;
    expect(apiKey, "NOWPAYMENTS_API_KEY must be configured").toBeTruthy();

    const response = await fetch("https://api.nowpayments.io/v1/status", {
      headers: { "x-api-key": apiKey as string },
      signal: AbortSignal.timeout(10_000),
    });

    expect(response.ok).toBe(true);
    const body = await response.json();
    expect(body).toHaveProperty("message");
  }, 20_000);
});
