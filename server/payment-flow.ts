import { createNowPaymentsInvoice, NowPaymentsInvoice } from "./nowpayments";

export async function createCheckoutForBooking(input: {
  bookingId: number;
  totalUsd: number;
  addon: boolean;
  origin: string;
  createInvoice?: typeof createNowPaymentsInvoice;
  savePayment: (data: { id: number; paymentId: string; paymentUrl: string; paymentStatus: string }) => Promise<void>;
  markFailed: (id: number) => Promise<void>;
}) {
  const createInvoice = input.createInvoice ?? createNowPaymentsInvoice;
  try {
    const invoice: NowPaymentsInvoice = await createInvoice({
      priceAmount: input.totalUsd,
      orderId: `booking-${input.bookingId}`,
      orderDescription: `Vedic astrology reading${input.addon ? " + Indian numerology add-on" : ""}`,
      callbackUrl: `${input.origin}/api/nowpayments/ipn`,
      successUrl: `${input.origin}/?payment=success#book`,
      cancelUrl: `${input.origin}/?payment=cancelled#book`,
    });
    await input.savePayment({
      id: input.bookingId,
      paymentId: invoice.id,
      paymentUrl: invoice.invoice_url,
      paymentStatus: "waiting",
    });
    return invoice;
  } catch (error) {
    await input.markFailed(input.bookingId);
    throw error;
  }
}
