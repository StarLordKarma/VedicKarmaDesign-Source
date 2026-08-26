CREATE TABLE `payment_test_lab_retention_settings` (
	`id` int NOT NULL,
	`retentionDays` int NOT NULL DEFAULT 90,
	`updatedBy` varchar(64) NOT NULL DEFAULT 'system',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastCleanupAt` timestamp,
	`lastCleanupDeleted` int,
	CONSTRAINT `payment_test_lab_retention_settings_id` PRIMARY KEY(`id`)
);
