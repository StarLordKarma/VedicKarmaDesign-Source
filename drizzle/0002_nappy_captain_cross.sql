ALTER TABLE `booking_requests` ADD `paymentId` varchar(128);--> statement-breakpoint
ALTER TABLE `booking_requests` ADD `paymentUrl` text;--> statement-breakpoint
ALTER TABLE `booking_requests` ADD `paymentStatus` varchar(32) DEFAULT 'waiting';