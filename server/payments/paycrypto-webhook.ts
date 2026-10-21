import type { Express } from "express";
import { getBookingRequestById } from "../db";
import { createRateLimit, logStructuredEvent } from "../observability";
import { processPaymentNotification } from "../payment-notification";
import { payCryptoProvider } from "./paycrypto-provider";

type PayCryptoWebhook = {
  webhook_type?: string;
  shop_link?: string;
  shop_amount?: number;
  shop_currency?: string;
  input_tx_hash?: string;
  other?: { order_id?: string };
};

export async function processPayCryptoWebhook(input: {
  body: PayCryptoWebhook;
  token?: string;
  processNotification?: typeof processPaymentNotification;
  getBooking?: typeof getBookingRequestById;
}) {
  if (!input.token || !payCryptoProvider.verifyWebhook(JSON.stringify(input.body), input.token))
    return { accepted: false as const, status: 401 as const, error: "Invalid payment token" };
  if (!input.body.webhook_type || !["invoice_link_opened", "new_transaction", "payment_done"].includes(input.body.webhook_type))
    return { accepted: false as const, status: 400 as const, error: "Invalid webhook type" };
  const bookingId = Number((input.body.other?.order_id || "").replace(/^booking-/, ""));
  if (!Number.isInteger(bookingId) || bookingId <= 0)
    return { accepted: false as const, status: 400 as const, error: "Invalid order id" };
  if (input.body.webhook_type === "payment_done") {
    const booking = await (input.getBooking ?? getBookingRequestById)(bookingId);
    const amountMatches = booking && Number(input.body.shop_amount) === Number(booking.totalUsd);
    const currencyMatches = booking && input.body.shop_currency?.toUpperCase() === booking.currency?.toUpperCase();
    if (!amountMatches || !currencyMatches)
      return { accepted: false as const, status: 409 as const, error: "Payment amount mismatch" };
  }
  const result = await (input.processNotification ?? processPaymentNotification)({
    bookingId,
    paymentId: input.body.input_tx_hash || input.body.shop_link,
    paymentStatus: input.body.webhook_type,
  });
  return { accepted: true as const, status: 200 as const, bookingId, result };
}

export function registerPayCryptoWebhook(app: Express) {
  const limit = createRateLimit({ name: "paycrypto-webhook", windowMs: 60_000, max: 60 });
  app.post(payCryptoProvider.webhookPath, limit, async (req, res) => {
    try {
      const result = await processPayCryptoWebhook({
        body: req.body as PayCryptoWebhook,
        token: typeof req.query.token === "string" ? req.query.token : undefined,
      });
      if (!result.accepted) {
        logStructuredEvent("warn", "payment.paycrypto.rejected", { reason: result.error });
        res.status(result.status).json({ error: result.error });
        return;
      }
      res.status(200).json({ received: true });
    } catch {
      res.status(503).json({ error: "Payment notification could not be processed; retry later." });
    }
  });
}
