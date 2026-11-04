#!/usr/bin/env node
import { config } from "dotenv";
import { strict as assert } from "node:assert";
import { writeFile } from "node:fs/promises";
import mysql from "mysql2/promise";
import { assertCardSandbox } from "../server/payments/card-sandbox-config.ts";
import { syncRelay } from "./riskpay-relay-local.mjs";
config({ path: ".env.card-sandbox", override: true, quiet: true });
assertCardSandbox();
assert.equal(process.env.RISKPAY_MODE, "fixture");
assert.equal(process.env.RISKPAY_LIVE_ENABLED, "false");
const publicBase = new URL(process.argv[2] || "");
assert.equal(publicBase.protocol, "https:");
assert.match(
  publicBase.hostname,
  /^[a-z0-9-]+\.(lhr\.life|trycloudflare\.com|netlify\.app)$/
);
assert.equal(publicBase.pathname, "/");
assert.equal(publicBase.search, "");
assert.equal(publicBase.hash, "");
const checks = [];
async function get(path, expected) {
  const r = await fetch(new URL(path, publicBase), {
    redirect: "error",
    signal: AbortSignal.timeout(20000),
  });
  assert.equal(
    r.status,
    expected,
    `Public boundary status ${path.split("?")[0]}`
  );
  assert.match(r.headers.get("content-type") || "", /application\/json/);
  return r.json();
}
const health = await get("/health", 200);
assert.equal(health.mode, "fixture");
assert.equal(health.livePayments, false);
checks.push("public_https_health");
for (const path of [
  "/",
  "/admin",
  "/api/auth/login?token=not-a-real-token",
  "/api/trpc/booking.submit",
  "/readings/app.mjs",
  "/.env",
  "/sandbox/card/7.fake",
  "/api/card-sandbox/7.fake",
]) {
  assert.equal((await get(path, 404)).error, "not_found");
  checks.push("blocked:" + path.split("?")[0]);
}
assert.equal(
  (await get("/api/riskpay/callback", 400)).error,
  "invalid_callback"
);
checks.push("unsigned_callback_rejected");
const create = await fetch(
  new URL("/api/trpc/booking.submit", process.env.PUBLIC_BASE_URL),
  {
    method: "POST",
    redirect: "error",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      json: {
        name: "Public Callback Sandbox",
        email: "callback-" + crypto.randomUUID() + "@sandbox.invalid",
        language: "English",
        product: "tarot",
        addon: false,
        currency: "USD",
        privacyAcknowledged: true,
        privacyNoticeVersion: "privacy-2026-10-21",
        privacyLocale: "en",
        paymentMethod: "google_pay",
        cardRefundConsent: true,
        cardTermsVersion: "card-manual-refund-2026-11-03",
      },
    }),
    signal: AbortSignal.timeout(15000),
  }
);
assert.equal(create.status, 200);
const order = (await create.json()).result?.data?.json;
assert.ok(order?.id);
const privateToken = order.invoiceUrl.split("/").at(-1),
  [id, capability] = privateToken.split(".");
const db = await mysql.createConnection(process.env.DATABASE_URL);
let assigned;
try {
  const [rows] = await db.execute(
    "SELECT priceSnapshotJson FROM booking_requests WHERE id=?",
    [order.id]
  );
  const card = JSON.parse(rows[0].priceSnapshotJson).cardSandbox;
  assert.equal(card.riskpay.mode, "fixture");
  assert.equal(new URL(card.riskpay.callbackUrl).origin, publicBase.origin);
  checks.push("new_order_bound_to_public_callback");
  assigned = card.riskpay.wallet.assignedAddress;
} finally {
  await db.end();
}
const params = new URLSearchParams({
  order: id,
  token: capability,
  value_coin: "4.99",
  coin: "polygon_usdc",
  txid_in: "0x" + "b".repeat(64),
  txid_out: "0x" + "c".repeat(64),
  address_in: assigned,
});
if (health.queued) {
  await syncRelay(publicBase.href);
  checks.push("signed_order_registration");
  for (const path of [
    "/internal/register",
    "/internal/events",
    "/internal/ack",
  ]) {
    const r = await fetch(new URL(path, publicBase), {
      method: "POST",
      body: "{}",
      redirect: "error",
      signal: AbortSignal.timeout(20000),
    });
    assert.equal(r.status, 401);
  }
  checks.push("unsigned_queue_access_rejected");
}
const ack = await get("/api/riskpay/callback?" + params, 202);
assert.deepEqual(ack, { accepted: true, paid: false, mode: "fixture" });
if (health.queued) {
  const result = await syncRelay(publicBase.href);
  assert.equal(result.delivered, 1);
  checks.push("queued_event_delivered_to_local_order");
}
checks.push("documented_mock_callback_delivered");
const status = await (
  await fetch(
    new URL("/api/card-sandbox/" + privateToken, process.env.PUBLIC_BASE_URL),
    { signal: AbortSignal.timeout(10000) }
  )
).json();
assert.equal(status.status, "review");
assert.equal(status.report, null);
checks.push("callback_did_not_issue_report");
assert.equal((await get("/api/riskpay/callback?" + params, 202)).paid, false);
if (health.queued)
  assert.equal((await syncRelay(publicBase.href)).delivered, 0);
checks.push("duplicate_still_unpaid");
if (health.queued) {
  const retry = new URLSearchParams([...params].reverse());
  retry.set("value_coin", "04.990000");
  retry.set("txid_in", "0x" + "B".repeat(64));
  assert.equal((await get("/api/riskpay/callback?" + retry, 202)).paid, false);
  assert.equal((await syncRelay(publicBase.href)).delivered, 0);
  checks.push("reordered_normalized_retry_not_redelivered");
}
params.set("token", "0".repeat(64));
assert.equal(
  (await get("/api/riskpay/callback?" + params, 400)).error,
  "unverified_callback"
);
checks.push("forged_order_capability_rejected");
const post = await fetch(new URL("/api/riskpay/callback", publicBase), {
  method: "POST",
  redirect: "error",
  signal: AbortSignal.timeout(20000),
});
assert.equal(post.status, 405);
checks.push("callback_post_rejected");
const record = {
  publicBase: publicBase.origin,
  callbackUrl: new URL("/api/riskpay/callback", publicBase).href,
  checkedAt: new Date().toISOString(),
  sandboxBookingId: order.id,
  livePayments: false,
  checks,
};
await writeFile(
  ".validation/riskpay-public-check.json",
  JSON.stringify(record, null, 2) + "\n",
  { mode: 0o600 }
);
console.log(JSON.stringify(record, null, 2));
