import { afterEach, describe, expect, it, vi } from "vitest";
import { heleketProvider, normalizeHeleketStatus, signHeleketBody, verifyHeleketWebhook } from "./heleket-provider";
import { payCryptoProvider } from "./paycrypto-provider";
import { processHeleketWebhook } from "./heleket-webhook";
import { processPayCryptoWebhook } from "./paycrypto-webhook";

const originalEnv = { ...process.env };
afterEach(() => {
  process.env = { ...originalEnv };
  vi.unstubAllGlobals();
});

describe("Heleket adapter", () => {
  it("signs invoice requests and maps the hosted checkout", async () => {
    process.env.HELEKET_MERCHANT_ID = "merchant-id";
    process.env.HELEKET_PAYMENT_API_KEY = "api-key";
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      state: 0,
      result: { uuid: "invoice-1", url: "https://new-pay.heleket.com/pay/invoice-1", order_id: "booking-7", amount: "25.00", currency: "USD" },
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetch);
    const result = await heleketProvider.createPayment({
      priceAmount: 25,
      orderId: "booking-7",
      orderDescription: "Reading",
      callbackUrl: "https://example.com/api/heleket/webhook",
      successUrl: "https://example.com/success",
      cancelUrl: "https://example.com/cancel",
    });
    expect(result).toMatchObject({ id: "invoice-1", invoice_url: "https://new-pay.heleket.com/pay/invoice-1" });
    const init = fetch.mock.calls[0][1];
    expect(init.headers.sign).toBe(signHeleketBody(init.body, "api-key"));
    expect(normalizeHeleketStatus("wrong_amount")).toBe("underpaid");
    expect(normalizeHeleketStatus("paid_over")).toBe("overpaid");
  });

  it("accepts only a correctly signed callback", async () => {
    process.env.HELEKET_PAYMENT_API_KEY = "api-key";
    const unsigned = { type: "payment", uuid: "invoice-1", order_id: "booking-7", status: "paid" };
    const sign = signHeleketBody(JSON.stringify(unsigned), "api-key");
    expect(verifyHeleketWebhook(JSON.stringify({ ...unsigned, sign }), sign, "api-key")).toBe(true);
    const processNotification = vi.fn().mockResolvedValue({ notified: true });
    const result = await processHeleketWebhook({ body: { ...unsigned, sign }, processNotification });
    expect(result).toMatchObject({ accepted: true, bookingId: 7 });
    expect(processNotification).toHaveBeenCalledWith({ bookingId: 7, paymentId: "invoice-1", paymentStatus: "paid" });
    expect((await processHeleketWebhook({ body: { ...unsigned, sign: "bad" }, processNotification })).accepted).toBe(false);
  });
});

describe("PayCrypto.Global adapter", () => {
  it("creates a direct-to-wallet checkout without exposing secrets in the result", async () => {
    process.env.PAYCRYPTO_API_KEY = "api-key";
    process.env.PAYCRYPTO_WEBHOOK_TOKEN = "t".repeat(32);
    process.env.PAYCRYPTO_COINS_JSON = JSON.stringify({ btc: { address: "bc1-test" } });
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ paylink: "https://paycrypto.global/invoice/abc" }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetch);
    const result = await payCryptoProvider.createPayment({
      priceAmount: 25,
      priceCurrency: "USD",
      orderId: "booking-8",
      orderDescription: "Reading",
      callbackUrl: "https://example.com/api/paycrypto/webhook",
      successUrl: "https://example.com/success",
      cancelUrl: "https://example.com/cancel",
    });
    expect(result.invoice_url).toBe("https://paycrypto.global/invoice/abc");
    const payload = JSON.parse(fetch.mock.calls[0][1].body);
    expect(payload.webhook_link).toContain("token=");
    expect(payload.coins.btc.address).toBe("bc1-test");
  });

  it("requires the callback token and exact order amount before confirming", async () => {
    process.env.PAYCRYPTO_WEBHOOK_TOKEN = "t".repeat(32);
    const processNotification = vi.fn().mockResolvedValue({ notified: true });
    const body = { webhook_type: "payment_done", shop_amount: 25, shop_currency: "usd", input_tx_hash: "tx-1", other: { order_id: "booking-8" } };
    const getBooking = vi.fn().mockResolvedValue({ id: 8, totalUsd: 25, currency: "USD" });
    const result = await processPayCryptoWebhook({ body, token: "t".repeat(32), processNotification, getBooking });
    expect(result).toMatchObject({ accepted: true, bookingId: 8 });
    expect(processNotification).toHaveBeenCalledWith({ bookingId: 8, paymentId: "tx-1", paymentStatus: "payment_done" });
    expect((await processPayCryptoWebhook({ body: { ...body, shop_amount: 24 }, token: "t".repeat(32), processNotification, getBooking })).status).toBe(409);
    expect((await processPayCryptoWebhook({ body, token: "wrong", processNotification, getBooking })).status).toBe(401);
  });
});
