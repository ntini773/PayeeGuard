# PayeeGuard task board and ownership contract

**Rule:** one task card at a time per owner unless the coordinator explicitly splits the work. Every coding task must name an actual coding tool, exact repository paths, tests, and report. The three tool names are not present in the consolidated source, so `Tool A/B/C` below are placeholders; replace them with the actual configured tools before dispatch. Do not assume a tool automatically reads `AGENTS.md`—verify its instruction-file discovery and provide the canonical rules.

## 0. Repository and tool inventory — must happen first

### TASK-000 — Establish safe baseline and exact file map

- **Goal:** Identify the current application structure, available coding tools, instruction-file discovery, test commands and working PayPal/NVIDIA configuration without changing application behavior.
- **Owner tool:** Coordinator / one designated inspection tool (assign actual tool before execution).
- **Read first:** `AGENTS.md`, `docs/POLICY.md`, `docs/STATE_MACHINE.md`, `docs/API_CONTRACT.md`, `docs/PAYPAL.md`, this file.
- **May edit:** `docs/TASKS.md`, `docs/COMMANDS.md` only if/when that file is created; may add a repository-path inventory section to this task card. No application source edits in this task.
- **Must not touch:** `.runtime/**`, credential files, database files, audit records, PayPal sandbox state, existing payout routes, policy implementation, UI implementation.
- **Inputs to inspect:** working tree and current branch; top-level file tree; `pixi.toml`; existing tests; current route/service/model boundaries; environment variable names without values; active PayPal client ID suffix only; tool-specific instruction behavior.
- **Done when:** working tree and branch are recorded; baseline test command is verified from project config and run if safe; historical versus fresh results are separated; actual code paths for backend, frontend, agent, tests and PayPal adapter are listed; each coding tool's instruction-file mechanism is verified; no secret or runtime financial data is exposed.
- **Report:** changed files; baseline command/date/result; exact source paths by responsibility; three actual tool names and instruction filenames; PayPal app client-ID suffix only; unresolved items; confirmation that `.runtime` and credentials were preserved.

## 1. Specification and backend foundation

### TASK-010 — Implement destination-change case model and state transitions

- **Goal:** Add a backend-owned case lifecycle matching `docs/STATE_MACHINE.md`, without conflating it with PayPal payout-item status or the legacy payout-correction workflow.
- **Owner tool:** Tool A — backend (replace placeholder with actual tool).
- **Read first:** `AGENTS.md`, `docs/POLICY.md`, `docs/STATE_MACHINE.md`, `docs/API_CONTRACT.md`, TASK-000 repository path inventory.
- **May edit:** Exact case-model, migration, case-service and backend-test paths recorded by TASK-000; no path may be added without updating this card before editing.
- **Must not touch:** UI files, AI prompts/tools, PayPal credentials/config, legacy correction workflow except through an approved compatibility change, `.runtime/**` data.
- **Done when:** transitions are centralized; invalid transitions are rejected; tenant/seller/case scoping and case-version checks exist; audit events are emitted; tests cover every allowed/forbidden transition and concurrent/stale update behavior.
- **Report:** changed paths; migration behavior and data-preservation notes; test command/results; uncovered transitions; compatibility risks.

### TASK-020 — Implement PayPal new/old account callback evidence

- **Goal:** Capture proposed B and old-account A authentication through separate, server-validated, one-use, case-bound callback flows.
- **Owner tool:** Tool A — backend (replace placeholder).
- **Read first:** `AGENTS.md`, `docs/PAYPAL.md`, `docs/STATE_MACHINE.md`, `docs/POLICY.md`, TASK-000 inventory.
- **May edit:** Exact PayPal OAuth/callback service, auth-state storage, evidence model and backend-test paths recorded by TASK-000.
- **Must not touch:** AI tool definitions/prompts, seller/operator UI, payout create/cancel code unless a separately approved task allows it, secrets and `.runtime/**` data.
- **Done when:** callback state is one-use, expires and binds purpose/tenant/seller/case/session; B callback cannot satisfy A check; old payer ID must exactly equal stored A; callback cannot activate B; replay, mix-up and cross-case tests pass.
- **Report:** changed paths; sandbox app suffix; scenarios tested with synthetic accounts; fresh test output; callback limitations and real-versus-simulated evidence.

### TASK-030 — Implement deterministic policy and payout gate

