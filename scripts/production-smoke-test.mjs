#!/usr/bin/env node

const baseUrl = (process.env.PRODUCTION_SMOKE_BASE_URL || "").replace(/\/$/, "");
const smokeSecret = process.env.PRODUCTION_SMOKE_SECRET || "";
if (process.env.PRODUCTION_SMOKE_RUN !== "1") {
  console.error("Refusing to run production smoke test. Set PRODUCTION_SMOKE_RUN=1 explicitly.");
  process.exit(2);
}
if (!baseUrl) {
  console.error("Set PRODUCTION_SMOKE_BASE_URL to the deployed site URL.");
  process.exit(2);
}
if (!smokeSecret) {
  console.error("Set PRODUCTION_SMOKE_SECRET to the server-configured smoke-test secret.");
  process.exit(2);
}

async function rpcGet(path, input) {
  const url = `${baseUrl}/api/trpc/${path}?input=${encodeURIComponent(JSON.stringify({ json: input }))}`;
  const response = await fetch(url, { headers: { accept: "application/json" } });
  const body = await response.json();
  if (!response.ok || body?.error) throw new Error(`${path} failed (${response.status}): ${body?.error?.json?.message || response.statusText}`);
  return body?.result?.data?.json ?? body?.result?.data;
}

async function rpcPost(path, input) {
  const response = await fetch(`${baseUrl}/api/trpc/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json", "x-production-smoke-secret": smokeSecret },
    body: JSON.stringify({ json: input }),
  });
  const body = await response.json();
  if (!response.ok || body?.error) throw new Error(`${path} failed (${response.status}): ${body?.error?.json?.message || response.statusText}`);
  return body?.result?.data?.json ?? body?.result?.data;
}

const startedAt = Date.now();
const runId = `production-smoke-${startedAt}`;
try {
  const currencies = ["EUR", "GBP"];
  const pricingByCurrency = {};
  for (const currency of currencies) {
    const pricing = await rpcGet("pricing.current", { currency });
    if (!pricing || (pricing.currency && pricing.currency !== currency)) throw new Error(`Expected a valid ${currency} pricing response.`);
    if (!Number.isFinite(pricing.basicUsd) || !Number.isFinite(pricing.numerologyAddonUsd)) throw new Error(`${currency} pricing response did not contain numeric amounts.`);
    pricingByCurrency[currency] = { ...pricing, currency };
  }

  const checkout = await rpcPost("booking.submit", {
    name: `Production smoke test ${startedAt}`,
    email: `${runId}@example.com`,
    birthDate: "1990-04-12",
    birthTime: "08:30",
    birthCity: "Berlin",
    birthCountry: "Germany",
    language: "English",
    addon: false,
    interest: "Automated production checkout verification",
    currency: "EUR",
    smokeTest: true,
    smokeTestRunId: runId,
  });
  if (!checkout?.invoiceUrl || !checkout?.paymentId) throw new Error("Checkout response did not contain invoiceUrl and paymentId.");
  if (checkout.smokeTestCleanup !== "completed") throw new Error("Production smoke-test booking was not cleaned up automatically.");

  const result = { ok: true, pricingCurrencies: currencies, checkoutCurrency: "EUR", bookingId: checkout.id, paymentId: checkout.paymentId, invoiceUrl: checkout.invoiceUrl, pricingByCurrency };
  console.log(JSON.stringify({ ...result, runId }, null, 2));
} catch (error) {
  const result = { ok: false, error: error instanceof Error ? error.message : String(error) };
  throw error;
}
