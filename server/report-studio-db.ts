import { createHash } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { calculationResults, calculationSnapshots, reportAuditEvents, reportJobs, reportVersions } from "../drizzle/schema";
import { getBookingRequestById, getDb } from "./db";
import { calculateVedicSnapshot } from "./vedic-astrology-calculator";
import { buildReportStylePreviewPdf } from "./export";
import { storagePut } from "./storage";

const CONFIRMED_PAYMENT_STATUSES = new Set(["finished", "confirmed", "partially_paid"]);
const REPORT_TEMPLATE_VERSION = "parasara-light-9-preview-v1";
const EMPTY_BACKGROUND = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");

function sha256(value: string) { return createHash("sha256").update(value).digest("hex"); }
function languageCode(language: string): "ru" | "en" | "de" { return language === "Русский" ? "ru" : language === "Deutsch" ? "de" : "en"; }

export async function enqueueReportJobForBooking(bookingId: number, confirmedBy = "system") {
  const booking = await getBookingRequestById(bookingId);
  if (!booking || !CONFIRMED_PAYMENT_STATUSES.has(booking.paymentStatus ?? "")) return { created: false, reason: "payment-not-confirmed" as const };
  const input = { bookingId, birthDate: booking.birthDate, birthTime: booking.birthTime, birthCity: booking.birthCity, birthCountry: booking.birthCountry, language: languageCode(booking.language), addon: Boolean(booking.addon) };
  const inputHash = sha256(JSON.stringify(input));
  const idempotencyKey = `${bookingId}:1:${inputHash}:${REPORT_TEMPLATE_VERSION}`;
  const db = await getDb();
  if (!db) return { created: false, reason: "database-unavailable" as const };
  const existing = await db.select().from(reportJobs).where(eq(reportJobs.idempotencyKey, idempotencyKey)).limit(1);
  if (existing[0]) return { created: false, duplicate: true, job: existing[0] };
  const result = await db.insert(reportJobs).values({ bookingId, reportVersion: 1, packageType: booking.addon ? "basic_plus" : "basic", language: input.language, status: "queued", idempotencyKey, inputHash, queuedAt: new Date() });
  const jobId = Number(result[0].insertId);
  await db.insert(reportAuditEvents).values({ reportJobId: jobId, eventType: "job_queued", actorType: "system", actorId: confirmedBy, fromStatus: "paid", toStatus: "queued", metadataJson: JSON.stringify({ bookingId }) });
  return { created: true, jobId, idempotencyKey };
}

export async function listReportReviewJobs() {
  const db = await getDb();
  if (!db) return [];
  return db.select({ job: reportJobs, version: reportVersions }).from(reportJobs).leftJoin(reportVersions, eq(reportVersions.reportJobId, reportJobs.id)).orderBy(desc(reportJobs.createdAt));
}

export async function getReportReviewJob(reportJobId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const job = (await db.select().from(reportJobs).where(eq(reportJobs.id, reportJobId)).limit(1))[0];
  if (!job) return undefined;
  const booking = await getBookingRequestById(job.bookingId);
  const versions = await db.select().from(reportVersions).where(eq(reportVersions.reportJobId, reportJobId)).orderBy(desc(reportVersions.versionNumber));
  const result = (await db.select().from(calculationResults).where(eq(calculationResults.reportJobId, reportJobId)).limit(1))[0];
  return { job, booking, versions, calculation: result };
}

