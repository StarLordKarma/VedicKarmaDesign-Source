ALTER TABLE `booking_requests` ADD `natalPdfKey` varchar(512);--> statement-breakpoint
ALTER TABLE `booking_requests` ADD `natalPdfUrl` text;--> statement-breakpoint
ALTER TABLE `booking_requests` ADD `natalPdfName` varchar(255);--> statement-breakpoint
ALTER TABLE `booking_requests` ADD `natalPdfUploadedAt` timestamp;--> statement-breakpoint
ALTER TABLE `booking_requests` ADD `natalPdfUploadedBy` varchar(64);