CREATE TABLE `verified_payment_claims` (
	`id` int AUTO_INCREMENT NOT NULL,
	`paymentId` varchar(128) NOT NULL,
	`bookingId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `verified_payment_claims_id` PRIMARY KEY(`id`),
	CONSTRAINT `verified_payment_claims_payment_unique` UNIQUE(`paymentId`)
);
--> statement-breakpoint
CREATE INDEX `verified_payment_claims_booking_idx` ON `verified_payment_claims` (`bookingId`);