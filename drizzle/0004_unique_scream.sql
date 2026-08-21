ALTER TABLE `booking_requests` ADD `statusUpdatedAt` timestamp;--> statement-breakpoint
ALTER TABLE `booking_requests` ADD `statusUpdatedBy` varchar(64);