- **Goal:** Enforce `docs/POLICY.md` as deterministic backend authorization and ensure only the stored active approved payer ID is used by the controlled payout path.
- **Owner tool:** Tool A — backend (replace placeholder).
- **Read first:** `AGENTS.md`, `docs/POLICY.md`, `docs/STATE_MACHINE.md`, `docs/PAYPAL.md`, TASK-000 inventory.
- **May edit:** Exact policy, payout-gate, payee-destination, payout-adapter integration and backend-test paths recorded by TASK-000.
- **Must not touch:** AI prompts/tool permissions, UI decision logic, PayPal credentials, `.runtime/**` or any unrelated legacy flow.
- **Done when:** different B creates/retains a hold; chat/request/AI-supplied payer ID is ignored; pending/rejected/expired/cooling-off blocks B; approval needs authorized role/reason/version; cooldown and activation are backend-controlled; idempotency and provider re-fetch behavior are tested.
- **Report:** changed paths; policy rows implemented; payout-path coverage and bypasses; tests and failure injection results; what remains outside the gate.

### TASK-040 — Implement lost-old-account recovery path

- **Goal:** Route old-account-unavailable cases through marketplace-controlled recovery evidence and review, never automatic activation.
- **Owner tool:** Tool A — backend (replace placeholder).
- **Read first:** `AGENTS.md`, `docs/POLICY.md`, `docs/STATE_MACHINE.md`, `docs/API_CONTRACT.md`, TASK-000 inventory.
- **May edit:** Exact recovery-evidence, review-policy, notification-event/flag and backend-test paths recorded by TASK-000.
- **Must not touch:** AI authorization boundary, PayPal callback trust logic, UI outside approved integration, any notification provider credentials.
- **Done when:** missing old-account auth retains hold; marketplace evidence and operator approval are required; old-contact notification is clearly represented as a flag unless delivery is genuinely integrated; longer cooldown and payout cap/pause are configurable; tests prove no auto-approval.
- **Report:** changed paths; evidence types actually supported; simulated versus real notifications; tests; residual recovery risk.

## 2. AI advisory agent

### TASK-050 — Restrict and evaluate NVIDIA investigation agent

- **Goal:** Build a case-scoped AI investigator that interprets seller text and produces advisory summaries without trusted verification or authorization powers.
- **Owner tool:** Tool B — AI/agent (replace placeholder with actual tool).
- **Read first:** `AGENTS.md`, `docs/POLICY.md`, `docs/STATE_MACHINE.md`, `docs/API_CONTRACT.md`; create/read `docs/AGENT.md`, `docs/RED_TEAM.md`, and `docs/TESTS.md` before implementation.
- **May edit:** Exact agent prompt, schema, orchestration, read-only tool definitions and AI evaluation paths recorded by TASK-000; `docs/AGENT.md` and evaluation docs.
- **Must not touch:** callback handlers, trusted evidence store, policy implementation, case transition implementation, payout execution, approval/release methods, secrets.
- **Done when:** agent tools are read-only and tenant/case scoped; seller claims are labelled claims; schema is validated; model timeout/invalid JSON keeps the hold; prompt injection cannot gain authority; tests prove AI output cannot make a baseline restriction less restrictive; live NVIDIA evaluation is recorded.
- **Report:** changed paths; model/provider used (no credentials); test/evaluation dataset and measured results; unavailable scenarios; confirmation no privileged tool exists.

## 3. API and UI

### TASK-060 — Implement HTTPS case API against the contract

- **Goal:** Expose authenticated, scoped request/status/summary/message/event operations, with operator review separated from external-agent access.
- **Owner tool:** Tool A — backend (replace placeholder).
- **Read first:** `AGENTS.md`, `docs/API_CONTRACT.md`, `docs/POLICY.md`, `docs/STATE_MACHINE.md`, TASK-000 inventory.
- **May edit:** Exact router, request/response schema, auth middleware and API test paths recorded by TASK-000.
- **Must not touch:** UI components, agent tool authority, payout implementation unless explicitly required by an approved contract task.
- **Done when:** contract examples are covered by handler tests; tenant/seller scope, idempotency, rate limiting, validation and stable error codes pass; callers cannot submit trusted evidence or approve through request endpoints; operator review is role/version guarded.
- **Report:** changed paths; endpoints shipped; contract-test results; scope/security tests; any contract deviations.

### TASK-070 — Build seller and operator UI

- **Goal:** Render the seller request journey and operator review workspace from backend state, without duplicating security policy in the browser.
- **Owner tool:** Tool C — UI (replace placeholder with actual tool).
- **Read first:** `AGENTS.md`, `docs/API_CONTRACT.md`, `docs/STATE_MACHINE.md`, `docs/POLICY.md`, TASK-000 inventory; create/read `docs/architecture.md` before architecture UI.
- **May edit:** Exact frontend route/component/style/test paths recorded by TASK-000; no backend source edits.
- **Must not touch:** Policy, payout gate, callback handlers, evidence store, agent permissions, PayPal credentials. UI must never write case state directly.
- **Done when:** seller can create a request, connect the proposed account through backend flow, explain change and view status; operator can inspect claims versus verified evidence and make a reasoned, versioned decision; status labels distinguish real, simulated, AI advisory and marketplace decision; no bulk approval; responsive checks pass.
- **Report:** changed paths; screens/flows tested; viewport/browser details; mock versus live dependencies; accessibility and remaining UX issues.

