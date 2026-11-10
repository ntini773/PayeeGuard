# Payout Rescue — Sponsor Tools, Integration & Verification Guide

Updated: 2026-11-10  
Project context: implementation report supplied for Payout Rescue  
Purpose: a practical guide for deciding which PayPal AI Hackathon sponsor tools to integrate, how to integrate them without weakening payout safety, and how to verify the result with a small, high-value test suite.

> **Important:** This document is an implementation plan, not evidence that any sponsor integration is already installed or working. The current implementation report says sponsor services and hosting have not yet been added. Verify every integration in the actual repository and record the result before listing it as a project dependency or sponsor tool.

---

## 1. Product architecture and non-negotiable boundaries

Payout Rescue helps a marketplace investigate a payout destination problem, authenticate the recipient's PayPal account, compare it with the marketplace's payee record, and route a sensitive change through operator approval.

The existing architecture already has:

- PayPal OAuth / Log in with PayPal and Payouts API integration.
- A deterministic backend state machine and policy layer.
- A constrained NVIDIA agent with five tools:
  `get_payout_status`, `get_payee_record`,
  `request_paypal_authentication`, `compare_payee_evidence`,
  `propose_action`.
- Recipient and operator interfaces.
- A real sandbox cancellation-failure path.
- A separate, explicitly simulated `RETURNED` / replacement demonstration.
- No AI payment-execution tool and no real replacement-payout endpoint.

### Keep these invariants

1. **PayPal and the marketplace remain the sources of truth.** Sponsor tools must not decide entitlement, PayPal transaction state, or whether a payout can be cancelled.
2. **The LLM cannot move money.** Do not add a sponsor MCP tool that directly calls payout cancellation, payout creation, refunds, or transfers.
3. **Operator approval stays server-side.** A UI widget, browser agent, workflow, notification, or search result cannot substitute for backend authorization.
4. **No replacement while the original is claimable.** Only a fresh, provider-confirmed `RETURNED` state can satisfy the replacement prerequisite; the current app deliberately has no real replacement API.
5. **External failures fail closed.** On timeout or error, re-fetch PayPal status. Never infer that cancellation succeeded.
6. **Search is advisory.** Elastic or another retrieval layer may find similar cases or policy text, but its results cannot authorize a financial action.
7. **Minimize sensitive data.** Do not send PayPal access tokens, secrets, full recipient email addresses, bank details, passwords, or unnecessary personal data to sponsor services.
8. **Keep simulation separate.** Sponsor integrations must never connect the simulated provider/database to the real PayPal sandbox or make a simulated recovery look real.

### Recommended integration boundary

```text
Recipient / Operator UI
        |
        +---- AG Studio (optional read-only operations analytics)
        |
Application API
        |
        +---- Deterministic case + policy + approval service
        |          |
        |          +---- PayPal adapter (OAuth, payout status, cancel attempt)
        |          +---- Marketplace payee records
        |          +---- Append-only audit events
        |
        +---- NVIDIA agent (five existing non-payment tools)
        |
        +---- Optional sponsor adapters
                   |-- Elastic: read-only case/policy retrieval
                   |-- Zapier: approved notifications only
                   |-- Render: hosting / background orchestration
                   |-- Postman: API collection and contract verification
                   |-- APIMatic: development-time PayPal API context
                   |-- Others: only if a real product need is demonstrated
```

---

## 2. Sponsor priority: what to build and what to skip

The hackathon lists AG Grid, APIMatic, Astropods, Bryntum, Channel3, Elastic, KERNEL, Postman, Render, and Zapier as optional sponsor tools. Optional means optional: do not integrate all ten just to increase the sponsor count.

### Recommended order for this product

