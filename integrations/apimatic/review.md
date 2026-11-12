# APIMatic PayPal adapter review

Status: installation attempted; blocked by npm DNS. Do not claim plugin-backed
validation until the installed plugin has actually supplied and reviewed context.

After installing, use this prompt with the coding assistant:

> Use the installed APIMatic PayPal context to review rescue/paypal.py and the
> OAuth flow in rescue/app.py. Identify exact source/version and operation for
> each endpoint below. Compare methods, path parameters, scopes, authentication,
> response fields and cancellation semantics. Report unsupported coverage rather
> than inventing it. Propose minimal corrections only. Do not call payment APIs,
> expose credentials, replace the state machine, or add financial agent tools.

Review checklist from the current adapter:

| Operation | Current request |
|---|---|
| App token | POST `/v1/oauth2/token`, client credentials |
| Payout creation (developer probe only) | POST `/v1/payments/payouts` |
| Batch retrieval | GET `/v1/payments/payouts/{id}` |
| Item retrieval | GET `/v1/payments/payouts-item/{id}` |
| Unclaimed cancellation | POST `/v1/payments/payouts-item/{id}/cancel` |
| Recipient token exchange | POST `/v1/oauth2/token`, authorization code and same redirect URI |
| Identity | GET `/v1/identity/openidconnect/userinfo?schema=openid` |

The payout operation paths/methods also match the
[official PayPal Payouts reference](https://developer.paypal.com/api/payments.payouts-batch/v1)
read on 2026-11-10. That independent documentation check is **not** APIMatic
verification or a successful live cancellation test.

Check account-information scope returns payer ID and verified-account evidence;
do not assume SDK coverage includes Log in with PayPal. Preserve callback state,
session binding, token redaction, redirect blocking, identifiers and exact payee
matching. Cancellation error/timeout must reconcile provider state and cannot
authorize replacement. Existing web replacement execution remains disabled.

Record plugin version, actual referenced documents, findings, accepted patch,
`pixi run test` result, and unresolved API coverage. No runtime plugin dependency
or Elastic memory is needed for this development-time review.


## Verified live against the PayPal sandbox (2026-11-11). This is our own testing, NOT APIMatic verification.
| Operation | Result |
|---|---|
| POST `/v1/oauth2/token` (authorization code, same redirect URI) | Works. Needed the app's Return URL registered exactly. |
| GET `/v1/identity/openidconnect/userinfo?schema=openid` | Returns `payer_id`, `sub`, `user_id`, `verified_account` (the string `"true"`, not a boolean). With `profile` and `address` enabled: `name` and `address` (country, region, city, postal code, street) for accounts that have them. **No `account_type`, no `account_creation_date`.** The older `/v1/identity/oauth2/userinfo?schema=paypalv1.1` returned the same fields. |
| POST `/v1/payments/payouts` | Works for 100 USD sandbox payouts, receiver `PAYPAL_ID`. |
| GET `/v1/payments/payouts/{id}` | Works. Item `transaction_status` went PENDING then SUCCESS. |
| POST `/v1/payments/payouts-item/{id}/cancel` | Not exercised in this round. An earlier sandbox attempt returned HTTP 500. Cancellation is not claimed. |

Open for the plugin review: whether any documented scope returns account creation date, and the cancellation behavior.
