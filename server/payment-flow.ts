import { getPaymentProvider, type PaymentProvider } from "./payments";

export async function createCheckoutForBooking(input: {
  bookingId: number;
  totalUsd: number;
  priceCurrency?: string;
  addon: boolean;
  product?: string;
  origin: string;
  provider?: PaymentProvider;
  savePayment: (data: { id: number; paymentId: string; paymentUrl: string; paymentStatus: string }) => Promise<void>;
  markFailed: (id: number) => Promise<void>;
}) {
  const provider = input.provider ?? getPaymentProvider();
  try {
    const invoice = await provider.createPayment({
      priceAmount: input.totalUsd,
      priceCurrency: input.priceCurrency,
      orderId: `booking-${input.bookingId}`,
      orderDescription: input.product && !input.product.startsWith("vedic_") ? ({portrait:"Western astrology full report",daily:"Western astrology daily forecast",monthly:"Western astrology monthly forecast",tarot:"Tarot report"}[input.product] || "Personal report") : `Vedic astrology reading${input.addon ? " + Indian numerology add-on" : ""}`,
      callbackUrl: `${input.origin}${provider.webhookPath}`,
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