| Priority | Sponsor | Product role | Recommendation |
|---|---|---|---|
| P1 | AG Grid / AG Studio | Operator analytics and case investigation dashboard | Best product fit; pursue if the existing UI can accommodate it |
| P1 | APIMatic | PayPal API context for the coding agent during development | Low-risk development-time use; document exactly what it helped with |
| P1 if hosting is absent | Render | Public demo hosting and possibly durable background tasks | Use only if it solves the deployment requirement |
| P2 | Postman | Repeatable API collection and test evidence | Useful, low-risk engineering support |
| P2 | Elastic | Search sanitized historical cases and policy documents | Optional; keep it advisory/read-only |
| P3 | Zapier | Operator notifications after approved state transitions | Optional; never grant payment authority |
| P3 | Bryntum | Investigation deadlines / SLA calendar | Only if scheduling is a demonstrated user need |
| Skip unless needed | Astropods | Deploy/observe the existing agent | Overlaps with the current agent stack and hosting |
| Skip unless needed | KERNEL | Isolated cloud browser for a legitimate browser task | PayPal APIs are preferable; do not automate financial actions through a browser |
| Skip | Channel3 | Product catalog/search/checkout | Poor fit for payout recovery; do not invent a shopping use case |

**Time-box:** spend at most one focused integration block on AG Studio and one on APIMatic before deciding. If either creates dependency churn or threatens the core demo, stop and preserve the working product.

---

## 3. AG Grid / AG Studio — operator case analytics

### Why it fits

The operator already needs to inspect case status, identity evidence, approvals, PayPal errors, and audit history. AG Studio can add embedded dashboards, grids, charts, filters, and custom widgets. This is a genuine operator capability, not just a logo.

Official references:
- Hackathon sponsor page: https://paypalaihackathon.devpost.com/details/aggrid
- AG Studio overview: https://www.ag-grid.com/studio/
- React quick start: https://www.ag-grid.com/studio/react/quick-start/
- React custom widgets: https://www.ag-grid.com/studio/react/custom-widgets/
- Agent framework: https://www.ag-grid.com/studio/javascript/ai/

### Suggested feature

Add an **Operations Overview** panel containing:

- KPI tiles: open cases, awaiting approval, cancellation pending, escalated.
- A case grid: case ID, age, current case state, PayPal item state, evidence status, last updated.
- A status chart: counts by case state.
- A custom case-detail widget: selected case's audit timeline and safe evidence summary.
- Filters for state, age, and review status.

Use only fields already exposed by an authenticated application API. Do not give AG Studio direct database access or broad access to raw audit records.

### Integration steps

1. Read the current AG Studio React quick start and confirm the package/version supported by the current frontend.
2. Claim the hackathon trial through the sponsor page; keep the license key in an environment variable or server-side configuration as required by the product.
3. Add a separate route or feature flag such as `/operator/analytics`; do not replace the existing operator console initially.
4. Add an authenticated, read-only endpoint such as `GET /api/operator/analytics`.
5. Return a minimal DTO: aggregate counts and sanitized case summaries. Exclude secrets, OAuth tokens, raw recipient identifiers, and unneeded personal data.
6. Connect AG Studio widgets to that endpoint through the supported data-source mechanism.
7. If building a custom widget, use the documented custom-widget interface and render the selected case's existing state/audit information.
8. Keep approve/reject/cancel controls in the existing server-authorized operator UI. A dashboard widget may link to the case; it must not independently execute financial actions.
9. If enabling AG Studio's AI assistant, expose only safe read-only tools and a narrow schema. Do not pass mutation tools or raw sensitive rows to the model.
10. Record the AG Studio version, trial/license status, and exact dashboard capability in the README / Devpost tools description.

### Verify it works

- Dashboard loads for an authenticated operator.
- Recipient role cannot access the operator analytics endpoint.
- KPI totals match a direct query against the seeded test database.
- Filters change the displayed rows correctly.
- A case detail widget displays the correct case and does not leak another case's information.
- Refreshing data does not mutate case state or add audit events.
- AG Studio AI (if enabled) can answer a read-only question such as “Which cases are awaiting approval?” but cannot approve, cancel, or create a payout.
- Production build loads without license or console errors; verify trial expiry against the judging-period requirement.

### Minimal tests

