import {
  createNowPaymentsInvoice,
  type NowPaymentsInvoice,
  verifyNowPaymentsSignature,
} from "../nowpayments";
import type {
  CreatePaymentInput,
  NormalizedPaymentStatus,
  PaymentProvider,
} from "./provider";

const PAID_STATUSES = new Set(["confirmed", "finished"]);

export function normalizeNowPaymentsStatus(
  status: string
): NormalizedPaymentStatus {
  switch (status.toLowerCase()) {
    case "confirmed":
    case "finished":
      return "paid";
    case "partially_paid":
      return "underpaid";
    case "overpaid":
      return "overpaid";
    case "expired":
      return "expired";
    case "refunded":
      return "refunded";
    case "failed":
      return "failed";
    case "waiting":
    case "confirming":
    case "sending":
      return "pending";
    default:
      return "created";
  }
}

export const nowPaymentsProvider: PaymentProvider = {
  id: "nowpayments",
  displayName: "NOWPayments",
  webhookPath: "/api/nowpayments/ipn",
  createPayment(input: CreatePaymentInput): Promise<NowPaymentsInvoice> {
    return createNowPaymentsInvoice(input);
  },
  verifyWebhook: verifyNowPaymentsSignature,
  normalizeStatus: normalizeNowPaymentsStatus,
  isPaid(status: string) {
    return PAID_STATUSES.has(status.toLowerCase());
  },
};
