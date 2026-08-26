ALTER TABLE `booking_requests` ADD `privacyConsentVersion` varchar(64);--> statement-breakpoint
ALTER TABLE `booking_requests` ADD `privacyConsentLocale` varchar(8);--> statement-breakpoint
ALTER TABLE `booking_requests` ADD `privacyConsentAt` timestamp;