1. **Role gate:** recipient receives 403 from operator analytics.
2. **Aggregate correctness:** fixture with known case states returns exact counts.
3. **Read-only guarantee:** dashboard data fetch leaves case, audit, and PayPal mock state unchanged.
4. **Tenant/case isolation:** requesting a case not visible to the operator returns no data.

---

## 4. APIMatic — PayPal API context for development

### Why it fits

APIMatic's PayPal Context Plugin is a coding-agent aid. It supplies PayPal API specifications, SDK material, and integration guidance so a coding assistant is less likely to invent endpoint names or request fields. This is a development-time tool, not necessarily a runtime dependency in Payout Rescue.

Official references:
- Hackathon sponsor page: https://paypalaihackathon.devpost.com/details/apimatic
- PayPal Context Plugin: https://context.apimatic.io/plugins/paypal/
- Installer: https://github.com/apimatic/context-plugins-installer

### Integration steps

1. Check Node.js 18+ and install from the project development environment:
   `npx context-plugins install paypal`
2. Confirm the plugin appears in the coding assistant actually used for this project.
3. Ask it to review the existing PayPal Payouts and Log in with PayPal integration against the current API specification.
4. Ask focused questions: endpoint path and method, OAuth scopes, request/response fields, error handling, payout item status retrieval, and cancellation semantics.
5. Treat generated code as a proposal. Compare it with official PayPal docs and the project's current adapter before accepting changes.
6. Use it to improve API contract notes and error handling; do not let it silently rewrite the tested payout state machine.
7. Record the exact development tasks where APIMatic was used. Do not describe it as a runtime component if it was not deployed with the app.

### Verify it works

- Installer exits successfully and the plugin is visible to the intended coding agent.
- The agent can locate the relevant PayPal API operation from the plugin's supplied context.
- A generated example uses the documented HTTP method, path, and request schema.
- The developer manually validates the output against PayPal's official API docs.
- No generated change weakens idempotency, status re-fetch, approval checks, or fail-closed behaviour.

### Minimal tests

This is mostly a developer-tool integration, so avoid adding application tests just to test APIMatic. Keep:
1. A reproducible setup check (plugin installed / visible).
2. A reviewed PayPal API contract check for the endpoint(s) changed.
3. The existing PayPal adapter tests as the actual application regression gate.

---

## 5. Render — host the demo and orchestrate durable background tasks

### Why it fits

Render can host the application and provides Workflows for long-running distributed tasks. Hosting is valuable if the project currently lacks a stable public demo. Workflows are only justified if Payout Rescue needs durable asynchronous jobs, not just because the sponsor offers them.

Official references:
- Hackathon sponsor page: https://paypalaihackathon.devpost.com/details/render
- Render docs: https://render.com/docs
- Workflows overview: https://render.com/docs/workflows
- Workflows quickstart: https://render.com/tutorials/render-workflows
- Cron jobs: https://render.com/docs/cronjobs

### Hosting steps

1. Confirm the app's start command, port binding, environment variables, database persistence, and health endpoint.
2. Connect the public repository to Render and deploy the existing application without changing its business logic.
3. Configure secrets in Render environment settings; never commit `.env`, OAuth secrets, NVIDIA keys, or Render API tokens.
4. Use a persistent managed database for durable case state and audit history. Do not rely on an ephemeral filesystem for important records.
5. Add a health check that confirms the app can serve requests without exposing credentials or personal data.
6. Configure logs and alerts; redact Authorization headers, tokens, passwords, and recipient details.
7. Exercise the hosted app from a clean browser session and verify the demo remains accessible without developer credentials.

### Optional Workflows steps

Only add a workflow for a real durable job such as a scheduled read-only reconciliation of unresolved cases:

1. Define a task that accepts a case ID, retrieves the current case and PayPal status through the backend adapter, and records a reconciliation result.
2. Use a unique operation key and durable job record.
3. Let the task call the same deterministic service layer as the web app; do not duplicate business rules in the workflow.
4. Make retries idempotent. A retry may re-fetch status and append a reconciliation event, but must not create a second payout.
5. Never put payout cancellation or replacement creation into an unattended workflow.
6. Trigger a test run from the application and inspect its result in Render's dashboard.

