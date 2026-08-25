CREATE TABLE `service_packages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(64) NOT NULL,
	`version` int NOT NULL,
	`packageType` enum('basic','basic_plus') NOT NULL,
	`nameEn` varchar(160) NOT NULL,
	`nameRu` varchar(160) NOT NULL,
	`nameDe` varchar(160) NOT NULL,
	`nameEs` varchar(160) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`createdBy` varchar(64) NOT NULL,
	CONSTRAINT `service_packages_id` PRIMARY KEY(`id`),
	CONSTRAINT `service_packages_code_version_unique` UNIQUE(`code`,`version`)
);
--> statement-breakpoint
ALTER TABLE `booking_requests` ADD `packageCode` varchar(64) DEFAULT 'basic' NOT NULL;--> statement-breakpoint
ALTER TABLE `booking_requests` ADD `packageVersion` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `booking_requests` ADD `priceSnapshotJson` text;--> statement-breakpoint
CREATE INDEX `service_packages_active_code_idx` ON `service_packages` (`active`,`code`);