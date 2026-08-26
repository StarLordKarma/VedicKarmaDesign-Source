CREATE TABLE `payment_test_lab_retention_changes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`oldRetentionDays` int NOT NULL,
	`newRetentionDays` int NOT NULL,
	`changedBy` varchar(64) NOT NULL,
	`changedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payment_test_lab_retention_changes_id` PRIMARY KEY(`id`)
);
