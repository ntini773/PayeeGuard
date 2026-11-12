# Engineering cross-review — 2026-11-10

Reviewer: Codex. This is an engineering review, not an independent security audit.
No real PayPal operation was performed during review.

## Investigator boundary (Claude Code implementation)

Reviewed `rescue/investigator.py`, `investigator_schema.py`, `investigator_rules.py`,
`investigator_eval.py`, the dataset and `tests/test_investigator.py` against the
real `destination_reader.py` and `destination_service.py` integration.

Verified by inspection and tests:

- Model tools are an explicit allowlist of three argumentless reads. Unknown
  names and caller-selected IDs are denied. Callback and payment modules are not
  imported by the investigator. Prompt instructions are not the security boundary.
- The schema rejects unknown authority keys and recommendations outside its three
  advisory values. The effective recommendation cannot weaken the baseline floor.
- The real reader rechecks backend sessions/grants and fixes tenant/seller/case
  scope. Missing/foreign cases fail before model invocation. IDs are masked.
- Assessments are appended separately, tagged with observed case version and
  timestamp; stale results are visible. Persisting an assessment cannot update
  approval, destination, case version, cooldown or payout controls.
- Model errors and invalid output produce an unavailable advisory assessment.
  Seller messages remain untrusted, including messages that claim an approval.

Findings for the AI owner (not silently changed across ownership):

1. **Latency limitation:** the 30-second deadline is checked between synchronous
   calls, not enforced by cancellation. A call started near the deadline can run
   to the provider's timeout before returning. Documentation should describe it
   as a cooperative deadline, or the owner should implement cancellable execution.
   This does not grant authorization, but can delay the HTTP response.
2. **Output hygiene limitation:** free-text `claims` and `follow_up_questions`
   have length/type checks but do not reject markup/identifiers as strictly as
   `summary`. The backend redacts identifier/key-shaped strings in public views;
   the UI must continue to render text, never HTML. Consider applying the same
   validation across all free-text fields in the AI-owned schema.
3. **Evaluation claim limitation:** existing live metrics were produced with an
   in-memory reference reader. They cannot prove real backend integration. The
   new `rescue.backend_evaluation` uses temporary real storage and
   `BackendCaseReader`; its offline result is recorded separately. A subsequent user live run completed all 21 assessments without changing
   authorization; see `backend-live-evaluation.json`. Four cases still missed
   required risk signals, and category match was 15/21. These quality limitations
   remain visible rather than being hidden by the conservative recommendation floor.

## Backend self-review

Resolved during this work:

- **Missing application gate integration:** `Application` now builds
  `MarketplacePayouts`; authenticated operator HTTP dispatch reads a stored earning
  and invokes `PayoutGate`. Request bodies cannot choose amount/currency/payer ID.
- **Missing queue/seed:** the scoped list route and a new-directory-only demo seed
  now exist. Demo callbacks identify their evidence as `DEMO_SIMULATION`.
- **Evidence revision bug:** an earlier accepted marketplace record could survive
  a later rejection. Policy now uses the latest revision per reference and holds
  conflicting/rejected current evidence. A regression covers rejection and repair.
- **Stale identity/permissions:** sessions and grant bindings are rechecked within
  storage transactions and after callback exchange. Concurrent reviews use case
  versions; callback nonce consumption occurs before provider exchange.
- **Payment race/uncertainty:** intent is persisted before dispatch; controls and
  active destination are checked again under the write lock. Duplicate earnings
  do not re-create a payout after timeout, restart or concurrent dispatch.
- **Seller view:** reviewer-only explanations are omitted from ordinary seller
  and external-agent views. Error responses do not include exception text.

Remaining boundaries:

- Prototype auth uses local sessions plus explicitly provisioned grants, one
  tenant/seller per user. It is not a real marketplace SSO/role integration.
- SQLite serializes payout dispatch under a write transaction across the provider
  call. This is conservative for the single-process prototype, not a high-volume
  deployment design. Unknown payouts need reconciliation, never a new payout key.
- Historical CLI feasibility experiments are outside the marketplace earnings
  gate. The gate does not control funds held by PayPal or other payment paths.
- No independent Claude Code review of the current backend patch has been
  received. This self-review must not be reported as that separate cross-review.

## Required external handoffs

