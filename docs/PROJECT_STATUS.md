# PayeeGuard: project status (2026-11-11)

## What works (tested)
- **Backend, 236 Python tests pass:** destination-change state machine, deterministic policy, payout gate, roles, audit trail, idempotency, PayPal callback binding.
- **Real PayPal sandbox, verified live:** two-account Log in with PayPal, name and country, 100 USD payouts reconciled to SUCCESS (`docs/SANDBOX_RESULTS.md`).
- **NVIDIA:** seller help chat and operator AI Review (read-only tools, one is a live PayPal read). Advisory only.
- **Risk flags and fast lane:** marketplace signals (simulated feed) and PayPal facts feed rules. One flag lengthens the wait, two block approval, a clean case can skip the operator when the fast lane is on (default off).
- **Website (`ui/`):** one site served by the backend. Seller page, operator console (AG Grid queue, AI Review, evidence form, payouts), landing, data-flow graph, schema explorer.
- **Postman:** 46 requests, 62 assertions, 0 failed (`docs/postman-run-2026-11-11.txt`).
- **OpenAPI spec:** `docs/openapi.yaml`, 22 operations, local structural checks only.

## Not verified or not done
- **APIMatic:** plugin v0.4.1 installed and used to review `rescue/paypal.py`; see `docs/APIMATIC_USE.md`. No SDK generated, claim form not submitted.
- **Render:** skipped by decision. Blueprint only, nothing deployed.
- **PayPal:** sandbox returns no account type or creation date, so the account-age flag cannot fire. Account cancellation was not exercised. Live PayPal was never used.
- **Marketplace signals and entitlement are simulated.** Operator evidence entry is a prototype stand-in.
- **AI quality:** one author-labelled 21-case set. Results vary between runs and prompts. The AI is not what blocks fraud: the rules and a person are.
- **Fast lane:** no measured false-pass rate.
- **UI:** Antigravity's list of items in `docs/archive/HANDOFF_UI_SIGNALS.md` (POLICY_BLOCKED wording, flag rows, tool label, cancel button). Accessibility (contrast, keyboard) and Lighthouse claims were not independently checked.
- **No repo browser tests:** the browser checks were scratch scripts.

## For you before submitting (deadline reported as about Nov 12 to 13, 2026; confirm on the Devpost page)
1. **LICENSE:** root `LICENSE` is MIT. Confirm GitHub shows it after you push the public repo (rules need a detectable open-source license).
2. **Video:** the public YouTube video must be under 3 minutes (reported). Use the montage and check it against the rules.
3. **APIMatic:** done as a review aid. Claim form needs a business email; skipped.
4. **Description text:** list the tools honestly. Do not call simulated parts real.
5. **Secrets:** confirm `.env` is not committed (it is git-ignored). Rotate keys that appeared in any shared place.
6. **Commit and push:** nothing is committed.
