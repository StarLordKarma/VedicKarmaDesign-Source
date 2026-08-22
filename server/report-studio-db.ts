import { createHash } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { calculationResults, calculationSnapshots, narrativeDrafts, reportAuditEvents, reportDeliveryAttempts, reportJobs, reportStudioProcessingSettings, reportVersions } from "../drizzle/schema";
import { getBookingRequestById, getDb } from "./db";
import { calculateVedicSnapshot } from "./vedic-astrology-calculator";
import { buildFullNatalReportPdf } from "./export";
import { resolveBirthLocation } from "./report-geocoding";
import { generateNarrativeDraft } from "./report-narrative";
import { storagePut } from "./storage";
import { sendClientReportPdf } from "./client-delivery";

const CONFIRMED_PAYMENT_STATUSES = new Set(["finished", "confirmed", "partially_paid"]);
const REPORT_TEMPLATE_VERSION = "parasara-light-9-v1";
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

export async function getReportProcessingSettings() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const row = (await db.select().from(reportStudioProcessingSettings).where(eq(reportStudioProcessingSettings.id, 1)).limit(1))[0];
  if (row) return row;
  await db.insert(reportStudioProcessingSettings).values({ id: 1, autoProcessEnabled: false, updatedBy: "system" });
  return (await db.select().from(reportStudioProcessingSettings).where(eq(reportStudioProcessingSettings.id, 1)).limit(1))[0];
}

