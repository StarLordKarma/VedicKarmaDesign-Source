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
