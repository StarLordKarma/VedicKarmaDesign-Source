CREATE TABLE `order_mail_flows` (
 `bookingId` int NOT NULL PRIMARY KEY, `locale` varchar(2) NOT NULL, `product` varchar(32) NOT NULL,
 `recipient` varchar(320) NOT NULL, `identityHash` varchar(64) NOT NULL, `delaySeconds` int NOT NULL,
 `acceptedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, `ackState` varchar(20) NOT NULL DEFAULT 'pending',
 `ackPayload` text NOT NULL, `ackStartedAt` timestamp NULL, `ackAcceptedAt` timestamp NULL, `dueAt` timestamp NULL,
 `providerMessageId` varchar(256), `attempts` int NOT NULL DEFAULT 0, `nextAttemptAt` timestamp NULL,
 `error` text, `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 INDEX `order_mail_pending_idx` (`ackState`,`nextAttemptAt`)
);
