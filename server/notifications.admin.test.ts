import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import { notifyOwner } from "./_core/notification";
import type { TrpcContext } from "./_core/context";
import { ENV } from "./_core/env";
import { createSmokeTestRun, finishSmokeTestRun, getPricingHistory, getReceiptRetentionHours, getServicePricing, updateReceiptRetentionHours, updateServicePricing } from "./db";

function context(role: "user" | "admin", openId = "test-owner"): TrpcContext {
  const now = new Date();
  return {
    user: {
      id: 1,
      openId,
      email: "owner@example.com",
      name: "Owner",
      loginMethod: "manus",
      role,
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now,
    },
    req: { protocol: "https", headers: {}, get: () => "example.com" } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

const dbIt = process.env.DATABASE_URL ? it : it.skip;

describe("owner notifications and admin access", () => {
  it("dispatches an owner notification through the configured service", async () => {
    const fetchMock = vi.fn(async () => new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(notifyOwner({ title: "New booking", content: "Booking #1" })).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });

  it("rejects a non-admin from the booking list", async () => {
    const caller = appRouter.createCaller(context("user"));
    await expect(caller.admin.bookingList()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  dbIt("loads the activity summary for the configured owner", async () => {
    const caller = appRouter.createCaller(context("admin", ENV.ownerOpenId));
    const summary = await caller.admin.activitySummary({ from: "2020-01-01", to: "2099-12-31" });
    const pricing = await caller.admin.pricing();
    expect(pricing).toEqual(expect.arrayContaining([expect.objectContaining({ currency: "USD", basicUsd: expect.any(Number), numerologyAddonUsd: expect.any(Number) })]));
    expect(summary).toEqual(expect.objectContaining({
      deliveryFailureCount: expect.any(Number),
      pendingPaymentCount: expect.any(Number),
      recentlyEditedClientCount: expect.any(Number),
      deliveryFailures: expect.any(Array),
      pendingPayments: expect.any(Array),
      recentlyEditedClients: expect.any(Array),
    }));
  });

  dbIt("persists owner pricing updates and reads them back", async () => {
    const caller = appRouter.createCaller(context("admin", ENV.ownerOpenId));
    const original = await getServicePricing("USD");
    try {
      const updated = await caller.admin.updatePricing({ currency: "USD", basicUsd: 42, numerologyAddonUsd: 17 });
      expect(updated).toEqual({ basicUsd: 42, numerologyAddonUsd: 17 });
      await expect(caller.admin.pricing()).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ currency: "USD", basicUsd: 42, numerologyAddonUsd: 17 })]));
      const history = await getPricingHistory();
      expect(history).toEqual(expect.arrayContaining([expect.objectContaining({ currency: "USD", oldBasicAmount: original.basicUsd, oldNumerologyAddonAmount: original.numerologyAddonUsd, newBasicAmount: 42, newNumerologyAddonAmount: 17, changedBy: ENV.ownerOpenId, changedAt: expect.any(Date) })]));
      const historyWithNames = await caller.admin.pricingHistory();
      expect(historyWithNames.items).toEqual(expect.arrayContaining([expect.objectContaining({ changedBy: ENV.ownerOpenId, changedByName: ENV.ownerName })]));
    } finally {
      await updateServicePricing({ ...original, currency: "USD", updatedBy: ENV.ownerOpenId });
    }
  });

  dbIt("persists owner receipt retention and rejects non-owner changes", async () => {
    const owner = appRouter.createCaller(context("admin", ENV.ownerOpenId));
    const nonOwner = appRouter.createCaller(context("admin", "another-admin"));
    const original = await getReceiptRetentionHours();
    try {
      await expect(owner.admin.updateReceiptRetention({ retentionHours: 72 })).resolves.toEqual({ retentionHours: 72, updatedBy: ENV.ownerOpenId });
      await expect(owner.admin.receiptRetention()).resolves.toBe(72);
      await expect(nonOwner.admin.updateReceiptRetention({ retentionHours: 24 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    } finally {
      await updateReceiptRetentionHours(original, ENV.ownerOpenId);
    }
  });

  it("allows the manual smoke launcher only for the configured owner", async () => {
    const nonOwner = appRouter.createCaller(context("admin", "another-admin"));
    await expect(nonOwner.admin.runManualSmokeTest()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  dbIt("exports pricing history CSV only for the configured owner", async () => {
    const owner = appRouter.createCaller(context("admin", ENV.ownerOpenId));
    const nonOwner = appRouter.createCaller(context("admin", "another-admin"));
    const result = await owner.admin.exportPricingHistoryCsv();
    expect(result.filename).toMatch(/^jyotish-pricing-history-.*\.csv$/);
    expect(Buffer.from(result.contentBase64, "base64").toString("utf8")).toContain("Currency");
    await expect(nonOwner.admin.exportPricingHistoryCsv()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  dbIt("filters pricing history by currency and inclusive UTC date range", async () => {
    const caller = appRouter.createCaller(context("admin", ENV.ownerOpenId));
    const eurHistory = await caller.admin.pricingHistory({ currency: "EUR" });
    expect(eurHistory.items.every((entry) => entry.currency === "EUR")).toBe(true);
    const futureHistory = await caller.admin.pricingHistory({ from: "2099-01-01", to: "2099-12-31" });
    expect(futureHistory.items).toHaveLength(0);
    await expect(caller.admin.pricingHistory({ from: "2026-08-22", to: "2026-08-01" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  dbIt("paginates pricing history while preserving filter metadata", async () => {
    const caller = appRouter.createCaller(context("admin", ENV.ownerOpenId));
    const page = await caller.admin.pricingHistory({ page: 2, pageSize: 2, currency: "USD" });
    expect(page.page).toBe(2);
    expect(page.pageSize).toBe(2);
    expect(page.total).toBeGreaterThanOrEqual(page.items.length);
    expect(page.items.every((entry) => entry.currency === "USD")).toBe(true);
  });

  dbIt("records smoke-test runs and exposes them only to the owner", async () => {
    const runId = `production-smoke-${Date.now()}`;
    const owner = appRouter.createCaller(context("admin", ENV.ownerOpenId));
    const nonOwner = appRouter.createCaller(context("admin", "another-admin"));
    await createSmokeTestRun(runId);
    await finishSmokeTestRun({ runId, status: "succeeded", result: JSON.stringify({ ok: true, checkoutCurrency: "EUR" }), durationMs: 123 });
    const runs = await owner.admin.smokeTestRuns();
    expect(runs.items).toEqual(expect.arrayContaining([expect.objectContaining({ runId, status: "succeeded", durationMs: 123 })]));
    await expect(nonOwner.admin.smokeTestRuns()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(owner.admin.smokeTestRuns({ status: "succeeded", sort: "duration_desc", page: 1, pageSize: 10 })).resolves.toEqual(expect.objectContaining({ total: expect.any(Number), items: expect.any(Array) }));
  });

  dbIt("filters, sorts, and paginates smoke-test runs with correct metadata", async () => {
    const owner = appRouter.createCaller(context("admin", ENV.ownerOpenId));
    const base = Date.now();
    const runIds = [0, 1, 2].map((offset) => `production-smoke-${base + offset}`);
    for (const runId of runIds) await createSmokeTestRun(runId);
    await finishSmokeTestRun({ runId: runIds[0], status: "failed", result: JSON.stringify({ runId: runIds[0] }), durationMs: 300 });
    await finishSmokeTestRun({ runId: runIds[1], status: "failed", result: JSON.stringify({ runId: runIds[1] }), durationMs: 100 });
    await finishSmokeTestRun({ runId: runIds[2], status: "failed", result: JSON.stringify({ runId: runIds[2] }), durationMs: 200 });
    const page = await owner.admin.smokeTestRuns({ status: "failed", sort: "duration_asc", page: 1, pageSize: 50 });
    expect(page.page).toBe(1);
    expect(page.pageSize).toBe(50);
    expect(page.totalPages).toBe(Math.ceil(page.total / page.pageSize));
    expect(page.items.every((entry) => entry.status === "failed")).toBe(true);
    const durationValues = page.items.filter((entry) => entry.durationMs !== null).map((entry) => entry.durationMs as number);
    expect(durationValues).toEqual([...durationValues].sort((a, b) => a - b));
    const latest = await owner.admin.smokeTestRuns({ status: "failed", sort: "started_desc", page: 1, pageSize: 50 });
    const selectedLatest = latest.items.filter((entry) => runIds.includes(entry.runId));
    const selectedDurations = selectedLatest.map((entry) => entry.durationMs);
    expect(selectedDurations).toEqual(expect.arrayContaining([100, 200, 300]));
    const selectedIds = selectedLatest.map((entry) => entry.runId);
    expect(selectedIds).toEqual(expect.arrayContaining(runIds));
    const startedTimes = latest.items.map((entry) => new Date(entry.startedAt).getTime());
    expect(startedTimes.every((time, index) => index === 0 || startedTimes[index - 1] >= time)).toBe(true);
  });

  dbIt("rejects unsupported currencies and defaults missing public currency to USD", async () => {
    const owner = appRouter.createCaller(context("admin", ENV.ownerOpenId));
    const publicCaller = appRouter.createCaller(context("user"));
    await expect(owner.admin.updatePricing({ currency: "JPY" as never, basicUsd: 40, numerologyAddonUsd: 15 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(publicCaller.pricing.current({ currency: "JPY" as never })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    const defaultPublicPricing = await publicCaller.pricing.current();
    const explicitUsdPricing = await getServicePricing("USD");
    expect(defaultPublicPricing).toEqual(explicitUsdPricing);
  });

  it("rejects invalid activity ranges before querying activity data", async () => {
    const caller = appRouter.createCaller(context("admin", ENV.ownerOpenId));
    await expect(caller.admin.activitySummary({ from: "2026-02-01", to: "2026-01-01" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  dbIt("exports the owner activity CSV for the configured owner", async () => {
    const caller = appRouter.createCaller(context("admin", ENV.ownerOpenId));
    const result = await caller.admin.exportActivityCsv({ from: "2020-01-01", to: "2099-12-31" });
    expect(result.filename).toMatch(/^jyotish-activity-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(Buffer.from(result.contentBase64, "base64").toString("utf8")).toContain("Event type");
  });

  it("rejects an admin-role user whose identity is not the configured owner", async () => {
    const caller = appRouter.createCaller(context("admin", "another-admin-open-id"));
    await expect(caller.admin.bookingList()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.admin.activitySummary()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.admin.pricing()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.admin.updatePricing({ basicUsd: 40, numerologyAddonUsd: 15 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects a non-owner from every admin write/export action", async () => {
    const caller = appRouter.createCaller(context("admin", "another-admin-open-id"));
    await expect(caller.admin.updateBooking({ id: 1, status: "completed" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.admin.exportCsv()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.admin.exportPdf()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.admin.exportActivityCsv()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.admin.updatePaymentTestLabNotificationLocale({ notificationLocale: "de" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.admin.paymentTestLabCleanupHistory()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.admin.exportPaymentTestLabCleanupHistoryCsv()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.admin.attachNatalPdf({ bookingId: 1, fileName: "chart.pdf", contentBase64: "JVBERi0xLjQ=" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects a non-admin and unauthenticated caller from PDF delivery", async () => {
    const nonAdmin = appRouter.createCaller(context("user"));
    await expect(nonAdmin.admin.sendNatalPdf({ bookingId: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const unauthenticated = appRouter.createCaller({ ...context("user"), user: null });
    await expect(unauthenticated.admin.sendNatalPdf({ bookingId: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
