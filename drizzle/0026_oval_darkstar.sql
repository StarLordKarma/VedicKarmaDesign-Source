CREATE TABLE `payment_test_lab_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`runId` varchar(128) NOT NULL,
	`actorId` varchar(64) NOT NULL,
	`paymentStatus` varchar(32) NOT NULL,
	`status` enum('running','succeeded','failed') NOT NULL,
	`bookingId` int,
	`errorCode` varchar(64),
	`errorMessage` varchar(500),
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`finishedAt` timestamp,
	`durationMs` int,
	CONSTRAINT `payment_test_lab_runs_id` PRIMARY KEY(`id`),
	CONSTRAINT `payment_test_lab_runs_runId_unique` UNIQUE(`runId`)
);
--> statement-breakpoint
CREATE INDEX `payment_test_lab_runs_status_started_idx` ON `payment_test_lab_runs` (`status`,`startedAt`);--> statement-breakpoint
CREATE INDEX `payment_test_lab_runs_actor_started_idx` ON `payment_test_lab_runs` (`actorId`,`startedAt`);