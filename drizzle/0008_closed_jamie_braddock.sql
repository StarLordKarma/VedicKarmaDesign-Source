CREATE TABLE `service_pricing` (
	`id` int NOT NULL,
	`basicUsd` int NOT NULL,
	`numerologyAddonUsd` int NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`updatedBy` varchar(64) NOT NULL,
	CONSTRAINT `service_pricing_id` PRIMARY KEY(`id`)
);
