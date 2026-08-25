ALTER TABLE `booking_requests` ADD `attachmentKey` varchar(512);--> statement-breakpoint
ALTER TABLE `booking_requests` ADD `attachmentUrl` text;--> statement-breakpoint
ALTER TABLE `booking_requests` ADD `attachmentName` varchar(255);--> statement-breakpoint
ALTER TABLE `booking_requests` ADD `attachmentType` varchar(120);--> statement-breakpoint
ALTER TABLE `booking_requests` ADD `attachmentSize` int;--> statement-breakpoint
ALTER TABLE `booking_requests` ADD `attachmentUploadedAt` timestamp;