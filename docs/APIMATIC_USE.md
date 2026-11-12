# APIMatic Context Plugin: what was actually done (2026-11-11)

## Facts
- Installed by the project owner with `npx context-plugins install paypal`: `paypal@context-plugins` v0.4.1 (author APIMatic, MIT) for Claude Code and Codex.
- The plugin ships 12 Python skills (and .NET, TypeScript) for the **APIMatic-generated PayPal Server SDK**: authentication, client initialization, error handling, configuration and resilience, testing, and others.
- Our adapter `rescue/paypal.py` is a small hand-written REST client. We do **not** use the Server SDK. We used the plugin's guidance as a review checklist.
- The Claude Code session that ran the review had started before the install, so the skills were not auto-loaded. The review read the installed `SKILL.md` files directly from `~/.claude/plugins/cache/context-plugins/paypal/0.4.1/skills/python/`.
- No Payouts-specific text was found in the skills (search for "payout" returned nothing). Log in with PayPal is not covered either.

## Review of `rescue/paypal.py` against the skills
| Skill | Question | Result |
|---|---|---|
| python-authentication (managed token lifecycle) | Does the client refresh the app token? | **Gap.** The token was cached forever; PayPal tokens expire (about nine hours), so a long-running server would fail with 401. |
| python-configuration-resilience (retries) | Does the client retry blindly? | **Correct as is.** Payout creation must not be retried blindly. We send no retries and report "outcome may be unknown" on transport failure; reconciliation checks the stored `sender_batch_id`. |
| python-configuration-resilience (explicit base URL) | Is the environment explicit? | **Correct.** Base URL is a constant sandbox URL, no silent default. |
| python-error-handling (do not log bodies) | Are response bodies kept out of logs? | **Correct.** `http_diagnostic` exposes only `name` and `debug_id` matches. |
| python-testing (fake the transport) | Is the network seam testable? | **Partly.** Tests patch `PayPal.call`. Added a test that fakes the opener to cover the 401 path. |

## Change made (accepted)
`rescue/paypal.py`: store `expires_in`, refresh the app token a minute early, and on a 401 for an app-token call fetch a new token and retry once (never for a caller-supplied token, never for payout creation beyond that one authenticated retry). Tests: `tests/test_paypal_identity.py` (`AppTokenLifetimeTest`, 3 tests). Full suite passes.

## Cross-check against PayPal's public docs (not APIMatic)
Read `developer.paypal.com/docs/api/payments.payouts-batch/v1/`: create `POST /v1/payments/payouts`, batch `GET /v1/payments/payouts/{id}`, item `GET /v1/payments/payouts-item/{id}`, cancel `POST /v1/payments/payouts-item/{id}/cancel`. All match our adapter. A repeated `sender_batch_id` within 30 days is rejected, not replayed, which is why we derive it from our idempotency key. `PayPal-Request-Id` is also supported (optional hardening, not added).
PayPal's public Postman workspace (postman.com/paypal) is a JavaScript page; its requests could not be read, so **no Postman cross-check was made**.

## Claim boundary
We used the APIMatic Context Plugin as a review aid for our PayPal adapter and made one fix from it. We did not generate an SDK, import the spec into APIMatic, or submit the APIMatic claim form.
