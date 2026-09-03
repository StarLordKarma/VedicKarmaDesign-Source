# Independent release and restore checklist

## Scope

The application supports owner-only OIDC login, private S3-compatible PDF storage,
Resend owner notifications, a configurable OpenAI-compatible LLM endpoint, direct
Google Maps geocoding and external authenticated scheduling. The legacy Manus
adapters remain available for the existing deployment. No customer records,
wallet keys or production credentials are included in this repository.

## Required owner decisions before a real launch

- Server and domain under the owner's control; DNS points to the server.
- Approved legal payment arrangement and seller disclosures. A personal foreign
  currency card is not an online acquiring integration. Do not advertise anonymous
  payments or activate fiat checkout without the provider's approval.
- OIDC provider supporting authorization code + PKCE and client_secret_basic;
  enable MFA there. Configure the exact issuer, client ID, client secret and owner
  subject. Redirect URI: `https://YOUR-DOMAIN/api/auth/callback`.
- Separate MySQL database and restricted runtime credentials; migration credentials
  should have schema permissions only during a controlled release.
- Private S3 bucket with public access blocked and a least-privilege credential for
  the app. Encryption, object versioning, lifecycle and backup policies are managed
  on the storage service, not by making the bucket public.
- Resend sending domain, owner recipient and selected LLM/Maps credentials.
- Confirm the licensing requirements of Swiss Ephemeris/sweph for the intended
  deployment before offering the service commercially.

## Deployment

1. Build and test the release in CI. Do not deploy while any job is failing.
2. Copy `deploy/.env.standalone.example` to `deploy/.env.standalone` on the server;
   fill through a secret manager or a protected file (mode 0600). Never commit it.
3. Review committed SQL migrations. Take a database backup and storage inventory.
4. Run `docker compose --env-file deploy/.env.standalone -f deploy/compose.yml --profile tools run --rm migrate`.
5. Run `docker compose --env-file deploy/.env.standalone -f deploy/compose.yml up -d --build app proxy`.
6. Check `/health` and `/ready` over HTTPS. Verify that direct public access to port
   3000 is blocked; only Caddy should reach the app. `TRUST_PROXY_HOPS=1` assumes
   this exact topology. Do not expose the app directly with that setting.
7. Log in through OIDC and verify the owner dashboard. Test another identity: it
   must be rejected. An unauthenticated private PDF must return 403.
8. Create a synthetic Report Studio job, calculate it, inspect facts and every PDF
   page, edit a paragraph, and verify a new version. Synthetic approval must fail.
9. Configure external POST jobs for `/api/scheduled/cleanup-receipts`,
   `/api/scheduled/cleanup-payment-test-lab` and `/api/scheduled/evaluate-sla`.
   Send `Authorization: Bearer SCHEDULED_TASK_SECRET`; do not put secrets in URLs.
10. Only after explicit owner approval, test one real low-value order and email.
    Repeated webhook delivery must not create duplicate reports or client emails.

## Backup and restore rehearsal

- Schedule encrypted database backups with the chosen database provider or
  `mysqldump --single-transaction` using a protected client option file (never
  passwords in command arguments). Keep an off-server copy and record restore time.
- Back up object storage independently, including all versions referenced by the
  database. Export key, size and checksum metadata; do not put customer PDFs in Git.
- Rehearse restoration into a **separate staging database and bucket**, with
  payment callbacks, notifications and automatic report processing disabled.
- Verify migration version, row counts, a sample PDF checksum, owner access and
  unauthenticated rejection. Do not mark backups verified until this rehearsal passes.
- Define retention periods and deletion handling for backups with the data owner.

## Rollback

Retain the prior image digest and a database snapshot before each schema change.
Revert to the prior image only if its schema is compatible. Do not automatically
reverse migrations or overwrite the live database: pause incoming orders, review
the failure and restore under explicit owner supervision. Disable automatic report
processing while reconciling failed or interrupted jobs. A delivery left in
`sending` requires checking the email provider before retrying; do not blindly
reset its state and risk a duplicate email.

## Remaining live acceptance gates

Local tests and browser fixtures do not prove a real OIDC login, object storage,
MySQL migrations, email delivery or Docker launch. CI runs the container build and
an isolated MySQL integration suite; production gates above require the actual
server, credentials and a controlled staging rehearsal. The older roadmap also
includes longer-term retention/audit UX and client download enhancements; those
must not be represented as shipped merely because historical todo items are checked.