### Verify it works

- Deployment health check passes.
- Public demo is reachable from a clean browser.
- A restart does not lose case state or audit history.
- Secrets are absent from client bundles and logs.
- Workflow can run a read-only reconciliation and persist its result.
- Simulated transient failure retries safely.
- Duplicate task delivery does not duplicate business actions.
- The hosted demo stays on the exact submitted version through judging.

### Minimal tests

1. `/health` returns healthy without disclosing secrets.
2. Restart/persistence smoke test preserves a seeded case and audit events.
3. Workflow retry/idempotency test proves no duplicate financial side effect is possible.
4. Hosted end-to-end smoke test signs in as recipient and operator in separate browser contexts.

---

## 6. Postman — API contract and regression collection

### Why it fits

Postman is the quickest low-risk way to make the application's HTTP contract reproducible. It can document and run requests against the local app or a controlled sandbox environment.

Official references:
- Hackathon overview: https://paypalaihackathon.devpost.com/
- Test API functionality: https://learning.postman.com/docs/tests-and-scripts/running-collections/running-collections-overview
- Postman CLI: https://learning.postman.com/docs/postman-cli/postman-cli-run-collection
- Newman compatibility note: https://learning.postman.com/docs/reference/newman-cli/command-line-integration-with-newman

### Integration steps

1. Create a collection for the Payout Rescue application's own HTTP API.
2. Define variables for `baseUrl`, test recipient credentials, operator credentials, and a synthetic case ID. Keep secrets in local/CI secret storage, not exported collection JSON.
3. Add requests for login, recipient case read, operator case read, proposal, approval, status refresh, and audit read.
4. Add assertions for status codes, role restrictions, expected state transitions, and response schemas.
5. Use synthetic fixture IDs for destructive or state-changing requests.
6. Export the collection into the repository if it contains no secrets.
7. Run it locally and in CI using the current Postman CLI. Do not start a new Newman workflow for Postman v12 collection v3; official docs note Newman is not compatible with that format.
8. Keep live PayPal calls in a separately named, manually triggered sandbox folder; do not make them part of every CI run.

### Verify it works

- Collection runs against a clean local test database.
- Unauthorized and wrong-role requests fail as expected.
- Response assertions catch schema changes.
- A second run does not duplicate approvals or financial actions.
- Exported collection contains no API keys, passwords, cookies, or OAuth tokens.

### Minimal tests

Use one API collection run with:
1. A successful recipient read.
2. A forbidden recipient-to-operator access attempt.
3. A successful operator approval on a synthetic fixture.
4. A forbidden attempt to create a replacement while the original is `UNCLAIMED`.

---

## 7. Elastic — read-only case and policy retrieval

### Why it fits

Elastic can provide full-text plus vector/hybrid search. For Payout Rescue, the credible use is finding similar historical investigations or relevant policy documentation. It is not an identity verifier, entitlement system, or financial policy engine.

Official references:
- Hackathon sponsor page: https://paypalaihackathon.devpost.com/details/elastic
- Hybrid search: https://www.elastic.co/docs/solutions/search/hybrid-search
- Elasticsearch Python client: https://www.elastic.co/guide/en/elasticsearch/client/python-api/current/index.html

### Suggested feature

An operator asks:

> Find prior cases where the recipient's PayPal account matched the marketplace payee record but the original payout email was inaccessible.

Elastic retrieves sanitized case summaries and policy snippets. The operator sees source case IDs and timestamps. The backend still computes all current eligibility and approval decisions.

### Integration steps

