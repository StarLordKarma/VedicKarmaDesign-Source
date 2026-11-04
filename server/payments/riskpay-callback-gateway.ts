import { z } from "zod";
import { riskPayCallbackSchema } from "./riskpay-settlement";
const callbackKey = z.object({
  order: z.string().regex(/^[1-9]\d{0,9}$/),
  token: z.string().regex(/^[a-f0-9]{64}$/),
});
const allowedKeys = new Set([
  "order",
  "token",
  "value_coin",
  "coin",
  "txid_in",
  "txid_out",
  "address_in",
]);
export type GatewayReply = {
  status: number;
  body: Record<string, unknown>;
  headers?: Record<string, string>;
};
/** The public tunnel points at this gateway, NEVER at the application port.
 * Only callback GETs are forwarded. No cookies, auth headers or redirects.
 */
export function createRiskPayCallbackGateway(options: {
  origin: string;
  fetcher?: typeof fetch;
  now?: () => number;
  maxPerMinute?: number;
}) {
  const origin = new URL(options.origin);
  if (
    origin.protocol !== "http:" ||
    !["localhost", "127.0.0.1"].includes(origin.hostname) ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  )
    throw Error("Gateway origin must be the local sandbox root");
  const fetcher = options.fetcher || fetch,
    now = options.now || Date.now;
  let windowStart = now(),
    count = 0;
  return async (input: {
    method: string;
    url: string;
    hasBody?: boolean;
  }): Promise<GatewayReply> => {
    if (now() - windowStart >= 60000) {
      windowStart = now();
      count = 0;
    }
    if (++count > (options.maxPerMinute || 120))
      return { status: 429, body: { error: "rate_limited" } };
    if (
      input.url.length > 2048 ||
      !input.url.startsWith("/") ||
      input.url.startsWith("//") ||
      input.url.includes("#")
    )
      return { status: 400, body: { error: "invalid_request" } };
    const url = new URL(input.url, "http://gateway.invalid");
    if (!["/health", "/api/riskpay/callback"].includes(url.pathname))
      return { status: 404, body: { error: "not_found" } };
    if (input.method !== "GET")
      return {
        status: 405,
        headers: { Allow: "GET" },
        body: { error: "method_not_allowed" },
      };
    if (input.hasBody)
      return { status: 413, body: { error: "body_not_allowed" } };
    if (url.pathname === "/health")
      return url.search
        ? { status: 400, body: { error: "invalid_request" } }
        : {
            status: 200,
            body: {
              service: "riskpay-callback-sandbox",
              mode: "fixture",
              livePayments: false,
            },
          };
    const keys = Array.from(url.searchParams.keys());
    if (
      keys.some(k => !allowedKeys.has(k)) ||
      new Set(keys).size !== keys.length
    )
      return { status: 400, body: { error: "invalid_callback" } };
    const params = Object.fromEntries(url.searchParams);
    if (
      !callbackKey.safeParse(params).success ||
      !riskPayCallbackSchema.safeParse(params).success
    )
      return { status: 400, body: { error: "invalid_callback" } };
    const target = new URL("/api/riskpay/callback", origin);
    target.search = url.search;
    try {
      const response = await fetcher(target, {
        method: "GET",
        redirect: "error",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10000),
      });
      // Never pass through arbitrary upstream HTML, cookies or internal errors.
      if (response.status === 400 || response.status === 404)
        return { status: 400, body: { error: "unverified_callback" } };
      if (response.status === 429)
        return { status: 429, body: { error: "rate_limited" } };
      if (response.status !== 202)
        return { status: 502, body: { error: "sandbox_unavailable" } };
      const raw = await response.text();
      if (raw.length > 1024)
        return { status: 502, body: { error: "sandbox_unavailable" } };
      const parsed = z
        .object({ accepted: z.literal(true), paid: z.literal(false) })
        .safeParse(JSON.parse(raw));
      if (!parsed.success)
        return { status: 502, body: { error: "unexpected_sandbox_response" } };
      return {
        status: 202,
        body: { accepted: true, paid: false, mode: "fixture" },
      };
    } catch {
      return { status: 502, body: { error: "sandbox_unavailable" } };
    }
  };
}
