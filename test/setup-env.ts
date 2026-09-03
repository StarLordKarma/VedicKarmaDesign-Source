// Safe deterministic defaults for unit tests. Tests that cover missing
// configuration explicitly unset the variable they are exercising.
process.env.NODE_ENV ??= "test";
process.env.NOWPAYMENTS_IPN_SECRET ??= "vitest-nowpayments-ipn-secret";
process.env.JWT_SECRET ??= "vitest-session-secret-at-least-32-bytes";
process.env.OWNER_OPEN_ID ??= "vitest-owner";
process.env.OWNER_NAME ??= "Vitest Owner";
process.env.PUBLIC_BASE_URL ??= "https://example.test";
process.env.PRODUCTION_SMOKE_SECRET ??= "vitest-production-smoke-secret";
process.env.SCHEDULED_TASK_SECRET ??= "";
process.env.RESEND_API_KEY ??= "vitest-resend-api-key";
process.env.RESEND_FROM_EMAIL ??= "Vedic Karma Design <no-reply@example.test>";
process.env.OWNER_ALERT_EMAIL ??= "owner@example.test";
process.env.BUILT_IN_FORGE_API_URL ??= "https://forge.example.test";
process.env.BUILT_IN_FORGE_API_KEY ??= "vitest-forge-api-key";
