import { boolean, index, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const bookingRequests = mysqlTable("booking_requests", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  birthDate: varchar("birthDate", { length: 10 }).notNull(),
  birthTime: varchar("birthTime", { length: 5 }).notNull(),
  birthCity: varchar("birthCity", { length: 160 }).notNull(),
  birthCountry: varchar("birthCountry", { length: 160 }).notNull(),
  language: varchar("language", { length: 32 }).notNull(),
  addon: int("addon").default(0).notNull(),
  totalUsd: int("totalUsd").notNull(),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  interest: text("interest"),
  paymentId: varchar("paymentId", { length: 128 }),
  paymentUrl: text("paymentUrl"),
  paymentStatus: varchar("paymentStatus", { length: 32 }).default("waiting"),
  status: mysqlEnum("status", ["new", "in_progress", "completed", "cancelled"]).default("new").notNull(),
  adminNote: text("adminNote"),
  statusUpdatedAt: timestamp("statusUpdatedAt"),
  statusUpdatedBy: varchar("statusUpdatedBy", { length: 64 }),
  natalPdfKey: varchar("natalPdfKey", { length: 512 }),
  natalPdfUrl: text("natalPdfUrl"),
  natalPdfName: varchar("natalPdfName", { length: 255 }),
  natalPdfUploadedAt: timestamp("natalPdfUploadedAt"),
  natalPdfUploadedBy: varchar("natalPdfUploadedBy", { length: 64 }),
  deliveryStatus: varchar("deliveryStatus", { length: 32 }).default("not_sent").notNull(),
  deliveryError: text("deliveryError"),
  deliveredAt: timestamp("deliveredAt"),
  deliveredBy: varchar("deliveredBy", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type BookingRequest = typeof bookingRequests.$inferSelect;
export type InsertBookingRequest = typeof bookingRequests.$inferInsert;

export const clientChangeHistory = mysqlTable("client_change_history", {
  id: int("id").autoincrement().primaryKey(),
  bookingId: int("bookingId").notNull(),
  changedBy: varchar("changedBy", { length: 64 }).notNull(),
  changedAt: timestamp("changedAt").defaultNow().notNull(),
  changes: text("changes").notNull(),
});

export type ClientChangeHistory = typeof clientChangeHistory.$inferSelect;

export const servicePricing = mysqlTable("service_pricing", {
  id: int("id").primaryKey(),
  basicUsd: int("basicUsd").notNull(),
  numerologyAddonUsd: int("numerologyAddonUsd").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  updatedBy: varchar("updatedBy", { length: 64 }).notNull(),
});

export type ServicePricing = typeof servicePricing.$inferSelect;
export type InsertServicePricing = typeof servicePricing.$inferInsert;

export const servicePricingCurrencies = mysqlTable("service_pricing_currencies", {
  currency: varchar("currency", { length: 3 }).primaryKey(),
  basicAmount: int("basicAmount").notNull(),
  numerologyAddonAmount: int("numerologyAddonAmount").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  updatedBy: varchar("updatedBy", { length: 64 }).notNull(),
});

export type ServicePricingCurrency = typeof servicePricingCurrencies.$inferSelect;
export type InsertServicePricingCurrency = typeof servicePricingCurrencies.$inferInsert;

export const servicePricingHistory = mysqlTable("service_pricing_history", {
  id: int("id").autoincrement().primaryKey(),
  currency: varchar("currency", { length: 3 }).notNull(),
  oldBasicAmount: int("oldBasicAmount").notNull(),
  oldNumerologyAddonAmount: int("oldNumerologyAddonAmount").notNull(),
  newBasicAmount: int("newBasicAmount").notNull(),
  newNumerologyAddonAmount: int("newNumerologyAddonAmount").notNull(),
  changedAt: timestamp("changedAt").defaultNow().notNull(),
  changedBy: varchar("changedBy", { length: 64 }).notNull(),
});

export type ServicePricingHistory = typeof servicePricingHistory.$inferSelect;
export type InsertServicePricingHistory = typeof servicePricingHistory.$inferInsert;

export const smokeTestRuns = mysqlTable("smoke_test_runs", {
  id: int("id").autoincrement().primaryKey(),
  runId: varchar("runId", { length: 128 }).notNull().unique(),
  status: mysqlEnum("status", ["running", "succeeded", "failed"]).notNull(),
  result: text("result"),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  finishedAt: timestamp("finishedAt"),
  durationMs: int("durationMs"),
});

export type SmokeTestRun = typeof smokeTestRuns.$inferSelect;
export type InsertSmokeTestRun = typeof smokeTestRuns.$inferInsert;

export const receiptFiles = mysqlTable("receipt_files", {
  id: int("id").autoincrement().primaryKey(),
  storageKey: varchar("storageKey", { length: 512 }).notNull().unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
});

export type ReceiptFile = typeof receiptFiles.$inferSelect;
export type InsertReceiptFile = typeof receiptFiles.$inferInsert;

export const receiptRetentionSettings = mysqlTable("receipt_retention_settings", {
  id: int("id").primaryKey(),
  retentionHours: int("retentionHours").notNull().default(48),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  updatedBy: varchar("updatedBy", { length: 64 }).notNull(),
});

export type ReceiptRetentionSettings = typeof receiptRetentionSettings.$inferSelect;
export type InsertReceiptRetentionSettings = typeof receiptRetentionSettings.$inferInsert;

export const reportStudioProcessingSettings = mysqlTable("report_studio_processing_settings", {
  id: int("id").primaryKey(),
  autoProcessEnabled: boolean("autoProcessEnabled").notNull().default(false),
  aiModel: varchar("aiModel", { length: 64 }).notNull().default("gpt-5-mini"),
  maxTokens: int("maxTokens").notNull().default(5000),
  maxSections: int("maxSections").notNull().default(6),
  maxParagraphChars: int("maxParagraphChars").notNull().default(1800),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  updatedBy: varchar("updatedBy", { length: 64 }).notNull(),
});

export type ReportStudioProcessingSettings = typeof reportStudioProcessingSettings.$inferSelect;
export type InsertReportStudioProcessingSettings = typeof reportStudioProcessingSettings.$inferInsert;

export const receiptEmailAttempts = mysqlTable("receipt_email_attempts", {
  id: int("id").autoincrement().primaryKey(),
  recipientEmail: varchar("recipientEmail", { length: 320 }).notNull(),
  storageKey: varchar("storageKey", { length: 512 }).notNull(),
  language: varchar("language", { length: 32 }).notNull(),
  status: mysqlEnum("status", ["sending", "sent", "failed"]).notNull(),
  providerId: varchar("providerId", { length: 128 }),
  error: text("error"),
  requestedAt: timestamp("requestedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
}, (table) => ({ recipientRequestedAtIdx: index("receipt_email_attempts_recipient_requested_at_idx").on(table.recipientEmail, table.requestedAt), statusRequestedAtIdx: index("receipt_email_attempts_status_requested_at_idx").on(table.status, table.requestedAt) }));

export type ReceiptEmailAttempt = typeof receiptEmailAttempts.$inferSelect;
export type InsertReceiptEmailAttempt = typeof receiptEmailAttempts.$inferInsert;

export const receiptEmailFailureAlerts = mysqlTable("receipt_email_failure_alerts", {
  id: int("id").autoincrement().primaryKey(),
  recipientEmail: varchar("recipientEmail", { length: 320 }).notNull(),
  failureCount: int("failureCount").notNull(),
  alertedAt: timestamp("alertedAt").defaultNow().notNull(),
}, (table) => ({ recipientAlertedAtIdx: index("receipt_email_failure_alerts_recipient_alerted_at_idx").on(table.recipientEmail, table.alertedAt) }));

export type ReceiptEmailFailureAlert = typeof receiptEmailFailureAlerts.$inferSelect;
export type InsertReceiptEmailFailureAlert = typeof receiptEmailFailureAlerts.$inferInsert;

export const reportJobs = mysqlTable("report_jobs", {
  id: int("id").autoincrement().primaryKey(),
  bookingId: int("bookingId").notNull(),
  reportVersion: int("reportVersion").notNull().default(1),
  packageType: mysqlEnum("packageType", ["basic", "basic_plus"]).notNull(),
  language: varchar("language", { length: 8 }).notNull(),
  status: mysqlEnum("status", ["waiting_payment", "paid", "queued", "calculating", "calculated", "narrative_draft", "rendering", "draft_ready", "needs_review", "approved", "sending", "sent", "rejected", "calculation_failed", "render_failed", "delivery_failed"]).notNull().default("waiting_payment"),
  idempotencyKey: varchar("idempotencyKey", { length: 160 }).notNull(),
  inputHash: varchar("inputHash", { length: 71 }).notNull(),
  factsHash: varchar("factsHash", { length: 71 }),
  attemptCount: int("attemptCount").notNull().default(0),
  lastErrorCode: varchar("lastErrorCode", { length: 64 }),
  lastErrorMessage: varchar("lastErrorMessage", { length: 1000 }),
  queuedAt: timestamp("queuedAt"),
  startedAt: timestamp("startedAt"),
  finishedAt: timestamp("finishedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  idempotencyKeyUnique: uniqueIndex("report_jobs_idempotency_key_unique").on(table.idempotencyKey),
  bookingVersionIdx: index("report_jobs_booking_version_idx").on(table.bookingId, table.reportVersion),
  statusCreatedIdx: index("report_jobs_status_created_idx").on(table.status, table.createdAt),
  languageStatusIdx: index("report_jobs_language_status_idx").on(table.language, table.status),
}));

export type ReportJob = typeof reportJobs.$inferSelect;
export type InsertReportJob = typeof reportJobs.$inferInsert;

export const calculationSnapshots = mysqlTable("calculation_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  reportJobId: int("reportJobId").notNull(),
  birthDateLocal: varchar("birthDateLocal", { length: 10 }).notNull(),
  birthTimeLocal: varchar("birthTimeLocal", { length: 5 }).notNull(),
  birthCity: varchar("birthCity", { length: 160 }).notNull(),
  birthCountry: varchar("birthCountry", { length: 160 }).notNull(),
  latitude: text("latitude").notNull(),
  longitude: text("longitude").notNull(),
  timezone: varchar("timezone", { length: 64 }).notNull(),
  birthInstantUtc: timestamp("birthInstantUtc").notNull(),
  chartSettingsJson: text("chartSettingsJson").notNull(),
  qualityFlagsJson: text("qualityFlagsJson").notNull(),
  inputHash: varchar("inputHash", { length: 71 }).notNull(),
  confirmedAt: timestamp("confirmedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  reportJobUnique: uniqueIndex("calculation_snapshots_report_job_unique").on(table.reportJobId),
  inputHashIdx: index("calculation_snapshots_input_hash_idx").on(table.inputHash),
}));

export type CalculationSnapshot = typeof calculationSnapshots.$inferSelect;
export type InsertCalculationSnapshot = typeof calculationSnapshots.$inferInsert;

export const calculationResults = mysqlTable("calculation_results", {
  id: int("id").autoincrement().primaryKey(),
  reportJobId: int("reportJobId").notNull(),
  schemaVersion: varchar("schemaVersion", { length: 32 }).notNull(),
  engineName: varchar("engineName", { length: 100 }).notNull(),
  engineVersion: varchar("engineVersion", { length: 64 }).notNull(),
  ephemerisVersion: varchar("ephemerisVersion", { length: 64 }).notNull(),
  factsJson: text("factsJson").notNull(),
  factsHash: varchar("factsHash", { length: 71 }).notNull(),
  validationStatus: mysqlEnum("validationStatus", ["pending", "valid", "invalid"]).notNull().default("pending"),
  validationErrorsJson: text("validationErrorsJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  reportJobUnique: uniqueIndex("calculation_results_report_job_unique").on(table.reportJobId),
  factsHashIdx: index("calculation_results_facts_hash_idx").on(table.factsHash),
}));

export type CalculationResult = typeof calculationResults.$inferSelect;
export type InsertCalculationResult = typeof calculationResults.$inferInsert;

export const narrativeDrafts = mysqlTable("narrative_drafts", {
  id: int("id").autoincrement().primaryKey(),
  reportJobId: int("reportJobId").notNull(),
  locale: varchar("locale", { length: 8 }).notNull(),
  modelName: varchar("modelName", { length: 100 }).notNull(),
  modelVersion: varchar("modelVersion", { length: 100 }).notNull(),
  promptVersion: varchar("promptVersion", { length: 64 }).notNull(),
  narrativeJson: text("narrativeJson").notNull(),
  validationStatus: mysqlEnum("validationStatus", ["pending", "valid", "invalid", "needs_edit"]).notNull().default("pending"),
  validationErrorsJson: text("validationErrorsJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  createdBy: varchar("createdBy", { length: 64 }).notNull().default("system"),
}, (table) => ({
  reportJobCreatedIdx: index("narrative_drafts_report_job_created_idx").on(table.reportJobId, table.createdAt),
}));

export type NarrativeDraft = typeof narrativeDrafts.$inferSelect;
export type InsertNarrativeDraft = typeof narrativeDrafts.$inferInsert;

export const reportVersions = mysqlTable("report_versions", {
  id: int("id").autoincrement().primaryKey(),
  reportJobId: int("reportJobId").notNull(),
  versionNumber: int("versionNumber").notNull(),
  templateVersion: varchar("templateVersion", { length: 64 }).notNull(),
  locale: varchar("locale", { length: 8 }).notNull(),
  pdfStorageKey: varchar("pdfStorageKey", { length: 512 }),
  pdfSha256: varchar("pdfSha256", { length: 64 }),
  status: mysqlEnum("status", ["draft", "needs_review", "approved", "superseded", "sent", "rejected"]).notNull().default("draft"),
  editorSummary: varchar("editorSummary", { length: 1000 }),
  approvedAt: timestamp("approvedAt"),
  approvedBy: varchar("approvedBy", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  jobVersionUnique: uniqueIndex("report_versions_job_version_unique").on(table.reportJobId, table.versionNumber),
  statusCreatedIdx: index("report_versions_status_created_idx").on(table.status, table.createdAt),
  pdfHashIdx: index("report_versions_pdf_hash_idx").on(table.pdfSha256),
}));

export type ReportVersion = typeof reportVersions.$inferSelect;
export type InsertReportVersion = typeof reportVersions.$inferInsert;

export const reportSections = mysqlTable("report_sections", {
  id: int("id").autoincrement().primaryKey(),
  reportVersionId: int("reportVersionId").notNull(),
  sectionKey: varchar("sectionKey", { length: 100 }).notNull(),
  sortOrder: int("sortOrder").notNull(),
  sourceFactsJson: text("sourceFactsJson").notNull(),
  draftText: text("draftText").notNull(),
  approvedText: text("approvedText"),
  editedBy: varchar("editedBy", { length: 64 }),
  editedAt: timestamp("editedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  versionSectionUnique: uniqueIndex("report_sections_version_section_unique").on(table.reportVersionId, table.sectionKey),
  versionSortIdx: index("report_sections_version_sort_idx").on(table.reportVersionId, table.sortOrder),
}));

export type ReportSection = typeof reportSections.$inferSelect;
export type InsertReportSection = typeof reportSections.$inferInsert;

export const reportDeliveryAttempts = mysqlTable("report_delivery_attempts", {
  id: int("id").autoincrement().primaryKey(),
  reportVersionId: int("reportVersionId").notNull(),
  recipientEmail: varchar("recipientEmail", { length: 320 }).notNull(),
  status: mysqlEnum("status", ["queued", "sending", "sent", "failed", "cancelled"]).notNull().default("queued"),
  provider: varchar("provider", { length: 40 }).notNull().default("resend"),
  providerMessageId: varchar("providerMessageId", { length: 160 }),
  idempotencyKey: varchar("idempotencyKey", { length: 180 }).notNull(),
  errorCode: varchar("errorCode", { length: 64 }),
  errorMessage: varchar("errorMessage", { length: 1000 }),
  requestedBy: varchar("requestedBy", { length: 64 }).notNull(),
  requestedAt: timestamp("requestedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
}, (table) => ({
  idempotencyKeyUnique: uniqueIndex("report_delivery_attempts_idempotency_key_unique").on(table.idempotencyKey),
  versionRequestedIdx: index("report_delivery_attempts_version_requested_idx").on(table.reportVersionId, table.requestedAt),
  statusRequestedIdx: index("report_delivery_attempts_status_requested_idx").on(table.status, table.requestedAt),
}));

export type ReportDeliveryAttempt = typeof reportDeliveryAttempts.$inferSelect;
export type InsertReportDeliveryAttempt = typeof reportDeliveryAttempts.$inferInsert;

export const reportAuditEvents = mysqlTable("report_audit_events", {
  id: int("id").autoincrement().primaryKey(),
  reportJobId: int("reportJobId").notNull(),
  eventType: varchar("eventType", { length: 80 }).notNull(),
  actorType: mysqlEnum("actorType", ["system", "owner", "client"]).notNull(),
  actorId: varchar("actorId", { length: 64 }),
  fromStatus: varchar("fromStatus", { length: 40 }),
  toStatus: varchar("toStatus", { length: 40 }),
  metadataJson: text("metadataJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  jobCreatedIdx: index("report_audit_events_job_created_idx").on(table.reportJobId, table.createdAt),
  typeCreatedIdx: index("report_audit_events_type_created_idx").on(table.eventType, table.createdAt),
}));

export type ReportAuditEvent = typeof reportAuditEvents.$inferSelect;
export type InsertReportAuditEvent = typeof reportAuditEvents.$inferInsert;
