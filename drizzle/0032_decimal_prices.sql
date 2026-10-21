ALTER TABLE `booking_requests` MODIFY COLUMN `totalUsd` decimal(12,2) NOT NULL;--> statement-breakpoint
ALTER TABLE `service_pricing` MODIFY COLUMN `basicUsd` decimal(12,2) NOT NULL;--> statement-breakpoint
ALTER TABLE `service_pricing` MODIFY COLUMN `numerologyAddonUsd` decimal(12,2) NOT NULL;--> statement-breakpoint
ALTER TABLE `service_pricing_currencies` MODIFY COLUMN `basicAmount` decimal(12,2) NOT NULL;--> statement-breakpoint
ALTER TABLE `service_pricing_currencies` MODIFY COLUMN `numerologyAddonAmount` decimal(12,2) NOT NULL;--> statement-breakpoint
ALTER TABLE `service_pricing_history` MODIFY COLUMN `oldBasicAmount` decimal(12,2) NOT NULL;--> statement-breakpoint
ALTER TABLE `service_pricing_history` MODIFY COLUMN `oldNumerologyAddonAmount` decimal(12,2) NOT NULL;--> statement-breakpoint
ALTER TABLE `service_pricing_history` MODIFY COLUMN `newBasicAmount` decimal(12,2) NOT NULL;--> statement-breakpoint
ALTER TABLE `service_pricing_history` MODIFY COLUMN `newNumerologyAddonAmount` decimal(12,2) NOT NULL;