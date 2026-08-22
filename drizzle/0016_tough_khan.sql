CREATE TABLE `report_studio_processing_settings` (
	`id` int NOT NULL,
	`autoProcessEnabled` boolean NOT NULL DEFAULT false,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`updatedBy` varchar(64) NOT NULL,
	CONSTRAINT `report_studio_processing_settings_id` PRIMARY KEY(`id`)
);
