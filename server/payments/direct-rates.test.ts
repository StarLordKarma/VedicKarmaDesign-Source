import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("DIRECT_EUR_USDT_RATE", "");
  vi.stubEnv("DIRECT_GBP_USDT_RATE", "");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("frozen fiat-to-USDT quote", () => {
  it("converts euros using the same fresh USD-based rate table", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              data: { currency: "USD", rates: { EUR: "0.8", USDT: "1" } },
            })
          )
      )
    );
    const { directQuoteRate } = await import("./direct-rates");
    expect(await directQuoteRate("EUR")).toBe(1.25);
  });
  it("fails closed if the rate service is unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 503 }))
    );
    const { directQuoteRate } = await import("./direct-rates");
    await expect(directQuoteRate("EUR")).rejects.toThrow("unavailable");
  });
  it("preserves an explicit positive merchant override", async () => {
    vi.stubEnv("DIRECT_GBP_USDT_RATE", "1.3");
    const { directQuoteRate } = await import("./direct-rates");
    expect(await directQuoteRate("GBP")).toBe(1.3);
  });
});
