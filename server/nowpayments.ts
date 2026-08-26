import { createHmac, timingSafeEqual } from "node:crypto";
import { ENV } from "./_core/env";

const NOWPAYMENTS_API = "https://api.nowpayments.io/v1";

export type NowPaymentsPayment = {
  payment_id: number;
  payment_status: string;
  pay_address?: string;
  pay_amount?: number;
  pay_currency?: string;
  price_amount: number;
  price_currency: string;
  order_id?: string;
  order_description?: string;
};

export type NowPaymentsInvoice = {
  id: string;
  invoice_url: string;
  order_id?: string;
  price_amount: number;
  price_currency: string;
};

async function nowpaymentsRequest<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${NOWPAYMENTS_API}${path}`, {
    ...init,
    headers: {
      "x-api-key": ENV.nowpaymentsApiKey,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(15_000),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`NOWPayments API error ${response.status}: ${JSON.stringify(body)}`);
  }
  return body as T;
}

export function buildInvoicePayload(input: {
  priceAmount: number;
  priceCurrency?: string;
  orderId: string;
  orderDescription: string;
  callbackUrl: string;
  successUrl: string;
  cancelUrl: string;
}) {
  return {
    price_amount: input.priceAmount,
    price_currency: (input.priceCurrency ?? "USD").toLowerCase(),
    order_id: input.orderId,
    order_description: input.orderDescription,
    ipn_callback_url: input.callbackUrl,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
  } as const;
}

export async function createNowPaymentsInvoice(input: {
  priceAmount: number;
  priceCurrency?: string;
  orderId: string;
  orderDescription: string;
  callbackUrl: string;
  successUrl: string;
  cancelUrl: string;
}) {
  return nowpaymentsRequest<NowPaymentsInvoice>("/invoice", {
    method: "POST",
    body: JSON.stringify(buildInvoicePayload(input)),
  });
}

export async function createNowPaymentsPayment(input: {
  priceAmount: number;
  priceCurrency?: string;
  orderId: string;
  orderDescription: string;
  callbackUrl: string;
  successUrl: string;
  cancelUrl: string;
}) {
  return nowpaymentsRequest<NowPaymentsPayment>("/payment", {
    method: "POST",
    body: JSON.stringify({
      price_amount: input.priceAmount,
      price_currency: (input.priceCurrency ?? "USD").toLowerCase(),
      pay_currency: "usdttrc20",
      order_id: input.orderId,
      order_description: input.orderDescription,
      ipn_callback_url: input.callbackUrl,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
    }),
  });
}

export function verifyNowPaymentsSignature(rawBody: string, signature: string) {
  const expected = createHmac("sha512", ENV.nowpaymentsIpnSecret)
    .update(rawBody)
    .digest("hex");
  const expectedBuffer = Buffer.from(expected, "utf8");
  const receivedBuffer = Buffer.from(signature, "utf8");
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}

/** Server-only helper. It is never exposed through a public route or browser bundle. */
export function signNowPaymentsPayloadForTest(rawBody: string) {
  return createHmac("sha512", ENV.nowpaymentsIpnSecret).update(rawBody).digest("hex");
}
