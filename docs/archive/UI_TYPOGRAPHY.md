# Typography at normal zoom

2026-11-11. Fixed the hard-coded small type that bypassed the previous shared
font-scale increase. Source and production frontend rebuilt; no commits or
PayPal calls. This task did not edit backend code, policy, the gate or API client.

## Changes

- Shared caption/label size: 14 px; supporting copy: 15 px; body: 16 px.
- Replaced sub-14 px sizes in application CSS, including font shorthand,
  component overrides and mobile media queries. Display headings retain their
  existing scale.
- Covered landing, sign-ins, navigation, dashboards, case detail, review timeline,
  risk/evidence labels, buttons, helper text, Docs, API reference and code text.
- Updated inline small text in StudioDashboard, AskBar, SchemaExplorer,
  CoolingOffRing, SellerAndAiTab, FlowGraph and MermaidDiagram.
- Configured AG Studio text, chart labels, subtitles and captions through its
  theme API; increased React Flow attribution size without hiding it.
- Removed perspective from the text-bearing landing cards to keep glyphs flat.
  The gate artwork remains. Mobile illustration caption now wraps with space
  beneath the account cards instead of being cropped after enlargement.

Changed paths: `ui/src/styles/*.css` containing small typography; the seven
presentation components above; `ui/tests/readability.browser.mjs`; `ui/dist`.
No dependency, configuration, credential, or financial-state changes.

## Verification

Local Chrome at 100% zoom, device scale factor 1, through Vite on port 5175.
All API responses in the typography audit are synthetic HTTP fixtures.

- `node tests/readability.browser.mjs` (with PAYEEGUARD_UI_URL): PASS, 21 checks.
  Landing, both anonymous sign-ins, signed-in seller, operator queue, Docs and
  API at 1440, 390 and 320 px. Checks computed size of ordinary rendered HTML
  text/form controls (minimum 14 px), normal zoom and horizontal page overflow.
  SVG drawing transforms and canvas text are outside this DOM assertion; Studio
  canvas font sizes are configured explicitly in its theme.
- `node tests/landing.browser.mjs` (same URL): PASS, 26 checks after font changes.
- Mobile landing screenshot visually inspected after caption wrapping fix.
- `npm test`: PASS, 9 tests.
- `npx tsc -b`: PASS.
- `NODE_OPTIONS=--max-old-space-size=6144 npm run build`: PASS; existing large
  vendor chunk warnings remain.

The audit checks typography and layout, not financial execution or a full
accessibility conformance assessment.
