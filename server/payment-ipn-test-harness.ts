import {
  createBookingRequest,
  deleteBookingRequest,
  finishPaymentTestLabRun,
  getBookingRequestById,
  startPaymentTestLabRun,
} from "./db";
import { signNowPaymentsPayloadForTest } from "./nowpayments";
import { processPaymentNotification } from "./payment-notification";
import {
  processSignedNowPaymentsIpn,
  stableStringify,
} from "./nowpayments.webhook";
import { ENV } from "./_core/env";

async function alertOwnerAboutFailedSimulation(input: {
  runId: string;
  paymentStatus: string;
  message: string;
}) {
  const recipient = process.env.OWNER_ALERT_EMAIL;
  if (!recipient || !ENV.resendApiKey || !ENV.resendFromEmail) return;
  await fetch(process.env.RESEND_BASE_URL || "https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ENV.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: ENV.resendFromEmail,
      to: [recipient],
      subject: "Payment Test Lab simulation failed",
      html: `<p>A signed Payment Test Lab simulation failed.</p><ul><li>Run ID: <code>${input.runId}</code></li><li>Requested status: <code>${input.paymentStatus}</code></li><li>Outcome: <code>${input.message.slice(0, 180)}</code></li></ul><p>No funds moved, no provider request was made, and no IPN payload or secret is included.</p>`,
    }),
    signal: AbortSignal.timeout(15_000),
  }).catch(() => undefined);
}

export async function runSignedIpnSimulation(input: {
  paymentStatus: "confirmed" | "finished" | "partially_paid";
  actorId: string;
}) {
  const runId = `ipn-simulation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const startedAt = Date.now();
  await startPaymentTestLabRun({
    runId,
    actorId: input.actorId,
    paymentStatus: input.paymentStatus,
  });
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
    priceSnapshotJson: JSON.stringify({
      ipnSimulation: true,
      actorId: input.actorId,
    }),
    totalUsd: 0,
    currency: "USD",
    interest: "Synthetic signed IPN simulation. Do not contact or deliver.",
    paymentStatus: "waiting",
    status: "new",
  });
  const payload = {
    order_id: `booking-${booking.id}`,
    payment_id: Number(`${Date.now()}`.slice(-10)),
    payment_status: input.paymentStatus,
  };
  const signature = signNowPaymentsPayloadForTest(stableStringify(payload));
  try {
    const result = await processSignedNowPaymentsIpn({
      body: payload,
      signature,
      processNotification: notification =>
        processPaymentNotification({
          ...notification,
          sendNotification: async () => true,
          enqueueJob: async () => ({
            created: false as const,
            reason: "payment-not-confirmed" as const,
          }),
          isAutoProcessingEnabled: async () => false,
        }),
    });
    const updated = await getBookingRequestById(booking.id);
    if (!result.accepted || updated?.paymentStatus !== input.paymentStatus)
      throw new Error(
        "Signed IPN simulation did not reach the expected payment state."
      );
    await finishPaymentTestLabRun({
      runId,
      status: "succeeded",
      bookingId: booking.id,
      startedAt,
    });
    return {
      runId,
      accepted: true as const,
      bookingId: booking.id,
      paymentStatus: updated.paymentStatus,
      paymentId: updated.paymentId,
      fundsTransferred: false as const,
      externalProviderCalled: false as const,
      deliverySuppressed: true as const,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Simulation failed";
    await finishPaymentTestLabRun({
      runId,
      status: "failed",
      errorCode: "simulation_failed",
      errorMessage: message,
      startedAt,
    });
    await alertOwnerAboutFailedSimulation({
      runId,
      paymentStatus: input.paymentStatus,
      message,
    });
    throw error;
  } finally {
    await deleteBookingRequest(booking.id);
  }
}
