import { createHash, timingSafeEqual } from "node:crypto";
import type { CreatePaymentInput, NormalizedPaymentStatus, PaymentProvider } from "./provider";

const DEFAULT_API = "https://api.heleket.com";

function apiBase() {
  return (process.env.HELEKET_BASE_URL || DEFAULT_API).replace(/\/$/, "");
}

export function signHeleketBody(body: string, key = process.env.HELEKET_PAYMENT_API_KEY || "") {
  return createHash("md5").update(`${Buffer.from(body).toString("base64")}${key}`).digest("hex");
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function verifyHeleketWebhook(rawBody: string, signature: string, key = process.env.HELEKET_PAYMENT_API_KEY || "") {
  if (!key || !signature) return false;
  const parsed = JSON.parse(rawBody) as Record<string, unknown>;
  delete parsed.sign;
  const canonical = JSON.stringify(parsed);
  const escapedSlashes = canonical.replaceAll("/", "\\/");
  return safeEqual(signHeleketBody(canonical, key), signature)
    || safeEqual(signHeleketBody(escapedSlashes, key), signature);
}

export function normalizeHeleketStatus(status: string): NormalizedPaymentStatus {
  switch (status.toLowerCase()) {
    case "paid": return "paid";
    case "paid_over": return "overpaid";
    case "wrong_amount":
    case "wrong_amount_waiting": return "underpaid";
    case "cancel": return "expired";
    case "fail":
    case "system_fail":
    case "refund_fail": return "failed";
    case "refund_paid": return "refunded";
    case "process":
    case "confirm_check":
    case "check":
    case "refund_process":
    case "locked": return "pending";
    default: return "created";
  }
}

type HeleketResponse = {
  state: number;
  result?: { uuid: string; url: string; order_id?: string; amount: string; currency: string };
  message?: string;
};

export const heleketProvider: PaymentProvider = {
  id: "heleket",
  displayName: "Heleket",
  webhookPath: "/api/heleket/webhook",
  async createPayment(input: CreatePaymentInput) {
    const key = process.env.HELEKET_PAYMENT_API_KEY || "";
    const merchant = process.env.HELEKET_MERCHANT_ID || "";
    if (!key || !merchant) throw new Error("Heleket credentials are not configured");
    const payload = {
      amount: input.priceAmount.toFixed(2),
      currency: (input.priceCurrency || "USD").toUpperCase(),
      order_id: input.orderId,
      url_return: input.cancelUrl,
      url_success: input.successUrl,
      url_callback: input.callbackUrl,
      is_payment_multiple: true,
      accuracy_payment_percent: 0,
      additional_data: input.orderDescription.slice(0, 255),
      theme: "light",
    };
    const body = JSON.stringify(payload);
    const response = await fetch(`${apiBase()}/v1/payment`, {
      method: "POST",
      headers: { merchant, sign: signHeleketBody(body, key), "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(15_000),
    });
    const data = await response.json().catch(() => ({})) as HeleketResponse;
    if (!response.ok || data.state !== 0 || !data.result?.uuid || !data.result.url)
      throw new Error(`Heleket API error ${response.status}: ${data.message || "invalid response"}`);
    return {
      id: data.result.uuid,
      invoice_url: data.result.url,
      order_id: data.result.order_id,
      price_amount: Number(data.result.amount),
      price_currency: data.result.currency,
    };
  },
  verifyWebhook: verifyHeleketWebhook,
  normalizeStatus: normalizeHeleketStatus,
  isPaid(status: string) {
    return ["paid", "paid_over"].includes(status.toLowerCase());
  },
};
