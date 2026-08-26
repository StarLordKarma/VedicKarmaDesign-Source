import type { Express } from "express";

type CorrelatedRequest = { requestId?: string };
import { processPaymentNotification } from "./payment-notification";
import { verifyNowPaymentsSignature } from "./nowpayments";
import { createRateLimit, logStructuredEvent } from "./observability";

export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function mapPaymentStatusToBookingStatus(paymentStatus: string) {
  return ["finished", "confirmed", "partially_paid"].includes(paymentStatus) ? "in_progress" : "new";
}

export function shouldNotifyPayment(previousStatus: string | null, nextStatus: string) {
  return ["finished", "confirmed", "partially_paid"].includes(nextStatus) && previousStatus !== nextStatus;
}

export async function processSignedNowPaymentsIpn(input: {
  body: { order_id?: string; payment_id?: number; payment_status?: string };
  signature?: string;
  processNotification?: typeof processPaymentNotification;
}) {
  const rawBody = stableStringify(input.body);
  if (!input.signature || !verifyNowPaymentsSignature(rawBody, input.signature)) return { accepted: false as const, status: 401 as const, error: "Invalid payment signature" };
  const orderId = input.body.order_id ?? "";
  const bookingId = Number(orderId.replace(/^booking-/, ""));
  if (!Number.isInteger(bookingId) || bookingId <= 0) return { accepted: false as const, status: 400 as const, error: "Invalid order id" };
  const result = await (input.processNotification ?? processPaymentNotification)({ bookingId, paymentId: input.body.payment_id, paymentStatus: input.body.payment_status ?? "unknown" });
  return { accepted: true as const, status: 200 as const, bookingId, result };
}

export function registerNowPaymentsWebhook(app: Express) {
  const ipnRateLimit = createRateLimit({ name: "payment-ipn", windowMs: 60_000, max: 60 });
  app.post("/api/nowpayments/ipn", ipnRateLimit, async (req, res) => {
    const signature = req.header("x-nowpayments-sig");
    const result = await processSignedNowPaymentsIpn({ body: req.body as { order_id?: string; payment_id?: number; payment_status?: string }, signature });
    if (!result.accepted && result.status === 401) {
      logStructuredEvent("warn", "payment.ipn.rejected", { requestId: (req as unknown as CorrelatedRequest).requestId, reason: "invalid_signature" });
      res.status(401).json({ error: "Invalid payment signature", requestId: (req as unknown as CorrelatedRequest).requestId });
      return;
    }
    if (!result.accepted) {
      res.status(400).json({ error: "Invalid order id" });
      return;
    }

    const requestId = (req as unknown as CorrelatedRequest).requestId;
    logStructuredEvent("info", "payment.ipn.accepted", { requestId, bookingId: result.bookingId });
    res.status(200).json({ received: true, requestId });
  });
}
