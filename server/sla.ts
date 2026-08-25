import { and, asc, avg, count, desc, eq, gte, isNull, like, lt, or, sql } from "drizzle-orm";
import { notifyOwner } from "./_core/notification";
import { logStructuredEvent } from "./observability";
import { bookingRequests, operationalAlerts, reportJobs, slaEvaluationRuns, slaSettings } from "../drizzle/schema";
import { getDb } from "./db";

const SETTINGS_ID = 1;

export type SlaViolationTrendPoint = {
  date: string;
  preparationViolations: number;
  deliveryViolations: number;
  totalViolations: number;
};

export function aggregateSlaViolationTrend(runs: Array<{ evaluatedAt: Date; preparationViolations: number; deliveryViolations: number }>): SlaViolationTrendPoint[] {
  const byDay = new Map<string, SlaViolationTrendPoint>();
  for (const run of runs) {
    const date = run.evaluatedAt.toISOString().slice(0, 10);
    const point = byDay.get(date) ?? { date, preparationViolations: 0, deliveryViolations: 0, totalViolations: 0 };
    point.preparationViolations += run.preparationViolations;
    point.deliveryViolations += run.deliveryViolations;
    point.totalViolations += run.preparationViolations + run.deliveryViolations;
    byDay.set(date, point);
  }
  return Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export type SlaErrorSummary = { errorCode: string; count: number; latestAt: Date | null };

export function aggregateTopSlaErrors(runs: Array<{ errorCode: string | null; evaluatedAt?: Date | null }>, limit = 3): SlaErrorSummary[] {
  const grouped = new Map<string, SlaErrorSummary>();
  for (const run of runs) {
    const errorCode = run.errorCode?.trim();
    if (!errorCode) continue;
    const current = grouped.get(errorCode) ?? { errorCode, count: 0, latestAt: null };
    current.count += 1;
    if (run.evaluatedAt && (!current.latestAt || run.evaluatedAt > current.latestAt)) current.latestAt = run.evaluatedAt;
    grouped.set(errorCode, current);
  }
  return Array.from(grouped.values()).sort((a, b) => b.count - a.count || a.errorCode.localeCompare(b.errorCode)).slice(0, Math.max(0, limit));
}

export type SlaEvaluationRunFilters = {
  status?: "succeeded" | "disabled" | "failed";
  trigger?: "heartbeat" | "manual";
  from?: string;
  to?: string;
  sort?: "evaluated_desc" | "evaluated_asc" | "duration_desc" | "duration_asc";
  page?: number;
  pageSize?: number;
  search?: string;
  errorCode?: string;
};

function runConditions(filters: SlaEvaluationRunFilters) {
  const conditions = [] as any[];
  if (filters.from) conditions.push(gte(slaEvaluationRuns.evaluatedAt, new Date(`${filters.from}T00:00:00.000Z`)));
  if (filters.to) { const end = new Date(`${filters.to}T00:00:00.000Z`); end.setUTCDate(end.getUTCDate() + 1); conditions.push(lt(slaEvaluationRuns.evaluatedAt, end)); }
  if (filters.status) conditions.push(eq(slaEvaluationRuns.status, filters.status));
  if (filters.trigger) conditions.push(eq(slaEvaluationRuns.trigger, filters.trigger));
  if (filters.errorCode) conditions.push(like(slaEvaluationRuns.errorCode, `%${filters.errorCode.slice(0, 120)}%`));
  if (filters.search) {
    const term = `%${filters.search.slice(0, 120)}%`;
    conditions.push(or(sql`CAST(${slaEvaluationRuns.id} AS CHAR) LIKE ${term}`, like(slaEvaluationRuns.errorCode, term), like(slaEvaluationRuns.status, term), like(slaEvaluationRuns.trigger, term)));
  }
  return conditions;
}

export type SlaSettingsInput = {
  enabled: boolean;
  preparationHours: number;
  deliveryHours: number;
  alertCooldownMinutes: number;
  updatedBy: string;
};

export async function getSlaSettings() {
  const db = await getDb();
  if (!db) return { id: SETTINGS_ID, enabled: true, preparationHours: 48, deliveryHours: 24, alertCooldownMinutes: 60, updatedBy: "system" };
  const current = (await db.select().from(slaSettings).where(eq(slaSettings.id, SETTINGS_ID)).limit(1))[0];
  return current ?? { id: SETTINGS_ID, enabled: true, preparationHours: 48, deliveryHours: 24, alertCooldownMinutes: 60, updatedBy: "system" };
}

export async function setSlaSettings(input: SlaSettingsInput) {
  if (!Number.isInteger(input.preparationHours) || input.preparationHours < 1 || input.preparationHours > 720) throw new Error("Invalid preparation SLA.");
  if (!Number.isInteger(input.deliveryHours) || input.deliveryHours < 1 || input.deliveryHours > 720) throw new Error("Invalid delivery SLA.");
  if (!Number.isInteger(input.alertCooldownMinutes) || input.alertCooldownMinutes < 5 || input.alertCooldownMinutes > 10080) throw new Error("Invalid alert cooldown.");
  const db = await getDb();
  if (!db) throw new Error("Database is not available.");
  await db.insert(slaSettings).values({ id: SETTINGS_ID, enabled: input.enabled, preparationHours: input.preparationHours, deliveryHours: input.deliveryHours, alertCooldownMinutes: input.alertCooldownMinutes, updatedBy: input.updatedBy }).onDuplicateKeyUpdate({ set: { enabled: input.enabled, preparationHours: input.preparationHours, deliveryHours: input.deliveryHours, alertCooldownMinutes: input.alertCooldownMinutes, updatedBy: input.updatedBy } });
  return getSlaSettings();
}

async function scalar(query: Promise<Array<{ value: number | string | null }>>) {
  const rows = await query;
  return Number(rows[0]?.value ?? 0);
}

export async function evaluateSla(options: { trigger?: "heartbeat" | "manual"; actor?: string } = {}) {
  const db = await getDb();
  const trigger = options.trigger ?? "manual";
  const actor = (options.actor ?? "system").slice(0, 64);
  const startedAt = Date.now();
  if (!db) return { enabled: false, evaluated: 0, alertsCreated: 0, notificationsSent: 0 };
  const settings = await getSlaSettings();
  if (!settings.enabled) {
    await db.insert(slaEvaluationRuns).values({ trigger, status: "disabled", evaluatedAt: new Date(), durationMs: Date.now() - startedAt, actor });
    return { enabled: false, evaluated: 0, alertsCreated: 0, notificationsSent: 0 };
  }
  const now = Date.now();
  const jobs = await db.select({ id: reportJobs.id, status: reportJobs.status, createdAt: reportJobs.createdAt, updatedAt: reportJobs.updatedAt }).from(reportJobs).limit(500);
  const preparationCutoff = now - settings.preparationHours * 3600000;
  const overduePreparation = jobs.filter(job => ["queued", "calculating", "narrative_draft", "rendering", "draft_ready", "needs_review"].includes(job.status) && job.createdAt.getTime() < preparationCutoff);
  const deliveryCutoff = now - settings.deliveryHours * 3600000;
  const overdueDelivery = jobs.filter(job => ["approved", "sending"].includes(job.status) && job.updatedAt.getTime() < deliveryCutoff);
  const candidates = [
    ...(overduePreparation.length ? [{ type: "report_preparation_overdue", severity: "warning" as const, count: overduePreparation.length, summary: `${overduePreparation.length} report job(s) exceeded the preparation SLA.` }] : []),
    ...(overdueDelivery.length ? [{ type: "report_delivery_overdue", severity: "critical" as const, count: overdueDelivery.length, summary: `${overdueDelivery.length} approved report job(s) exceeded the delivery SLA.` }] : []),
  ];
  let alertsCreated = 0;
  let notificationsSent = 0;
  for (const candidate of candidates) {
    const fingerprint = `sla:${candidate.type}`;
    const existing = (await db.select().from(operationalAlerts).where(eq(operationalAlerts.fingerprint, fingerprint)).limit(1))[0];
    const shouldNotify = !existing?.lastNotifiedAt || existing.lastNotifiedAt.getTime() + settings.alertCooldownMinutes * 60000 <= now;
    if (!existing) {
      await db.insert(operationalAlerts).values({ alertType: candidate.type, fingerprint, severity: candidate.severity, status: "open", count: candidate.count, summary: candidate.summary, metadataJson: JSON.stringify({ evaluatedAt: new Date(now).toISOString() }) });
      alertsCreated += 1;
    } else {
      await db.update(operationalAlerts).set({ severity: candidate.severity, status: "open", count: candidate.count, summary: candidate.summary, lastSeenAt: new Date(now), resolvedAt: null, ...(shouldNotify ? { lastNotifiedAt: new Date(now) } : {}) }).where(eq(operationalAlerts.id, existing.id));
    }
    if (shouldNotify) {
      const sent = await notifyOwner({ title: "Jyotish SLA alert", content: candidate.summary });
      if (sent) notificationsSent += 1;
      if (!existing && sent) await db.update(operationalAlerts).set({ lastNotifiedAt: new Date(now) }).where(eq(operationalAlerts.fingerprint, fingerprint));
    }
  }
  await db.insert(slaEvaluationRuns).values({ trigger, status: "succeeded", evaluatedAt: new Date(now), durationMs: Date.now() - startedAt, jobsEvaluated: jobs.length, preparationViolations: overduePreparation.length, deliveryViolations: overdueDelivery.length, alertsCreated, notificationsSent, actor });
  logStructuredEvent("info", "sla.evaluated", { evaluated: jobs.length, overduePreparation: overduePreparation.length, overdueDelivery: overdueDelivery.length, alertsCreated, notificationsSent, trigger });
  return { enabled: true, evaluated: jobs.length, overduePreparation: overduePreparation.length, overdueDelivery: overdueDelivery.length, alertsCreated, notificationsSent };
}

export async function getOwnerMetrics(sinceInput?: Date, untilInput?: Date) {
  const db = await getDb();
  const since = sinceInput && !Number.isNaN(sinceInput.getTime()) ? sinceInput : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const until = untilInput && !Number.isNaN(untilInput.getTime()) ? untilInput : undefined;
  const range = (column: any) => until ? and(gte(column, since), lt(column, until)) : gte(column, since);
  if (!db) return { since: since.toISOString(), bookings: 0, paidBookings: 0, completedBookings: 0, failedDeliveries: 0, queuedReports: 0, sentReports: 0, openAlerts: 0, averageSlaResponseMs: 0, recentAlerts: [], recentSlaRuns: [], slaViolationTrend: [], topWeeklyErrors: [] };
  const [bookings, paidBookings, completedBookings, failedDeliveries, queuedReports, sentReports, openAlerts, averageSlaResponseMs] = await Promise.all([
    scalar(db.select({ value: count() }).from(bookingRequests).where(range(bookingRequests.createdAt))),
    scalar(db.select({ value: count() }).from(bookingRequests).where(and(range(bookingRequests.createdAt), eq(bookingRequests.paymentStatus, "finished")))),
    scalar(db.select({ value: count() }).from(bookingRequests).where(and(range(bookingRequests.createdAt), eq(bookingRequests.status, "completed")))),
    scalar(db.select({ value: count() }).from(reportJobs).where(and(range(reportJobs.createdAt), eq(reportJobs.status, "delivery_failed")))),
    scalar(db.select({ value: count() }).from(reportJobs).where(and(range(reportJobs.createdAt), eq(reportJobs.status, "queued")))),
    scalar(db.select({ value: count() }).from(reportJobs).where(and(range(reportJobs.createdAt), eq(reportJobs.status, "sent")))),
    scalar(db.select({ value: count() }).from(operationalAlerts).where(and(eq(operationalAlerts.status, "open"), isNull(operationalAlerts.resolvedAt)))),
    scalar(db.select({ value: avg(slaEvaluationRuns.durationMs) }).from(slaEvaluationRuns).where(and(range(slaEvaluationRuns.evaluatedAt), eq(slaEvaluationRuns.status, "succeeded")))),
  ]);
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setUTCHours(0, 0, 0, 0);
  const daysFromMonday = (weekStart.getUTCDay() + 6) % 7;
  weekStart.setUTCDate(weekStart.getUTCDate() - daysFromMonday);
  const [recentAlerts, recentSlaRuns, trendRuns, weeklyErrorRuns] = await Promise.all([
    db.select({ id: operationalAlerts.id, alertType: operationalAlerts.alertType, severity: operationalAlerts.severity, status: operationalAlerts.status, count: operationalAlerts.count, summary: operationalAlerts.summary, firstSeenAt: operationalAlerts.firstSeenAt, lastSeenAt: operationalAlerts.lastSeenAt }).from(operationalAlerts).where(eq(operationalAlerts.status, "open")).orderBy(desc(operationalAlerts.lastSeenAt)).limit(20),
    db.select().from(slaEvaluationRuns).where(range(slaEvaluationRuns.evaluatedAt)).orderBy(desc(slaEvaluationRuns.evaluatedAt)).limit(20),
    db.select({ evaluatedAt: slaEvaluationRuns.evaluatedAt, preparationViolations: slaEvaluationRuns.preparationViolations, deliveryViolations: slaEvaluationRuns.deliveryViolations }).from(slaEvaluationRuns).where(and(range(slaEvaluationRuns.evaluatedAt), eq(slaEvaluationRuns.status, "succeeded"))).orderBy(asc(slaEvaluationRuns.evaluatedAt)).limit(1000),
    db.select({ errorCode: slaEvaluationRuns.errorCode, evaluatedAt: slaEvaluationRuns.evaluatedAt }).from(slaEvaluationRuns).where(and(gte(slaEvaluationRuns.evaluatedAt, weekStart), eq(slaEvaluationRuns.status, "failed"))).orderBy(desc(slaEvaluationRuns.evaluatedAt)).limit(1000),
  ]);
  return { since: since.toISOString(), bookings, paidBookings, completedBookings, failedDeliveries, queuedReports, sentReports, openAlerts, averageSlaResponseMs, recentAlerts, recentSlaRuns, slaViolationTrend: aggregateSlaViolationTrend(trendRuns), topWeeklyErrors: aggregateTopSlaErrors(weeklyErrorRuns) };
}


export async function getSlaEvaluationRuns(filters: SlaEvaluationRunFilters = {}) {
  const db = await getDb();
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, filters.pageSize ?? 10));
  if (!db) return { items: [], total: 0, page, pageSize, totalPages: 0 };
  const conditions = runConditions(filters);
  const where = conditions.length ? and(...conditions) : undefined;
  const order = filters.sort === "evaluated_asc"
    ? asc(slaEvaluationRuns.evaluatedAt)
    : filters.sort === "duration_desc"
      ? desc(slaEvaluationRuns.durationMs)
      : filters.sort === "duration_asc"
        ? asc(slaEvaluationRuns.durationMs)
        : desc(slaEvaluationRuns.evaluatedAt);
  const [items, total] = await Promise.all([
    db.select().from(slaEvaluationRuns).where(where).orderBy(order).limit(pageSize).offset((page - 1) * pageSize),
    scalar(db.select({ value: count() }).from(slaEvaluationRuns).where(where)),
  ]);
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}
