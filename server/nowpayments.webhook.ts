import type { Express } from "express";

type CorrelatedRequest = { requestId?: string };
import { processPaymentNotification } from "./payment-notification";
import { verifyNowPaymentsSignature } from "./nowpayments";
import { createRateLimit, logStructuredEvent } from "./observability";

function stableStringify(value: unknown): string {
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

export function registerNowPaymentsWebhook(app: Express) {
  const ipnRateLimit = createRateLimit({ name: "payment-ipn", windowMs: 60_000, max: 60 });
  app.post("/api/nowpayments/ipn", ipnRateLimit, (req, res) => {
    const signature = req.header("x-nowpayments-sig");
    if (!signature || !verifyNowPaymentsSignature(stableStringify(req.body), signature)) {
      logStructuredEvent("warn", "payment.ipn.rejected", { requestId: (req as unknown as CorrelatedRequest).requestId, reason: "invalid_signature" });
      res.status(401).json({ error: "Invalid payment signature", requestId: (req as unknown as CorrelatedRequest).requestId });
      return;
    }

    const payload = req.body as { order_id?: string; payment_id?: number; payment_status?: string };
    const orderId = payload.order_id ?? "";
    const bookingId = Number(orderId.replace(/^booking-/, ""));
    if (!Number.isInteger(bookingId) || bookingId <= 0) {
      res.status(400).json({ error: "Invalid order id" });
      return;
    }

    const requestId = (req as unknown as CorrelatedRequest).requestId;
    logStructuredEvent("info", "payment.ipn.accepted", { requestId, bookingId });
    void processPaymentNotification({
      bookingId,
      paymentId: payload.payment_id,
      paymentStatus: payload.payment_status ?? "unknown",
    }).then(() => res.status(200).json({ received: true, requestId })).catch(() => {
      logStructuredEvent("error", "payment.ipn.processing_failed", { requestId, bookingId });
      res.status(500).json({ error: "Could not update payment status", requestId });
    });
  });
}
