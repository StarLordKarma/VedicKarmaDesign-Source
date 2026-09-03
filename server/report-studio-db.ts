import { createHash } from "node:crypto";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { calculationResults, calculationSnapshots, narrativeDrafts, reportAuditEvents, reportDeliveryAttempts, reportJobs, reportSections, reportStudioProcessingSettings, reportVersions } from "../drizzle/schema";
import { createBookingRequest, deleteBookingRequest, getBookingRequestById, getDb } from "./db";
import { calculateVedicSnapshot } from "./vedic-astrology-calculator";
import { buildFullNatalReportPdf } from "./export";
import { resolveBirthLocation } from "./report-geocoding";
import { generateNarrativeDraft, validateNarrativeDraft } from "./report-narrative";
import { storagePut } from "./storage";
import { sendClientReportPdf } from "./client-delivery";

const CONFIRMED_PAYMENT_STATUSES = new Set(["finished", "confirmed"]);
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
  const existing = await db.select().from(reportJobs).where(and(eq(reportJobs.bookingId, bookingId), eq(reportJobs.reportVersion, 1))).limit(1);
  if (existing[0]) return { created: false, duplicate: true, job: existing[0] };
  const result = await db.insert(reportJobs).values({ bookingId, reportVersion: 1, packageType: booking.addon ? "basic_plus" : "basic", language: input.language, status: "queued", idempotencyKey, inputHash, queuedAt: new Date() }).onDuplicateKeyUpdate({ set: { idempotencyKey } });
  const jobId = Number(result[0].insertId);
  if (!jobId) {
    const duplicate = (await db.select().from(reportJobs).where(eq(reportJobs.idempotencyKey, idempotencyKey)).limit(1))[0];
    return { created: false, duplicate: true, job: duplicate };
  }
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

