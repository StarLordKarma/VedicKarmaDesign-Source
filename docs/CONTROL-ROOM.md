# Owner control room

Route: `/admin/control`. Uses the existing owner-only session and requires the configured owner openId plus admin role on every query. The page refreshes every 30 seconds when enabled. It supports English, Russian, Spanish and German, a UTC date range of up to 90 days, product section and customer-language filters, recent archives, order-number search, CSV and JSON download. No customer names, contacts, birth details, wallet addresses, PDF URLs, tokens or document contents are returned.

## Design and revised plan

The first plan combined traffic, payments and email counters. Review identified three misleading comparisons: server requests are not visitors; an email provider's acceptance is not inbox delivery; orders from all visitors must not be divided by consented sessions to claim a site-wide conversion rate. The implemented design separates these measures and labels missing data explicitly.

The compact page has six leading cards, a current-work strip, traffic chart, event funnel, acquisition campaigns, languages/devices, configured services and a shared archive. Charts and tables respond to filters. Failure states retain an explicit warning; missing collection history is displayed with a dash instead of invented visitors. The existing administration, Report Studio, refunds and SLA pages remain accessible for action and full detail.

## Measurement definitions

- Orders: creation-date cohort; paid means `paid`, `confirmed` or `finished`. Waiting is separate from failed/expired/cancelled. Known test addresses and orders with a test Report Studio job are excluded; unmarked test activity cannot always be distinguished from genuine orders.
- Revenue: gross nominal payments, before refunds, displayed separately by currency. The primary currency card is USD only. No exchange-rate conversions or net-revenue claims.
- PDF and mail activity: creation/request time of recorded operations, including versioned PDF records and older manually attached PDF records. Current job state is shown; this is not a historical snapshot of that state on the selected date. Operational totals are computed independently from the bounded recent-record archive.
- Current backlog ignores the date window but respects section/language. Refund counts refer to requests created within the selected period.
- Accepted emails include recorded report sends, legacy sends and receipt sends. Provider acceptance is not inbox confirmation; delivery/bounce webhooks are not configured by this feature. Receipt statistics are available only with all-section/all-language filters because standalone receipts have no booking attribution.
- Recent archive: latest 50 orders and at most 200 records of each operational type. CSV exports the selected recent archive, not an unlimited accounting ledger. JSON exports the current aggregate snapshot for the future marketing agent.
- Audience: approximate distinct pseudonymous visitor and session IDs, only after explicit optional-analytics consent. Known bot/headless/monitor user agents are ignored, but this is not proof that every accepted event is human. Public events cannot mark a payment paid or change an order.
- The funnel counts distinct sessions containing each event; the steps are not a guaranteed ordered path. It cannot be used as a consent-independent conversion denominator. Sources use validated campaign codes; arbitrary referrer URLs are not stored. Order campaign attribution is saved only with consent and does not affect the price or fulfillment facts.
- Server requests: aggregated categories and 5xx counts without IP addresses, URLs, identifiers or cookies. Includes bots and admin requests; `/health`, `/ready` and analytics submissions are excluded. Flushed about every minute with stable IDs for retry. Up to the last unflushed minute can be lost on process termination. Category counts and response means are technical metrics and do not use section/language filters.
- New audience and HTTP tables have 90-day rolling retention, cleaned in bounded batches during collection. Historical visitor/source statistics cannot be reconstructed for the period before this feature. Google Search Console remains an external link; no invented live search statistics are displayed.

## Collection and privacy

First-party `/api/audience` accepts a strict, small schema, requires `consent:true`, limits submissions per IP and limits concurrent persistence. Only controlled event names, product/section/language/device and campaign slugs are accepted. Input containing extra personal fields or arbitrary URLs is rejected. Visitor/session identifiers are random and HMAC-hashed before persistence; raw identifiers are not returned in reports. Birth details, names, email, wallet data and private status/payment URLs never enter events. Collection respects DNT and Global Privacy Control, and privacy choices can be reopened in the footer. No analytics are collected from payment, status or admin pages.

The same consent-aware collector is loaded on the three landing sections and public guides. Anonymous technical request aggregation is distinct from optional visitor tracking. No external tracking provider or paid service is introduced.

## Agent interface

`controlRoom.summary` is a read-only authenticated tRPC query with `{from,to,section,locale}` and response `schemaVersion:control-room.v1`. It returns the same aggregate data as the dashboard and contains no action, payment, refund or email-send methods. A future agent needs separately authorised access; this feature does not mint API credentials or grant access to any third party. Owners can instead supply a downloaded JSON snapshot.

## Deployment

Apply additive migrations 0038 and 0039 before expecting collection to work. Missing telemetry tables are reported as unavailable; financial/order operations remain accessible. The optional attribution helper is fail-open for ordering if analytics configuration is missing. No historical customer records or previous reports are rewritten.

## Checks

New tests cover owner access boundaries, consent and PII rejection, unsupported public financial events and invalid date ranges. MySQL integration tests exercise the actual aggregate SQL, currency/section/language filters, absence of customer data, event de-duplication and distinct visitor/session semantics. Existing pricing tests check that optional metadata does not alter booking amounts. Full CI and responsive browser verification are required before publication.
