# Configuration and Secrets Setup

## Important safety rule

The backup package does not contain real credentials. Keep `CONFIGURATION-TEMPLATE.env` as a reference, copy it to `.env` only on a trusted local machine, or enter the same variables into the deployment platform's secret manager. Never commit `.env`, paste keys into tickets, screenshots or chat, or place server-only values in client code.

## Variables

| Variable | Required | Where it is used | How to fill it |
|---|---:|---|---|
| `NODE_ENV` | Yes | Runtime mode | `development` locally, `production` in deployment |
| `PORT` | Platform-defined | HTTP server | Leave platform-provided; do not hardcode in code |
| `DATABASE_URL` | Yes | Drizzle/MySQL/TiDB | Use the provider connection string; require SSL in production |
| `JWT_SECRET` | Yes | Session cookie signing | Generate a long random value, at least 32 bytes |
| `OWNER_OPEN_ID` | Yes | Owner-only authorization | Use the exact OAuth OpenID of the owner |
| `OWNER_NAME` | Yes | Admin display and audit records | Human-readable owner name |
| `VITE_APP_ID` | OAuth | OAuth application | Application ID from the OAuth provider |
| `OAUTH_SERVER_URL` | OAuth | Server-side OAuth calls | Provider OAuth backend URL |
| `VITE_OAUTH_PORTAL_URL` | OAuth | Browser login redirect | Provider login portal URL |
| `BUILT_IN_FORGE_API_URL` | Manus | Server storage/notification/LLM helpers | Project Forge API base URL |
| `BUILT_IN_FORGE_API_KEY` | Manus | Server-only Forge authentication | Server-scoped Forge key; never expose it to the browser |
| `VITE_FRONTEND_FORGE_API_URL` | Manus | Browser Forge helper | Frontend-safe API base URL |
| `VITE_FRONTEND_FORGE_API_KEY` | Manus | Browser Forge helper | Frontend-scoped key only; treat all `VITE_*` values as public |
| `NOWPAYMENTS_API_KEY` | Payments | Crypto checkout creation | NOWPayments API key, server-only |
| `NOWPAYMENTS_IPN_SECRET` | Payments | Webhook/IPN verification | NOWPayments IPN secret, server-only |
| `RESEND_API_KEY` | Email | Approved PDF and receipt delivery | Resend API key, server-only |
| `RESEND_FROM_EMAIL` | Email | Sender identity | Verified sender, for example `Reports <reports@example.com>` |
| `SWE_EPHE_PATH` | Optional | Swiss Ephemeris data | Local ephemeris directory; blank uses fallback mode |
| `PRODUCTION_SMOKE_BASE_URL` | Smoke tests | Production smoke script | Deployed HTTPS base URL |
| `PRODUCTION_SMOKE_RUN` | Smoke tests | Explicit smoke marker | `true` only for an intentional smoke run |
| `RUN_LIVE_PAYMENT_TESTS` | Smoke tests | Live payment test gate | Keep `false`; enable only with provider test credentials and cleanup |
| `VITEST` | Tooling | Test runtime | Usually unset; Vitest manages it |

## Recommended setup order

First create the database and configure `DATABASE_URL`, then create `JWT_SECRET`, `OWNER_OPEN_ID` and `OWNER_NAME`. Configure OAuth and verify the callback URL. Next configure private storage and the Manus Forge server values. Add NOWPayments only after the webhook/IPN endpoint is deployed and signature validation has been tested. Configure Resend after verifying the sender domain. Add optional Swiss Ephemeris and smoke-test values last.

## Server/client separation

The following values must remain server-only: `DATABASE_URL`, `JWT_SECRET`, `OWNER_OPEN_ID`, `BUILT_IN_FORGE_API_KEY`, `NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_IPN_SECRET` and `RESEND_API_KEY`. Values beginning with `VITE_` can be included in the browser bundle, so they must never contain private credentials. Do not place storage secret keys, backup keys or provider Authorization headers in frontend variables.

## Validation without exposing values

Use presence checks rather than printing values:

```bash
node -e 'for (const k of ["DATABASE_URL","JWT_SECRET","OWNER_OPEN_ID","BUILT_IN_FORGE_API_KEY","NOWPAYMENTS_API_KEY","NOWPAYMENTS_IPN_SECRET","RESEND_API_KEY"]) console.log(k, Boolean(process.env[k]))'
pnpm check
pnpm test --run
pnpm build
```

A successful presence check does not prove that a credential is valid. Use the project's credential tests and controlled staging smoke tests. Never run live payment tests with production money or customer data.

## Rotation and recovery

To rotate a secret, create a replacement credential at the provider, add it to the secret manager, restart the deployment, run a controlled validation, and revoke the old credential. Rotating `JWT_SECRET` invalidates existing sessions. If a secret has been exposed, revoke it immediately rather than merely changing the archive or repository.

## Report Studio-specific configuration

Report Studio additionally stores owner-controlled AI settings in the database: automatic processing is OFF by default; the model must be allowlisted; `maxTokens` is bounded from 1000 to 12000; `maxSections` from 1 to 12; and `maxParagraphChars` from 300 to 1800. These values are not secrets and are configured in the owner-only Report Studio screen. AI receives validated calculation facts JSON only.

## Deployment checklist

After filling configuration, apply migrations, run the validation commands, verify owner-only access, verify private PDF storage, test city geocoding, test a NOWPayments sandbox callback, generate a Report Studio preview, approve a controlled report and test Resend delivery. Keep automatic job processing OFF until these checks succeed and a database/storage backup exists.
