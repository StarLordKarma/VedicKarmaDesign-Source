# Search foundation

Implemented 2026-10-22 for https://karmalifedesign.com.

## Public URLs and languages

The existing routes `/`, `/privacy`, `/refunds` use `?lang=ru`, `?lang=de` and `?lang=es`. The bare URL is English; `?lang=en` canonicalizes to it. Explicit URL language takes priority over browser storage so an indexed URL has a predictable language. The selector preserves the existing form state and updates the URL and metadata without reloading the application.

`shared/seo.ts` defines localized titles, descriptions, canonical URLs and structured data. `server/_core/seo.ts` supplies the initial response; `PageMetadata.tsx` updates the browser document on navigation. Canonical URLs strip tracking parameters and never depend on the untrusted request Host. Every public language version links reciprocally to the four alternatives and the English x-default.

The home page includes a short localized initial HTML overview and three existing fictional sample images, replaced by React when the application loads. It is identical for humans and crawlers, without user-agent detection. This is an initial public overview, not complete server rendering of the booking application or legal documents. JavaScript remains required for booking and payment.

## Discovery and exclusion

- `/robots.txt` is plain text and advertises `/sitemap.xml`.
- `/sitemap.xml` is XML and lists exactly twelve public canonical URLs; private orders, tokens and administrative pages are excluded.
- Payment, status, owner and admin pages receive both `X-Robots-Tag: noindex, nofollow, noarchive` and equivalent HTML metadata. The header also covers API responses, including private download endpoints.
- Private HTML remains crawlable so a crawler can see noindex; authentication and report access control remain necessary and unchanged. Robots is not an access-control mechanism.
- Unknown page URLs return HTTP 404 and noindex instead of a misleading 200. Direct `/index.html` requests redirect permanently to `/`.

## Link previews and structured data

Public pages have Open Graph and Twitter large-image card metadata. The 1200×630 JPEG at `/social/report-preview.jpg` uses existing public fictional report pages. Regenerate with `node --import tsx scripts/build-social-preview.mts` after updating the samples; Playwright Chromium must be available.

Home pages contain Organization and Service JSON-LD. No invented ratings, testimonials, offer prices or eligibility promises are included. Structured data does not guarantee rich search results.

## Search Console

Add the URL-prefix property `https://karmalifedesign.com/` in the owner's Google account. Publish only the verification tag or file actually issued for that account, then verify and submit `https://karmalifedesign.com/sitemap.xml`. Keep the verification proof present. Do not add another person's token or grant additional users access as part of routine SEO maintenance.

Verification is a separate access-control action: it establishes owner privileges over the property in Google. Until verification and sitemap submission have visibly succeeded in Search Console, do not report them as completed. Indexing and reporting take time and are not guaranteed by HTTP success or a sitemap submission.

## Validation

- `pnpm check`
- `pnpm exec vitest run server/_core/seo.test.ts client/src/components/PageMetadata.test.tsx client/src/pages/Home.test.tsx client/src/pages/Privacy.test.tsx client/src/App.test.tsx`
- `pnpm build`
- Inspect the actual public responses after deployment, including HEAD on a harmless nonexistent payment/status token; never put a real private order URL into external validation services.
- Check title, canonical and structured data after switching languages in a real browser, and the initial public overview with JavaScript disabled.

Official references: [robots](https://developers.google.com/search/docs/crawling-indexing/robots/intro), [localized versions](https://developers.google.com/search/docs/specialty/international/localized-versions), [Search Console verification](https://support.google.com/webmasters/answer/9008080).
