CREATE INDEX `booking_requests_payment_identity_idx` ON `booking_requests` (`paymentId`);--> statement-breakpoint
-- Preserve already used blockchain payments; do not rewrite historical orders.
INSERT INTO `verified_payment_claims` (`paymentId`,`bookingId`)
SELECT LOWER(`paymentId`), MIN(`id`) FROM `booking_requests`
WHERE `paymentId` REGEXP '^0x[0-9A-Fa-f]+:(0x)?[0-9A-Fa-f]{64}$'
GROUP BY LOWER(`paymentId`)
ON DUPLICATE KEY UPDATE `paymentId` = VALUES(`paymentId`);