Claude Code: review `destination_policy.py`, `destination_service.py`,
`destination_store.py`, `marketplace_payouts.py`, `payout_gate.py` and their tests;
return findings against the current working tree. Investigate the AI findings above.

Antigravity: integrate the real queue/detail/review endpoints using
`docs/BACKEND_REPORT.md`. TASK-073 browser journey and the requested redesign are
still pending under frontend ownership; mock screenshots are not backend evidence.

## Requested review order for the user

1. rescue/destination_policy.py — evidence revisions, approval freshness, cooling.
2. rescue/payout_gate.py — PayoutGate.execute is the single financial dispatch chokepoint.
3. rescue/destination_service.py — callback binding, transitions and permissions.
4. rescue/marketplace_payouts.py and rescue/app.py — stored earning → gate wiring.
5. rescue/destination_api.py — operator tenant queue, seller mutation boundaries.

Start with tests/test_marketplace_payouts.py::test_application_dispatch_has_gate_chokepoint:
forcing the gate to deny must prevent the HTTP path from calling the provider.

## Response to Claude review — 2026-11-11

Findings 1 and 2 implemented:
- Assessment payloads are returned only to browser reviewers, including summary
  responses. Seller/staff/external views return null. Backend freshness checks
  preserve idempotent inference without exposing signals. The live evaluation
  harness explicitly provisions a reviewer grant to inspect its synthetic results.
- Failed reconciliation reads preserve an already RECONCILED provider result and
  append PAYOUT_RECONCILE_FAILED with a fixed reason code. Unresolved operations
  remain unknown. No create/retry is triggered by the read failure.

Regression coverage: test_assessment_hidden_from_seller_staff_and_external_in_all_views;
test_confirmed_success_survives_failed_read_with_audit. Existing foreign-binding
regression now verifies preservation of the last confirmed result too.

Low findings (attention flags, timer refresh/order in operator queue, mismatch
reviewer hint) remain open. AI schema validation stays with Claude. Real sandbox
callbacks and independent store/session review remain unverified.

Fresh validation, 2026-11-11: `pixi run test` passed 168 Python tests and existing
Node UI DOM checks in the restricted local Pixi environment. No real PayPal or
NVIDIA call was performed by this regression run. No UI/schema files were edited.

Low findings 3–6 implemented (2026-11-11): payout needs_attention, transactional
queue timer refresh/newest-first cursor, and reviewer-only OLD_ACCOUNT_MISMATCH.
See SECURITY_AUDIT_060_065.md for the requirement/evidence audit and explicit
remaining provider/reviewer verification. Please re-verify both medium fixes plus
the internal queue timer scope in destination_store.authorize/operator_cases.

AI-owner follow-up from the full regression: RulesBaselineTest.test_rules_output_is_schema_valid_and_has_no_authority
fails because investigator_rules copies raw synthetic text into claims, while the
new investigator_schema rejects markup/identifiers there. Please reconcile the
rules baseline with the tightened schema; no AI-owned files were changed by Codex.

## Replay follow-up — 2026-11-11

Current code already used assessment_current() instead of inspecting the seller's
hidden assessment. Strengthened idempotency further: service.message now marks a
replayed request explicitly, and the HTTP route never invokes inference for that
replay even if a subsequent case change made the last assessment stale. Regression:
test_replayed_old_message_never_invokes_model_after_case_changes. Sellers still
receive no assessment detail. A separate deliberate retry workflow would be needed
for inference after a failed/interrupted first attempt; replay does not do it.

Claude's user-reported re-verification closes medium findings 1–2 and schema
finding 8. Low findings 3–6 are implemented in the current backend and covered by
the 73-test focused run; their reviewer re-verification remains pending.

Latest low-note response: stripped message_replayed at the API boundary before
returning either a fresh or replayed message view. Regression asserts omission
while still proving no inference on replay. DECISIONS.md now explicitly documents
GET queue side effects, including cross-seller timer activation and page scope.
The existing regression test_queue_refreshes_foreign_seller_timers_and_orders_by_time
in tests/test_marketplace_payouts.py creates a later foreign-seller case, advances
expiry, checks it is first/EXPIRED, and follows the cursor to the original case.

Evidence route reviewed and confirmed for demo/sandbox prototype only. Added
explicit mode guards at API and service, server-owned evidence provenance and a
regression for CSRF, version, pending-state preservation and production denial.
No UI/AI schema changes; real OLD-account mismatch remains unrecorded.
