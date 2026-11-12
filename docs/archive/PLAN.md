> Sandbox preparation (2026-11-11): earning CLI, seed metadata/policy fixes, defensive summaries and built-UI backend serving implemented. Runbook: docs/SANDBOX_VERIFICATION.md. 177 Python tests + Node checks passed; final 5-test focused check passed. No real provider calls. Waiting for private sandbox inputs and explicit GO; Claude Code owns browser verification. ui/ unchanged.

> Backend follow-up (2026-11-11): low findings 3–6 implemented; 73 focused backend tests pass. TASK-060–065 self-audit: docs/SECURITY_AUDIT_060_065.md. Full suite has one AI rules/schema compatibility failure; reviewer sign-off and real sandbox callbacks remain open.

> Review update (2026-11-11): medium findings 1–2 fixed; 168 Python tests and UI DOM checks pass. Low findings remain open; Claude owns schema tightening.

> Backend status (2026-11-11): application payouts use PayoutGate.execute;
> operator /api/v1/cases, pagination, six-state temp seed task and handoff/setup
> docs implemented. Backend tests run separately below/in reports. Pending:
> reviewer sign-off, real sandbox callbacks, frontend integration/browser demo.
> ui/ is unchanged. Six-state queue snapshots are explicitly simulated fixtures.

This is the version I would freeze for submission. It keeps PayPal central, gives NVIDIA a genuine AI role, uses all three coding agents, and avoids claiming sponsor integrations or security controls that have not been demonstrated.

**Product name: PayeeGuard.**  
**Core proposition: Authentication is not authorization to redirect someone else's earnings.**

# 1. Final pitch

# PayeeGuard
### Protecting marketplace seller payouts from unauthorized destination changes

## One-line pitch

**PayeeGuard stops a successful login from automatically becoming permission to redirect a seller's earnings.**

## The problem

Marketplaces pay sellers through PayPal. But what happens when someone gains access to a seller's marketplace account and changes the PayPal account receiving their future earnings?

The attacker may not need to compromise PayPal. They may authenticate their own PayPal account and attempt to redirect someone else's earnings.

Some platforms provide relatively simple payout-detail change workflows, while others introduce security holds and restrict who can modify payment information.

PayPal's US Payouts Agreement places responsibility for the accuracy of payout instructions on the sender and permits PayPal to rely on the recipient identifier supplied.

This creates a marketplace-side authorization problem:

**Authenticating a new PayPal account does not establish that it is authorized to receive another seller's earnings.**

## Our solution

PayeeGuard is an authorization and payout-control layer for marketplaces using PayPal Payouts.

It turns a payout destination change into an explicit, reviewable process.

1. **Bind:** The seller connects their existing PayPal account. PayeeGuard stores its validated payer ID.
2. **Detect:** A different proposed payer ID creates a destination-change case.
3. **Hold:** The proposed destination cannot receive payouts while the change is pending.
4. **Verify:** The seller authenticates the proposed PayPal account and, where possible, the existing account. The backend validates the authentication callbacks.
5. **Authorize:** Marketplace permissions and available evidence are checked against deterministic policy. Lost-account requests, third-party destinations and suspicious circumstances can require human review.
6. **Protect:** Approved changes enter a configurable cooling-off period before activation.
7. **Pay:** The payout gate uses only the stored, approved active payer ID. It never pays to an account supplied in a free-text message.
8. **Audit:** Evidence, decisions, actors and state transitions are recorded.

## Where AI fits

PayeeGuard uses an NVIDIA-powered AI investigation assistant.

It interprets seller explanations, identifies potential pressure or manipulation, recognizes third-party destination requests, asks contextual follow-up questions and prepares summaries for human reviewers.

AI is deliberately restricted:

- It cannot authenticate PayPal accounts.
- It cannot approve destination changes.
- It cannot remove payout restrictions.
- It cannot activate destinations.
- It cannot create or cancel payouts.

**AI investigates. Deterministic backend policy authorizes. The payout gate enforces. PayPal moves the money.**

## Technology and tool contributions

| Technology | Contribution |
|---|---|
| PayPal | Authentication and payout infrastructure at the centre of the application. |
| NVIDIA | Model powering the AI investigation assistant. |
| Postman | API collection and regression testing, if completed. |
| AG Grid | Operator case-management interface, if completed. |
| Render | Optional hosting, if deployed. |
| APIMatic | Include only if an actual eligible integration is completed. |

NVIDIA is the AI technology used, not a hackathon sponsor. Postman, AG Grid, Render and APIMatic should only be described as integrations if their deliverables are actually present.

## Demonstration

