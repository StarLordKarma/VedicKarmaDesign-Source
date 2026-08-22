CREATE TABLE `service_pricing_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`currency` varchar(3) NOT NULL,
	`oldBasicAmount` int NOT NULL,
	`oldNumerologyAddonAmount` int NOT NULL,
	`newBasicAmount` int NOT NULL,
	`newNumerologyAddonAmount` int NOT NULL,
	`changedAt` timestamp NOT NULL DEFAULT (now()),
	`changedBy` varchar(64) NOT NULL,
	CONSTRAINT `service_pricing_history_id` PRIMARY KEY(`id`)
);
