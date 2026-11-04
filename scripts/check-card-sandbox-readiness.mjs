import { config } from "dotenv";
import { stat, writeFile } from "node:fs/promises";
import {
  assertCardSandbox,
  sandboxCardCallbackBase,
} from "../server/payments/card-sandbox-config.ts";
import { CARD_RESERVE_DAYS } from "../server/payments/card-reserve.ts";
config({ path: ".env.card-sandbox", override: true, quiet: true });
assertCardSandbox();
const checks = [];
async function check(name, action) {
  try {
    checks.push({ name, ok: !!(await action()) });
  } catch {
    checks.push({ name, ok: false });
  }
}
await check(
  "fixture_mode",
  () =>
    process.env.RISKPAY_MODE === "fixture" &&
    process.env.RISKPAY_LIVE_ENABLED === "false"
);
await check(
  "no_live_merchant_wallet",
  () => !process.env.RISKPAY_MERCHANT_WALLET
);
await check("built_application", async () => !!(await stat("dist/index.js")));
await check("local_card_checkout", async () => {
  const response = await fetch(
    new URL("/api/card-options", process.env.PUBLIC_BASE_URL),
    { redirect: "error", signal: AbortSignal.timeout(5000) }
  );
  const body = await response.json();
  return response.ok && body.sandbox === true && body.card === true;
});
const callbackBase = sandboxCardCallbackBase();
let publicCallback = "local_only";
if (callbackBase !== new URL(process.env.PUBLIC_BASE_URL).origin) {
  try {
    const response = await fetch(new URL("/health", callbackBase), {
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
    const health = await response.json();
    publicCallback =
      response.ok &&
      health.mode === "fixture" &&
      health.livePayments === false &&
      health.expiresAt > Date.now()
        ? "test_receiver_available"
        : "test_receiver_unavailable";
  } catch {
    publicCallback = "test_receiver_unavailable";
  }
}
const result = {
  checkedAt: new Date().toISOString(),
  sandboxReady: checks.every(c => c.ok),
  livePaymentsReady: false,
  checks,
  publicCallback,
  reserve: {
    source: "verified_net_receipts",
    holdDays: CARD_RESERVE_DAYS,
    openRefundsRemainHeld: true,
  },
  liveBlockers: [
    "authoritative_per_order_gross_incoming_net_quote",
    "confirmed_token_contract_and_provider_route",
    "provider_approval_of_product_countries_and_refund_terms",
    "live_refund_quote_and_atomic_proof_integration",
    "permanent_callback_delivery_monitoring_and_live_acceptance_test",
  ],
};
await writeFile(
  "artifacts/card-sandbox-readiness-2026-11-03.json",
  JSON.stringify(result, null, 2) + "\n"
);
console.log(JSON.stringify(result, null, 2));
if (!result.sandboxReady) process.exitCode = 1;
