# Consent-based free-reading funnel — 15 November 2026

The free-reading page now uses the existing optional analytics consent control. No events or audience IDs are created before analytics consent, and DNT/GPC prevent collection. Birth-data processing consent is separate and does not opt anyone into analytics. Withdrawal clears the existing audience IDs. The server also ignores DNT/GPC requests.

The five events are `free_preview_view`, `free_preview_start`, `free_preview_complete`, `free_sample_open`, and `free_product_open`. A start means a valid form submission; completion means the current successful response was displayed. Failed requests and stale responses do not count as completions. Sample/product events mean link clicks, not a verified PDF read or purchase.

All events use western/portrait context and the existing language, device class and source/medium/campaign attribution. The analytics call receives no form values or calculated placements. Strict server validation rejects additional fields including name, email, birth date/time, city identifiers and coordinates. Existing pseudonymous session/visitor identifiers are hashed before database storage; no new database migration is needed.

The owner's control room shows unique sessions per funnel step and per campaign. Repeated calculations/clicks in one session count once per step. These are period-based step counts, not an ordered cohort conversion rate; a session may start before the selected period or enter at a later step. Existing campaign order and payment totals remain the final-stage evidence and are not changed by this release. Visitors declining analytics are absent, so these figures are incomplete by design.

Validation includes client consent/withdrawal, DNT/GPC, private-value exclusion, unsuccessful and stale requests, schema rejection and server privacy-header checks. The disposable MySQL integration test verifies repeated completion events remain one session in the campaign summary. Production activation must be confirmed separately after deployment; synthetic test records must not be described as real visitors or sales.
