ALTER TABLE `report_studio_processing_settings` ADD `aiModel` varchar(64) DEFAULT 'gpt-5-mini' NOT NULL;--> statement-breakpoint
ALTER TABLE `report_studio_processing_settings` ADD `maxTokens` int DEFAULT 5000 NOT NULL;--> statement-breakpoint
ALTER TABLE `report_studio_processing_settings` ADD `maxSections` int DEFAULT 6 NOT NULL;--> statement-breakpoint
ALTER TABLE `report_studio_processing_settings` ADD `maxParagraphChars` int DEFAULT 1800 NOT NULL;