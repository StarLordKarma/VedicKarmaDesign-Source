CREATE TABLE `audience_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`eventId` varchar(36) NOT NULL,
	`visitorKey` varchar(64) NOT NULL,
	`sessionKey` varchar(64) NOT NULL,
	`event` varchar(24) NOT NULL,
	`section` varchar(12) NOT NULL,
	`product` varchar(20) NOT NULL,
	`locale` varchar(2) NOT NULL,
	`device` varchar(8) NOT NULL,
	`source` varchar(64) NOT NULL,
	`medium` varchar(64) NOT NULL,
	`campaign` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audience_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `audience_event_unique` UNIQUE(`eventId`)
);
--> statement-breakpoint
CREATE INDEX `audience_date_idx` ON `audience_events` (`createdAt`);--> statement-breakpoint
CREATE INDEX `audience_visitor_idx` ON `audience_events` (`visitorKey`,`createdAt`);--> statement-breakpoint
CREATE INDEX `audience_session_idx` ON `audience_events` (`sessionKey`,`createdAt`);