export async function setReportProcessingSettings(input: { autoProcessEnabled: boolean; actorId: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(reportStudioProcessingSettings).values({ id: 1, autoProcessEnabled: input.autoProcessEnabled, updatedBy: input.actorId }).onDuplicateKeyUpdate({ set: { autoProcessEnabled: input.autoProcessEnabled, updatedBy: input.actorId } });
  return getReportProcessingSettings();
}

export async function isReportStudioAutoProcessingEnabled() {
  return (await getReportProcessingSettings())?.autoProcessEnabled === true;
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
  const narrative = (await db.select().from(narrativeDrafts).where(eq(narrativeDrafts.reportJobId, reportJobId)).orderBy(desc(narrativeDrafts.createdAt)).limit(1))[0];
  return { job, booking, versions, calculation: result, narrative };
}

export async function processReportJob(input: { reportJobId: number; actorId: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const current = (await db.select().from(reportJobs).where(eq(reportJobs.id, input.reportJobId)).limit(1))[0];
  if (!current) throw new Error("Report job not found");
  if (!["queued", "paid", "calculation_failed", "render_failed"].includes(current.status)) return { skipped: true, job: current };
  const booking = await getBookingRequestById(current.bookingId);
  if (!booking) throw new Error("Booking request not found");
  try {
    await db.update(reportJobs).set({ status: "calculating", startedAt: new Date(), attemptCount: current.attemptCount + 1, lastErrorCode: null, lastErrorMessage: null }).where(eq(reportJobs.id, current.id));
  const location = await resolveBirthLocation({ city: booking.birthCity, country: booking.birthCountry, birthDate: booking.birthDate, birthTime: booking.birthTime });
  const birthUtc = new Date(Date.UTC(Number(booking.birthDate.slice(0, 4)), Number(booking.birthDate.slice(5, 7)) - 1, Number(booking.birthDate.slice(8, 10)), Number(booking.birthTime.slice(0, 2)), Number(booking.birthTime.slice(3, 5))) - location.timeZoneOffsetMinutes * 60_000);
  const chartSettings = { zodiac: "sidereal", ayanamsa: "lahiri", dasha: "vimshottari", houseSystem: "whole-sign", packageType: current.packageType };
  const qualityFlags = { source: location.source, timezone: location.timezone, formattedAddress: location.formattedAddress, locationType: location.locationType, warnings: location.qualityFlags };
  const snapshotInput = { birthDateLocal: booking.birthDate, birthTimeLocal: booking.birthTime, latitude: location.latitude, longitude: location.longitude, timezone: location.timezone, timeZoneOffsetMinutes: location.timeZoneOffsetMinutes };
  const inputHash = sha256(JSON.stringify(snapshotInput));
  await db.insert(calculationSnapshots).values({ reportJobId: current.id, birthDateLocal: booking.birthDate, birthTimeLocal: booking.birthTime, birthCity: booking.birthCity, birthCountry: booking.birthCountry, latitude: String(location.latitude), longitude: String(location.longitude), timezone: location.timezone, birthInstantUtc: birthUtc, chartSettingsJson: JSON.stringify(chartSettings), qualityFlagsJson: JSON.stringify(qualityFlags), inputHash, confirmedAt: new Date() }).onDuplicateKeyUpdate({ set: { latitude: String(location.latitude), longitude: String(location.longitude), timezone: location.timezone, birthInstantUtc: birthUtc, chartSettingsJson: JSON.stringify(chartSettings), qualityFlagsJson: JSON.stringify(qualityFlags), inputHash } });
    const facts = calculateVedicSnapshot({ localDate: booking.birthDate, localTime: booking.birthTime, timeZoneOffsetMinutes: location.timeZoneOffsetMinutes, latitude: location.latitude, longitude: location.longitude });
    const factsJson = JSON.stringify(facts);
    const factsHash = sha256(factsJson);
    await db.insert(calculationResults).values({ reportJobId: current.id, schemaVersion: facts.contractVersion, engineName: facts.engine.adapter, engineVersion: facts.engine.engineVersion, ephemerisVersion: facts.engine.ephemerisMode, factsJson, factsHash, validationStatus: "valid" }).onDuplicateKeyUpdate({ set: { factsJson, factsHash, validationStatus: "valid", validationErrorsJson: null } });
    await db.update(reportJobs).set({ status: "narrative_draft", factsHash }).where(eq(reportJobs.id, current.id));
    const aiSettings = await getReportProcessingSettings();
    const narrative = await generateNarrativeDraft({ facts, locale: current.language as "ru" | "en" | "de", settings: { aiModel: aiSettings.aiModel as "gpt-5-nano" | "gpt-5-mini" | "gpt-5" | "claude-haiku-4-5" | "claude-sonnet-4-6" | "gemini-3-flash-preview", maxTokens: aiSettings.maxTokens, maxSections: aiSettings.maxSections, maxParagraphChars: aiSettings.maxParagraphChars } });
    await db.insert(narrativeDrafts).values({ reportJobId: current.id, locale: current.language, modelName: aiSettings.aiModel, modelVersion: narrative.modelVersion, promptVersion: narrative.promptVersion, narrativeJson: JSON.stringify(narrative), validationStatus: "valid", createdBy: "system" });
    const narrativeSummary = narrative.sections[0]?.paragraphs[0]?.slice(0, 600);
    const pdf = await buildFullNatalReportPdf({ background: EMPTY_BACKGROUND, locale: current.language as "ru" | "en" | "de", clientName: booking.name, packageType: current.packageType, narrative: { sections: narrative.sections.map((section) => ({ sectionKey: section.sectionKey, title: section.title, paragraphs: section.paragraphs, factRefs: section.factRefs })) }, facts });
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

export async function retryReportDelivery(input: { reportJobId: number; versionId: number; actorId: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const job = (await db.select().from(reportJobs).where(eq(reportJobs.id, input.reportJobId)).limit(1))[0];
  if (!job || job.status !== "delivery_failed") throw new Error("Manual resend is available only for delivery_failed jobs.");
  return deliverApprovedReport(input);
}

export async function deliverApprovedReport(input: { reportJobId: number; versionId: number; actorId: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const current = (await db.select().from(reportVersions).where(and(eq(reportVersions.id, input.versionId), eq(reportVersions.reportJobId, input.reportJobId))).limit(1))[0];
  if (!current || current.status !== "approved" || !current.pdfStorageKey) throw new Error("Only an approved report version can be delivered.");
  const job = (await db.select().from(reportJobs).where(eq(reportJobs.id, input.reportJobId)).limit(1))[0];
  if (!job) throw new Error("Report job not found");
  const bookingRequest = await getBookingRequestById(job.bookingId);
  if (!bookingRequest) throw new Error("Booking request not found");
  const idempotencyKey = `report:${current.id}:approved:${current.pdfSha256 ?? current.versionNumber}`;
  const existing = (await db.select().from(reportDeliveryAttempts).where(eq(reportDeliveryAttempts.idempotencyKey, idempotencyKey)).limit(1))[0];
  if (existing?.status === "sent") return { status: "sent" as const, providerMessageId: existing.providerMessageId };
  let attemptId = existing?.id;
  if (!attemptId) { const inserted = await db.insert(reportDeliveryAttempts).values({ reportVersionId: current.id, recipientEmail: bookingRequest.email.toLowerCase(), status: "sending", idempotencyKey, requestedBy: input.actorId }).onDuplicateKeyUpdate({ set: { status: "sending" } }); attemptId = Number(inserted[0].insertId); }
  try {
    const result = await sendClientReportPdf({ email: bookingRequest.email, name: bookingRequest.name, pdfKey: current.pdfStorageKey, pdfName: `vedic-report-${bookingRequest.id}.pdf`, language: bookingRequest.language });
    await db.update(reportDeliveryAttempts).set({ status: "sent", providerMessageId: result.id ?? null, completedAt: new Date() }).where(eq(reportDeliveryAttempts.id, attemptId));
    await db.update(reportVersions).set({ status: "sent" }).where(eq(reportVersions.id, current.id));
    await db.update(reportJobs).set({ status: "sent", finishedAt: new Date() }).where(eq(reportJobs.id, input.reportJobId));
    await db.insert(reportAuditEvents).values({ reportJobId: input.reportJobId, eventType: "approved_pdf_sent", actorType: "system", actorId: input.actorId, fromStatus: "approved", toStatus: "sent", metadataJson: JSON.stringify({ versionId: current.id, providerMessageId: result.id ?? null }) });
    return { status: "sent" as const, providerMessageId: result.id ?? null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Report delivery failed.";
    await db.update(reportDeliveryAttempts).set({ status: "failed", errorMessage: message.slice(0, 1000), completedAt: new Date() }).where(eq(reportDeliveryAttempts.id, attemptId));
    await db.update(reportJobs).set({ status: "delivery_failed", lastErrorCode: "DELIVERY_FAILED", lastErrorMessage: message.slice(0, 1000) }).where(eq(reportJobs.id, input.reportJobId));
    await db.insert(reportAuditEvents).values({ reportJobId: input.reportJobId, eventType: "approved_pdf_delivery_failed", actorType: "system", actorId: input.actorId, fromStatus: "approved", toStatus: "delivery_failed", metadataJson: JSON.stringify({ versionId: current.id }) });
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
  const delivery = await deliverApprovedReport({ reportJobId: input.reportJobId, versionId: version.id, actorId: input.actorId });
  return { approved: true, versionId: version.id, delivery };
}
