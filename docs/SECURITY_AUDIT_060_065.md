# TASK-060–065 engineering security audit — 2026-11-11

Auditor: Codex, implementation self-audit with Claude's review as input. This does
not substitute for the user's sign-off or real provider/browser verification.
Scope: backend storage, sessions, reader, lifecycle/policy, gate and HTTP handlers.

| Task / requirement | Current evidence | Conclusion |
|---|---|---|
| 060 scoped real reader; fixed investigator scope | test_destination_reader: shared argumentless contract, foreign tenant/seller, missing payee, scope rebinding/logout | Implemented; synthetic integration tested |
| 061 correct case/version/model/time; advisory only | test_destination_assessment: append-only metadata, stale versions, unchanged approval/cooling, hostile output | Implemented; live 21-case reader report also confirms unchanged authority |
| 062 trusted roles, reject caller roles, audit failures | destination_store principal reloads session and backend grant; authorize rechecks binding inside transactions; test_destination_authorization/API | Implemented prototype local auth; not marketplace SSO |
| 063 configurable three-day default; B unusable while pending/cooling | destination_policy/evaluate; gate reads stored active payee; state and gate regressions | Implemented; provider calls simulated in tests |
| 063 compromise policy and expiry; simulation separation | recovery/policy/state tests, queue timer regression, gate simulation rejection | Implemented; real sandbox unverified |
| 064 new authentication never activates; wrong old account never autoapproves | callback and recovery tests; reviewer-only mismatch hint | Implemented |
| 064 replay/session/case/seller/purpose binding | nonce consumed before exchange; version comparison after exchange; OAuth replay/wrong-session/cross-scope/stale-exchange tests | Covered with synthetic providers; independent store review still requested |
| 064 duplicate/concurrent/restarted payout | durable intent before provider call; duplicate intent returns saved operation; gate concurrency and Application restart tests | Covered; no automatic replacement after uncertainty |
| 064 mandatory gate path | Application → MarketplacePayouts.execute → PayoutGate.execute; forced-denial regression prevents provider invocation | Application earnings path enforced; historical feasibility CLI explicitly outside scope |
| 065 request/status/summary/events, tenant/seller/CSRF | handler-level tests and user Postman 31 requests/40 assertions | Implemented; Postman predates latest review fixes |
| 065 no external approvals/activation; redacted errors | browser-review grant check, strict schemas, no activation endpoint, fixed public error codes | Covered by role/API tests |
| Reviewer finding 1: AI information disclosure | _view limits full assessment to browser reviewers; summaries use same view; regression covers seller/staff/external | Fixed; reviewer re-verification pending |
| Reviewer finding 2: failed read erases confirmed status | retain confirmed record, append fixed-code failure event, no dispatch | Fixed; reviewer re-verification pending |
| Reviewer findings 3–6 | attention flag, queue timer/order regressions, reviewer-only mismatch regression | Implemented in follow-up; user re-verification pending |

Transaction review: SQLite BEGIN IMMEDIATE serializes lifecycle and payout intent
writes. Optimistic versions guard stale case writes; payee activation and case update
share a transaction. The second payout transaction rechecks active destination and
controls while holding the write lock across provider dispatch. Crashes retain the
intent and prevent re-creation. This conservative prototype can block other writers
during slow provider calls; it is not a high-throughput architecture claim.

Session review: public APIs accept only the raw session cookie, never a Principal
or role object. The identity store verifies hashed session lookup/expiry; backend
grants select tenant, seller and channel. Transactional authorize revalidates those
values. The queue's internal tenant timer scope preserves and checks the original
grant seller; ordinary request mutations cannot select it. Tests cover revocation,
logout, foreign scope, callback session mismatch and concurrent review.

Residual/unverified: independent reviewer sign-off; real PayPal callback and payout
behavior; browser end-to-end UI; deployment TLS/persistence operation. In-process
rate limits assume the existing single-process deployment. No claim of protection
for payment paths outside the marketplace gate. AI schema tightening remains with
its owner. No live payment or credential disclosure was needed for this audit.

Validation checkpoint: full `pixi run test` executed 171 Python tests with one
failure in AI-owned RulesBaselineTest.test_rules_output_is_schema_valid_and_has_no_authority.
The tightened AI schema rejects markup/identifier content copied into rules claims.
That owner must sanitize or adjust the rules baseline; schema validation must not
be weakened to make the test pass. This is separate from the backend fixes.

Focused backend validation (2026-11-11, local Pixi): 73 destination, payout-gate
and marketplace-path tests passed. No real PayPal calls. git diff --check passed.