| Capability | Status to report |
|---|---|
| PayPal Login returns a payer ID | Real |
| PayPal Payout to a payer ID reaches SUCCESS | Real — sandbox item `4BV5LMRQQW65J` |
| Changed payer ID creates a pending case and payout restriction | Real, subject to final end-to-end verification |
| Old and new PayPal account authentication | Real only if the two-account sandbox test passes |
| Operator review and audit trail | Real |
| Marketplace role authorization | Claim only after its tests pass |
| Cooling-off enforcement | Simulated if using the demo override |
| One-time code and old-contact notification | Simulated |
| Postman regression collection | Claim only after it runs against actual HTTP handlers |
| AG Grid operator interface | Claim only after it is connected to real case data |
| Render deployment | Claim only if the deployed application passes sandbox smoke tests |
| Unclaimed payout cancellation | Not demonstrated as working; sandbox cancellation returned HTTP 500 |

## Limitations

- PayeeGuard does not globally identify or block fraudulent PayPal accounts.
- It does not access PayPal's internal fraud intelligence.
- It does not guarantee that a destination change is legitimate.
- Authenticating two PayPal accounts establishes control of those accounts, not necessarily authorization to redirect marketplace earnings.
- An attacker controlling the marketplace account, required verification channels and approval process may still succeed.
- We have not established how frequently fraudulent destination changes occur among PayPal Payouts users.
- We have not established whether existing PayPal Payouts customers already have equivalent controls.
- Market demand and willingness to pay remain hypotheses to validate through marketplace operator interviews.

**Built on PayPal Payouts. Not affiliated with or endorsed by PayPal.**

## 30-second spoken pitch

"Marketplaces pay sellers through PayPal. But someone who gains access to a seller's marketplace account may be able to redirect future earnings to their own PayPal account without compromising PayPal itself. PayeeGuard adds an authorization layer in front of the payout. A changed destination is held, account evidence is checked, risky cases go to human review, and only an approved destination can receive future payouts. Our NVIDIA-powered AI investigates seller explanations, but it cannot approve or move money. We protect the authorization process between a marketplace seller and their payout destination."

# 2. Final task assignments

The ownership model is:

- **Codex:** Backend and financial authorization.
- **Claude Code:** NVIDIA investigator and AI evaluation.
- **Antigravity:** Operator UI, Postman, browser testing and optional deployment.
- **You:** Integration owner, final test execution and merge approval.

Do not assign GPT as the independent security reviewer. Use cross-review between the coding agents, and personally verify the critical tests.

# PayeeGuard — Final Agent Task Board

## Shared instructions

All agents must read:

- `AGENTS.md`
- `docs/POLICY.md`
- `docs/STATE_MACHINE.md`
- `docs/API_CONTRACT.md`
- `docs/PAYPAL.md`
- `docs/TASKS.md`

Rules:

1. One owner per file at a time.
2. Do not change another agent's owned files without coordination.
3. AI must never approve, activate, release holds or move money.
4. PayPal callbacks go directly to the backend, never through the AI.
5. Payout execution uses only the stored, approved active payer ID.
6. Never print, commit or expose credentials.
7. Every task report must state changes, tests run, results and unresolved issues.
8. Do not claim a feature works until its acceptance tests pass.

---

# A. Codex — Backend and authorization

**Ownership:** Backend services, policy integration, payout gate and backend tests.

### TASK-060 — Real CaseReader integration

**Goal:** Replace the synthetic investigator CaseReader with a backend implementation.

**Read first:**
- `docs/AGENT.md`
- `docs/API_CONTRACT.md`
- `docs/POLICY.md`
- Existing investigator implementation.

**May edit:**
- Backend case-reader implementation.
- Backend service wiring.
- Relevant integration tests.

**Must not touch:**
- `rescue/investigator_schema.py`
- `rescue/investigator.py`
- Policy semantics without coordination.

**Done when:**
- CaseReader retrieves tenant-, seller- and case-scoped information.
- The investigator cannot choose its own scope.
- Cross-seller access is rejected.
- Missing data fails safely.

### TASK-061 — Persist AI assessment

**Goal:** Persist the investigator's structured result as `ai_assessment`.

**May edit:** Backend persistence and service integration.

**Must not touch:** Payout approval logic or AI permissions.

**Done when:**
- Assessment is associated with the correct case.
- Timestamp and model/version metadata are recorded where available.
- AI assessment remains advisory.
- Effective recommendation is display-only and cannot authorize a transition.

### TASK-062 — Marketplace role authorization

**Goal:** Prevent ordinary staff or shared-account access from automatically granting payout-management permission.

**May edit:** Backend authentication/authorization services and policy tests.

**Done when:**
- Payout-management permission is checked using trusted backend identity data.
- An authenticated staff member without that permission cannot initiate a destination change.
- Caller-supplied role claims are rejected.
- Authorization failures are audited.

