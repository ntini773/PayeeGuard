# Backend handoff — 2026-11-10

The new destination backend is implemented and the marketplace earning path is
wired through its payout gate. The whole product/demo is **not yet complete**:
real sandbox callbacks, the new UI integration
and the other owner's backend cross-review remain separate gates.

## Implemented paths

- `rescue/destination_store.py`: additive `pg_` tables, backend grants, scoped case
  reads, session rechecks, append-only audits/assessments and earnings persistence.
- `destination_service.py`, `destination_policy.py`: centralized callback,
  evidence, review, expiry, cooling and atomic activation; three-day normal demo
  default, seven-day recovery, fresh role/version/policy checks.
- `destination_reader.py`: fixed-scope argumentless investigator reads.
- `marketplace_payouts.py`, `payout_gate.py`: stored earnings → gate → provider,
  durable operation IDs, active stored payer ID, fail-closed reconciliation.
- `destination_api.py`, `app.py`: authenticated v1 routes with CSRF, scoped queue,
  rate limits, redacted errors and actual application payout wiring.
- `destination_admin.py`: explicit local provisioning and trusted evidence entry.
- `destination_demo.py`: new-directory-only seed and isolated simulated providers.
- `backend_evaluation.py`: existing AI evaluation dataset through the real reader
  and advisory persistence. `configure_ai.py`: private project-local key setup.
- `integrations/postman/destination.postman_collection.json` and its disposable
  `run_destination.py` runner: actual HTTP application checks.
- `LICENSE`: MIT, copyright Payout Rescue contributors.

No investigator/schema or frontend source was edited for this assignment. Legacy
correction behavior and existing runtime/credential/audit records were preserved.
All new demo/evaluation runs used temporary storage. Nothing was committed.

## Requirement evidence

| Requirement | Evidence / status |
|---|---|
| TASK-060 real scoped reader | `tests/test_destination_reader.py`, including shared reader contract, foreign seller/tenant, missing payee, revocation |
| TASK-061 advisory persistence | `tests/test_destination_assessment.py`: correct scope, metadata, stale output, append-only storage, unchanged approval/version/cooling |
| TASK-062 trusted roles | `tests/test_destination_authorization.py`; `test_destination_api.py`; local prototype grants explicitly labelled |
| TASK-063 cooling and destination restriction | `test_destination_state.py`, `test_destination_policy.py`, `test_destination_recovery.py`, `test_payout_gate.py` |
| TASK-064 enforced payout path | `test_marketplace_payouts.py` exercises HTTP → stored earning → gate; `test_destination_demo.py` uses actual Application wiring and restart |
| TASK-065 request/status/summary/events | `test_destination_api.py`, real Postman handler run, scope/CSRF/error/idempotency checks |
| Queue and seed | `test_marketplace_payouts.py::test_list_is_scoped_and_runs_backend_expiry`; `test_destination_demo.py` |
| Security review | `archive/CROSS_REVIEW.md`: Codex AI cross-review and backend self-review complete; independent Claude Code backend review not received |
| TASK-073 browser journey | Pending frontend owner; current React client remains mock-driven |
| TASK-074 optional deployment | Local fallback documented in `LOCAL_DEMO.md`; no new Render deployment claimed |
| Real PayPal callbacks | Pending interactive verification; synthetic callback tests do not prove provider integration |

## Verification evidence

- **Fresh local run, 2026-11-10:** `pixi run test` passed **162 Python tests** and
  the existing Node DOM checks (restricted Linux/Pixi environment). This includes
  the application gate/queue/seed and evidence-revision fix. No real provider calls.
- After that run, `pixi run python -m unittest discover -s tests -p
  'test_configure_ai.py' -v` passed **2 additional configuration tests**. Do not
  report these as a fresh 164-test aggregate run.
- `pixi lock --check`: passed. `git diff --check`: passed.
- **User-run real HTTP Postman result:** 31 requests, 40 assertions, zero failures,
  799 ms on 2026-11-10. Command: `pixi run python
  integrations/postman/run_destination.py`. Synthetic providers, temporary DB;
  the agent environment independently returned EPERM on socket creation.
