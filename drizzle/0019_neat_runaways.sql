CREATE TABLE `sla_evaluation_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`trigger` enum('heartbeat','manual') NOT NULL,
	`status` enum('succeeded','disabled','failed') NOT NULL,
	`evaluatedAt` timestamp NOT NULL DEFAULT (now()),
	`durationMs` int NOT NULL DEFAULT 0,
	`jobsEvaluated` int NOT NULL DEFAULT 0,
	`preparationViolations` int NOT NULL DEFAULT 0,
	`deliveryViolations` int NOT NULL DEFAULT 0,
	`alertsCreated` int NOT NULL DEFAULT 0,
	`notificationsSent` int NOT NULL DEFAULT 0,
	`errorCode` varchar(120),
	`actor` varchar(64) NOT NULL DEFAULT 'system',
	CONSTRAINT `sla_evaluation_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `sla_evaluation_runs_evaluated_at_idx` ON `sla_evaluation_runs` (`evaluatedAt`);--> statement-breakpoint
CREATE INDEX `sla_evaluation_runs_status_evaluated_at_idx` ON `sla_evaluation_runs` (`status`,`evaluatedAt`);