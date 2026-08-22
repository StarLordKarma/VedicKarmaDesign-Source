CREATE TABLE `receipt_email_attempts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`recipientEmail` varchar(320) NOT NULL,
	`storageKey` varchar(512) NOT NULL,
	`language` varchar(32) NOT NULL,
	`status` enum('sending','sent','failed') NOT NULL,
	`providerId` varchar(128),
	`error` text,
	`requestedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `receipt_email_attempts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `receipt_email_failure_alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`recipientEmail` varchar(320) NOT NULL,
	`failureCount` int NOT NULL,
	`alertedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `receipt_email_failure_alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `receipt_email_attempts_recipient_requested_at_idx` ON `receipt_email_attempts` (`recipientEmail`,`requestedAt`);--> statement-breakpoint
CREATE INDEX `receipt_email_attempts_status_requested_at_idx` ON `receipt_email_attempts` (`status`,`requestedAt`);--> statement-breakpoint
CREATE INDEX `receipt_email_failure_alerts_recipient_alerted_at_idx` ON `receipt_email_failure_alerts` (`recipientEmail`,`alertedAt`);