- `pixi run python -m rescue.backend_evaluation --output
  docs/backend-evaluation.json`: 21 offline rules-backed cases, zero unavailable,
  authority unchanged. Quality: 20 category matches, 17 minimum recommendations,
  four cases missing required signals, one false-positive signal. This is **not**
  live NVIDIA performance.
- **Successful user live reader run, 2026-11-10 18:29:46 UTC** (23:59:46 IST):
  21 cases, zero unavailable, 15 category matches, all 21 minimum recommendations
  met, four cases missing required risk signals, zero false-positive signals and
  zero unsupported claims under the dataset's heuristic. Every row confirms
  authority unchanged and persisted advisory-only. Zero PayPal calls. Full report:
  `backend-live-evaluation.json`. This is one live run on author-labelled synthetic
  cases, not a general accuracy claim or proof of sandbox callbacks.
- User also reported `pixi run diagnose-ai`: inference and JSON validation PASS.
  The earlier 21-unavailable run was due to a missing project-local key; the
  hidden configuration helper resolved that setup issue without changing PayPal.

## UI integration contract / handoff to Antigravity

Do not merely change `USE_MOCK_DATA` to false. The current client/types require
an adapter and real mutation wiring:

- `GET /api/v1/destination-change-requests` returns `{cases, correlation_id}`;
  unwrap `.cases`. Queue is scoped to one explicitly provisioned seller per user.
  No implicit tenant-wide operator access exists. Pagination: `limit`, `before`.
- Detail is a masked case object. Timestamps currently use Unix seconds, not ISO
  strings; convert with `new Date(seconds * 1000)`. Null proposed IDs are normal.
- Advisory persistence is under `ai_assessment.assessment`; wrapper metadata
  includes `stale`, `assessed_at`, `case_version`, `model`, `prompt_version`, and
  `effective_recommendation`. UNAVAILABLE does not contain all optional AI arrays;
  default those arrays safely. Do not render advisory values as trusted policy.
- `policy_decision` is a string. Authorized operator `/summary` includes the full
  deterministic `policy_findings`; it separates seller claims and trusted evidence.
  Review decision is `marketplace_review.decision` (no mock-only `status` field).
- Cooling states are `NOT_STARTED`, `WAITING`, `COMPLETE`, `INVALIDATED`. `ACTIVE`
  is also a valid completed no-change case (same authenticated destination as A).
- `/events` returns `{events}`. Each event has `seq`, Unix `at`, `event`, and
  role-redacted `details`; operators also get `actor`. Do not assume embedded
  mock `audit_trail`. `simulation` and `DEMO_SIMULATION` must remain visible.
- Login/session uses `/api/login` and `/api/session`; use the session cookie and
  `X-CSRF-Token` for mutations. Do not accept a browser-selected trusted role.
- POST `/review` body: `{decision, reason, expected_version}`. Re-fetch after a
  409; do not reuse a stale approval. The backend independently checks permission.
- POST `/messages` requires `Idempotency-Key`; claims cannot set evidence.
- Backend earnings are listed at `/api/v1/marketplace-payouts`. Operator execution
  accepts **only `{}`** at `/{earning_id}/execute`. Amount/currency/destination
  are stored backend values. No external-agent payout action is permitted.
- During pending/cooling/rejection, B is unusable. Safe A may still receive stored
  earnings; compromise policy can pause A too. Do not claim all payouts are frozen.
- Configure a same-origin deployment or a Vite proxy that preserves the backend
  Host/Origin/CSRF boundary. Do not weaken backend origin checks to bypass a UI
  development-server integration issue. The Python server currently serves the
  legacy static console, not the new React bundle.

The seed, source-of-truth endpoints, and test data are ready for TASK-073. Browser
verification and redesign remain under UI ownership per AGENTS.md and archive/PLAN.md.
