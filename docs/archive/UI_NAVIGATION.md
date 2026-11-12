# Menu navigation transition fix

2026-11-11. Frontend only; no credentials, login, API mutation, or PayPal
operation was used in these checks. No commits.

The router keeps the current page mounted while the next route module loads.
Header and footer links preload their destination on hover or keyboard focus.
Ready pages crossfade over 220 ms using the browser View Transitions API; the
header stays outside the animation. Unsupported browsers navigate normally.
Both the device preference and the app's Reduce motion control skip the effect.
Scroll reset, main-content focus, role palettes, and mobile menu dismissal remain.
The menu label is now **Docs**; `/how-it-works` URLs still work.

A synchronous router commit inside the native transition avoids a concurrent
render timeout found during rapid menu-click testing. There is no exit delay
keeping an old form interactive after navigation commits. Hover preloading only
imports frontend modules; it does not mount the destination or fetch its cases.

## Files

- `ui/src/App.tsx`: persistent layout and lazy data-router routes.
- `ui/src/routing/pages.ts`: shared route import functions and intent preloading.
- `ui/src/routing/RouteLink.tsx`: accessible links, preloading, transition opt-in,
  and synchronous ready-route commit. Modified clicks retain native behavior.
- `ui/src/components/layout/Header.tsx` and `Footer.tsx`: use those links.
- `ui/src/styles/global.css`: page-only crossfade and pending progress line.
- `ui/tests/navigation.browser.mjs`: browser regression checks.
- `ui/dist`: rebuilt frontend.

## Fresh verification

Local Chrome, anonymous browser contexts; isolated development preview at
`http://127.0.0.1:5175` backed by synthetic demo providers.

- `npx tsc -b`: PASS.
- `npm test`: PASS, 5 tests.
- `PAYEEGUARD_UI_URL=http://127.0.0.1:5175 node tests/navigation.browser.mjs`:
  PASS, 10 checks: hover preloading, deliberately blocked cold module retaining
  its previous page, native transition invocation/timing, scroll/focus,
  manual/device reduced motion, rapid clicks, Back, mobile menu, browser errors.
  This test deliberately intercepts Vite source-module URLs: run against dev.
- `PAYEEGUARD_UI_URL=http://127.0.0.1:5175 node tests/landing.browser.mjs`:
  PASS, 26 public-page checks.
- `NODE_OPTIONS=--max-old-space-size=6144 npm run build`: PASS.
- Built-site Chrome smoke check on port 5176: PASS across Seller, Operator,
  Docs and API. API responses stubbed; no backend requests or browser errors.
- All 35 protected backend/API files match the saved pre-revamp SHA-256 baseline.

The existing heavyweight chart/diagram/highlighter chunks still produce Vite
size warnings. These changes remove the navigation fallback flash; they do not
make downloading an uncached destination instantaneous. Actual payment execution
was outside this presentation-only check.
