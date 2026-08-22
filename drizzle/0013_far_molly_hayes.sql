CREATE TABLE `receipt_retention_settings` (
	`id` int NOT NULL,
	`retentionHours` int NOT NULL DEFAULT 48,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`updatedBy` varchar(64) NOT NULL,
	CONSTRAINT `receipt_retention_settings_id` PRIMARY KEY(`id`)
);
