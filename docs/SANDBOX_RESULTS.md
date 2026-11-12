# Real PayPal sandbox run: results (2026-11-11)

Run by Claude Code with the user's go. PayPal SANDBOX only, USD 0.01 per payout, live NVIDIA assessment.
Local marketplace users (creator, operator), AI model `nvidia/nemotron-3.5-bolt-e4b`, runtime in a new temporary directory.
Cooling-off was set to 1 second (`RESCUE_COOLING_SECONDS=1`). The default is 3 days. This shortens the wait. It is not a timer skip.
Payer IDs are masked. Sandbox account logins were entered by a headless browser script and are not in this file.

| Step | Result |
|---|---|
| Log in with PayPal as A and B (sandbox) | Both returned a payer ID and verified_account. A is `***-EVCA`, B is `***-WRVQ`. |
| Payout 1, before any change | Receiver A. Batch `S4T2YHC49L5TY`. Provider status SUCCESS after reconcile. needs_attention=false. |
| Seller request | CHANGE_REQUESTED. A active. B not usable. Live NVIDIA assessment AVAILABLE (NEW_ACCOUNT, no signals, advisory_only). Seller response has no ai_assessment. |
| NEW login as B (callback `/api/v1/paypal/callback`) | new_account VALIDATED, state PENDING_OLD_ACCOUNT_AUTH. A still active. B proposed, not usable. |
| OLD login as A | old_account MATCHED, state PENDING_REVIEW. |
| Replay of the same callback | HTTP 400 PAYPAL_CALLBACK_INVALID. |
| Evidence, then APPROVE | APPROVED_COOLING_OFF. After the wait the backend set ACTIVE_NEW_DESTINATION. Active destination is B. |
| Payout 2, after activation | Receiver B. Batch `QUCXXDVBZDG8Y`. SUCCESS after reconcile. needs_attention=false. |
| UI at http://127.0.0.1:8765 | Operator sign-in works. The case shows Active with B. No full payer ID in the page. No horizontal overflow. 3 of 3 Mermaid diagrams render. |

## Bug found by this run, fixed
PayPal's sandbox returns `verified_account` as the string `"true"`. The destination callback required the boolean `True`,
so every real login was rejected with PROVIDER_IDENTITY_UNAVAILABLE. Fixed at the provider boundary in
`rescue/paypal.py` (`identity()`): only `True` or the exact string `"true"` counts as verified. Test: `tests/test_paypal_identity.py`.
The callback check itself is unchanged and strict. Fake-provider tests could not catch this.

## Setup notes
- The PayPal app needed the Return URL `http://127.0.0.1:8765/api/v1/paypal/callback` registered. The user added it.
- The old `.runtime` sandbox payee held the placeholder `ESTABLISHED_A`, not a real payer ID. This run used a new runtime with A's real ID.

## Not verified
- Account recovery path (lost old account, 7-day wait, ACCOUNT_RECOVERY evidence).
- A wrong old account (NOT_MATCHED) with real PayPal.
- Default 3-day cooling-off with real PayPal.
- Failed, returned or unclaimed payouts.
- HTTPS hosting. This run used HTTP on 127.0.0.1.
