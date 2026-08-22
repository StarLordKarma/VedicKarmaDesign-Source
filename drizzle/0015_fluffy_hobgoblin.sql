CREATE TABLE `calculation_results` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reportJobId` int NOT NULL,
	`schemaVersion` varchar(32) NOT NULL,
	`engineName` varchar(100) NOT NULL,
	`engineVersion` varchar(64) NOT NULL,
	`ephemerisVersion` varchar(64) NOT NULL,
	`factsJson` text NOT NULL,
	`factsHash` varchar(71) NOT NULL,
	`validationStatus` enum('pending','valid','invalid') NOT NULL DEFAULT 'pending',
	`validationErrorsJson` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `calculation_results_id` PRIMARY KEY(`id`),
	CONSTRAINT `calculation_results_report_job_unique` UNIQUE(`reportJobId`)
);
--> statement-breakpoint
CREATE TABLE `calculation_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reportJobId` int NOT NULL,
	`birthDateLocal` varchar(10) NOT NULL,
	`birthTimeLocal` varchar(5) NOT NULL,
	`birthCity` varchar(160) NOT NULL,
	`birthCountry` varchar(160) NOT NULL,
	`latitude` text NOT NULL,
	`longitude` text NOT NULL,
	`timezone` varchar(64) NOT NULL,
	`birthInstantUtc` timestamp NOT NULL,
	`chartSettingsJson` text NOT NULL,
	`qualityFlagsJson` text NOT NULL,
	`inputHash` varchar(71) NOT NULL,
	`confirmedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `calculation_snapshots_id` PRIMARY KEY(`id`),
	CONSTRAINT `calculation_snapshots_report_job_unique` UNIQUE(`reportJobId`)
);
--> statement-breakpoint
CREATE TABLE `narrative_drafts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reportJobId` int NOT NULL,
	`locale` varchar(8) NOT NULL,
	`modelName` varchar(100) NOT NULL,
	`modelVersion` varchar(100) NOT NULL,
	`promptVersion` varchar(64) NOT NULL,
	`narrativeJson` text NOT NULL,
	`validationStatus` enum('pending','valid','invalid','needs_edit') NOT NULL DEFAULT 'pending',
	`validationErrorsJson` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`createdBy` varchar(64) NOT NULL DEFAULT 'system',
	CONSTRAINT `narrative_drafts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `report_audit_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reportJobId` int NOT NULL,
	`eventType` varchar(80) NOT NULL,
	`actorType` enum('system','owner','client') NOT NULL,
	`actorId` varchar(64),
	`fromStatus` varchar(40),
	`toStatus` varchar(40),
	`metadataJson` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `report_audit_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `report_delivery_attempts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reportVersionId` int NOT NULL,
	`recipientEmail` varchar(320) NOT NULL,
	`status` enum('queued','sending','sent','failed','cancelled') NOT NULL DEFAULT 'queued',
	`provider` varchar(40) NOT NULL DEFAULT 'resend',
	`providerMessageId` varchar(160),
	`idempotencyKey` varchar(180) NOT NULL,
	`errorCode` varchar(64),
	`errorMessage` varchar(1000),
	`requestedBy` varchar(64) NOT NULL,
	`requestedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `report_delivery_attempts_id` PRIMARY KEY(`id`),
	CONSTRAINT `report_delivery_attempts_idempotency_key_unique` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `report_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bookingId` int NOT NULL,
	`reportVersion` int NOT NULL DEFAULT 1,
	`packageType` enum('basic','basic_plus') NOT NULL,
	`language` varchar(8) NOT NULL,
	`status` enum('waiting_payment','paid','queued','calculating','calculated','narrative_draft','rendering','draft_ready','needs_review','approved','sending','sent','rejected','calculation_failed','render_failed','delivery_failed') NOT NULL DEFAULT 'waiting_payment',
	`idempotencyKey` varchar(160) NOT NULL,
	`inputHash` varchar(71) NOT NULL,
	`factsHash` varchar(71),
	`attemptCount` int NOT NULL DEFAULT 0,
	`lastErrorCode` varchar(64),
	`lastErrorMessage` varchar(1000),
	`queuedAt` timestamp,
	`startedAt` timestamp,
	`finishedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `report_jobs_id` PRIMARY KEY(`id`),
	CONSTRAINT `report_jobs_idempotency_key_unique` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `report_sections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reportVersionId` int NOT NULL,
	`sectionKey` varchar(100) NOT NULL,
	`sortOrder` int NOT NULL,
	`sourceFactsJson` text NOT NULL,
	`draftText` text NOT NULL,
	`approvedText` text,
	`editedBy` varchar(64),
	`editedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `report_sections_id` PRIMARY KEY(`id`),
	CONSTRAINT `report_sections_version_section_unique` UNIQUE(`reportVersionId`,`sectionKey`)
);
--> statement-breakpoint
CREATE TABLE `report_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reportJobId` int NOT NULL,
	`versionNumber` int NOT NULL,
	`templateVersion` varchar(64) NOT NULL,
	`locale` varchar(8) NOT NULL,
	`pdfStorageKey` varchar(512),
	`pdfSha256` varchar(64),
	`status` enum('draft','needs_review','approved','superseded','sent','rejected') NOT NULL DEFAULT 'draft',
	`editorSummary` varchar(1000),
	`approvedAt` timestamp,
	`approvedBy` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `report_versions_id` PRIMARY KEY(`id`),
	CONSTRAINT `report_versions_job_version_unique` UNIQUE(`reportJobId`,`versionNumber`)
);
--> statement-breakpoint
CREATE INDEX `calculation_results_facts_hash_idx` ON `calculation_results` (`factsHash`);--> statement-breakpoint
CREATE INDEX `calculation_snapshots_input_hash_idx` ON `calculation_snapshots` (`inputHash`);--> statement-breakpoint
CREATE INDEX `narrative_drafts_report_job_created_idx` ON `narrative_drafts` (`reportJobId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `report_audit_events_job_created_idx` ON `report_audit_events` (`reportJobId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `report_audit_events_type_created_idx` ON `report_audit_events` (`eventType`,`createdAt`);--> statement-breakpoint
CREATE INDEX `report_delivery_attempts_version_requested_idx` ON `report_delivery_attempts` (`reportVersionId`,`requestedAt`);--> statement-breakpoint
CREATE INDEX `report_delivery_attempts_status_requested_idx` ON `report_delivery_attempts` (`status`,`requestedAt`);--> statement-breakpoint
CREATE INDEX `report_jobs_booking_version_idx` ON `report_jobs` (`bookingId`,`reportVersion`);--> statement-breakpoint
CREATE INDEX `report_jobs_status_created_idx` ON `report_jobs` (`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `report_jobs_language_status_idx` ON `report_jobs` (`language`,`status`);--> statement-breakpoint
CREATE INDEX `report_sections_version_sort_idx` ON `report_sections` (`reportVersionId`,`sortOrder`);--> statement-breakpoint
CREATE INDEX `report_versions_status_created_idx` ON `report_versions` (`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `report_versions_pdf_hash_idx` ON `report_versions` (`pdfSha256`);