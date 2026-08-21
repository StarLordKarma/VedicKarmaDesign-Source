import { notifyOwner } from "./_core/notification";
import { updateBookingPaymentStatus } from "./db";
import { shouldNotifyPayment } from "./nowpayments.webhook";

export async function processPaymentNotification(input: {
  bookingId: number;
  paymentId?: number;
  paymentStatus: string;
  updateStatus?: typeof updateBookingPaymentStatus;
  sendNotification?: typeof notifyOwner;
}) {
  const updateStatus = input.updateStatus ?? updateBookingPaymentStatus;
  const sendNotification = input.sendNotification ?? notifyOwner;
  const result = await updateStatus({
    id: input.bookingId,
    paymentId: input.paymentId ? String(input.paymentId) : undefined,
    paymentStatus: input.paymentStatus,
  });
  if (result.isConfirmed && shouldNotifyPayment(result.previousStatus, input.paymentStatus)) {
    await sendNotification({
      title: "Crypto payment confirmed",
      content: `NOWPayments confirmed payment ${input.paymentId ?? ""} for booking #${input.bookingId}. Status: ${input.paymentStatus}.`,
    });
    return { notified: true, ...result };
  }
  return { notified: false, ...result };
}
