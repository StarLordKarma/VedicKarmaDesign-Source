# Independent deployment guide

This project includes a portable Docker build profile for Docker-compatible independent servers. The managed Manus deployment remains unchanged because the profile is stored at `deploy/Dockerfile.independent` rather than the repository root.

## Runtime architecture

The application is a Node.js 22 server that builds the React/Vite client and serves it from `dist/public`. It uses MySQL-compatible storage through `DATABASE_URL`, tRPC under `/api/trpc`, and scheduled HTTP callbacks for receipt cleanup and SLA evaluation. The container must listen on the platform-provided `PORT`; local development defaults to 3000.

## Build and run

From the repository root, build with `docker build -f deploy/Dockerfile.independent -t vedic-astrology-booking .`. Run with `docker run --env-file .env.standalone -p 3000:3000 vedic-astrology-booking`. In production, put the image behind HTTPS and a reverse proxy, set `PORT`, and use a secret manager rather than committing an environment file.

## Required configuration

| Variable | Purpose | Independent-server action |
|---|---|---|
| `DATABASE_URL` | MySQL/TiDB connection | Provide a TLS-enabled managed database URL and apply all Drizzle migrations. |
| `JWT_SECRET` | Session signing | Generate a unique high-entropy value. |
| `PUBLIC_BASE_URL` | Canonical public HTTPS origin | Set the final site URL without a trailing slash; production checkout callbacks do not trust the incoming Host header. |
| `OWNER_OPEN_ID` / `OWNER_NAME` | Owner access mapping | Set the owner identity used by the configured auth adapter. |
| `OAUTH_SERVER_URL`, `VITE_APP_ID`, `VITE_OAUTH_PORTAL_URL` | Current Manus OAuth | Keep only when using Manus OAuth; replace with a standalone auth adapter before removing the Manus dependency. |
| `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY` | LLM, storage, notification proxy | Keep for Manus Forge, or replace the LLM/storage/notification adapters with provider-specific implementations. |
| `VITE_FRONTEND_FORGE_API_URL`, `VITE_FRONTEND_FORGE_API_KEY` | Frontend Forge access | Keep only for features that use the Manus frontend API. |
| `NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_IPN_SECRET` | Crypto checkout and webhook verification | Configure the independent public webhook URL and verify the IPN secret. |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Email delivery | Configure a verified sending domain and provider key. |
| `SCHEDULED_TASK_SECRET` | Protects cleanup/SLA callback endpoints | Set a high-entropy value and send it as `Authorization: Bearer ...` from the external scheduler. |
| `PRODUCTION_SMOKE_SECRET` | Authorizes destructive-free checkout smoke runs | Set a separate high-entropy value and expose it only to the release smoke job. |
| `REPORT_FONT_PATH` | Unicode font used for localized PDFs | The provided container installs DejaVu Sans and supplies its path automatically. |
| `VITE_APP_TITLE`, `VITE_APP_LOGO` | Branding | Set public, non-secret branding values. |

## Platform dependency boundary

The portable container and database contract are independent, but the current application still contains explicit Manus adapters for OAuth, Forge LLM/storage/notifications, and the managed scheduled-task callback. To run without Manus, implement replacements behind those boundaries: a local/OIDC authentication provider, S3-compatible storage, an LLM provider adapter, an email/notification provider, and an external scheduler. Do not remove the existing Manus adapters until the replacements are configured and tested.

Scheduled work must be invoked by the host scheduler or a platform scheduler. Call `POST /api/scheduled/cleanup-receipts`, `POST /api/scheduled/cleanup-payment-test-lab`, and `POST /api/scheduled/evaluate-sla` from authenticated, private jobs; when `SCHEDULED_TASK_SECRET` is set, send it as a Bearer token. Do not run cron inside the container.

## Database and storage migration

Run the committed Drizzle migrations against the target MySQL-compatible database before starting application traffic. File bytes should remain in S3-compatible object storage, with only metadata in the database. Export and restore database data and object storage separately; the source ZIP intentionally contains no customer data or secrets.

## Security checklist

Use TLS for the database and HTTP traffic, rotate `JWT_SECRET`, protect scheduled endpoints at the reverse proxy or add a deployment-specific scheduler credential, keep admin routes owner-only, and configure restrictive CORS and proxy headers. Never commit `.env`, provider keys, customer records, generated PDFs, or database dumps.

## GitHub workflow

The repository workflow runs type checks, tests, the production build, and an independent Docker image build for every pull request. Develop in a feature branch, require the workflow to pass, and merge through review rather than pushing directly to `main`.
