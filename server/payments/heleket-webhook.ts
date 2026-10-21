import type { Express } from "express";
import { createRateLimit, logStructuredEvent } from "../observability";
import { processPaymentNotification } from "../payment-notification";
import { heleketProvider } from "./heleket-provider";

type HeleketWebhook = {
  sign?: string;
  uuid?: string;
  order_id?: string;
  status?: string;
};

export async function processHeleketWebhook(input: {
  body: HeleketWebhook;
  processNotification?: typeof processPaymentNotification;
}) {
  const signature = input.body.sign || "";
  const rawBody = JSON.stringify(input.body);
  if (!heleketProvider.verifyWebhook(rawBody, signature))
    return { accepted: false as const, status: 401 as const, error: "Invalid payment signature" };
  const bookingId = Number((input.body.order_id || "").replace(/^booking-/, ""));
  if (!Number.isInteger(bookingId) || bookingId <= 0)
    return { accepted: false as const, status: 400 as const, error: "Invalid order id" };
  const result = await (input.processNotification ?? processPaymentNotification)({
    bookingId,
    paymentId: input.body.uuid,
    paymentStatus: input.body.status || "unknown",
  });
  return { accepted: true as const, status: 200 as const, bookingId, result };
}

export function registerHeleketWebhook(app: Express) {
  const limit = createRateLimit({ name: "heleket-webhook", windowMs: 60_000, max: 60 });
  app.post(heleketProvider.webhookPath, limit, async (req, res) => {
    try {
      const result = await processHeleketWebhook({ body: req.body as HeleketWebhook });
      if (!result.accepted) {
        logStructuredEvent("warn", "payment.heleket.rejected", { reason: result.error });
        res.status(result.status).json({ error: result.error });
        return;
      }
      res.status(200).json({ received: true });
    } catch {
      res.status(503).json({ error: "Payment notification could not be processed; retry later." });
    }
  });
}
