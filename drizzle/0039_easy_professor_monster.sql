CREATE TABLE `http_metric_batches` (
	`id` varchar(64) NOT NULL,
	`category` varchar(20) NOT NULL,
	`requests` int NOT NULL,
	`errors` int NOT NULL,
	`totalMs` int NOT NULL,
	`maxMs` int NOT NULL,
	`day` timestamp NOT NULL,
	`recordedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `http_metric_batches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `http_metric_day_idx` ON `http_metric_batches` (`day`);