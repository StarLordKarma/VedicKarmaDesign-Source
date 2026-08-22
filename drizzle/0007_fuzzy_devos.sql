CREATE TABLE `client_change_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bookingId` int NOT NULL,
	`changedBy` varchar(64) NOT NULL,
	`changedAt` timestamp NOT NULL DEFAULT (now()),
	`changes` text NOT NULL,
	CONSTRAINT `client_change_history_id` PRIMARY KEY(`id`)
);
