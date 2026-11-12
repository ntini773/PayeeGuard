# Backend review by Claude Code (2026-11-11)

Scope: engineering review by reading code, not a security audit. No code was changed.
Read in full: `destination_policy.py`, `payout_gate.py`, `marketplace_payouts.py`,
`destination_service.py`, and `destination_api.py` lines 76-130 (payout, create, message, callback routes).
Not read: `destination_store.py`, `destination_reader.py` (already exercised by my contract tests),
`destination_admin.py`, `app.py`, and the tests other than the full-suite run (166 tests, all pass).

## Verified good
- `PayoutGate.execute` records intent in one transaction before the provider call, and a replay never creates a second payout (timeout, crash, concurrent call).
- Amount, currency and payer ID come from the stored earning and the stored payee. The HTTP body is rejected if it carries fields.
- Timers are refreshed before the payee is read, so the payout goes to the new account only after the backend activated it.
- A rejected evidence revision supersedes an earlier acceptance (`latest` by reference).
- Approval is bound to case version, policy version and a still-valid reviewer grant. A seller message after approval invalidates the approval.
- OAuth state is bound to tenant, seller, case, session, purpose and case version, and is consumed before the code exchange.
- The AI assessment is never an input to `evaluate`.

## Findings

| # | Severity | Finding | Evidence | Suggested fix |
|---|---|---|---|---|
| 1 | Medium | **The seller sees the AI risk signals.** `_view` returns `ai_assessment` (risk_signals, recommendation, summary) to every principal. `create` and `messages` return it to the seller session. A hijacked seller session can then reword messages until the signals disappear. The deterministic floors still hold, but the attacker learns what triggers review. | `destination_service.py` `_view` (no role filter), `destination_api.py` create and messages routes return the view | Return `ai_assessment` only when `p.review and p.channel == 'browser'`. Sellers get `{status, advisory_only}` at most. Also filter it in `summary`. |
| 2 | Medium | **Transient provider read error downgrades a good result.** In `reconcile`, any exception sets `status=UNKNOWN, provider_status=UNKNOWN`, even if the operation was already `RECONCILED` with `SUCCESS`. | `payout_gate.py` reconcile `except Exception` | If the prior status was `RECONCILED`, keep it and record only a `PAYOUT_RECONCILE_FAILED` event. |
| 3 | Low | **Terminal provider failures look like success.** `FAILED`, `RETURNED`, `BLOCKED`, `DENIED` all become `status=RECONCILED`. Nothing flags them for an operator, and nothing may retry (correct), but the UI will show "reconciled". | `payout_gate.py` reconcile | Add `needs_attention: true` in `_public` for non-`SUCCESS`/`PENDING` statuses. Document the manual path. |
| 4 | Low | **Operator queue does not refresh timers.** `operator_cases` reads stored state, while `list_cases` calls `_refresh`. A case past its expiry or cooling deadline shows the old state until someone opens it. | `destination_service.py` `operator_cases` | Call `_refresh` per case (needs a write transaction) or document that the queue state can lag. |
| 5 | Low | **Queue order and scope.** It orders by random case ID, not by time or "needs review". A reviewer grant is bound to one seller but the queue lists the whole tenant (comment says this is intended). | `operator_cases` | Order by `created_at DESC` with a cursor like `list_cases`. Confirm the tenant-wide read is a deliberate decision and record it in `docs/DECISIONS.md`. Also move `import json` out of the loop. |
| 6 | Low | **Wrong old account is not flagged.** An old-account login with a different account gives `NOT_MATCHED`, which `evaluate` treats as the recovery path (evidence, operator review, 7 days). That is safe, but no risk flag or reviewer hint records that a different account was presented. | `destination_service.py` callback, `destination_policy.py` `recovery` | Add `OLD_ACCOUNT_MISMATCH` to the case's reviewer-visible findings. |
| 7 | Info | **Cooperative AI deadline** (Codex finding 1, accepted). The model call runs inline in the HTTP request, up to the provider timeout of 25 s after the 30 s check. Rate limits exist (`_rate`). | `investigator.py` | Document it. Optionally run the assessment after the response. |
| 8 | Info | **Free-text AI fields** (Codex finding 2, accepted). Apply the `summary` checks to `claims` and `follow_up_questions` too. I will do this in the schema (my file). |  | AI owner |

## Not verified
- Real sandbox callbacks and real payouts (simulated providers only).
- `destination_store.py` transactions and `principal()` binding, beyond what the tests exercise.
- Whether the `ai_assessment` leak in finding 1 is covered by a test. I found none by reading, but did not grep every test file.

## Follow-up (2026-11-11)
- Findings 1 and 2: verified fixed by reading `_view`, `summary` and `reconcile`. Findings 3-6 remain open (Codex).
- Finding 8 (free-text AI fields): fixed in `investigator_schema.py`. `claims` and `follow_up_questions` are
  sanitized (13-character IDs redacted, `<` and `>` removed). I chose sanitizing over rejecting because these fields quote
  untrusted seller text. Rejecting would make the assessment unavailable on injection cases. Test added. 172 tests pass.
- **New, caused by fix 1 (Codex):** `destination_api.py` messages route runs the model when
  `view['ai_assessment'] is None or stale`. For a seller, `_view` now always returns `None`, so the check is always true.
  An idempotent replay of a seller message therefore calls the model again (the code comment says it should not).
  `_rate` limits the damage. Fix: have `service.message` return whether it was a replay, or read the assessment state internally.

## Re-verification (2026-11-11, after Codex's low-finding fixes)
173 tests pass. Verified by reading code and tests:
- Finding 3: `_public` returns `needs_attention` (UNKNOWN or BLOCKED status, or provider status not SUCCESS or PENDING). Test in `tests/test_payout_gate.py`.
- Finding 4: `operator_cases` now calls `_refresh` per case, using an internal seller-scoped copy of the principal.
- Finding 5: queue is ordered by `created_at DESC, id DESC` with a cursor. Unknown cursor gives 404.
- Finding 6: `OLD_ACCOUNT_MISMATCH` is added to `reviewer_findings`. Reviewers see it, sellers get `[]`. Test in `tests/test_destination_oauth.py`.
- Message replay: `service.message` returns `message_replayed`, and the route skips the model on replay.
Open notes (all low):
- `message_replayed` is an internal flag that the route returns in the seller JSON. Pop it before returning.
- `GET /api/v1/cases` can write: `_refresh` may activate a destination for any seller in the tenant when a deadline passes. This is the same backend-only timer rule as other GETs, but record it in `docs/DECISIONS.md`.
- Queue ordering and the cross-seller refresh have no dedicated test that I found. Add one.
