CREATE TABLE `receipt_files` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storageKey` varchar(512) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	CONSTRAINT `receipt_files_id` PRIMARY KEY(`id`),
	CONSTRAINT `receipt_files_storageKey_unique` UNIQUE(`storageKey`)
);