1. Start with local Elasticsearch or the sponsor trial. Confirm trial duration and access through the sponsor page.
2. Define a strict index schema for sanitized case summaries and approved policy documents.
3. Index only the minimum fields needed: synthetic/internal case ID, normalized state, issue category, safe resolution notes, policy document ID, and timestamps.
4. Exclude raw recipient email, PayPal payer ID, access tokens, passwords, financial account data, and full conversation transcripts unless explicitly justified and protected.
5. Add a backend retrieval adapter; do not connect the browser directly to Elasticsearch.
6. Expose a read-only search function to the operator UI or agent.
7. Return citations/record IDs with each result so an operator can inspect the source.
8. Keep policy decisions in deterministic backend code. A retrieved prior case is not precedent or authorization.
9. Add index retention and deletion rules consistent with the app's data policy.

### Verify it works

- Known seeded query returns the expected synthetic case.
- Exact keyword search and semantic/hybrid search both return relevant results.
- Every result includes a source case or policy ID.
- Unrelated or low-confidence matches are clearly marked as suggestions.
- A retrieved record cannot change case state or invoke a PayPal API.
- Indexing and query logs contain no secrets or raw sensitive values.

### Minimal tests

1. Search for a known fixture returns its case ID.
2. Search response contains only allowlisted fields.
3. Search result cannot be passed as approval evidence or used to bypass backend policy.
4. Elasticsearch outage degrades the search panel gracefully without blocking core payout safety flows.

---

## 8. Zapier — notifications, not financial execution

### Why it fits

Zapier MCP can expose selected app actions to an AI client. For this project, use it only for low-risk notifications after the backend has already committed a valid state transition.

Official references:
- Hackathon sponsor page: https://paypalaihackathon.devpost.com/
- Zapier MCP quickstart: https://docs.zapier.com/mcp/quickstart
- Zapier MCP docs: https://docs.zapier.com/mcp

### Suggested feature

Send an operator notification when:
- A case enters `APPROVAL_PENDING`.
- A case is escalated for suspicious redirection.
- A PayPal cancellation attempt fails and the original remains `UNCLAIMED`.

Do not let Zapier decide the case state. Do not expose PayPal payout creation/cancellation as a Zapier action.

### Integration steps

1. Create a Zapier MCP server and connect only the notification app/action needed (for example, a team channel message).
2. Do not connect broad email, drive, payment, or admin permissions unless essential.
3. Create a backend notification outbox record only after a committed state transition.
4. A small worker delivers the notification to Zapier with an idempotency key.
5. Send a minimal payload: internal case ID, event type, timestamp, and safe dashboard link. Avoid full recipient identifiers and transaction credentials.
6. Record delivery status and retry count in the outbox.
7. Keep notifications non-authoritative; the operator must open the application and authenticate to take action.

### Verify it works

- A committed approval-pending event creates exactly one notification.
- A rolled-back state transition creates no notification.
- A repeated delivery attempt does not create duplicate notifications where the destination supports deduplication; otherwise document at-least-once semantics.
- Zapier outage does not block the case workflow.
- Notification payload contains no secrets or unnecessary personal data.

### Minimal tests

1. Outbox event created only after successful transaction commit.
2. Retry does not duplicate the internal outbox event.
3. Zapier failure leaves the payout case state unchanged.

---

## 9. Bryntum — investigation deadlines and SLA calendar

### Why it may fit

Bryntum Scheduler, Calendar, or Gantt could visualize investigation tasks and deadlines. It is not necessary for a small prototype unless the operator genuinely needs a time-based workload view.

Official references:
- Hackathon sponsor page: https://paypalaihackathon.devpost.com/details/bryntum
- React Scheduler quick start: https://www.bryntum.com/docs/guide/Scheduler/quick-start/react
- Product overview: https://bryntum.com/docs/guide/Scheduler/overview
- Trial/download: https://bryntum.com/download

### Suggested feature

A read-only **Case SLA Calendar**:
- Case opened.
- Recipient response due.
- Operator review due.
- Next follow-up.
- Escalation deadline.

Do not present a calendar event as proof that a payout was cancelled or returned.

### Integration steps

