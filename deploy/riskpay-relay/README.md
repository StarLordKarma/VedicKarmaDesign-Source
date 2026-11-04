# Isolated RiskPay callback fixture receiver

This is a separate TEST project, never the main website. It contains no checkout,
merchant wallet, payment credentials, customer profile, PDF, or production database access.
It cannot make RiskPay requests, accept card payments, or confirm payment.

`GET /health` reports fixture mode. `GET /api/riskpay/callback` accepts the documented
event fields only for a test order registered by the local signed client. The cloud
stores immutable notification objects and hashed capabilities in deploy-scoped Blobs,
not a financial ledger. Raw capability tokens are removed before storage.

`POST /internal/register`, `/internal/events`, and `/internal/ack` require an Ed25519
signature over method, path, timestamp and body hash. The private key stays in ignored
`.validation/riskpay-relay-key.pem`. Never upload that directory. The generated
`lib/deployment.mjs` contains only a PUBLIC verification key and expiration timestamp.
All other routes return 404. No CORS or public event-listing endpoint exists.

The receiver refuses requests after one hour. This does not automatically delete
stored objects; they remain scoped to this isolated deployment. Remove test data
through Netlify Blobs or remove the isolated project after testing. Only synthetic
orders may be registered. Do not configure this queue for production payments.

From the repository root:

1. `node scripts/prepare-riskpay-relay.mjs`
2. `npm install --prefix deploy/riskpay-relay --ignore-scripts`
3. `node --test deploy/riskpay-relay/relay.test.mjs`
4. Authenticate Netlify CLI, then deploy **from this directory** into a new isolated
   project, with `--no-build --dir public --functions functions --prod --json`.
   Never pass the main website's site ID. Anonymous deploys cannot run functions.
5. Set `RISKPAY_CALLBACK_BASE_URL=https://<test-project>.netlify.app` only in
   `.env.card-sandbox`, keep fixture mode and live disabled, restart local sandbox.
6. `node --import tsx scripts/check-riskpay-public-callback.mjs https://<test-project>.netlify.app`

The checker creates a synthetic order, registers its hash and assigned address,
submits an external event, pulls it over authenticated HTTPS into the local callback,
checks review status and no report, verifies replay handling and blocked routes.
`node --import tsx scripts/riskpay-relay-local.mjs https://<test-project>.netlify.app`
performs one signed registration-and-delivery pass. No background polling is installed.
If the local app stops, events wait in the cloud until the next pass or test expiry.

Main production server, domain, GitHub deployment and existing wallets are untouched.
