import { beforeAll, afterAll, it, expect, vi } from "vitest";
import { eq, inArray, sql } from "drizzle-orm";
import {
  bookingRequests,
  orderMailFlows,
  clientAccessTokens,
  reportJobs,
  reportVersions,
  reportDeliveryAttempts,
  reportAuditEvents,
} from "../drizzle/schema";
import { getDb, getBookingRequestById } from "./db";
import {
  ensureOrderMailFlow,
  getOrderMailFlow,
  tickOrderMailFlows,
  orderDeliverySchedule,
} from "./order-mail-flow";
const finalMail = vi.hoisted(() =>
  vi.fn(async (_input: any) => ({ id: "mock-final-mail" }))
);
vi.mock("./client-delivery", () => ({ sendClientReportPdf: finalMail }));
vi.setConfig({ testTimeout: 30000 });
const check = process.env.RUN_ORDER_MAIL_MYSQL_TESTS === "true" ? it : it.skip;
let db: any;
const ids: number[] = [],
  jobs: number[] = [],
  versions: number[] = [];
const original = globalThis.fetch;
beforeAll(async () => {
  if (process.env.RUN_ORDER_MAIL_MYSQL_TESTS !== "true") return;
  const u = new URL(process.env.DATABASE_URL || "");
  if (
    !["127.0.0.1", "localhost"].includes(u.hostname) ||
    !u.pathname.endsWith("_test")
  )
    throw Error("Disposable local DB only");
  db = await getDb();
});
afterAll(async () => {
  globalThis.fetch = original;
  if (jobs.length) {
    await db
      .delete(reportAuditEvents)
      .where(inArray(reportAuditEvents.reportJobId, jobs));
    await db
      .delete(reportDeliveryAttempts)
      .where(inArray(reportDeliveryAttempts.reportVersionId, versions));
    await db.delete(reportVersions).where(inArray(reportVersions.id, versions));
    await db.delete(reportJobs).where(inArray(reportJobs.id, jobs));
  }
  if (ids.length) {
    await db
      .delete(orderMailFlows)
      .where(inArray(orderMailFlows.bookingId, ids));
    await db
      .delete(clientAccessTokens)
      .where(inArray(clientAccessTokens.bookingId, ids));
    await db.delete(bookingRequests).where(inArray(bookingRequests.id, ids));
  }
});
async function booking(product = "tarot", locale = "en") {
  const r = await db.insert(bookingRequests).values({
    name: "Synthetic order mail audit",
    email: `order-mail-${crypto.randomUUID()}@sandbox.invalid`,
    birthDate: "1990-01-01",
    birthTime: "12:00",
    birthCity: "Berlin",
    birthCountry: "Germany",
    language: "English",
    totalUsd: 9.99,
    paymentStatus: "confirmed",
    packageCode: product,
    packageVersion: 1,
    priceSnapshotJson: JSON.stringify({
      orderMailV1: { locale, version: 1 },
      reading: { product },
    }),
  });
  const id = Number(r[0].insertId);
  ids.push(id);
  return (await getBookingRequestById(id))!;
}
check(
  "concurrent acceptance freezes one payload, delay and message; never releases early",
  async () => {
    const b = await booking();
    await Promise.all(Array.from({ length: 10 }, () => ensureOrderMailFlow(b)));
    const rows = await db
      .select()
      .from(orderMailFlows)
      .where(eq(orderMailFlows.bookingId, b.id));
    expect(rows).toHaveLength(1);
    let calls = 0;
    globalThis.fetch = vi.fn(async () => {
      calls++;
      return new Response(JSON.stringify({ id: "mock-one" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as any;
    await Promise.all([tickOrderMailFlows(), tickOrderMailFlows()]);
    const f = (await getOrderMailFlow(b.id))!;
    expect(calls).toBe(1);
    expect(f.ackState).toBe("accepted");
    expect(f.dueAt!.getTime() - f.ackAcceptedAt!.getTime()).toBe(
      f.delaySeconds * 1000
    );
    expect(await orderDeliverySchedule(b)).toMatchObject({
      status: "scheduled",
    });
    await tickOrderMailFlows();
    expect(calls).toBe(1);
  }
);
check(
  "ambiguous acceptance retries immutable bytes/key and preserves first-attempt time",
  async () => {
    const b = await booking("portrait", "de");
    await ensureOrderMailFlow(b);
    const requests: any[] = [];
    globalThis.fetch = vi.fn(async (_url: any, options: any) => {
      requests.push(options);
      throw Error("Synthetic timeout after possible acceptance");
    }) as any;
    await tickOrderMailFlows();
    let f = (await getOrderMailFlow(b.id))!;
    expect(f.ackState).toBe("retry");
    expect(f.ackStartedAt).toBeTruthy();
    const first = f.ackStartedAt!.getTime();
    await db
      .update(orderMailFlows)
      .set({ nextAttemptAt: new Date(Date.now() - 60000) })
      .where(eq(orderMailFlows.bookingId, b.id));
    globalThis.fetch = vi.fn(async (_url: any, options: any) => {
      requests.push(options);
      return new Response('{"id":"mock-retried"}', { status: 200 });
    }) as any;
    await tickOrderMailFlows();
    f = (await getOrderMailFlow(b.id))!;
    expect(f.ackState).toBe("accepted");
    expect(f.ackStartedAt!.getTime()).toBe(first);
    expect(requests[0].body).toBe(requests[1].body);
    expect(requests[0].headers["Idempotency-Key"]).toBe(
      requests[1].headers["Idempotency-Key"]
    );
  }
);
check(
  "expired provider window holds for reconciliation without sending",
  async () => {
    const b = await booking();
    await ensureOrderMailFlow(b);
    await db
      .update(orderMailFlows)
      .set({ ackStartedAt: new Date(Date.now() - 24 * 3600000) })
      .where(eq(orderMailFlows.bookingId, b.id));
    globalThis.fetch = vi.fn() as any;
    await tickOrderMailFlows();
    expect((await getOrderMailFlow(b.id))!.ackState).toBe("reconcile");
    expect(globalThis.fetch).not.toHaveBeenCalled();
  }
);
check("refund prevents acknowledgement and final schedule", async () => {
  const b = await booking();
  await ensureOrderMailFlow(b);
  await db
    .update(bookingRequests)
    .set({ paymentStatus: "refund_pending" })
    .where(eq(bookingRequests.id, b.id));
  globalThis.fetch = vi.fn() as any;
  await tickOrderMailFlows();
  expect(globalThis.fetch).not.toHaveBeenCalled();
  expect((await getOrderMailFlow(b.id))!.ackState).toBe("pending");
});
check("changed recipient cannot receive the accepted order PDF", async () => {
  const b = await booking();
  await ensureOrderMailFlow(b);
  await db
    .update(orderMailFlows)
    .set({
      ackState: "accepted",
      ackAcceptedAt: sql`NOW()`,
      dueAt: sql`DATE_ADD(NOW(), INTERVAL ${orderMailFlows.delaySeconds} SECOND)`,
    })
    .where(eq(orderMailFlows.bookingId, b.id));
  await db
    .update(bookingRequests)
    .set({ email: "changed@sandbox.invalid" })
    .where(eq(bookingRequests.id, b.id));
  await expect(
    orderDeliverySchedule((await getBookingRequestById(b.id))!)
  ).rejects.toThrow("changed");
});

check(
  "automatic approved report waits for its deadline then sends exactly once",
  async () => {
    const b = await booking("tarot", "es");
    await ensureOrderMailFlow(b);
    const now = new Date(Math.floor(Date.now() / 1000) * 1000);
    const delay = (await getOrderMailFlow(b.id))!.delaySeconds;
    await db
      .update(orderMailFlows)
      .set({
        ackState: "accepted",
        ackAcceptedAt: now,
        dueAt: new Date(now.getTime() + delay * 1000),
      })
      .where(eq(orderMailFlows.bookingId, b.id));
    const j = await db.insert(reportJobs).values({
      bookingId: b.id,
      packageType: "basic",
      language: "en",
      status: "approved",
      idempotencyKey: crypto.randomUUID(),
      inputHash: "synthetic",
    });
    const job = Number(j[0].insertId);
    jobs.push(job);
    const v = await db.insert(reportVersions).values({
      reportJobId: job,
      versionNumber: 1,
      templateVersion: "test",
      locale: "en",
      pdfStorageKey: "synthetic.pdf",
      pdfSha256: "a".repeat(64),
      status: "approved",
    });
    versions.push(Number(v[0].insertId));
    finalMail.mockClear();
    await tickOrderMailFlows();
    expect(finalMail).not.toHaveBeenCalled();
    await db
      .update(orderMailFlows)
      .set({
        acceptedAt: sql`DATE_SUB(NOW(), INTERVAL (${orderMailFlows.delaySeconds}+2) SECOND)`,
        ackAcceptedAt: sql`DATE_SUB(NOW(), INTERVAL (${orderMailFlows.delaySeconds}+1) SECOND)`,
        dueAt: sql`DATE_SUB(NOW(), INTERVAL 1 SECOND)`,
      })
      .where(eq(orderMailFlows.bookingId, b.id));
    await Promise.all([tickOrderMailFlows(), tickOrderMailFlows()]);
    expect(finalMail).toHaveBeenCalledTimes(1);
    expect(finalMail.mock.calls[0]?.[0]).toMatchObject({
      email: b.email,
      language: "Español",
      expectedPdfSha256: "a".repeat(64),
    });
    await tickOrderMailFlows();
    expect(finalMail).toHaveBeenCalledTimes(1);
  }
);

check("rejects a corrupted persisted deadline", async () => {
  const b = await booking();
  await ensureOrderMailFlow(b);
  await db
    .update(orderMailFlows)
    .set({
      ackState: "accepted",
      ackAcceptedAt: sql`NOW()`,
      dueAt: sql`DATE_ADD(NOW(), INTERVAL 1 SECOND)`,
    })
    .where(eq(orderMailFlows.bookingId, b.id));
  await expect(orderDeliverySchedule(b)).rejects.toThrow("integrity");
});
