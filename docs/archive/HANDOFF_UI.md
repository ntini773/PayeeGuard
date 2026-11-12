# Backend handoff for Antigravity

`GET /api/v1/cases?limit=50&before=CASE_ID` is a tenant-scoped operator queue.
Only backend-provisioned browser marketplace reviewers may use it. IDs are masked
inside destination fields; case IDs remain usable API resource identifiers.

Example: `{"cases":[{"case_id":"chg_example","seller_id":"seller","tenant_id":"marketplace","state":"PENDING_REVIEW","version":3,"simulation":true,"destinations":{"active":{"masked_payer_id":"***-AAAA"},"proposed":{"masked_payer_id":"***-BBBB"}},"cooling_off":{"status":"NOT_STARTED","ends_at":null}}],"next_cursor":null,"correlation_id":"request-id"}`.

Pagination is newest creation time first, with case ID as a deterministic tie-breaker and an exclusive `before` case-ID cursor; follow `next_cursor` until null. A tenant queue does not grant mutation access
to other sellers: detail/review remain explicitly seller-bound.

Existing endpoints:
- POST `/api/v1/destination-change-requests`: reason_text, Idempotency-Key.
- GET `/api/v1/destination-change-requests/ID`: masked detail.
- GET `/api/v1/destination-change-requests/ID/summary`: claims/evidence/policy.
- GET `/api/v1/destination-change-requests/ID/events`: `{events:[...]}`.
- POST `/api/v1/destination-change-requests/ID/review`: decision, reason, expected_version.
- GET `/api/v1/marketplace-payouts`: `{earnings:[...]}`.
- POST `/api/v1/marketplace-payouts/ID/execute`: empty object only, operator and CSRF.

Login via `/api/login`; obtain CSRF from `/api/session`. Every mutation uses
X-CSRF-Token. A 403 means missing backend permission; 409 means a state/version or
idempotency conflict: reload rather than retrying an old approval. Errors look like
`{"error":{"code":"CASE_VERSION_CONFLICT"},"correlation_id":"request-id"}`.
`ai_assessment.stale=true` means its observed case version is old: show advisory
staleness and never infer approval. Assessment fields are nested under `.assessment`.

For Vite development proxy both `/api` and `/callback` to
`http://127.0.0.1:8765`, with `changeOrigin: true`. Forwarded requests must have the
backend Origin as well as Host; configure proxy request headers accordingly for
local development only. Keep browser cookies and CSRF; do not disable backend
origin validation. Prefer same-origin serving for the final browser demo.

Run `pixi run seed-destination-demo`. It prints a new temporary runtime directory,
six labelled simulated state fixtures and masked case IDs. Start it using:
`pixi run python -m rescue.app serve --mode demo --ai fixture --runtime-dir PRINTED_DIRECTORY`.
Credentials are stored privately in that directory's demo-accounts.json.

Six-state queue records are explicit snapshot fixtures, not proof that their
transitions or PayPal authentication ran. Use the existing single-case seed/service
tests for actual simulated lifecycle execution. Demo provider receipts and identity
are simulated; HTTP/session/database/gate logic are real. No PayPal calls occur in
this demo. See BACKEND_REPORT.md for timestamp conversion and other adapter details.

Review fix (2026-11-11): ai_assessment is null for sellers, ordinary staff and
external agents, including summary responses. Only browser reviewers receive the
risk signals and advisory detail. A failed payout refresh retains the last confirmed
provider result and emits PAYOUT_RECONCILE_FAILED; it never creates a replacement.

Low-review fixes: queue refreshes backend expiry/cooling timers and returns newest
creation time first. Follow the opaque case-ID cursor; do not sort IDs yourself.
Payout receipts include needs_attention; a reconciled FAILED/RETURNED/BLOCKED/DENIED
outcome requires manual review and must not trigger a new payout. Reviewers alone
receive OLD_ACCOUNT_MISMATCH in reviewer_findings; the recovery evidence/cooling
requirements remain unchanged.

message_replayed is internal and omitted from HTTP responses. Replayed messages never trigger
model inference, even if the latest assessment is stale. Assessment visibility is
still restricted to browser reviewers; no internal replay marker is exposed.

Evidence route (added 2026-11-11, Claude Code): `POST /api/v1/destination-change-requests/ID/evidence` with
`{kind: SELLER_ENTITLEMENT|ACCOUNT_RECOVERY, reference, reason, accepted: bool, expected_version}`. Browser marketplace
reviewers only. Sellers, staff and external agents are refused. The case must be PENDING_REVIEW. `accepted=false` keeps approval
blocked (POLICY_REVIEW_REQUIRED). Other new routes: `POST /api/v1/seller-guide`, `POST .../ai-review`, `GET .../ai-review/RUN_ID`.
The operator UI now records evidence, runs the AI review, and executes and reconciles marketplace payouts itself.
