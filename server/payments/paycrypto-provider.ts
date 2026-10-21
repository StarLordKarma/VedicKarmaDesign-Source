import { timingSafeEqual } from "node:crypto";
import type { CreatePaymentInput, NormalizedPaymentStatus, PaymentProvider } from "./provider";

const DEFAULT_API = "https://paycrypto.global/api";

function safeTokenEqual(received: string, expected: string) {
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return Boolean(expected) && a.length === b.length && timingSafeEqual(a, b);
}

function payCryptoCoins() {
  const value = process.env.PAYCRYPTO_COINS_JSON || "";
  const parsed = JSON.parse(value) as Record<string, { address?: string; tag?: string | number }>;
  if (!Object.keys(parsed).length || Object.values(parsed).some((coin) => !coin.address))
    throw new Error("PAYCRYPTO_COINS_JSON must contain at least one receiving address");
  return parsed;
}

export function normalizePayCryptoStatus(status: string): NormalizedPaymentStatus {
  switch (status) {
    case "payment_done": return "paid";
    case "new_transaction": return "pending";
    case "invoice_link_opened": return "created";
    default: return "created";
  }
}

export const payCryptoProvider: PaymentProvider = {
  id: "paycrypto",
  displayName: "PayCrypto.Global",
  webhookPath: "/api/paycrypto/webhook",
  async createPayment(input: CreatePaymentInput) {
    const apiKey = process.env.PAYCRYPTO_API_KEY || "";
    const token = process.env.PAYCRYPTO_WEBHOOK_TOKEN || "";
    if (!apiKey || !token) throw new Error("PayCrypto credentials are not configured");
    const base = (process.env.PAYCRYPTO_BASE_URL || DEFAULT_API).replace(/\/$/, "");
    const callback = new URL(input.callbackUrl);
    callback.searchParams.set("token", token);
    const body = JSON.stringify({
      lang: "en",
      title: `Order ${input.orderId}`,
      desc: input.orderDescription,
      amount: input.priceAmount,
      amount_currency: (input.priceCurrency || "USD").toLowerCase(),
      ok_link: input.successUrl,
      cancel_link: input.cancelUrl,
      webhook_link: callback.toString(),
      coins: payCryptoCoins(),
      other: { order_id: input.orderId },
    });
    const response = await fetch(`${base}/${encodeURIComponent(apiKey)}/getpaylink`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(15_000),
    });
    const data = await response.json().catch(() => ({})) as { paylink?: string; error?: string };
    if (!response.ok || !data.paylink)
      throw new Error(`PayCrypto API error ${response.status}: ${data.error || "invalid response"}`);
    return {
      id: input.orderId,
      invoice_url: data.paylink,
      order_id: input.orderId,
      price_amount: input.priceAmount,
      price_currency: (input.priceCurrency || "USD").toLowerCase(),
    };
  },
  verifyWebhook(_rawBody: string, token: string) {
    return safeTokenEqual(token, process.env.PAYCRYPTO_WEBHOOK_TOKEN || "");
  },
  normalizeStatus: normalizePayCryptoStatus,
  isPaid(status: string) {
    return status === "payment_done";
  },
};
