## Activity dashboard and mobile verification

The desktop `/admin` preview renders the new Activity overview panel with Delivery failures, Pending payments, Recently edited clients, plus the Display preferences panel. The page remains owner-only in the authenticated preview session.

The 390x844 mobile preview renders the compact DashboardLayout mobile header and stacked summary cards without horizontal overflow in the initial viewport. The Quick delivery queue is placed below the summary/activity sections with `sm:hidden`, so it is intentionally lower on the mobile scroll rather than visible in the first viewport.

Automated validation at this checkpoint: `pnpm check` passed; `pnpm test` passed with 55 tests and 1 optional credential test skipped; `pnpm build` passed. Visual preview was captured for `/` and `/admin` at 1280x720 and `/admin` at 390x844.

Final responsive verification after the viewport-aware branch: desktop `/admin` shows the Activity overview and Display preferences side by side. The 390x844 viewport shows the mobile header and stacked cards without horizontal overflow; the quick delivery queue remains below the first viewport by design and is rendered only when `useIsMobile()` detects the mobile breakpoint. The full-page mobile capture earlier confirmed the queue placement.

Final code validation after the responsive correction: `pnpm check` passed, `pnpm test` passed with 55 tests and 1 optional credential test skipped, and `pnpm build` passed.

## Activity tools verification — 2026-08-22

Desktop preview at 1280x900 shows the Activity overview with date-from/date-to inputs, Clear range control, and Export activity CSV button aligned above the three metric cards. The owner dashboard remains readable with the existing Display preferences panel beside it.

Mobile full-page preview at 390x844 shows the activity controls stacking without horizontal overflow, the compact Quick delivery queue remaining visible below Display preferences, and the existing client request controls continuing below. The current database has no rows, so failure retry and quick PDF action rows are represented by empty states rather than executable live actions.

## Pricing editor verification — 2026-08-22

The desktop public preview still renders the fallback/default Basic price of $25 before an owner changes the persisted configuration. The owner admin preview renders the new Service pricing section beside Display preferences with Basic reading price and Numerology add-on price inputs initialized to 25 and 10, plus the Save prices action. The layout remains readable at 1280x900.
