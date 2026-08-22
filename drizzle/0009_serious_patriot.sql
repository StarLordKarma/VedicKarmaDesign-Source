CREATE TABLE `service_pricing_currencies` (
	`currency` varchar(3) NOT NULL,
	`basicAmount` int NOT NULL,
	`numerologyAddonAmount` int NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`updatedBy` varchar(64) NOT NULL,
	CONSTRAINT `service_pricing_currencies_currency` PRIMARY KEY(`currency`)
);
--> statement-breakpoint
ALTER TABLE `booking_requests` ADD `currency` varchar(3) DEFAULT 'USD' NOT NULL;