## 4. Validation and demo

### TASK-080 — Policy, security, AI red-team and sandbox regression

- **Goal:** Map every policy row to tests and execute deterministic, red-team and real PayPal sandbox scenarios without relying on payout cancellation.
- **Owner tool:** Tool A for backend/security tests; Tool B for AI evaluation; coordinator owns final reconciliation.
- **Read first:** `AGENTS.md`, `docs/POLICY.md`, `docs/STATE_MACHINE.md`, `docs/PAYPAL.md`, `docs/TESTS.md`, `docs/RED_TEAM.md`, `docs/COMMANDS.md`.
- **May edit:** Exact test and fixture paths recorded by TASK-000; test docs and synthetic fixtures only.
- **Must not touch:** Production/live credentials, `.runtime` financial data, payout gate semantics, secrets, or provider account state outside approved sandbox probes.
- **Done when:** all mandatory policy and AI boundary tests pass or failures are explicitly listed; sandbox demonstrates separate A/B callbacks, hold, activation under demo policy and payout to B; pending/rejected payout attempt is blocked; cancellation is not needed for core flow.
- **Report:** every command/date/environment/result; case coverage; sandbox item states; actual versus simulated steps; failure details/debug IDs; unresolved risks.

### TASK-090 — Demo and release truth check

- **Goal:** Produce a demo and README that match the tested implementation and distinguish working provider calls from simulations.
- **Owner tool:** Coordinator plus Tool C for UI/video asset edits (replace placeholders).
- **Read first:** `AGENTS.md`, `docs/DEMO.md`, `docs/COMMANDS.md`, `docs/architecture.md`, `docs/PAYPAL.md`, `docs/TESTS.md`, `README.md`.
- **May edit:** `docs/DEMO.md`, `README.md`, approved demo assets and non-security UI copy only.
- **Must not touch:** policy, callback validation, payout gate, evidence records, credentials, or historical audit data.
- **Done when:** video shows one authorized change and one blocked change; each step is labelled real/simulated; PayPal non-affiliation disclaimer and market-hypothesis caveat are present; test claims are fresh and reproducible.
- **Report:** video/demo path; exact scenario labels; commands and fresh outputs; unsupported claims removed; final known limitations.

## 5. Required task report format

Every completed task returns:

1. **Changed:** exact file paths and concise description.
2. **Tests:** exact command, date, environment and pass/fail result.
3. **Security boundary:** what the change can and cannot authorize.
4. **Real vs simulated:** any provider, model, data, notification or timer simulation.
5. **Uncertain / blocked:** unresolved behavior, failed probes and external dependencies.
6. **Next handoff:** exact next task ID and files it should read.

## 6. Work coordination rules

- Replace Tool A/B/C with the actual three tool names before dispatch; verify each tool's instruction-file discovery and provide the canonical `AGENTS.md` rules.
- No code-editing task begins until TASK-000 records exact repository paths and a fresh baseline.
- One owner edits a given source path at a time. If two tasks need the same path, serialize them or create a coordinator-approved patch/handoff.
- If implementation disagrees with this spec, stop and propose a documented change; do not silently redefine policy in code.
- Any policy/state/API contract change must be made in the spec first, reviewed, then implemented and tested.
- Do not report old handoff test counts (62 Python tests, UI checks, 2 bootstrap tests, 24 Postman requests) as fresh results. They are historical only.

## TASK-000 execution inventory — 2026-11-10

