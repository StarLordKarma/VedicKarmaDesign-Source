-- Owner-requested USD prices: basic $9.99; advanced $14.99 ($5 supplement).
-- Existing order snapshots and non-USD prices are preserved.
INSERT INTO service_pricing_history
  (currency, oldBasicAmount, oldNumerologyAddonAmount, newBasicAmount, newNumerologyAddonAmount, changedBy)
SELECT 'USD', COALESCE(c.basicAmount, p.basicUsd, 25),
  COALESCE(c.numerologyAddonAmount, p.numerologyAddonUsd, 10),
  9.99, 5, 'release-usd-prices-2026-10-21'
FROM (SELECT 1 AS id) AS singleton
LEFT JOIN service_pricing_currencies c ON c.currency = 'USD'
LEFT JOIN service_pricing p ON p.id = 1
WHERE COALESCE(c.basicAmount, p.basicUsd, 25) <> 9.99
   OR COALESCE(c.numerologyAddonAmount, p.numerologyAddonUsd, 10) <> 5;
--> statement-breakpoint
INSERT INTO service_pricing_currencies
  (currency, basicAmount, numerologyAddonAmount, updatedBy)
VALUES ('USD', 9.99, 5, 'release-usd-prices-2026-10-21')
ON DUPLICATE KEY UPDATE basicAmount = 9.99, numerologyAddonAmount = 5,
  updatedBy = 'release-usd-prices-2026-10-21', updatedAt = CURRENT_TIMESTAMP;
--> statement-breakpoint
INSERT INTO service_pricing (id, basicUsd, numerologyAddonUsd, updatedBy)
VALUES (1, 9.99, 5, 'release-usd-prices-2026-10-21')
ON DUPLICATE KEY UPDATE basicUsd = 9.99, numerologyAddonUsd = 5,
  updatedBy = 'release-usd-prices-2026-10-21', updatedAt = CURRENT_TIMESTAMP;
