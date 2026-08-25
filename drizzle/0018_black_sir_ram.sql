CREATE TABLE `client_access_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bookingId` int NOT NULL,
	`tokenHash` varchar(64) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`revokedAt` timestamp,
	`lastAccessedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`createdBy` varchar(64) NOT NULL,
	CONSTRAINT `client_access_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `client_access_tokens_tokenHash_unique` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
CREATE TABLE `operational_alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`alertType` varchar(64) NOT NULL,
	`fingerprint` varchar(160) NOT NULL,
	`severity` enum('warning','critical') NOT NULL DEFAULT 'warning',
	`status` enum('open','resolved') NOT NULL DEFAULT 'open',
	`count` int NOT NULL DEFAULT 1,
	`summary` varchar(500) NOT NULL,
	`firstSeenAt` timestamp NOT NULL DEFAULT (now()),
	`lastSeenAt` timestamp NOT NULL DEFAULT (now()),
	`lastNotifiedAt` timestamp,
	`resolvedAt` timestamp,
	`metadataJson` text,
	CONSTRAINT `operational_alerts_id` PRIMARY KEY(`id`),
	CONSTRAINT `operational_alerts_fingerprint_unique` UNIQUE(`fingerprint`)
);
--> statement-breakpoint
CREATE TABLE `sla_settings` (
	`id` int NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`preparationHours` int NOT NULL DEFAULT 48,
	`deliveryHours` int NOT NULL DEFAULT 24,
	`alertCooldownMinutes` int NOT NULL DEFAULT 60,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`updatedBy` varchar(64) NOT NULL,
	CONSTRAINT `sla_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `client_access_tokens_booking_created_idx` ON `client_access_tokens` (`bookingId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `client_access_tokens_expiry_revoked_idx` ON `client_access_tokens` (`expiresAt`,`revokedAt`);--> statement-breakpoint
CREATE INDEX `operational_alerts_status_last_seen_idx` ON `operational_alerts` (`status`,`lastSeenAt`);