# Seller workspace visual refinement

2026-11-11. Desktop refinement following the supplied screenshot. Frontend only;
no commits, real AI calls, or PayPal operations. No mobile checks were run.

Inspected Render in Chrome at 1440 px: rendered page and computed typography.
Used its restrained typography, spacing and borders as visual references. Kept
PayeeGuard's Geist font and seller forest palette; copied no proprietary font,
artwork or source. Reference: https://render.com/.

Changes:

- `ui/src/styles/sellerWorkspace.module.css` (new): 1600 px maximum workspace,
  32 px horizontal padding, 420 px chat, calmer account panels, clear primary
  next-step panel and subdued secondary cancellation. Smaller desktop uses an
  existing responsive fallback; review tested 1280 px and wider.
- `ui/src/components/seller/SellerPage.tsx`: scoped workspace styles, next step
  before progress, cancellation on the right inside the current-step panel. Same actions/API.
- `ui/src/components/detail/JourneyStepper.tsx` and
  `ui/src/styles/journey.module.css`: seller-specific progress treatment: lighter
  typography, fewer borders, simpler status labels. Operator progress unchanged.
- `ui/src/components/seller/SellerGuideChat.tsx` and
  `ui/src/styles/guideChat.module.css`: smaller guide icon, quieter bubbles,
  clearer composer separation, more comfortable line height and containment.
- `ui/tests/sellerDesktop.browser.mjs` (new): desktop-only fixture checks.
- `ui/dist`: rebuilt production frontend.

Fresh checks:

- TypeScript build: PASS.
- `npm test`: PASS, 9 tests.
- `PAYEEGUARD_UI_URL=http://127.0.0.1:5175 node tests/sellerDesktop.browser.mjs`:
  PASS at 1280, 1440, 1720 and 1920 px. Validates expanded container/chat width,
  action ordering, long replies, controls and bubbles within bounds, internal
  scrolling, no reply-induced page jump and no uncaught browser errors.
- `PAYEEGUARD_UI_URL=http://127.0.0.1:5175 node tests/sellerCancel.browser.mjs`:
  PASS, 6 groups including success, confirmation dismissal, CSRF/session,
  forbidden request and activation race.
- Repeated desktop checks against built UI on port 8765: PASS at all four
  desktop widths, with every API response intercepted.
- `NODE_OPTIONS=--max-old-space-size=6144 npm run build`: PASS, existing large
  vendor chunk warnings remain.

Screenshots from synthetic fixtures were visually inspected at 1720 px. Browser
API requests were intercepted, including on any production-build smoke check;
no saved sandbox request or payout was changed. Existing working-tree changes
were preserved; no backend or API client edits were made by this task.

## Follow-up: cancellation inside the PayPal panel

Moved the secondary Cancel this request button into the right side of the
verification panel, alongside Continue with PayPal. Review and safety-wait states
retain the same cancel control in their current-step panel. Removed the separate
Changed your mind section. The existing confirmation, CSRF/session handling,
backend state checks and activation-conflict behavior are preserved.

The running sandbox runtime's private marketplace login file remains
`/tmp/payee-sandbox-1ap9zatk/sandbox-accounts.json`, with seller and operator
usernames. No passwords were copied into this report or terminal output.
