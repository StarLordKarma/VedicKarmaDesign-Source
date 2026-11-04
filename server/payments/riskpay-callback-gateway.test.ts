import { describe, expect, it, vi } from "vitest";
import { createRiskPayCallbackGateway } from "./riskpay-callback-gateway";
const query = new URLSearchParams({
  order: "7",
  token: "a".repeat(64),
  value_coin: "4.99",
  coin: "polygon_usdc",
  txid_in: "0x" + "b".repeat(64),
  txid_out: "0x" + "c".repeat(64),
  address_in: "0x" + "1".repeat(40),
});
const path = "/api/riskpay/callback?" + query;
function setup() {
  const fetcher = vi.fn(
    async () =>
      new Response(JSON.stringify({ accepted: true, paid: false }), {
        status: 202,
        headers: { "Set-Cookie": "must-not-be-public=secret" },
      })
  );
  const route = createRiskPayCallbackGateway({
    origin: "http://127.0.0.1:3000",
    fetcher,
  });
  return { route, fetcher };
}
describe("callback-only public gateway", () => {
  it("exposes only a minimal health response", async () => {
    const s = setup();
    expect(await s.route({ method: "GET", url: "/health" })).toEqual({
      status: 200,
      body: {
        service: "riskpay-callback-sandbox",
        mode: "fixture",
        livePayments: false,
      },
    });
    expect(s.fetcher).not.toHaveBeenCalled();
  });
  it.each([
    "/",
    "/admin",
    "/api/auth/login?token=secret",
    "/api/trpc/booking.submit",
    "/readings/app.mjs",
    "/.env",
    "/sandbox/card/7.fake",
    "/api/card-sandbox/7.fake",
    "/api/riskpay/callback/",
    "/api/riskpay%2Fcallback",
  ])("does not publish %s", async url => {
    const s = setup();
    expect((await s.route({ method: "GET", url })).status).toBe(404);
    expect(s.fetcher).not.toHaveBeenCalled();
  });
  it("forwards a validated callback to one fixed local path without auth headers or redirects", async () => {
    const s = setup();
    expect(await s.route({ method: "GET", url: path })).toEqual({
      status: 202,
      body: { accepted: true, paid: false, mode: "fixture" },
    });
    const [url, options] = s.fetcher.mock.calls[0];
    expect(String(url)).toBe("http://127.0.0.1:3000" + path);
    expect(options).toMatchObject({
      method: "GET",
      redirect: "error",
      headers: { Accept: "application/json" },
    });
  });
  it.each(["POST", "PUT", "DELETE", "OPTIONS", "HEAD"])(
    "does not forward %s requests",
    async method => {
      const s = setup();
      expect((await s.route({ method, url: path })).status).toBe(405);
      expect(s.fetcher).not.toHaveBeenCalled();
    }
  );
  it.each([
    "/api/riskpay/callback",
    path + "&token=" + "d".repeat(64),
    path + "&url=https://evil.test",
    path.replace("polygon_usdc", "polygon_usdt"),
    path.replace("order=7", "order=-1"),
    path.replace("value_coin=4.99", "value_coin=-1"),
  ])("rejects malformed callback %s", async url => {
    const s = setup();
    expect((await s.route({ method: "GET", url })).status).toBe(400);
    expect(s.fetcher).not.toHaveBeenCalled();
  });
  it("rejects bodies, absolute targets and overlong URLs", async () => {
    const s = setup();
    expect(
      (await s.route({ method: "GET", url: path, hasBody: true })).status
    ).toBe(413);
    for (const url of [
      "https://evil.test" + path,
      "//evil.test" + path,
      path + "a".repeat(2048),
    ])
      expect((await s.route({ method: "GET", url })).status).toBe(400);
    expect(s.fetcher).not.toHaveBeenCalled();
  });
  it("does not pass through upstream secrets or a paid acknowledgement", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ accepted: true, paid: true, secret: "not-public" }),
          { status: 202 }
        )
    );
    const route = createRiskPayCallbackGateway({
      origin: "http://127.0.0.1:3000",
      fetcher,
    });
    const result = await route({ method: "GET", url: path });
    expect(result.status).toBe(502);
    expect(JSON.stringify(result)).not.toContain("not-public");
  });
  it("keeps upstream failures generic", async () => {
    const route = createRiskPayCallbackGateway({
      origin: "http://127.0.0.1:3000",
      fetcher: async () => {
        throw Error("private database password");
      },
    });
    expect(await route({ method: "GET", url: path })).toEqual({
      status: 502,
      body: { error: "sandbox_unavailable" },
    });
  });
  it("rate limits without allocating unbounded visitor state", async () => {
    let time = 0;
    const route = createRiskPayCallbackGateway({
      origin: "http://127.0.0.1:3000",
      now: () => time,
      maxPerMinute: 2,
    });
    await route({ method: "GET", url: "/health" });
    await route({ method: "GET", url: "/health" });
    expect((await route({ method: "GET", url: "/health" })).status).toBe(429);
    time = 60000;
    expect((await route({ method: "GET", url: "/health" })).status).toBe(200);
  });
  it.each([
    "https://production.example.com",
    "http://remote.test",
    "http://127.0.0.1:3000/admin",
    "http://user:secret@127.0.0.1:3000",
  ])("refuses origin %s", origin =>
    expect(() => createRiskPayCallbackGateway({ origin })).toThrow(
      "local sandbox"
    )
  );
});