1. Choose one component (Calendar or Scheduler); do not add multiple components.
2. Verify current framework and version compatibility.
3. Install the appropriate package/tier from the official guide and obtain the correct trial/license if required.
4. Build a read-only event DTO from case deadlines.
5. Link each event to the existing case page.
6. If drag/drop rescheduling is enabled, send a proposed deadline change to the backend; enforce operator authorization and audit it there.
7. Pin dependency versions and verify the trial covers the period in which the demo must remain available.

### Verify it works

- Calendar events match backend case deadlines.
- Unauthorized users cannot see operator-only cases.
- Time zones render correctly.
- Dragging an event cannot alter payout status, approval, or recipient identity.
- Build has no license warnings and remains usable for the required demo period.

### Minimal tests

1. Event mapping uses the correct case ID and timestamp.
2. Unauthorized deadline update is rejected.
3. Calendar interactions do not mutate payment state.

---

## 10. Astropods — agent deployment and observability

### Why it is lower priority

Astropods provides infrastructure to publish, deploy, and observe agents. Payout Rescue already has a constrained NVIDIA agent and an application backend. Moving it to another agent platform late in the hackathon risks duplicating deployment, secret management, and observability.

Official references:
- Hackathon sponsor page: https://paypalaihackathon.devpost.com/details/astropods
- Documentation: https://docs.astropods.com/welcome
- Guides: https://docs.astropods.com/guides

### Only integrate if

You need a repeatable deployed agent service with run traces and the platform supports your existing framework without changing the five-tool safety boundary.

### Integration steps

1. Check the current Astropods supported framework/container model.
2. Package the existing agent without changing its system prompt, tool allowlist, or tool schemas.
3. Inject model credentials through the platform's secret mechanism.
4. Give the agent only the five existing read/proposal tools.
5. Keep PayPal credentials and all financial operations in the application backend, not the agent container.
6. Compare traces and outputs with the existing local NVIDIA agent before switching traffic.
7. Keep a rollback path to the current agent.

### Verify it works

- Deployed agent can complete the three expected investigation paths.
- Tool calls remain limited to the five allowlisted tools.
- No PayPal credential is visible in the agent runtime.
- Model/tool failure produces an explicit incomplete result, not a fabricated approval.
- Traces redact personal data.

### Minimal tests

1. Tool allowlist regression.
2. Missing/failed model response does not create an approval proposal.
3. Agent deployment smoke test against synthetic PayPal tools only.

---

## 11. KERNEL — isolated browser infrastructure

### Why it is lower priority

KERNEL provides isolated cloud browsers for agents that must interact with websites. Payout Rescue already uses PayPal APIs. API integration is more reliable and auditable than automating a financial dashboard through a browser.

Official references:
- Hackathon sponsor page: https://paypalaihackathon.devpost.com/details/kernel
- KERNEL: https://www.kernel.sh/

### Safe possible use

If needed, use a browser session only for non-financial public documentation checks or a controlled read-only QA workflow against your own demo. Do not use browser automation to click PayPal cancel/send buttons, bypass OAuth, or handle user passwords/MFA.

### Integration steps

1. Read KERNEL's current API/MCP docs and create a scoped API key.
2. Create short-lived isolated sessions.
3. Restrict allowed domains to the demo or public documentation needed.
4. Do not place PayPal credentials, OAuth tokens, or user sessions into agent prompts.
5. Capture logs/screenshots only from synthetic demo data.
6. Explicitly close/delete browser sessions after use.

### Verify it works

- Session creation and teardown succeed.
- Browser can access only allowed test domains.
- No credentials or cookies are written to logs or model context.
- Browser task cannot invoke any payment mutation.
- Session expiry is enforced.

### Minimal tests

1. Browser session is created and deleted.
2. Disallowed domain is blocked.
3. No financial API or payment tool is exposed to the browser agent.

---

## 12. Channel3 — not recommended for Payout Rescue

### Why it does not fit

Channel3 is a structured product search, lookup, and shopping API. Payout Rescue handles payee identity and payout destination verification. Product discovery does not solve that problem.

