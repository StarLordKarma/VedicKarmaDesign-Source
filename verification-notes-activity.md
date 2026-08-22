## Activity dashboard and mobile verification

The desktop `/admin` preview renders the new Activity overview panel with Delivery failures, Pending payments, Recently edited clients, plus the Display preferences panel. The page remains owner-only in the authenticated preview session.

The 390x844 mobile preview renders the compact DashboardLayout mobile header and stacked summary cards without horizontal overflow in the initial viewport. The Quick delivery queue is placed below the summary/activity sections with `sm:hidden`, so it is intentionally lower on the mobile scroll rather than visible in the first viewport.

Automated validation at this checkpoint: `pnpm check` passed; `pnpm test` passed with 55 tests and 1 optional credential test skipped; `pnpm build` passed. Visual preview was captured for `/` and `/admin` at 1280x720 and `/admin` at 390x844.

Final responsive verification after the viewport-aware branch: desktop `/admin` shows the Activity overview and Display preferences side by side. The 390x844 viewport shows the mobile header and stacked cards without horizontal overflow; the quick delivery queue remains below the first viewport by design and is rendered only when `useIsMobile()` detects the mobile breakpoint. The full-page mobile capture earlier confirmed the queue placement.

Final code validation after the responsive correction: `pnpm check` passed, `pnpm test` passed with 55 tests and 1 optional credential test skipped, and `pnpm build` passed.
