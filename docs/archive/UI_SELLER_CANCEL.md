# Seller request cancellation UI

2026-11-11. Implemented and production frontend rebuilt; no commits or real
PayPal calls. Backend policy, service and payout gate were not edited.

Files changed by this task:

- `ui/src/api/client.ts`: `cancelRequest(caseId)` uses the shared CSRF/session
  POST helper, encodes the case ID, submits `{}`, and adapts the returned case.
- `ui/src/components/seller/SellerPage.tsx`: seller-only Cancel this request
  button for open/safety-wait cases. Confirmation retains the selected case ID.
  Success comes from the server response, with the requested payout-account
  message. A 409 reloads current case state and reports the conflict; no optimistic
  rejection or activation occurs. Busy state disables the action.
- `ui/src/components/seller/CancelRequestDialog.tsx`: native modal dialog with
  accessible title/description, browser focus containment and Escape dismissal.
  Initial focus is Keep request. Dismissing sends no request.
- `ui/src/styles/cancelRequest.module.css`: responsive dialog presentation.
- `ui/tests/sellerCancel.browser.mjs`: HTTP-fixture integration checks through
  the actual seller page and API client.
- `ui/dist`: rebuilt frontend.

Fresh verification, run from `ui/`:

- `npx tsc -b`: PASS.
- `npm test`: PASS, 9 tests.
- `PAYEEGUARD_UI_URL=http://127.0.0.1:5175 node tests/sellerCancel.browser.mjs`:
  PASS, six groups covering all five eligible states, confirmation/dismissal,
  CSRF/session headers and one POST on confirmation, successful backend response,
  activation race/409 refresh, denied cancellation/403, and hidden controls for
  active/closed cases and an operator session. No uncaught browser errors.
- `NODE_OPTIONS=--max-old-space-size=6144 npm run build`: PASS; existing vendor
  chunk-size warnings remain.

All browser-test API traffic is intercepted. No saved runtime, real seller
request, provider or payout was changed during verification. The existing backend
Python cancellation tests were not rerun for this frontend-only change.
