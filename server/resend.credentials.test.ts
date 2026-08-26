import { describe, expect, it } from "vitest";

describe("Resend credentials", () => {
  const runExternalProbe = process.env.RUN_EXTERNAL_CREDENTIAL_TESTS === "true";
  it.skipIf(!runExternalProbe)("authenticates against the domains endpoint with bounded retry", async () => {
    const apiKey = process.env.RESEND_API_KEY;
    expect(apiKey, "RESEND_API_KEY must be configured").toBeTruthy();
    let response: Response | undefined;
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        response = await fetch("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${apiKey as string}` }, signal: AbortSignal.timeout(15_000) });
        if (response.ok || (response.status >= 400 && response.status < 500 && response.status !== 429)) break;
      } catch (error) { lastError = error; }
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
    if (!response) throw lastError ?? new Error("Resend credential probe did not return a response");
    expect(response.ok).toBe(true);
    expect(await response.json()).toHaveProperty("data");
  }, 60_000);
});