If full marketplace role integration is unavailable, use an explicitly labelled prototype role model.

### TASK-063 — Cooling-off and destination enforcement

**Goal:** Enforce a configurable delay before an approved new destination becomes active.

**May edit:** Backend state machine integration, policy configuration and payout-gate tests.

**Done when:**
- Three days is the configurable demonstration default.
- Pending and cooling-off destinations cannot receive payouts.
- Existing approved destination behaviour follows the configured compromise policy.
- Expiry is checked by the backend, not by the UI.
- Demo override is clearly marked as simulation and cannot be used as a production authorization path.

### TASK-064 — Policy and payout-gate regression

**Goal:** Verify the complete authorization boundary.

**Done when:**
- New PayPal authentication alone cannot activate a destination.
- Failed old-account verification cannot automatically approve.
- Unauthorized roles cannot change destinations.
- Pending, rejected and cooling-off cases cannot pay to B.
- Payout execution uses the stored active payer ID.
- AI output cannot weaken a baseline restriction.
- Callback replay, case mismatch and seller mismatch are rejected.
- Duplicate requests cannot create duplicate payouts.

### TASK-065 — API integration

**Goal:** Complete the HTTPS API contract for the UI and Postman.

**Done when:**
- Request, status, summary and event endpoints work.
- Tenant and seller authorization is enforced.
- Idempotency is implemented for change requests.
- External callers cannot approve or activate destinations.
- API errors do not expose credentials or stack traces.

---

# B. Claude Code — NVIDIA investigator and evaluation

**Ownership:** `rescue/investigator.py`, `rescue/investigator_schema.py`, investigator evaluation and related tests.

### TASK-050 — Complete investigator integration contract

**Goal:** Ensure the investigator works with the real CaseReader interface.

**Done when:**
- Tools remain read-only and case-scoped.
- No PayPal or payout mutation operations are accessible.
- Seller messages are treated as untrusted input.
- Structured output follows the strict schema.

Coordinate with Codex on the CaseReader interface. Do not modify Codex's backend implementation.

### TASK-051 — Rules-only baseline

**Goal:** Compare the AI investigator against a conventional rules-based investigator.

**Done when:**
- Both systems process the same red-team dataset.
- Both produce comparable reason categories, risk signals, missing information and escalation recommendations.
- Results are reported per case.
- Unsupported AI claims and false-positive signals are counted.
- No accuracy or improvement claims are invented.

### TASK-052 — Improve investigation quality

**Goal:** Improve contextual understanding without weakening safety.

Prioritize:
- Lost old-account access.
- Third-party destinations.
- Urgency and social-engineering attempts.
- Inconsistent seller explanations.
- Attempts to bypass verification.
- Prompt injection.

Hindi is one multilingual robustness case, not a primary product requirement.

**Done when:**
- Invalid enum values are rejected.
- The model does not invent unsupported risk signals.
- Uncertain explanations lead to follow-up or review rather than automatic rejection.

### TASK-053 — Failure and safety evaluation

**Goal:** Verify safe behaviour when the model or tools fail.

**Done when:**
- NVIDIA timeout leaves the case restricted.
- Invalid JSON leaves the case restricted.
- Unknown tool calls are denied.
- Prompt injection cannot create trusted verification evidence.
- AI cannot approve, activate or release a payout hold.
- AI recommendations cannot weaken the baseline policy.

### TASK-054 — Evaluation report

**Goal:** Produce reproducible evaluation evidence.

**Done when:**
- Live evaluation command is documented.
- Rules-only and AI results are compared.
- Model/version and run information are recorded where available.
- Failed cases are explained.
- Results are not presented as universal model accuracy.

---

# C. Antigravity — UI, Postman and demonstration

**Ownership:** Frontend, operator experience, Postman collection and browser testing.

### TASK-070 — Operator interface

**Goal:** Build a clear operator workspace for payout destination-change cases.

**Read first:**
- `AGENTS.md`
- `docs/API_CONTRACT.md`
- `docs/STATE_MACHINE.md`
- `docs/POLICY.md`

**May edit:** Frontend and UI assets.

**Must not touch:** Backend policy, payout gate, callbacks or state machine.

**Done when:**
- Case queue displays real backend data.
- Seller explanations and AI summaries are distinguishable.
- Verified evidence and seller claims are clearly labelled.
- Old and proposed payer IDs are masked.
- Review actions require backend authorization.
- UI never treats an AI recommendation as approval.

### TASK-071 — AG Grid integration

**Goal:** Make the operator queue searchable and useful.

**Done when:**
- Search, sort and filtering work.
- Cases can be filtered by state, review requirement and verification status.
- Cooling-off deadlines are visible.
- Statuses use text and visual indicators.
- No bulk approval is available.

