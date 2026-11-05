import {isPaidPaymentStatus} from '../shared/payment-status';
import type { Express } from "express";
import { desc, eq, and, sql } from "drizzle-orm";
import { getDb } from "./db";
import {
  bookingRequests,
  orderMailFlows,
  reportJobs,
  reportVersions,
  reportDeliveryAttempts,
} from "../drizzle/schema";
import { sdk } from "./_core/sdk";
import { ENV } from "./_core/env";
export function registerOrderMailRoutes(app: Express) {
  app.get("/api/owner/order-flow", async (req, res) => {
    res.set({
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex,nofollow",
    });
    try {
      const user = await sdk.authenticateRequest(req);
      if (
        !ENV.ownerOpenId ||
        user.openId !== ENV.ownerOpenId ||
        user.role !== "admin"
      )
        return void res.status(403).json({ error: "owner_required" });
    } catch {
      return void res.status(403).json({ error: "owner_required" });
    }
    try {
      const db = await getDb();
      if (!db) throw Error("DB unavailable");
      const rows = await db
        .select({
          booking: bookingRequests,
          flow: orderMailFlows,
          job: reportJobs,
        })
        .from(bookingRequests)
        .leftJoin(
          orderMailFlows,
          eq(orderMailFlows.bookingId, bookingRequests.id)
        )
        .leftJoin(
          reportJobs,
          and(
            eq(reportJobs.bookingId, bookingRequests.id),
            sql`${reportJobs.id}=(select max(j.id) from report_jobs j where j.bookingId=${bookingRequests.id})`
          )
        )
        .orderBy(desc(bookingRequests.id))
        .limit(200);
      const orders = [];
      for (const { booking: b, flow, job } of rows) {
        const versions = job
          ? await db
              .select()
              .from(reportVersions)
              .where(eq(reportVersions.reportJobId, job.id))
              .orderBy(desc(reportVersions.versionNumber))
              .limit(1)
          : [];
        const attempts = versions[0]
          ? await db
              .select()
              .from(reportDeliveryAttempts)
              .where(eq(reportDeliveryAttempts.reportVersionId, versions[0].id))
              .orderBy(desc(reportDeliveryAttempts.id))
          : [];
        const manual = JSON.parse(b.priceSnapshotJson || "{}").riskpayManual;
        orders.push({
          id: b.id,
          name: b.name,
          email: b.email,
          payment: b.paymentStatus,
          received:
            !!manual?.receipt ||
            isPaidPaymentStatus(b.paymentStatus),
          manual: !!manual,
          accepted:
            !!manual?.preparation ||
            (!manual &&
              isPaidPaymentStatus(b.paymentStatus)),
          flow: flow
            ? {
                capturedRecipient: flow.recipient,
                locale: flow.locale,
                product: flow.product,
                ackState: flow.ackState,
                acceptedAt: flow.acceptedAt,
                ackAcceptedAt: flow.ackAcceptedAt,
                providerMessageId: flow.providerMessageId,
                delaySeconds: flow.delaySeconds,
                dueAt: flow.dueAt,
                attempts: flow.attempts,
                nextAttemptAt: flow.nextAttemptAt,
                error: flow.error,
              }
            : null,
          preparation: job?.status || null,
          preparationError: job?.lastErrorMessage,
          version: versions[0]
            ? {
                id: versions[0].id,
                number: versions[0].versionNumber,
                hash: versions[0].pdfSha256,
                status: versions[0].status,
              }
            : null,
          delivery: attempts.map(a => ({
            status: a.status,
            recipient: a.recipientEmail,
            providerMessageId: a.providerMessageId,
            requestedAt: a.requestedAt,
            completedAt: a.completedAt,
            error: a.errorMessage,
          })),
          held:
            b.status === "cancelled" ||
            /refund|disput/.test(b.paymentStatus || "") || ["ORDER_MAIL_HELD","AUTO_DELIVERY_STOPPED"].includes(job?.lastErrorCode||"") || ["failed","reconcile"].includes(flow?.ackState||""),
        });
      }
      res.json({ orders });
    } catch {
      res.status(503).json({ error: "order_flow_unavailable" });
    }
  });
  app.get("/owner/order-flow", (_req, res) => {
    res
      .set({
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex,nofollow",
        "Referrer-Policy": "no-referrer",
      })
      .type("html")
      .send(
        `<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Этапы заказов</title><link rel="stylesheet" href="/readings/site.css"><style>#orders{overflow-wrap:anywhere}article{border-bottom:1px solid #d8cabe;padding:24px 0}</style><main class="wrap"><a href="/admin/control">← Кабинет</a><h1>Этапы обработки заказов</h1><p>Принятие почтовым сервисом не подтверждает доставку во входящие. Обновление каждые 15 секунд.</p><p id="feedback" role="status"></p><div id="orders"></div></main><script src="/readings/payments/order-flow.mjs" type="module"></script></html>`
      );
  });
  app.get("/readings/payments/order-flow.mjs", (_req, res) =>
    res.sendFile("reading-core/payments/order-flow.mjs", {
      root: process.cwd(),
    })
  );
}