Official references:
- Hackathon sponsor page: https://paypalaihackathon.devpost.com/details/channel3
- Developer portal: https://www.trychannel3.com/developers

Do not add a product search feature just to claim Channel3. It would distract from the product and make the demo less coherent.

### Only reconsider if the product changes

If Payout Rescue later becomes part of a creator/affiliate marketplace operations suite, Channel3 might be relevant to a separate merchant-product discovery workflow. That is outside the current scope and should not be added to this submission.

### If experimented with separately

- Use synthetic product queries only.
- Keep Channel3 product/offer data separate from payout identity and entitlement records.
- Never use product catalog results to determine a payee or payout destination.
- Verify search and lookup response schemas against the official docs.
- Do not claim checkout works unless the relevant checkout access is actually enabled and tested; the developer page has described checkout as early access/coming soon.

---

## 13. Small, high-value regression suite

The project report already records 59 passing Python tests and UI render checks. **Do not delete or replace passing tests simply to make the suite smaller.** First identify duplicated tests that assert the same behaviour. Preserve broad safety coverage and add only tests that protect a meaningful risk or a new sponsor integration.

A good small suite should test invariants, not every line of implementation.

### P0 — must never regress

| Test | Arrange | Action | Required assertion |
|---|---|---|---|
| Payee mismatch blocks action | Payee record expects payer A; authenticated account is payer B | Propose destination change | Escalated/rejected; no approval; no cancellation |
| Approval is bound to exact proposal | Approve proposal for item A/destination A | Change destination, item, amount, or evidence | Old approval invalid; action rejected |
| Claimable original cannot be replaced | PayPal status is `UNCLAIMED` | Attempt replacement through every exposed route | No replacement record and no payout API call |
| Cancellation error reconciles state | Cancel endpoint returns 500 | Re-fetch payout item | State remains based on fresh PayPal response; never report success from error |
| Duplicate operation is safe | Same cancel request submitted twice / concurrently | Process both | One logical operation; second request reconciles; no duplicate money action |
| Recipient/operator authorization holds | Recipient session and unrelated case | Request operator read/approve endpoint | 403/404; no state or audit mutation |
| Agent cannot execute payment | Prompt injection asks agent to cancel/send money | Run agent | No payment tool exists; backend rejects unauthorized mutations |
| Changed request invalidates review | Proposal exists, then recipient changes request or reauthenticates | Attempt approval using old proposal | Old proposal/approval cannot be used |

These tests are more important than sponsor-specific cosmetic tests.

### P1 — sponsor tests only for integrations actually shipped

| Integration | One core test |
|---|---|
| AG Studio | Operator-only dashboard returns correct aggregates and is read-only |
| APIMatic | Reviewed API contract matches actual adapter method/path/schema; record plugin setup evidence |
| Render | Hosted health + persistent case/audit smoke test |
| Postman | Collection run catches forbidden recipient access and replacement-on-UNCLAIMED |
| Elastic | Search returns sanitized source IDs and cannot change case state |
| Zapier | Notification outbox is committed once and delivery failure does not block case processing |
| Bryntum | Calendar mapping is correct and cannot mutate payment state |
| Astropods | Deployed agent retains the same tool allowlist and safe failure behaviour |
| KERNEL | Browser session is scoped, short-lived, and has no payment mutation capability |
| Channel3 | Only if used: schema/response smoke test; no coupling to payout identity or authorization |

### Test design rules

- Prefer state-transition and policy tests over UI snapshot tests.
- Use fake PayPal adapters for deterministic CI; use real sandbox tests as separately labelled manual integration checks.
- Never make CI create/cancel real sandbox payouts on every run.
- For negative cases, assert **no side effect**: no PayPal call, no replacement row, no approval, no notification.
- Test the observable contract, not private helper implementation details.
- Use one parametrized test for equivalent unauthorized actors/states where appropriate.
- Keep one end-to-end browser test for the highest-value journey; don't create a huge fragile browser suite.
- Make test fixtures synthetic and deterministic.
- Redact credentials and personal data from failure output.
- Do not weaken a test just to make a flaky live-model or sandbox test pass.

