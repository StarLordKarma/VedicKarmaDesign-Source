#!/usr/bin/env node
import { config } from "dotenv";
import { createServer } from "node:http";
import { createRiskPayCallbackGateway } from "../server/payments/riskpay-callback-gateway.ts";
import { assertCardSandbox } from "../server/payments/card-sandbox-config.ts";
config({ path: ".env.card-sandbox", override: true, quiet: true });
assertCardSandbox();
if (
  process.env.RISKPAY_MODE !== "fixture" ||
  process.env.RISKPAY_LIVE_ENABLED !== "false"
)
  throw Error(
    "Public test gateway requires fixture mode and disabled live payments"
  );
const origin = process.env.PUBLIC_BASE_URL;
const probe = await fetch(new URL("/api/card-options", origin), {
  redirect: "error",
  signal: AbortSignal.timeout(5000),
});
const state = await probe.json();
if (!probe.ok || state.sandbox !== true)
  throw Error("Local sandbox is not available");
const handler = createRiskPayCallbackGateway({ origin });
const server = createServer(async (req, res) => {
  const reply = await handler({
    method: req.method || "",
    url: req.url || "",
    hasBody:
      !!req.headers["transfer-encoding"] ||
      Number(req.headers["content-length"] || 0) > 0,
  });
  res.writeHead(reply.status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex, nofollow",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    ...reply.headers,
  });
  res.end(JSON.stringify(reply.body));
});
server.maxHeadersCount = 30;
server.headersTimeout = 5000;
server.requestTimeout = 15000;
server.keepAliveTimeout = 1000;
server.maxRequestsPerSocket = 10;
server.listen(4080, "127.0.0.1", () =>
  console.log("RiskPay callback-only test gateway: http://127.0.0.1:4080")
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => server.close(() => process.exit(0)));
