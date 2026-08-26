import { createBookingRequest, deleteBookingRequest, finishPaymentTestLabRun, getBookingRequestById, startPaymentTestLabRun } from "./db";
import { signNowPaymentsPayloadForTest } from "./nowpayments";
import { processPaymentNotification } from "./payment-notification";
import { processSignedNowPaymentsIpn, stableStringify } from "./nowpayments.webhook";

export async function runSignedIpnSimulation(input: { paymentStatus: "confirmed" | "finished" | "partially_paid"; actorId: string }) {
  const runId = `ipn-simulation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const startedAt = Date.now();
  await startPaymentTestLabRun({ runId, actorId: input.actorId, paymentStatus: input.paymentStatus });
  const booking = await createBookingRequest({
    name: "IPN simulation — synthetic",
    email: `${runId}@example.com`,
    birthDate: "1990-01-01",
    birthTime: "12:00",
    birthCity: "Berlin",
    birthCountry: "Germany",
    language: "English",
    addon: 0,
    packageCode: "basic",
    packageVersion: 1,
    priceSnapshotJson: JSON.stringify({ ipnSimulation: true, actorId: input.actorId }),
    totalUsd: 0,
    currency: "USD",
    interest: "Synthetic signed IPN simulation. Do not contact or deliver.",
    paymentStatus: "waiting",
    status: "new",
  });
  const payload = { order_id: `booking-${booking.id}`, payment_id: Number(`${Date.now()}`.slice(-10)), payment_status: input.paymentStatus };
  const signature = signNowPaymentsPayloadForTest(stableStringify(payload));
  try {
    const result = await processSignedNowPaymentsIpn({
      body: payload,
      signature,
      processNotification: (notification) => processPaymentNotification({
        ...notification,
        sendNotification: async () => true,
        enqueueJob: async () => ({ created: false as const, reason: "payment-not-confirmed" as const }),
        isAutoProcessingEnabled: async () => false,
      }),
    });
    const updated = await getBookingRequestById(booking.id);
    if (!result.accepted || updated?.paymentStatus !== input.paymentStatus) throw new Error("Signed IPN simulation did not reach the expected payment state.");
    await finishPaymentTestLabRun({ runId, status: "succeeded", bookingId: booking.id, startedAt });
    return { runId, accepted: true as const, bookingId: booking.id, paymentStatus: updated.paymentStatus, paymentId: updated.paymentId, fundsTransferred: false as const, externalProviderCalled: false as const, deliverySuppressed: true as const };
  } catch (error) {
    await finishPaymentTestLabRun({ runId, status: "failed", errorCode: "simulation_failed", errorMessage: error instanceof Error ? error.message : "Simulation failed", startedAt });
    throw error;
  } finally {
    await deleteBookingRequest(booking.id);
  }
}
