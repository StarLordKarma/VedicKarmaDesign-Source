export const PAYMENT_PROVIDER_IDS = ["nowpayments", "heleket", "paycrypto", "direct"] as const;

export type PaymentProviderId = (typeof PAYMENT_PROVIDER_IDS)[number];

export type NormalizedPaymentStatus =
  | "created"
  | "pending"
  | "paid"
  | "underpaid"
  | "overpaid"
  | "expired"
  | "failed"
  | "refunded";

export type CreatePaymentInput = {
  priceAmount: number;
  priceCurrency?: string;
  orderId: string;
  orderDescription: string;
  callbackUrl: string;
  successUrl: string;
  cancelUrl: string;
};

export type HostedPayment = {
  id: string;
  invoice_url: string;
  order_id?: string;
  price_amount: number;
  price_currency: string;
};

export interface PaymentProvider {
  readonly id: PaymentProviderId;
  readonly displayName: string;
  readonly webhookPath: string;
  createPayment(input: CreatePaymentInput): Promise<HostedPayment>;
  verifyWebhook(rawBody: string, signature: string): boolean;
  normalizeStatus(status: string): NormalizedPaymentStatus;
  isPaid(status: string): boolean;
}

export function resolvePaymentProviderId(
  env: NodeJS.ProcessEnv = process.env
): PaymentProviderId {
  const configured = (env.PAYMENT_PROVIDER || "nowpayments").toLowerCase();
  if (!PAYMENT_PROVIDER_IDS.includes(configured as PaymentProviderId)) {
    throw new Error(`Unsupported PAYMENT_PROVIDER: ${configured}`);
  }
  return configured as PaymentProviderId;
}
