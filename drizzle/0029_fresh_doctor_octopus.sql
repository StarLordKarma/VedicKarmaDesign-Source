CREATE TABLE `payment_test_lab_cleanup_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`triggeredBy` varchar(64) NOT NULL,
	`retentionDays` int NOT NULL,
	`deletedCount` int NOT NULL,
	`cutoff` timestamp NOT NULL,
	`completedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payment_test_lab_cleanup_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `payment_test_lab_retention_settings` ADD `notificationLocale` varchar(8) DEFAULT 'en' NOT NULL;--> statement-breakpoint
CREATE INDEX `payment_test_lab_cleanup_history_completed_idx` ON `payment_test_lab_cleanup_history` (`completedAt`);--> statement-breakpoint
CREATE INDEX `payment_test_lab_cleanup_history_actor_completed_idx` ON `payment_test_lab_cleanup_history` (`triggeredBy`,`completedAt`);