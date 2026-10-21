CREATE TABLE `direct_payment_bindings` (
	`bookingId` int NOT NULL,
	`intentId` varchar(64) NOT NULL,
	`network` varchar(24) NOT NULL,
	`payer` varchar(64) NOT NULL,
	`nonceHash` varchar(64) NOT NULL,
	`statusToken` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `direct_payment_bindings_bookingId` PRIMARY KEY(`bookingId`),
	CONSTRAINT `direct_payment_binding_intent_unique` UNIQUE(`intentId`)
);
