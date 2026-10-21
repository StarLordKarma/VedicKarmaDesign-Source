# Report production runtime

Production uses an independent order-signing secret, private Cloudflare R2
storage, a domain-scoped Resend sending key, and a Workers AI-only token. Values
belong in the hosting environment; never commit secrets or copy them into logs.

- `ORDER_SIGNING_SECRET`: stable, random key for invoices and wallet-binding messages.
- `STORAGE_PROVIDER=s3`, `S3_REGION=auto`, `S3_BUCKET`, `S3_ENDPOINT`,
  `S3_FORCE_PATH_STYLE=true`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`: R2.
- `NOTIFICATION_PROVIDER=resend`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`: email.
- `LLM_BASE_URL`: account-specific Workers AI `/ai/v1` endpoint.
- `LLM_API_KEY`: token restricted to Workers AI in the hosting account.
- `REPORT_AI_MODEL=@cf/meta/llama-3.3-70b-instruct-fp8-fast`.
- `GEOCODING_PROVIDER=geonames`: bundled cities15000 directory, with historical
  offsets resolved using IANA timezone rules. Unknown or ambiguous places and DST
  gaps/overlaps are rejected before payment. Attribution is included in PDFs.

The text model receives chart calculations, not raw birth input or contact
details. Its output must satisfy the narrative schema and reference real facts.
The automatic review gate may hold an invalid report for owner review.

Workers AI is configured on the free tier. When its daily allocation is exhausted,
generation fails and requires queue recovery; it does not automatically upgrade
the billing plan. Check queue health and capacity before taking production orders.

`DIRECT_AUTO_PROCESS=true` and `REPORT_AUTO_DELIVERY=true` enable the durable
workflow for independently confirmed direct payments. Keep `CHECKOUT_ENABLED=false`
until runtime checks, delivery checks and deployment verification have passed.

Verification uses synthetic data and `delivered@resend.dev`, the provider's test
recipient. Acceptance by that endpoint is not evidence of delivery to a real inbox.
Real blockchain finality and payment matching are covered separately by the
payment tests; synthetic report checks do not transfer funds.

## Public sample

`scripts/build-public-report-sample.mts` uses the production PDF renderer and
invented identity/birth details, without credentials or network requests.
Run it with `node --import tsx scripts/build-public-report-sample.mts`, then run
`python3 scripts/render-public-report-sample.py` in a PDF tooling environment
with pypdf, reportlab, Pillow and Poppler. Inspect all three rendered pages.
Only the cover, D1 chart and final interpretation page are published under
`client/public/samples/`; every page is visibly marked as a fictional sample.

## Checkout verification (2026-10-21)

Production health and database readiness returned 200. Basic and advanced USD
orders produced signed invoices for 9.99 and 14.99 tokens. All five configured
networks were included. Fresh, unfunded test wallets successfully signed EVM
(Polygon) and TRON binding challenges; malformed signatures were rejected.
Nonexistent transaction hashes remained unpaid, and no real transfer was sent.
All four configured EVM RPCs returned finalized blocks. A full transfer with real
funds remains a separate owner-operated test; never infer it from these checks.

The public booking form refreshes payment availability every 30 seconds, on
focus/reconnection and on explicit retry, avoiding a stale disabled checkout
after a server restart. Network failures disable checkout until a successful
refresh. The production smoke script includes the current privacy contract and
tests the default USD checkout, as well as pricing in all offered currencies.