export async function setReportProcessingSettings(input: { autoProcessEnabled: boolean; actorId: string; aiModel?: string; maxTokens?: number; maxSections?: number; maxParagraphChars?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const values = { autoProcessEnabled: input.autoProcessEnabled, updatedBy: input.actorId, ...(input.aiModel !== undefined ? { aiModel: input.aiModel } : {}), ...(input.maxTokens !== undefined ? { maxTokens: input.maxTokens } : {}), ...(input.maxSections !== undefined ? { maxSections: input.maxSections } : {}), ...(input.maxParagraphChars !== undefined ? { maxParagraphChars: input.maxParagraphChars } : {}) };
  await db.insert(reportStudioProcessingSettings).values({ id: 1, ...values }).onDuplicateKeyUpdate({ set: values });
  return getReportProcessingSettings();
}

export async function isReportStudioAutoProcessingEnabled() {
  return (await getReportProcessingSettings())?.autoProcessEnabled === true;
}

export async function listReportReviewJobs() {
  const db = await getDb();
  if (!db) return [];
  return db.select({ job: reportJobs, version: reportVersions }).from(reportJobs).leftJoin(reportVersions, and(eq(reportVersions.reportJobId, reportJobs.id), sql`${reportVersions.versionNumber} = (select max(rv.versionNumber) from report_versions rv where rv.reportJobId = ${reportJobs.id})`)).orderBy(desc(reportJobs.createdAt));
}

export async function createReportStudioTestJob(input: { packageType: "basic" | "basic_plus"; language: "en" | "ru" | "de"; actorId: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const runId = `report-studio-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const booking = await createBookingRequest({ name: "Report Studio synthetic test", email: `${runId}@example.com`, birthDate: "1990-01-01", birthTime: "12:00", birthCity: "Berlin", birthCountry: "Germany", language: input.language === "ru" ? "Русский" : input.language === "de" ? "Deutsch" : "English", addon: input.packageType === "basic_plus" ? 1 : 0, packageCode: input.packageType, packageVersion: 1, priceSnapshotJson: JSON.stringify({ testJob: true, packageCode: input.packageType }), totalUsd: 0, currency: "USD", interest: "Synthetic owner-only Report Studio test. Never deliver to a client.", paymentStatus: "confirmed", status: "in_progress" });
  const inputHash = sha256(JSON.stringify({ runId, bookingId: booking.id, packageType: input.packageType, language: input.language }));
  const inserted = await db.insert(reportJobs).values({ bookingId: booking.id, reportVersion: 1, packageType: input.packageType, language: input.language, status: "queued", testJob: true, idempotencyKey: `test:${runId}`, inputHash, queuedAt: new Date() });
  const jobId = Number(inserted[0].insertId);
  await db.insert(reportAuditEvents).values({ reportJobId: jobId, eventType: "test_job_queued", actorType: "owner", actorId: input.actorId, fromStatus: "paid", toStatus: "queued", metadataJson: JSON.stringify({ synthetic: true, bookingId: booking.id }) });
  return { jobId, bookingId: booking.id, testJob: true as const };
}

export async function deleteReportStudioTestJob(input: { reportJobId: number; actorId: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const job = (await db.select().from(reportJobs).where(eq(reportJobs.id, input.reportJobId)).limit(1))[0];
  if (!job || !job.testJob) throw new Error("Only synthetic test jobs can be deleted.");
  const versions = await db.select({ id: reportVersions.id }).from(reportVersions).where(eq(reportVersions.reportJobId, job.id));
  const versionIds = versions.map((entry) => entry.id);
  if (versionIds.length) {
    await db.delete(reportSections).where(inArray(reportSections.reportVersionId, versionIds));
    await db.delete(reportDeliveryAttempts).where(inArray(reportDeliveryAttempts.reportVersionId, versionIds));
    await db.delete(reportVersions).where(inArray(reportVersions.id, versionIds));
  }
  await db.delete(calculationSnapshots).where(eq(calculationSnapshots.reportJobId, job.id));
  await db.delete(calculationResults).where(eq(calculationResults.reportJobId, job.id));
  await db.delete(narrativeDrafts).where(eq(narrativeDrafts.reportJobId, job.id));
  await db.delete(reportAuditEvents).where(eq(reportAuditEvents.reportJobId, job.id));
  await db.delete(reportJobs).where(eq(reportJobs.id, job.id));
  await deleteBookingRequest(job.bookingId);
  return { deleted: true as const, reportJobId: input.reportJobId };
}

export async function getReportReviewJob(reportJobId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const job = (await db.select().from(reportJobs).where(eq(reportJobs.id, reportJobId)).limit(1))[0];
  if (!job) return undefined;
  const booking = await getBookingRequestById(job.bookingId);
  const versions = await db.select().from(reportVersions).where(eq(reportVersions.reportJobId, reportJobId)).orderBy(desc(reportVersions.versionNumber));
  const result = (await db.select().from(calculationResults).where(eq(calculationResults.reportJobId, reportJobId)).limit(1))[0];
  const narrative = (await db.select().from(narrativeDrafts).where(eq(narrativeDrafts.reportJobId, reportJobId)).orderBy(desc(narrativeDrafts.createdAt), desc(narrativeDrafts.id)).limit(1))[0];
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
  if (current.attemptCount >= 3) throw new Error("Retry limit reached. Review the cause before creating a new report job.");
  if (!current.testJob) {
    const frozenHash = sha256(JSON.stringify({ bookingId: booking.id, birthDate: booking.birthDate, birthTime: booking.birthTime, birthCity: booking.birthCity, birthCountry: booking.birthCountry, language: languageCode(booking.language), addon: Boolean(booking.addon) }));
    if (frozenHash !== current.inputHash) throw new Error("Birth details changed after payment. A new reviewed snapshot is required.");
  }
  try {
    const claim = await db.update(reportJobs)
      .set({ status: "calculating", startedAt: new Date(), attemptCount: current.attemptCount + 1, lastErrorCode: null, lastErrorMessage: null })
      .where(and(eq(reportJobs.id, current.id), eq(reportJobs.status, current.status)));
    if (Number(claim[0].affectedRows ?? 0) !== 1) {
      return { skipped: true, job: current, reason: "already-claimed" as const };
    }
  const location = await resolveBirthLocation({ city: booking.birthCity, country: booking.birthCountry, birthDate: booking.birthDate, birthTime: booking.birthTime });
  if (location.qualityFlags.length) throw new Error(`Birth location requires manual review: ${location.qualityFlags.join(", ")}`);
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
  if (job.testJob) throw new Error("Synthetic test reports cannot be delivered to clients.");
  const bookingRequest = await getBookingRequestById(job.bookingId);
  if (!bookingRequest) throw new Error("Booking request not found");
  const idempotencyKey = `report:${current.id}:approved:${current.pdfSha256 ?? current.versionNumber}`;
  let existing = (await db.select().from(reportDeliveryAttempts).where(eq(reportDeliveryAttempts.idempotencyKey, idempotencyKey)).limit(1))[0];
  if (existing?.status === "sent") return { status: "sent" as const, providerMessageId: existing.providerMessageId };
  if (!existing) {
    await db.insert(reportDeliveryAttempts)
      .values({ reportVersionId: current.id, recipientEmail: bookingRequest.email.toLowerCase(), status: "queued", idempotencyKey, requestedBy: input.actorId })
      .onDuplicateKeyUpdate({ set: { idempotencyKey } });
    existing = (await db.select().from(reportDeliveryAttempts).where(eq(reportDeliveryAttempts.idempotencyKey, idempotencyKey)).limit(1))[0];
  }
  if (!existing) throw new Error("Could not create report delivery attempt.");
  const claim = await db.update(reportDeliveryAttempts)
    .set({ status: "sending", errorCode: null, errorMessage: null, completedAt: null })
    .where(and(eq(reportDeliveryAttempts.id, existing.id), inArray(reportDeliveryAttempts.status, ["queued", "failed"])));
  if (Number(claim[0].affectedRows ?? 0) !== 1) {
    return { status: existing.status === "sent" ? "sent" as const : "sending" as const, providerMessageId: existing.providerMessageId };
  }
  const attemptId = existing.id;
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
  const job = (await db.select().from(reportJobs).where(eq(reportJobs.id, input.reportJobId)).limit(1))[0];
  if (!job || job.testJob) throw new Error("Synthetic test reports cannot be approved or delivered.");
  if (job.status !== "needs_review") throw new Error("This job is not awaiting owner review.");
  const calculation = (await db.select().from(calculationResults).where(eq(calculationResults.reportJobId, job.id)).limit(1))[0];
  if (calculation?.validationStatus !== "valid") throw new Error("Validated calculation facts are required before approval.");
  if (version.status !== "needs_review") throw new Error("Only a report awaiting review can be approved.");
  await db.transaction(async tx => {
    const claim = await tx.update(reportJobs).set({ status: "approved", updatedAt: new Date() }).where(and(eq(reportJobs.id, input.reportJobId), eq(reportJobs.status, "needs_review")));
    if (Number(claim[0].affectedRows ?? 0) !== 1) throw new Error("The report is being changed. Refresh the job.");
    const approval = await tx.update(reportVersions).set({ status: "approved", approvedAt: new Date(), approvedBy: input.actorId, editorSummary: input.summary?.slice(0, 1000) ?? null }).where(and(eq(reportVersions.id, version.id), eq(reportVersions.status, "needs_review")));
    if (Number(approval[0].affectedRows ?? 0) !== 1) throw new Error("This version has already been reviewed. Refresh the job.");
    await tx.insert(reportAuditEvents).values({ reportJobId: input.reportJobId, eventType: "pdf_approved", actorType: "owner", actorId: input.actorId, fromStatus: "needs_review", toStatus: "approved", metadataJson: JSON.stringify({ versionId: input.versionId }) });
  });
  const delivery = await deliverApprovedReport({ reportJobId: input.reportJobId, versionId: version.id, actorId: input.actorId });
  return { approved: true, versionId: version.id, delivery };
}

export async function reviseReportNarrative(input: { reportJobId: number; baseVersionId: number; narrativeJson: string; actorId: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const detail = await getReportReviewJob(input.reportJobId);
  const base = detail?.versions[0];
  if (!detail?.booking || !base || base.id !== input.baseVersionId || base.status !== "needs_review" || detail.job.status !== "needs_review") throw new Error("Only the current unapproved draft can be edited. Refresh the report.");
  if (detail.calculation?.validationStatus !== "valid") throw new Error("Validated facts are required.");
  const facts = JSON.parse(detail.calculation.factsJson);
  const narrative = validateNarrativeDraft(JSON.parse(input.narrativeJson), facts);
  if (narrative.locale !== detail.job.language) throw new Error("Narrative language must match the report.");
  const claim = await db.update(reportJobs).set({ status: "rendering" }).where(and(eq(reportJobs.id, detail.job.id), eq(reportJobs.status, "needs_review")));
  if (Number(claim[0].affectedRows ?? 0) !== 1) throw new Error("This report is being changed by another request.");
  try {
    const versionNumber = base.versionNumber + 1;
    const pdf = await buildFullNatalReportPdf({ background: EMPTY_BACKGROUND, locale: narrative.locale, clientName: detail.booking.name, packageType: detail.job.packageType, narrative, facts });
    const stored = await storagePut(`report-studio/${detail.job.id}/v${versionNumber}-preview.pdf`, pdf, "application/pdf");
    await db.transaction(async tx => {
      await tx.insert(narrativeDrafts).values({ reportJobId: detail.job.id, locale: narrative.locale, modelName: detail.narrative?.modelName ?? "owner-edited", modelVersion: narrative.modelVersion, promptVersion: narrative.promptVersion, narrativeJson: JSON.stringify(narrative), validationStatus: "valid", createdBy: input.actorId });
      await tx.insert(reportVersions).values({ reportJobId: detail.job.id, versionNumber, templateVersion: base.templateVersion, locale: narrative.locale, pdfStorageKey: stored.key, pdfSha256: sha256(pdf.toString("base64")), status: "needs_review", editorSummary: "Owner revised narrative" });
      await tx.update(reportVersions).set({ status: "superseded" }).where(and(eq(reportVersions.id, base.id), eq(reportVersions.status, "needs_review")));
      await tx.update(reportJobs).set({ status: "needs_review" }).where(eq(reportJobs.id, detail.job.id));
      await tx.insert(reportAuditEvents).values({ reportJobId: detail.job.id, eventType: "narrative_revised", actorType: "owner", actorId: input.actorId, fromStatus: "needs_review", toStatus: "needs_review", metadataJson: JSON.stringify({ baseVersionId: base.id, versionNumber }) });
    });
    return { versionNumber };
  } catch (error) {
    await db.update(reportJobs).set({ status: "needs_review" }).where(and(eq(reportJobs.id, detail.job.id), eq(reportJobs.status, "rendering")));
    throw error;
  }
}
