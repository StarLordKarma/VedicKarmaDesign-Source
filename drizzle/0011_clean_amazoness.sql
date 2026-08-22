CREATE TABLE `smoke_test_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`runId` varchar(128) NOT NULL,
	`status` enum('running','succeeded','failed') NOT NULL,
	`result` text,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`finishedAt` timestamp,
	`durationMs` int,
	CONSTRAINT `smoke_test_runs_id` PRIMARY KEY(`id`),
	CONSTRAINT `smoke_test_runs_runId_unique` UNIQUE(`runId`)
);