export async function processReportJob(input: { reportJobId: number; latitude: number; longitude: number; timeZoneOffsetMinutes: number; timezone: string; actorId: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const current = (await db.select().from(reportJobs).where(eq(reportJobs.id, input.reportJobId)).limit(1))[0];
  if (!current) throw new Error("Report job not found");
  if (!["queued", "paid", "calculation_failed", "render_failed"].includes(current.status)) return { skipped: true, job: current };
  const booking = await getBookingRequestById(current.bookingId);
  if (!booking) throw new Error("Booking request not found");
  await db.update(reportJobs).set({ status: "calculating", startedAt: new Date(), attemptCount: current.attemptCount + 1, lastErrorCode: null, lastErrorMessage: null }).where(eq(reportJobs.id, current.id));
  const birthUtc = new Date(Date.UTC(Number(booking.birthDate.slice(0, 4)), Number(booking.birthDate.slice(5, 7)) - 1, Number(booking.birthDate.slice(8, 10)), Number(booking.birthTime.slice(0, 2)), Number(booking.birthTime.slice(3, 5))) - input.timeZoneOffsetMinutes * 60_000);
  const chartSettings = { zodiac: "sidereal", ayanamsa: "lahiri", dasha: "vimshottari", houseSystem: "whole-sign", packageType: current.packageType };
  const qualityFlags = { source: "owner-reviewed-location", timezone: input.timezone, warnings: [] };
  const snapshotInput = { birthDateLocal: booking.birthDate, birthTimeLocal: booking.birthTime, latitude: input.latitude, longitude: input.longitude, timezone: input.timezone, timeZoneOffsetMinutes: input.timeZoneOffsetMinutes };
  const inputHash = sha256(JSON.stringify(snapshotInput));
  await db.insert(calculationSnapshots).values({ reportJobId: current.id, birthDateLocal: booking.birthDate, birthTimeLocal: booking.birthTime, birthCity: booking.birthCity, birthCountry: booking.birthCountry, latitude: String(input.latitude), longitude: String(input.longitude), timezone: input.timezone, birthInstantUtc: birthUtc, chartSettingsJson: JSON.stringify(chartSettings), qualityFlagsJson: JSON.stringify(qualityFlags), inputHash, confirmedAt: new Date() }).onDuplicateKeyUpdate({ set: { latitude: String(input.latitude), longitude: String(input.longitude), timezone: input.timezone, birthInstantUtc: birthUtc, chartSettingsJson: JSON.stringify(chartSettings), qualityFlagsJson: JSON.stringify(qualityFlags), inputHash } });
  try {
    const facts = calculateVedicSnapshot({ localDate: booking.birthDate, localTime: booking.birthTime, timeZoneOffsetMinutes: input.timeZoneOffsetMinutes, latitude: input.latitude, longitude: input.longitude });
    const factsJson = JSON.stringify(facts);
    const factsHash = sha256(factsJson);
    await db.insert(calculationResults).values({ reportJobId: current.id, schemaVersion: facts.contractVersion, engineName: facts.engine.adapter, engineVersion: facts.engine.engineVersion, ephemerisVersion: facts.engine.ephemerisMode, factsJson, factsHash, validationStatus: "valid" }).onDuplicateKeyUpdate({ set: { factsJson, factsHash, validationStatus: "valid", validationErrorsJson: null } });
    const pdf = await buildReportStylePreviewPdf({ background: EMPTY_BACKGROUND, locale: current.language as "ru" | "en" | "de", clientName: booking.name, packageType: current.packageType });
    const stored = await storagePut(`report-studio/${current.id}/v1-preview.pdf`, pdf, "application/pdf");
    await db.insert(reportVersions).values({ reportJobId: current.id, versionNumber: 1, templateVersion: REPORT_TEMPLATE_VERSION, locale: current.language, pdfStorageKey: stored.key, pdfSha256: sha256(pdf.toString("base64")), status: "needs_review" });
    await db.update(reportJobs).set({ status: "needs_review", factsHash, finishedAt: new Date() }).where(eq(reportJobs.id, current.id));
    await db.insert(reportAuditEvents).values({ reportJobId: current.id, eventType: "pdf_ready_for_review", actorType: "system", fromStatus: "calculating", toStatus: "needs_review", metadataJson: JSON.stringify({ factsHash }) });
    return { skipped: false, status: "needs_review" as const, pdfUrl: stored.url };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Calculation failed";
    await db.update(reportJobs).set({ status: "calculation_failed", lastErrorCode: "CALCULATION_FAILED", lastErrorMessage: message.slice(0, 1000), finishedAt: new Date() }).where(eq(reportJobs.id, current.id));
    throw error;
  }
}

export async function approveReportVersion(input: { reportJobId: number; versionId: number; actorId: string; summary?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const version = (await db.select().from(reportVersions).where(and(eq(reportVersions.id, input.versionId), eq(reportVersions.reportJobId, input.reportJobId))).limit(1))[0];
  if (!version || !version.pdfStorageKey) throw new Error("Report version with PDF not found");
  await db.update(reportVersions).set({ status: "approved", approvedAt: new Date(), approvedBy: input.actorId, editorSummary: input.summary?.slice(0, 1000) ?? null }).where(eq(reportVersions.id, version.id));
  await db.update(reportJobs).set({ status: "approved", updatedAt: new Date() }).where(eq(reportJobs.id, input.reportJobId));
  await db.insert(reportAuditEvents).values({ reportJobId: input.reportJobId, eventType: "pdf_approved", actorType: "owner", actorId: input.actorId, fromStatus: "needs_review", toStatus: "approved", metadataJson: JSON.stringify({ versionId: input.versionId }) });
  return { approved: true, versionId: version.id };
}
