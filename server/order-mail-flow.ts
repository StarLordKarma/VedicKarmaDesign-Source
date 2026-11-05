import { randomInt } from "node:crypto";
import { and, eq, inArray, sql, desc } from "drizzle-orm";
import {
  bookingRequests,
  orderMailFlows,
  reportJobs,
  reportVersions,
  reportDeliveryAttempts,
} from "../drizzle/schema";
import { getDb, getBookingRequestById } from "./db";
import {
  manualDigest,
  manualOrderIdentity,
  assertManualFulfillment,
} from "./payments/riskpay-manual-policy";
import { withPaidBookingLock } from "./fulfillment-claims";
import { isPaidPaymentStatus, PAID_PAYMENT_STATUSES } from "../shared/payment-status";
import { isRefundHeld } from "./refund-proof";
import {
  orderArea,
  orderLocale,
  chooseDelaySeconds,
  DELIVERY_MINUTES,
} from "../shared/order-lifecycle";
import { acceptanceCopy } from "./order-mail-copy";
import { createClientStatusLink } from "./client-status";
import { ENV } from "./_core/env";
export const flowMarker = (b: any) =>
  JSON.parse(b.priceSnapshotJson || "{}").orderMailV1;
const identity = (b: any) => manualDigest(manualOrderIdentity(b));
export async function getOrderMailFlow(id: number) {
  const db = await getDb();
  if (!db) return null;
  return (
    (
      await db
        .select()
        .from(orderMailFlows)
        .where(eq(orderMailFlows.bookingId, id))
        .limit(1)
    )[0] || null
  );
}
export async function ensureOrderMailFlow(b: any) {
  if (!flowMarker(b)) return null;
  const db = await getDb();
  if (!db) throw Error("Database unavailable");
  const existing = await getOrderMailFlow(b.id);
  if (existing) return existing;
  if (
    !isPaidPaymentStatus(b.paymentStatus) ||
    isRefundHeld(b.paymentStatus) ||
    b.status === "cancelled"
  )
    return null;
  assertManualFulfillment(b);
  const marker = flowMarker(b),
    product =
      JSON.parse(b.priceSnapshotJson || "{}").reading?.product || b.packageCode;
  const locale = orderLocale(marker.locale),
    delaySeconds = chooseDelaySeconds(
      orderArea(product),
      () => randomInt(0, 1000000) / 1000000
    );
  const link = await createClientStatusLink({
    bookingId: b.id,
    expiryHours: 720,
    createdBy: "system:order-mail",
  });
  const payload = {
    from: ENV.resendFromEmail,
    to: [b.email.trim().toLowerCase()],
    ...acceptanceCopy(
      locale,
      b.id,
      product,
      `${process.env.PUBLIC_BASE_URL}/status/${link.token}`
    ),
  };
  await withPaidBookingLock(db, b.id, async (tx, fresh) => {
    assertManualFulfillment(fresh);
    if (identity(fresh) !== identity(b))
      throw Error("Order changed during acceptance");
    await tx
      .insert(orderMailFlows)
      .values({
        bookingId: b.id,
        locale,
        product,
        recipient: payload.to[0],
        identityHash: identity(b),
        delaySeconds,
        ackPayload: JSON.stringify(payload),
      })
      .onDuplicateKeyUpdate({ set: { bookingId: b.id } });
  });
  return getOrderMailFlow(b.id);
}
export async function orderDeliverySchedule(b: any) {
  if (!flowMarker(b)) return null;
  const f = await getOrderMailFlow(b.id);
  if (!f || !["accepted", "delivered"].includes(f.ackState) || !f.dueAt)
    return { status: "awaiting_acceptance_email" as const };
  const [minimum, maximum] = DELIVERY_MINUTES[orderArea(f.product)];
  if (
    !f.ackAcceptedAt ||
    f.ackAcceptedAt.getTime() < f.acceptedAt.getTime() ||
    f.delaySeconds < minimum * 60 ||
    f.delaySeconds > maximum * 60 ||
    f.dueAt.getTime() !== f.ackAcceptedAt.getTime() + f.delaySeconds * 1000
  )
    throw Error("Delivery schedule integrity check failed");
  if (
    f.identityHash !== identity(b) ||
    f.recipient !== b.email.trim().toLowerCase()
  )
    throw Error("Order changed after acceptance; review required");
  if (
    b.status === "cancelled" ||
    isRefundHeld(b.paymentStatus) ||
    !isPaidPaymentStatus(b.paymentStatus)
  )
    throw Error("Order delivery is paused");
  return Date.now() < f.dueAt.getTime()
    ? { status: "scheduled" as const, dueAt: f.dueAt.toISOString() }
    : null;
}
async function sendAcceptance(id: number) {
  const db = await getDb();
  if (!db) return;
  const claimed = await withPaidBookingLock(db, id, async (tx, b) => {
    assertManualFulfillment(b);
    if (b.status === "cancelled") return false;
    const f = (
      await tx
        .select()
        .from(orderMailFlows)
        .where(eq(orderMailFlows.bookingId, id))
        .for("update")
    )[0];
    if (
      !f ||
      !["pending", "retry", "sending"].includes(f.ackState) ||
      (f.nextAttemptAt && f.nextAttemptAt.getTime() > Date.now())
    )
      return false;
    if (f.identityHash !== identity(b)) {
      await tx
        .update(orderMailFlows)
        .set({
          ackState: "failed",
          error: "Данные заказа изменены; требуется проверка владельца.",
        })
        .where(eq(orderMailFlows.bookingId, id));
      return false;
    }
    await tx
      .update(orderMailFlows)
      .set({
        ackState: "sending",
        ackStartedAt: f.ackStartedAt || new Date(),
        nextAttemptAt: new Date(Date.now() + 300000),
      })
      .where(eq(orderMailFlows.bookingId, id));
    return true;
  });
  if (!claimed) return;
  await withPaidBookingLock(db, id, async (tx, b) => {
    assertManualFulfillment(b);
    const f = (
      await tx
        .select()
        .from(orderMailFlows)
        .where(eq(orderMailFlows.bookingId, id))
        .for("update")
    )[0];
    if (
      !f ||
      ["accepted", "delivered", "failed", "reconcile"].includes(f.ackState) ||
      b.status === "cancelled"
    )
      return;
    if (f.identityHash !== identity(b))
      throw Error("Order changed before acceptance email");
    const first = f.ackStartedAt || new Date();
    if (Date.now() - first.getTime() > 23 * 3600000) {
      await tx
        .update(orderMailFlows)
        .set({
          ackState: "reconcile",
          error:
            "Provider deduplication window exceeded; reconcile before retry",
        })
        .where(eq(orderMailFlows.bookingId, id));
      return;
    }
    const claim = await tx
      .update(orderMailFlows)
      .set({
        ackState: "sending",
        ackStartedAt: first,
        attempts: f.attempts + 1,
      })
      .where(
        and(
          eq(orderMailFlows.bookingId, id),
          eq(orderMailFlows.ackState, f.ackState)
        )
      );
    if (!Number(claim[0].affectedRows)) return;
    try {
      const endpoint = new URL(
        "/emails",
        process.env.RESEND_BASE_URL || "https://api.resend.com"
      );
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ENV.resendApiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `order-accepted:${id}:v1`,
        },
        body: f.ackPayload,
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) {
        const permanent =
          response.status >= 400 &&
          response.status < 500 &&
          ![409, 429].includes(response.status);
        await tx
          .update(orderMailFlows)
          .set({
            ackState: permanent ? "failed" : "retry",
            error: `Email provider HTTP ${response.status}`,
            nextAttemptAt: new Date(
              Date.now() +
                Math.min(3600000, 30000 * 2 ** Math.min(f.attempts, 7))
            ),
          })
          .where(eq(orderMailFlows.bookingId, id));
        return;
      }
      const body = await response.json();
      if (typeof body.id !== "string")
        throw Error("Provider acceptance missing message ID");
      const at = new Date();
      await tx
        .update(orderMailFlows)
        .set({
          ackState: "accepted",
          ackAcceptedAt: at,
          dueAt: new Date(at.getTime() + f.delaySeconds * 1000),
          providerMessageId: body.id,
          error: null,
          nextAttemptAt: null,
        })
        .where(eq(orderMailFlows.bookingId, id));
    } catch {
      await tx
        .update(orderMailFlows)
        .set({
          ackState: "retry",
          error: "Ambiguous email outcome; retry same immutable key",
          nextAttemptAt: new Date(Date.now() + 60000),
        })
        .where(eq(orderMailFlows.bookingId, id));
    }
  });
}
let running = false;
export async function tickOrderMailFlows() {
  if (running) return;
  running = true;
  try {
    const db = await getDb();
    if (!db) return;
    // Recover acceptance missed between confirmed payment and job creation. Only explicitly enrolled orders.
    const candidates = await db
      .select()
      .from(bookingRequests)
      .where(
        and(
          sql`json_extract(${bookingRequests.priceSnapshotJson}, '$.orderMailV1') is not null`,
          inArray(bookingRequests.paymentStatus, [...PAID_PAYMENT_STATUSES]),
          sql`not exists (select 1 from order_mail_flows omf where omf.bookingId=${bookingRequests.id})`
        )
      )
      .orderBy(bookingRequests.id)
      .limit(200);
    for (const b of candidates) {
      try {
        await ensureOrderMailFlow(b);
      } catch {
        /* Owner acceptance may still be pending. */
      }
    }
    const pending = await db
      .select()
      .from(orderMailFlows)
      .where(
        and(
          inArray(orderMailFlows.ackState, ["pending", "retry", "sending"]),
          sql`(${orderMailFlows.nextAttemptAt} is null or ${orderMailFlows.nextAttemptAt} <= now())`
        )
      )
      .limit(30);
    for (const f of pending) {
      try {
        await sendAcceptance(f.bookingId);
      } catch {
        console.error("[Order mail] acceptance paused", f.bookingId);
      }
    }
    const ready = await db
      .select({ job: reportJobs, version: reportVersions })
      .from(reportJobs)
      .innerJoin(
        reportVersions,
        and(
          eq(reportVersions.reportJobId, reportJobs.id),
          eq(reportVersions.status, "approved")
        )
      )
      .innerJoin(
        orderMailFlows,
        eq(orderMailFlows.bookingId, reportJobs.bookingId)
      )
      .where(
        and(
          inArray(reportJobs.status, ["approved", "delivery_failed"]),
          sql`coalesce(${reportJobs.lastErrorCode}, '') not in ('ORDER_MAIL_HELD','AUTO_DELIVERY_STOPPED')`,
          inArray(orderMailFlows.ackState, ["accepted", "delivered"]),
          sql`${orderMailFlows.dueAt} <= now()`
        )
      )
      .limit(30);
    for (const { job, version } of ready) {
      try {
        const b = await getBookingRequestById(job.bookingId);
        if (!b || (await orderDeliverySchedule(b))) continue;
        const last = (
          await db
            .select()
            .from(reportDeliveryAttempts)
            .where(eq(reportDeliveryAttempts.reportVersionId, version.id))
            .orderBy(desc(reportDeliveryAttempts.id))
            .limit(1)
        )[0];
        if (
          last &&
          (last.errorCode === "PERMANENT_DELIVERY_ERROR" ||
            Date.now() - last.requestedAt.getTime() > 3600000)
        ) {
          await db
            .update(reportJobs)
            .set({
              lastErrorCode: "AUTO_DELIVERY_STOPPED",
              lastErrorMessage:
                "Почтовая отправка требует сверки; автоматические повторы остановлены.",
            })
            .where(eq(reportJobs.id, job.id));
          continue;
        }
        if (
          last?.completedAt &&
          Date.now() - last.completedAt.getTime() < 60000
        )
          continue;
        if (
          last?.status === "sending" &&
          Date.now() - (last.startedAt || last.requestedAt).getTime() > 300000
        )
          await db
            .update(reportDeliveryAttempts)
            .set({ status: "failed", completedAt: new Date() })
            .where(
              and(
                eq(reportDeliveryAttempts.id, last.id),
                eq(reportDeliveryAttempts.status, "sending"),
                sql`${reportDeliveryAttempts.startedAt} < ${new Date(Date.now() - 300000)}`
              )
            );
        const { deliverApprovedReport } = await import("./report-studio-db");
        await deliverApprovedReport({
          reportJobId: job.id,
          versionId: version.id,
          actorId: "system:scheduled-delivery",
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Delivery paused";
        if (
          /integrity|changed|paused|Refunded|confirmed payment/i.test(message)
        )
          await db
            .update(reportJobs)
            .set({
              lastErrorCode: "ORDER_MAIL_HELD",
              lastErrorMessage: message.slice(0, 1000),
            })
            .where(eq(reportJobs.id, job.id));
        console.error("[Order mail] final delivery paused", job.bookingId);
      }
    }
  } finally {
    running = false;
  }
}
export function startOrderMailWorker() {
  if (process.env.ORDER_MAIL_WORKER_ENABLED !== "true") return;
  const timer = setInterval(
    () =>
      void tickOrderMailFlows().catch(() =>
        console.error("[Order mail] worker unavailable")
      ),
    15000
  );
  timer.unref();
}
