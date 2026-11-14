# Free birth-chart preview release

The homepage has a free preview entry in en/ru/es/de. The preview uses the existing tropical Swiss Ephemeris engine and historical IANA birth time, returns Sun/Moon/rising explanations immediately, and links to a sample and the full Western portrait. It needs no email, creates no booking, sends no email, and stores no birth details in the customer database or browser storage. Privacy information describes this separate flow.

Unknown birth time omits the rising sign and exposes Sun/Moon sign changes across the possible day. Missing/ambiguous DST times are rejected or explicitly disambiguated. A worldwide offline GeoNames index contains 5,233,013 populated-place records and subdivisions, with 11,512,783 indexed names and aliases, countries and administrative regions. Its CC BY 4.0 attribution appears in the preview.

When the exact place is absent, the user may supply birthplace coordinates and a country to list up to five current populated places within 50 km. Nothing is automatically selected. A second explicit confirmation is required. The server revalidates the candidate against the point/country; the result retains an approximation warning and distance, and omits the rising sign. Clearing or changing location invalidates earlier selections. Coordinates travel in JSON POST, never in campaign URLs.

Request bodies are limited to 2 KB in the existing application boundary middleware, before the preview handler. Calculation/search limits are bounded per-process IP limits. No trust-proxy/authentication settings or existing payment/mail guards change. The animation toggle now says Disable/Enable animation (localized), including both Russian states.

## Gazetteer delivery

Public geographic data is a separate versioned GitHub release:
https://github.com/StarLordKarma/VedicKarmaDesign-Source/releases/tag/geonames-2026-11-14-v1

`scripts/install-settlement-directory.mjs` installs the read-only SQLite file during Docker image builds. It verifies the pinned source snapshot, compressed and uncompressed SHA-256, declared file size and required SQLite/FTS/spatial schema. The reviewed database SHA-256 is `1e6b70a982e5f588614d8eac73bd777f03262036b6bc7466a2756a8b01b098d0`; the compressed SHA-256 is `8bf5129c9cb56a3455761018c937843243bee1c97367b088478f814c926d550a`. The index is on image disk, not loaded into a JavaScript array. No production credentials or external geocoding API are needed. Node >=22.13 is required for built-in SQLite.

The source and build/index scripts remain in Git. The large SQLite file and source downloads are excluded. Docker enables FREE_PREVIEW_ENABLED=true only after a verified artifact install; the runtime environment can explicitly set it to false to disable enrollment in the free tool. Existing order-mail flags are independent and unchanged. No customer schema migration is required.

## Validation before main

- Full local Vitest: 667 passed, 27 conditional tests skipped, 101 passing files. External credential probes and conditional SQL suites were not run by this command.
- Focused integration run: 52 passed, including the real upstream request boundary, privacy notice, calculations, HTTP guard/limits and client clearing.
- Full TypeScript check and production build passed.
- Published Linux-built artifact downloaded and verified with the production installer; engine and query checks passed.
- Sandbox browser checks covered all four locales, mobile width 390px, a small village, nearby selection without automatic choice, mandatory confirmation, approximate output, unknown time/DST, clearing and continuation to the portrait form without payment.

After release, verify public HTTPS routes, all languages, new city and nearby lookup, calculated output, animation toggle, owner API protection and readiness. Verify the Northflank rollout and corresponding AGPL mirror before reporting completion. A real paid order or inbox delivery is not established by these checks.

Rollback: set FREE_PREVIEW_ENABLED=false or redeploy the prior source commit. Do not modify the existing order-mail worker/enrollment flags or delete its customer state. The free preview has no customer state to migrate.