Assigned inspection/backend owner: **Codex** (this session). No parallel owners
are dispatched. Other configured tools: **Claude Code** (`CLAUDE.md` explicitly
points to `AGENTS.md`) and **OpenCode** (`.opencode/opencode.json` exists; its
configuration has plugin entries, no custom instructions; native project rules
use `AGENTS.md`, per https://opencode.ai/docs/rules/). Codex has read the repository
`AGENTS.md` directly in this session. No policy copies are placed in tool configs.

Actual specification files were supplied under `docs/docs/`, not `docs/`.
References to POLICY, STATE_MACHINE, API_CONTRACT, PAYPAL and TASKS resolve to
that directory for this assignment. Files are not moved or duplicated.

Working branch: `main`. At inspection, user additions were untracked:
`AGENTS.md`, `CLAUDE.md`, `docs/archive/README_FIRST.md`, `docs/docs/`, `.opencode/`.
These are preserved. Fresh baseline on 2026-11-10: `pixi run test` passed 64
Python tests and UI DOM checks; `pixi lock --check` passed. No network/provider
probe was run. Active client-ID suffix only: `THlUjs`. Credentials were neither
printed nor copied. `.runtime` records and existing audit were not changed.

Existing path inventory:

| Responsibility | Actual paths |
|---|---|
| HTTP/session/OAuth integration | `rescue/app.py`, `rescue/store.py`, `rescue/login.py` |
| Legacy correction workflow | `rescue/workflow.py` (preserve) |
| PayPal sandbox adapter | `rescue/paypal.py` |
| Developer feasibility payout path | `rescue/cli.py`, `rescue/experiments.py` (outside new gate) |
| AI | `rescue/agent.py`, `rescue/ai.py`, `rescue/evaluate.py` (other ownership) |
| UI | `static/index.html`, `static/app.js`, `static/style.css` (other ownership) |
| Tests | `tests/test_app.py`, `tests/test_workflow.py`, `tests/test_agent.py`, `tests/test_auth_boundaries.py`, `tests/test_experiments.py`, `tests/test_http_diagnostic.py`, `tests/test_deploy.py`, `tests/test_ui.cjs` |
| Commands/deploy | `pixi.toml`, `deploy/start.py`, `render.yaml` |

### Backend assignment and exact edit allowlists

User assigned deterministic backend, callback validation, state machine and payout
gate to Codex. Codex owns TASK-010, 020, 030, 040 and 060 sequentially, plus backend
verification/reporting; TASK-050/070 and live external-system validation are not
silently delegated or claimed. No UI or AI edits are authorized by these cards.
New paths below are intentional modules to be created, not claimed existing paths.

- TASK-010: `rescue/destination_store.py`, `rescue/destination_service.py`,
  `rescue/destination_errors.py`, `tests/test_destination_state.py`.
- TASK-020: `rescue/destination_service.py`, `rescue/destination_store.py`,
  `tests/test_destination_oauth.py`. Reuse existing PayPal identity adapter.
- TASK-030: `rescue/destination_policy.py`, `rescue/payout_gate.py`,
  `rescue/destination_store.py`, `rescue/destination_service.py`,
  `tests/test_destination_policy.py`, `tests/test_payout_gate.py`.
- TASK-040: `rescue/destination_service.py`, `rescue/destination_policy.py`,
  `tests/test_destination_recovery.py`.
- TASK-060: `rescue/destination_api.py`, `rescue/destination_admin.py`,
  `rescue/app.py`, `tests/test_destination_api.py`. Compatibility approval is
  limited to routing `/api/v1/` and dedicated callback paths and wiring the new
  service; preserve legacy routes, workflow and AI behavior.
- Backend test support: `tests/destination_fixtures.py`.
- Assignment documentation/report paths: `docs/docs/TASKS.md`, `docs/COMMANDS.md`,
  `docs/DECISIONS.md`, `docs/BACKEND_REPORT.md`.

Additive `pg_` tables will keep destination-change cases separate from legacy
cases/payees. Existing runtime fixtures will not be auto-converted into production
entitlements; tenant/user/payee bindings require explicit backend provisioning.
The pending T0 no-change state-table gap is being clarified with the user before
implementing that transition. Unconfigured policy values will retain a hold.

### TASK-050 path allowlist (Claude Code, 2026-11-10)

Tool B role is filled by **Claude Code**. New AI-owned paths (legacy `rescue/agent.py`,
`rescue/ai.py`, `rescue/evaluate.py` left unchanged): `rescue/investigator.py`,
`rescue/investigator_schema.py`, `rescue/investigator_eval.py`, `tests/test_investigator.py`,
`docs/AGENT.md`, `docs/RED_TEAM.md`, `docs/TESTS.md`; plus the `evaluate-investigator`
task in `pixi.toml` and two lines in `docs/COMMANDS.md`.

TASK-051 to 054 additional AI-owned paths: `rescue/investigator_dataset.py`, `rescue/investigator_rules.py`, `tests/investigator_reader_contract.py`, `docs/EVALUATION.md`, `docs/eval/`.

## Revised backend assignment — attachment TASK-060–065 (2026-11-10)

The user's attachment supersedes the earlier numbering for the current assignment.
Codex owns the following sequential backend tasks, without editing investigator,
schema or UI ownership. Existing legacy correction behavior and runtime records
remain intact. The missing destination foundation is necessary to integrate a real
CaseReader; the existing TASK-010/020/030/040 allowlists remain applicable.

- TASK-060 (real reader): `rescue/destination_reader.py`,
  `rescue/destination_store.py`, `rescue/destination_service.py`,
  `rescue/destination_errors.py`, `tests/test_destination_reader.py`.
- TASK-061 (assessment persistence): the same backend store/service plus
  `tests/test_destination_assessment.py`.
- TASK-062 (trusted marketplace grants): backend store/service,
  `rescue/destination_admin.py`, `tests/test_destination_authorization.py`.
- TASK-063 (cooling and destination enforcement): backend service/store,
  `rescue/destination_policy.py`, `rescue/payout_gate.py`,
  `tests/test_destination_policy.py`, `tests/test_destination_state.py`.
- TASK-064 (regression): `tests/test_destination_oauth.py`,
  `tests/test_destination_recovery.py`, `tests/test_payout_gate.py`,
  `tests/destination_fixtures.py` and the above backend test paths.
- TASK-065 (HTTPS): `rescue/destination_api.py`, `rescue/app.py`,
  `tests/test_destination_api.py`, `integrations/postman/destination.postman_collection.json`.
- Reports/configuration decisions: `docs/DECISIONS.md`, `docs/BACKEND_REPORT.md`,
  `docs/COMMANDS.md`, this task board.

The fresh baseline immediately before this assignment is 95 Python tests and UI
DOM checks passing (`pixi run test`, 2026-11-10). This includes the configuration
isolation change. No financial calls or runtime migrations have been executed.
- TASK-065 isolated Postman runner: `integrations/postman/run_destination.py`.
  It creates a disposable database and prototype grants, invokes only the local
  fixture app, and never uses the project's runtime or provider credentials.

## Completion-gap assignment — 2026-11-10 attachment

Codex: wire the controlled marketplace earnings path through `PayoutGate`; add
scoped case listing and a disposable demo seed; complete backend/AI cross-review,
Postman verification, local setup documentation and LICENSE. Extra backend paths:
`rescue/marketplace_payouts.py`, `rescue/destination_demo.py`,
`tests/test_marketplace_payouts.py`, `tests/test_destination_demo.py`.
Existing backend application/API/store/service/test and report allowlists apply.
The new API extensions are documented in `docs/docs/API_CONTRACT.md` before edits.
`docs/LOCAL_DEMO.md`, `docs/archive/CROSS_REVIEW.md`, `LICENSE` are assigned deliverables.
UI TASK-073 and the redesign retain Antigravity ownership; Codex supplies working
backend contracts and fixtures, and reports the browser integration gap explicitly.
No live payout is executed merely to test wiring. Real sandbox identity callbacks
require the user's interactive browser session; synthetic callbacks are labelled.
- Backend-reader evaluation adapter: `rescue/backend_evaluation.py`,
  `tests/test_backend_evaluation.py`, `docs/backend-evaluation.json`.
  Reuses the AI owner's dataset/schema/scoring without modifying their files.
- Local NVIDIA configuration repair: `rescue/configure_ai.py`,
  `tests/test_configure_ai.py`, `setup.md`. The live backend-reader run found no
  project-local key after configuration isolation; no sibling secrets are copied.

### Completion-gap checkpoint

Implemented: application earnings → payout gate integration; scoped list API;
disposable seed; MIT license; backend handoff/configuration/local fallback docs;
Codex cross-review of the AI boundary. Verified: 162-test full Python run and
existing UI checks, 2 private-configuration tests, user Postman result of 31
requests/40 assertions with zero failures. The offline real-reader evaluation
covered 21 cases without authorization changes.

Still open, not claimed complete: successful live NVIDIA evaluation through the
real reader (first run had no configured key; key is now configured); interactive
new/old PayPal sandbox callbacks; Claude Code's independent backend review;
Antigravity UI integration/redesign and TASK-073 browser journey. UI ownership
clarification and live-result requests are pending with the user.

Live-reader checkpoint resolved: user NVIDIA run at 2026-11-10 18:29:46 UTC
returned 21/21 available assessments and unchanged authority. Archived artifact:
`docs/backend-live-evaluation.json`. Remaining external gates: interactive sandbox
callbacks, Claude backend cross-review, UI ownership/integration and browser demo.

Sandbox preparation assignment (2026-11-11): user explicitly authorizes backend
SPA serving, seed/summary fixes, earning CLI, tests/test_sandbox_preparation.py,
and docs/SANDBOX_VERIFICATION.md. ui/ remains read-only. Real PayPal calls require
separate user go, sandbox only, USD 0.01 per payout.
