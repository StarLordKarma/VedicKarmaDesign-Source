import { notifyOwner } from "./_core/notification";
import { updateBookingPaymentStatus } from "./db";
import { shouldNotifyPayment } from "./nowpayments.webhook";
import { enqueueReportJobForBooking } from "./report-studio-db";

export async function processPaymentNotification(input: {
  bookingId: number;
  paymentId?: number;
  paymentStatus: string;
  updateStatus?: typeof updateBookingPaymentStatus;
  sendNotification?: typeof notifyOwner;
  enqueueJob?: typeof enqueueReportJobForBooking;
}) {
  const updateStatus = input.updateStatus ?? updateBookingPaymentStatus;
  const sendNotification = input.sendNotification ?? notifyOwner;
  const enqueueJob = input.enqueueJob ?? enqueueReportJobForBooking;
  const result = await updateStatus({
    id: input.bookingId,
    paymentId: input.paymentId ? String(input.paymentId) : undefined,
    paymentStatus: input.paymentStatus,
  });
  if ("missing" in result && result.missing) return { notified: false, ignored: true, ...result };
  if (result.isConfirmed && shouldNotifyPayment(result.previousStatus, input.paymentStatus)) {
    const reportJob = await enqueueJob(input.bookingId, "system");
    await sendNotification({
      title: "Crypto payment confirmed",
      content: `NOWPayments confirmed payment ${input.paymentId ?? ""} for booking #${input.bookingId}. Status: ${input.paymentStatus}.`,
    });
    return { notified: true, reportJob, ...result };
  }
  return { notified: false, ...result };
}
