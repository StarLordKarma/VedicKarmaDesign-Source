# Vedic Astrology Booking

A multilingual full-stack booking site for Vedic astrology birth-chart readings with optional Indian numerology, crypto checkout, localized receipts, owner-only administration, PDF delivery, and receipt retention tools.

## Stack

React 19, Vite, Tailwind CSS, Express, tRPC, Drizzle ORM, MySQL/TiDB, S3-compatible storage, NOWPayments, Resend, and Manus OAuth or an equivalent OAuth provider.

## Development

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
pnpm dev
```

## Recovery and migration

Read [`ETAP-ODIN-RESTORE-INSTRUCTIONS.md`](./ETAP-ODIN-RESTORE-INSTRUCTIONS.md) before deployment. The source archive intentionally excludes secrets, databases, object-storage contents, cookies, logs, and generated build artifacts. Those must be restored separately and configured through a secret manager.

## Important security assumptions

Admin procedures are restricted to `OWNER_OPEN_ID`. Keep that authorization gate enabled, keep PDF storage private, validate NOWPayments IPN signatures, and never commit `.env` files or credentials.

## License

MIT. Third-party services, uploaded content, customer data, domains, and credentials remain subject to their respective terms and ownership records.
