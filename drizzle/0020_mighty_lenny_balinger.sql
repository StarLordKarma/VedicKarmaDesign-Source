CREATE TABLE `sla_email_allowlist` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`label` varchar(120),
	`enabled` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdBy` varchar(64) NOT NULL,
	`updatedBy` varchar(64) NOT NULL,
	CONSTRAINT `sla_email_allowlist_id` PRIMARY KEY(`id`),
	CONSTRAINT `sla_email_allowlist_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE INDEX `sla_email_allowlist_enabled_email_idx` ON `sla_email_allowlist` (`enabled`,`email`);