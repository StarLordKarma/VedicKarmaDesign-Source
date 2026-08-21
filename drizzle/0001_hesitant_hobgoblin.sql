CREATE TABLE `booking_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`email` varchar(320) NOT NULL,
	`birthDate` varchar(10) NOT NULL,
	`birthTime` varchar(5) NOT NULL,
	`birthCity` varchar(160) NOT NULL,
	`birthCountry` varchar(160) NOT NULL,
	`language` varchar(32) NOT NULL,
	`addon` int NOT NULL DEFAULT 0,
	`totalUsd` int NOT NULL,
	`interest` text,
	`status` enum('new','in_progress','completed','cancelled') NOT NULL DEFAULT 'new',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `booking_requests_id` PRIMARY KEY(`id`)
);