### Suggested commands

Use the repository's actual commands from `README.md` / `pyproject.toml`; do not assume these names exist if the project changes.

Current implementation report records:
```bash
pixi run test
pixi run evaluate-agent
pixi run start
pixi run demo
pixi run demo-ai
```

- `pixi run test`: deterministic regression suite.
- `pixi run evaluate-agent`: live model evaluation; requires service access and should not be treated as a deterministic CI test.
- `pixi run start`: real sandbox application.
- `pixi run demo`: isolated scripted simulation.
- `pixi run demo-ai`: actual NVIDIA conversations with simulated PayPal data.

Do not confuse a scripted demo pass with live-model quality or a simulated replacement with real PayPal recovery.

---

## 14. Acceptance checklist before claiming a sponsor integration

For every sponsor actually used, add a short entry to `README.md` or the Devpost Tools section:

- [ ] Sponsor tool and exact product/version named.
- [ ] What user problem it solves explained.
- [ ] Actual code path or development workflow identified.
- [ ] Credentials and trial/license handled safely.
- [ ] One working end-to-end demonstration captured.
- [ ] At least one relevant test or repeatable verification command recorded.
- [ ] Failure behaviour documented.
- [ ] No claim that an optional integration is live when it was only researched or installed.
- [ ] Sponsor service does not weaken the PayPal/AI safety boundaries.
- [ ] Demo remains available for the judging period.

### Evidence format

For each integration, record:

```text
Sponsor:
Product/version:
Purpose in Payout Rescue:
Files/routes changed:
Credential names (never values):
Verification command:
Manual verification:
Test result:
Known limitation:
Demo timestamp / screenshot:
```

---

## 15. Final recommendation

For this submission, prioritize:

1. **AG Studio** — the most meaningful product-level sponsor integration: an operator analytics and investigation dashboard.
2. **APIMatic** — use its PayPal Context Plugin to validate and document the PayPal adapter; keep it development-time unless there is a real runtime reason.
3. **Render** — only if you still need stable public hosting; Workflows are optional and should be limited to read-only reconciliation or notification jobs.
4. **Postman** — add a small API collection for repeatable verification.
5. **Elastic or Zapier** — choose at most one if it materially improves operator work.

Skip Channel3, Bryntum, KERNEL, and Astropods unless a specific unmet requirement makes one necessary. Avoid last-minute platform migrations.

**The product wins on trustworthy payout handling, not sponsor count.** Keep PayPal transaction state authoritative, keep the agent constrained, keep operator approval deterministic, and keep the real cancellation failure visible and honest.

---

## Sources

Hackathon:
- [PayPal AI Hackathon overview](https://paypalaihackathon.devpost.com/)
- [Official rules](https://paypalaihackathon.devpost.com/rules)
- [FAQ — sponsor tools are optional and multiple may be used](https://paypalaihackathon.devpost.com/details/faqs)

Sponsor documentation:
- [AG Studio](https://www.ag-grid.com/studio/)
- [AG Studio React custom widgets](https://www.ag-grid.com/studio/react/custom-widgets/)
- [APIMatic PayPal Context Plugin](https://context.apimatic.io/plugins/paypal/)
- [Astropods documentation](https://docs.astropods.com/welcome)
- [Bryntum Scheduler React quick start](https://www.bryntum.com/docs/guide/Scheduler/quick-start/react)
- [Channel3 developer portal](https://www.trychannel3.com/developers)
- [Elastic hybrid search](https://www.elastic.co/docs/solutions/search/hybrid-search)
- [KERNEL browser infrastructure](https://www.kernel.sh/)
- [Postman API testing](https://learning.postman.com/docs/tests-and-scripts/running-collections/running-collections-overview)
- [Render Workflows](https://render.com/docs/workflows)
- [Zapier MCP quickstart](https://docs.zapier.com/mcp/quickstart)
