# Seller chat containment and action order

2026-11-11. Frontend-only fix; no commits or real PayPal calls.

Changed:

- `ui/src/components/seller/SellerPage.tsx`: moved Cancel request below the
  active workflow step. Step 2 / PayPal new-account verification, old-account
  verification and safety-wait information now precede the secondary cancel action.
- `ui/src/components/seller/SellerGuideChat.tsx`: replies scroll the transcript
  itself, rather than using scrollIntoView and moving the seller's entire page.
- `ui/src/styles/guideChat.module.css`: constrain grid tracks and bubble widths,
  wrap long content and the reason-copy button, contain vertical scroll, and keep
  the input/send controls within the panel.
- `ui/src/styles/journey.module.css`: allow the chat column to shrink properly,
  including the single-column mobile layout.
- `ui/tests/sellerLayout.browser.mjs`: synthetic HTTP-fixture regression checks.

Fresh checks, from `ui/` against isolated Vite preview port 5175:

- `npx tsc -b`: PASS.
- `npm test`: PASS, 9 tests.
- `PAYEEGUARD_UI_URL=http://127.0.0.1:5175 node tests/sellerLayout.browser.mjs`:
  PASS at 1440, 390 and 320 px. Tests primary-step ordering, long messages and
  unbroken words, transcript scrolling, chat/control bounds and no reply-induced
  page scroll. All API requests intercepted; no saved case was changed.
- `PAYEEGUARD_UI_URL=http://127.0.0.1:5175 node tests/sellerCancel.browser.mjs`:
  PASS, 6 cancellation check groups.

Backend, policy, gate and API client were not edited. Layout tests use synthetic
responses, not real model or provider calls. Production `ui/dist` rebuilt with
`NODE_OPTIONS=--max-old-space-size=6144 npm run build`.
