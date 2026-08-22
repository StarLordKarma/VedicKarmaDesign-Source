ALTER TABLE `booking_requests` ADD `deliveryStatus` varchar(32) DEFAULT 'not_sent' NOT NULL;--> statement-breakpoint
ALTER TABLE `booking_requests` ADD `deliveryError` text;--> statement-breakpoint
ALTER TABLE `booking_requests` ADD `deliveredAt` timestamp;--> statement-breakpoint
ALTER TABLE `booking_requests` ADD `deliveredBy` varchar(64);