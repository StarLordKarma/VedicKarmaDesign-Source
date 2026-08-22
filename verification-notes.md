# Verification notes

Fresh preview verification on 2026-08-22:

- `/?lang=de` rendered the German hero, navigation, service sections, booking form labels/placeholders, FAQ headings, disclaimer, and footer. The language selector exposed EN/RU/DE/ES.
- `/?lang=es` rendered the Spanish hero, navigation, service sections, booking form labels/placeholders, FAQ headings, disclaimer, and footer. The language selector exposed EN/RU/DE/ES.
- Both pages rendered at the desktop preview viewport without layout errors; the screenshot showed the intended split hero composition and responsive section flow.
- Automated tests separately verify that the selected public locale is stored in `localStorage` and resolved on a later render.
- A real admin PDF delivery was not executed because it would email a real client. The delivery path is covered by mocked storage/Resend tests, Resend credentials validation, and protected admin authorization tests; the UI provides delivery status and error feedback.


Additional browser verification:

- `/admin` without an authenticated owner session displayed the protected-access message and did not expose booking records, exports, filters, or delivery controls.
- The ES public preview remained available after visiting `/admin` and rendered correctly again, confirming the admin guard does not interfere with public routing.
- Direct real-client delivery was intentionally not triggered to avoid sending an unsolicited email; the production action requires an attached PDF and is protected by the admin procedure.


Mobile screenshot verification at 390×844:

- The German and Spanish public hero sections fit the mobile viewport, preserve the branded typography, stack CTAs vertically, and expose the hamburger navigation without clipping.
- The mobile `/admin` route rendered the dashboard shell and protected data state with responsive cards. The current unauthenticated preview showed zero rows, so booking controls below the fold could not be exercised without an owner session.
- Authenticated admin search/date behavior remains covered by jsdom interaction tests; no real client email was sent during verification.
