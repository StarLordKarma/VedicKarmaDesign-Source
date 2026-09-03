import { notifyOwner } from "./_core/notification";
import { updateBookingPaymentStatus } from "./db";
import { shouldNotifyPayment } from "./nowpayments.webhook";
import { enqueueReportJobForBooking, isReportStudioAutoProcessingEnabled, processReportJob } from "./report-studio-db";

export async function processPaymentNotification(input: {
  bookingId: number;
  paymentId?: number;
  paymentStatus: string;
  updateStatus?: typeof updateBookingPaymentStatus;
  sendNotification?: typeof notifyOwner;
  enqueueJob?: typeof enqueueReportJobForBooking;
  processJob?: typeof processReportJob;
  isAutoProcessingEnabled?: typeof isReportStudioAutoProcessingEnabled;
}) {
  const updateStatus = input.updateStatus ?? updateBookingPaymentStatus;
  const sendNotification = input.sendNotification ?? notifyOwner;
  const enqueueJob = input.enqueueJob ?? enqueueReportJobForBooking;
  const processJob = input.processJob ?? processReportJob;
  const isAutoProcessingEnabled = input.isAutoProcessingEnabled ?? isReportStudioAutoProcessingEnabled;
  const result = await updateStatus({
    id: input.bookingId,
    paymentId: input.paymentId ? String(input.paymentId) : undefined,
    paymentStatus: input.paymentStatus,
  });
  if ("missing" in result && result.missing) return { notified: false, ignored: true, ...result };
  if (result.isConfirmed) {
    // Retry job creation even on a duplicate callback: a previous attempt may
    // have persisted payment status and failed before enqueuing the report.
    const reportJob = await enqueueJob(input.bookingId, "system");
    const reportJobId = "jobId" in reportJob ? reportJob.jobId : "job" in reportJob ? reportJob.job?.id : undefined;
    if (reportJobId && await isAutoProcessingEnabled()) void processJob({ reportJobId, actorId: "system" }).catch((error) => console.error(`[Report Studio] Automatic job ${reportJobId} failed`, error));
    if (!shouldNotifyPayment(result.previousStatus, input.paymentStatus)) return { notified: false, reportJob, ...result };
    await sendNotification({
      title: "Crypto payment confirmed",
      content: `NOWPayments confirmed payment ${input.paymentId ?? ""} for booking #${input.bookingId}. Status: ${input.paymentStatus}.`,
    });
    return { notified: true, reportJob, ...result };
  }
  return { notified: false, ...result };
}