Advanced styling and custom widgets are optional until the core works.

### TASK-072 — Postman collection

**Goal:** Provide a repeatable API demonstration and regression suite.

**Done when:**
- Collection uses the actual application HTTP handlers.
- Includes valid and invalid destination-change requests.
- Tests role authorization.
- Tests case status and event retrieval.
- Tests cross-seller access denial.
- Tests invalid transitions and idempotency.
- Includes a payout-blocking scenario where supported.

Do not report mock-only requests as real backend integration tests.

### TASK-073 — Browser end-to-end demonstration

**Goal:** Exercise the complete seller and operator journey.

**Done when:**
- Seller requests a destination change.
- Proposed account authentication is represented correctly.
- Pending case appears in the operator interface.
- Unauthorized role or missing evidence prevents activation.
- Payout restriction is visible.
- Audit timeline explains the decision.

Report any simulated step explicitly.

### TASK-074 — Render deployment (optional)

**Goal:** Deploy the tested application for judges.

**Done when:**
- HTTPS works.
- Persistent storage survives restart.
- PayPal sandbox OAuth callbacks work.
- Environment secrets are configured securely.
- Health checks pass.
- No credentials appear in logs or browser responses.

If deployment consumes time needed for the core, provide complete local setup instructions instead.

---

# D. Cross-review and merge ownership

| Work | Reviewer |
|---|---|
| Codex backend policy and payout-gate changes | Claude Code |
| Claude investigator and AI boundary | Codex |
| Antigravity UI and API contract | Claude Code |
| Postman tests | Codex |
| Full end-to-end integration | You |
| Final pitch and evidence consistency | You, with GPT assistance |

These are engineering cross-reviews, not independent external security audits.

You personally run the final test suite before merging.

---

# E. Execution order

## Must finish first

1. TASK-060 — Real CaseReader.
2. TASK-061 — AI assessment persistence.
3. TASK-062 — Role authorization.
4. TASK-063 — Cooling-off and payout enforcement.
5. TASK-051 to TASK-053 — AI evaluation and failure handling.
6. TASK-070 — Basic operator interface.
7. TASK-064 — Policy and payout-gate regression.
8. TASK-073 — Complete attack-and-block demonstration.

## Then, if time permits

9. TASK-065 — API completion.
10. TASK-072 — Postman collection.
11. TASK-071 — AG Grid refinement.
12. TASK-074 — Render deployment.
13. APIMatic investigation and integration only if sponsor eligibility is confirmed and core work is complete.

## Explicitly defer

- Elastic.
- AG Studio.
- Dual approval unless the core is finished.
- MCP adapter.
- Additional agent frameworks.
- Global fraud-account intelligence.
- Features that require unverified PayPal capabilities.

---

# F. Final release gate

Before submission, verify:

- [ ] `pixi run test` passes.
- [ ] Investigator offline tests pass.
- [ ] Live NVIDIA evaluation results are documented.
- [ ] Rules-only comparison is documented.
- [ ] Unauthorized destination cannot pass the payout gate.
- [ ] Role authorization works.
- [ ] Cooling-off is enforced by the backend.
- [ ] PayPal sandbox payout to an approved payer ID works.
- [ ] No cancellation success is claimed.
- [ ] Operator UI works against the actual backend.
- [ ] README contains complete setup and run instructions.
- [ ] Public repository and appropriate open-source license are ready.
- [ ] Three-minute public YouTube video is ready.
- [ ] Video follows the hackathon's trademark and copyright restrictions.
- [ ] Every simulated capability is labelled.
- [ ] Final pitch matches the implementation, not the intended roadmap.

**Final acceptance criterion:** Demonstrate that a person can successfully access a seller's marketplace account and authenticate their own PayPal account, yet still cannot redirect that seller's future earnings without the required marketplace authorization.

## 3. Final decisions — freeze these

| Decision | Final choice |
|---|---|
| Product name | PayeeGuard |
| Core problem | Unauthorized marketplace payout-destination changes |
| Core integration | PayPal Payouts |
| AI | NVIDIA-powered investigation assistant |
| Backend owner | Codex |
| AI owner | Claude Code |
| UI / Postman owner | Antigravity |
| Independent reviewer | No formal independent reviewer; cross-review plus your own test execution |
| Primary demo | Unauthorized destination change gets blocked |
| Optional sponsors | AG Grid, Postman, Render; APIMatic only if eligibility is confirmed |
| Deferred | Elastic, MCP, AG Studio, dual approval |

**One critical instruction:** Give agents the task cards individually, not the entire task board as permission to modify everything. Give them the shared specification, their assigned card and explicit file ownership.

The submission should demonstrate a working PayPal authorization control with AI assistance—not an AI fraud detector pretending to have PayPal's internal intelligence.