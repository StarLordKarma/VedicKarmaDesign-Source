import { createBookingRequest, createSmokeTestRun, deleteBookingRequest, finishSmokeTestRun, getServicePricing, updateBookingPayment, updateSmokeTestRunProgress } from "./db";
import { createCheckoutForBooking } from "./payment-flow";

type Progress = { stage: string; progress: number; message: string };

export async function runManualSmokeTest(origin: string) {
  const startedAt = Date.now();
  const runId = `manual-smoke-${startedAt}`;
  let bookingId: number | null = null;
  const progress = async (value: Progress) => updateSmokeTestRunProgress(runId, JSON.stringify(value));

  await createSmokeTestRun(runId);
  try {
    await progress({ stage: "pricing_eur", progress: 15, message: "Checking EUR pricing" });
    const eurPricing = await getServicePricing("EUR");
    if (!Number.isFinite(eurPricing.basicUsd) || !Number.isFinite(eurPricing.numerologyAddonUsd)) throw new Error("EUR pricing response is invalid.");

    await progress({ stage: "pricing_gbp", progress: 30, message: "Checking GBP pricing" });
    const gbpPricing = await getServicePricing("GBP");
    if (!Number.isFinite(gbpPricing.basicUsd) || !Number.isFinite(gbpPricing.numerologyAddonUsd)) throw new Error("GBP pricing response is invalid.");

    await progress({ stage: "creating_booking", progress: 45, message: "Creating a marked test booking" });
    const booking = await createBookingRequest({
      name: `Manual smoke test ${startedAt}`,
      email: `${runId}@example.com`,
      birthDate: "1990-04-12",
      birthTime: "08:30",
      birthCity: "Berlin",
      birthCountry: "Germany",
      language: "English",
      addon: 0,
      totalUsd: eurPricing.basicUsd,
      currency: "EUR",
      interest: "Automated production checkout verification",
      status: "new",
      paymentStatus: "creating",
    });
    bookingId = booking.id;

    await progress({ stage: "creating_checkout", progress: 65, message: "Creating EUR crypto checkout" });
    const invoice = await createCheckoutForBooking({
      bookingId,
      totalUsd: eurPricing.basicUsd,
      priceCurrency: "EUR",
      addon: false,
      origin,
      savePayment: updateBookingPayment,
      markFailed: async (id) => updateBookingPayment({ id, paymentStatus: "failed" }),
    });

    await progress({ stage: "cleaning_up", progress: 85, message: "Removing the marked test booking" });
    await deleteBookingRequest(bookingId);
    const result = { ok: true, pricingCurrencies: ["EUR", "GBP"], checkoutCurrency: "EUR", bookingId, paymentId: invoice.id, invoiceUrl: invoice.invoice_url, pricingByCurrency: { EUR: eurPricing, GBP: gbpPricing }, cleanup: "completed" };
    await finishSmokeTestRun({ runId, status: "succeeded", result: JSON.stringify({ ...result, stage: "completed", progress: 100 }), durationMs: Date.now() - startedAt });
    return { runId, ...result };
  } catch (error) {
    if (bookingId !== null) {
      try { await deleteBookingRequest(bookingId); } catch (cleanupError) { console.error("[Manual smoke] cleanup failed", cleanupError); }
    }
    const result = { ok: false, error: error instanceof Error ? error.message : String(error), stage: "failed", progress: 100 };
    await finishSmokeTestRun({ runId, status: "failed", result: JSON.stringify(result), durationMs: Date.now() - startedAt });
    throw error;
  }
}
