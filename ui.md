# UI revamp handoff — Payout Rescue

Updated 2026-11-10. This is the user's UI handoff brief for the next agent.
Improve the interface substantially while preserving the working backend and
TASK.md's cancellation-failure fallback. Do not redesign the payment architecture.
Commit each functional UI improvement separately; update report.md with actual
verification. No sponsor dependency is installed by this handoff.

Read [tools.md](tools.md) for the sponsor integration and verification guide.
It describes candidate integrations, not installed capabilities. The selection
below applies that guide to this UI revamp; it does not authorize installing every
listed service. No sponsor logos, promotional badges, or sponsor showcase sections
are requested. Every dependency must solve a named user or engineering task.

Latest sequencing: the user authorized Postman testing, APIMatic review and Render
hosting (ClaimPal, PayPal sandbox + NVIDIA) **before UI work**. See
[integration status and setup](integrations/README.md). AG Studio remains for the
later UI phase. Do not mistake prepared configuration for a deployed service.

## Product truth and demonstrated behavior

A marketplace recipient reports an inaccessible/wrong payout address, authenticates
a PayPal destination, and asks the marketplace to review it. The operator verifies
evidence and approves. The backend controls all financial actions.

The user has demonstrated:

- Real sandbox PayPal identity and a PAYPAL_ID payout reaching SUCCESS.
- Real web proposal → operator approval → cancellation HTTP 500 → UNCLAIMED,
  with no replacement. This is correct failure handling, not successful recovery.
- Separate demo approval → simulated cancellation failure → simulated RETURNED
  and SIMULATED_SUCCESS replacement. No real PayPal funds moved.

Keep these outcomes separate. Never turn an actual HTTP 500 into a completed
payment label. Last sandbox case state is CANCELLATION_PENDING; the completed
demo case is CLOSED_SIMULATED. Current truth is always the API response, not this
file or model prose. See [report.md](report.md).

## Highest-priority UX problems to solve

1. **Users cannot find their next action.** Put a compact progress strip and
   explicit next-step card near the case title: report issue → verify PayPal →
   submit proposal → operator approval → cancellation/result. Name who acts next.
   Verification alone is not a submitted proposal. If the operator cannot approve,
   explain precisely why (for example, “Waiting for recipient to submit review”).
   Prefer explained unavailable actions over silently disappearing controls.
2. **Three identities/addresses get confused.** Explain once, in context:
   marketplace `creator` login; original payout email (unregistered test address);
   separately authenticated PayPal recipient account. RECEIVER_UNREGISTERED is
   about the original address, not whether the marketplace user exists.
3. **Chat narration gets mistaken for a committed action.** Only backend proposal
   state enables approval. Display authoritative proposal/evidence cards separately
   from AI text. Keep the explicit recipient Request operator review form; users
   must not have to discover a magic prompt. Its reason and confirmation are required.
4. **Successful demo still looks failed.** The current patch now says “Demo
   completed” / “Completed (simulation)”. A successful synthetic replacement has
   a completion card, persistent no-funds-moved wording, expandable replacement
   IDs, and a collapsed “Earlier simulated cancellation error” section. Preserve
   that distinction; unresolved sandbox errors must remain prominent.
5. **Screens are dense and diagnostic-heavy.** Give the creator a focused
   conversation, verification status and next action. Give the operator a case
   queue and evidence/approval workspace. Group technical IDs, raw tool results,
   debug IDs and historical errors under accessible details controls. Preserve
   copyable diagnostics for support without leading with a wall of JSON.
6. **Chat/history needs clear controls.** Clear conversation removes working chat
   history, not verification, proposals, approvals, payouts or audit. Label that
   scope. Do not imply it starts a fresh case or removes financial evidence.
7. **Loading/polling is disruptive.** Show investigation progress without jumping
   the scroll position or globally disabling unrelated controls. Preserve focused
   fields, unsent text, expanded history, selected case, and explicit grid filters
   across polling. Handle stale approvals with a clear “case changed; review again”.
8. **Finish the visual polish.** Consistent typography/spacing, strong current-state
   hierarchy, clear per-role navigation, accessible controls, mobile stacking,
   narrow-width overflow handling, keyboard focus, readable contrast, and useful
   empty/error states. No decorative charts or sponsor-logo strip in place of UX.

## Two independent mode indicators

Payment mode and assistant mode are independent. Keep both intelligible:

| Command | Payment evidence/actions | Assistant |
|---|---|---|
| `pixi run start` | Real PayPal SANDBOX; no real replacement sending | NVIDIA |
| `pixi run demo` | Simulated provider and isolated demo database | Scripted offline fixture |
| `pixi run demo-ai` | Same isolated simulated provider/database | Real NVIDIA |

“Scripted” is truthful for the offline fixture; do not rename it to live AI.
A concise “Offline demo assistant” badge with an explanation is acceptable if
all displayed claims remain clear. With demo-ai, PayPal is still simulated.
Keep SIMULATION/SANDBOX visible without repeating a full warning in every line.
Do not offer a client-side toggle that changes financial mode: mode is server-set.
Both servers use port 8765; stop the old process before changing mode. Separate
creator/operator browser profiles are needed because the cookie is per browser.

## PayPal buttons — requested for the revamp

These are functional authentication controls, not a request for decorative logos.
Use the actual **Log in with PayPal / Continue with PayPal** identity button for
sandbox destination authentication. This flow verifies an account; it is not a
checkout. Do not insert a Buy Now/Pay button, Orders capture, or checkout SDK
just for branding. Keep operator approval/cancellation as marketplace controls.
Demo simulated authentication must remain clearly a demo control, not a fake
PayPal authentication success presented as real.

PayPal's official manual-button guide offers its hosted branded image, or a
custom button following the design guide. It says not to self-host a copied
branded image. Recommended labels and design guidance are in the official guide.
Sources checked 2026-11-10:

- [Build the login button](https://developer.paypal.com/log-in/build-button/)
- [Button design guide](https://developer.paypal.com/log-in/designer-guide/)

Implementation boundary:

- The button must POST to the existing case `authenticate` action with CSRF, then
  navigate to the returned URL. Do not hardcode a static OAuth URL/client ID/state.
- Preserve case/session binding, one-use state, account-information scope and
  `http://127.0.0.1:8765/callback`. Never put secrets or token exchange in the browser.
- Current CSP permits self-hosted assets only. If using the official remote image,
  deliberately allow `https://www.paypalobjects.com` under img-src only, with a
  usable accessible text fallback. Do not weaken script-src/connect-src globally.
- Keyboard activation, accessible button name, sufficient hit area and a clear
  destination-authentication explanation must survive branding changes.

## AG Grid / AG Studio — only if it does useful operator work

The user specifically requested investigating this sponsor. TASK.md makes the
integration optional; the new request asks for a useful UI, not a sponsor chase.

**Verified sponsor facts:** The [AG Grid sponsor brief](https://paypalaihackathon.devpost.com/details/aggrid)
emphasizes AG Studio, custom widgets, theming/layout and the Studio Agent Framework;
a grid/chart alone is not the full award brief. It links a 45-day trial and a
starter. Do not replace this working repository with that starter.

Official docs show a [vanilla JavaScript AG Studio integration](https://www.ag-grid.com/studio/javascript/quick-start/)
using `ag-studio` and `createStudio`, so a React rewrite is unnecessary. Studio
accepts arrays of records as data sources. [Custom widgets](https://www.ag-grid.com/studio/react/custom-widgets/)
can supply application-specific panels; its [agent framework](https://www.ag-grid.com/studio/react/ai-agents/)
provides configurable agents/tools. Review current [Grid Community/Enterprise boundaries](https://www.ag-grid.com/javascript-data-grid/community-vs-enterprise/)
and the Studio trial/license terms before depending on premium features. These
capabilities are documented, but integration in this repository is not yet tested.

**Proposed application value (our design, not a sponsor requirement):**

| Operator task | Useful component | Demonstration that proves value |
|---|---|---|
| Find work that can actually be reviewed | Filterable case queue: workflow state, PayPal status, verified match, proposal/approval, currency | Filter to Awaiting approval, select a row, open that exact authorized case and its evidence |
| Track unresolved payouts | Pending-cancellation widget with count, outstanding amount per currency and last-check time | Select the widget and filter the same queue; actual unresolved sandbox cases stay unresolved |
| Compare established and authenticated destinations | Custom evidence widget bound to selected case | Display match/mismatch and the missing requirement; approval still uses the existing versioned endpoint |
| Understand why an action was blocked | Audit/timeline widget | Select a case and see its real error/decision history without mixing other cases or synthetic events |
| Answer an operational question | Optional read-only dashboard agent: “Show pending cancellations in USD” | Agent changes a visible filter/widget using authorized data; makes no approval/cancellation/payment request |

A meaningful minimum is a working queue linked to case detail plus a useful
cross-filtered pending/ready widget. If targeting the sponsor brief, demonstrate
custom widgets, coherent theming/layout and a bounded Studio agent interaction.
Do not add the dependency merely to show a three-row table or canned chart.
A single sandbox case is not enough evidence of dashboard value: use clearly
labeled synthetic cases in the isolated demo for varied queue states, not more
real payout creation. Keep demo and sandbox totals separate and never sum unlike
currencies. “Outstanding amount” is not “money recovered” or measured savings.

Implementation constraints for the handoff agent:

- Keep this operator-facing. The recipient should not need dashboard tooling.
- Build data from authorized `/api/cases` and case-detail responses. Client filters
  are not access control. Avoid injecting raw conversations/PII into analytics or
  third-party models; expose only necessary fields.
- Case selection is the useful bridge to the existing review panel. No inline
  editing of payer ID, amount, approval, or provider state in a grid.
- No bulk approve/cancel. Keep explicit case-level operator consent and versions.
- Dashboard AI is separate from the recipient's five-tool agent. It may inspect
  sanitized operational data and arrange dashboards; it must not gain financial
  action tools or arbitrary SQL/URL execution. Model API keys stay server-side.
- Preserve view state during refresh and distinguish stale/network-failed data
  from current status. Never make an optimistic client row look like provider SUCCESS.
- Add a reproducible dependency/build path and lockfile only if needed. Preserve
  Pixi tasks and Python backend; do not silently require a new stack to run the app.
- Document exact licensed features and trial expiry/fallback. Do not claim award
  eligibility merely because the library loads. Keep ordinary case detail usable
  if the optional dashboard fails to initialize.
- Acceptance: filter results are correct; selecting a row opens matching evidence;
  refresh preserves selection; simulated totals never masquerade as real payouts;
  dashboard prompts cannot trigger a financial action. Show before/after operator
  task improvement, not logo placement.

## Sponsor selection after reviewing tools.md

Use tools.md's recommendations selectively. TASK.md §6 originally cut broad
sponsor integration; the user's subsequent request asks us to identify useful
integrations for this handoff, not to migrate the application or add all sponsors.
AG Studio is the primary UI candidate. Preserve the existing console as a fallback
and initially expose analytics as a separate operator view or feature flag.

| Candidate | Concrete contribution | Scope for the handoff |
|---|---|---|
| AG Studio | Find pending reviews, filter unresolved cases, inspect selected-case evidence and audit history | Primary UI candidate; implement only with the functional acceptance checks above |
| APIMatic | Review PayPal endpoint/schema assumptions using its development context tooling | Development aid if PayPal integration changes; no dashboard widget or runtime dependency required |
| Postman | Repeatable application API checks for roles, proposals, stale approvals and safe failure | Optional verification deliverable using synthetic fixtures; retain the existing regression suite |
| Render | Stable public demo with persistent case/audit data | Separate hosting work if needed; not part of visual polish or an automatic deployment request |
| Elastic | Find relevant sanitized prior cases or policy passages with source IDs | Defer until operators have a real retrieval need and enough records; search results never authorize an action |
| Zapier | Notify operators of committed review requests or cancellation failures | Defer until notifications solve an actual missed-work problem; delivery failure must not block the case workflow |
| Bryntum | Display backend-defined review deadlines | Defer: do not invent SLA dates or a scheduling workflow to justify a calendar |
| KERNEL | Browser QA against a controlled synthetic demo | Only if browser access is an actual verification blocker; no PayPal dashboard automation |
| Astropods | Agent deployment/observability | Defer unless existing deployment cannot meet a named requirement; preserve the five-tool boundary |
| Channel3 | Product discovery | Exclude: no useful role in the current payout investigation flow |

The table is a project selection from tools.md, not fresh verification of vendor
versions, licensing, or availability. Before implementing a selected integration,
check its current official documentation and record the exact product/version.
Do not install services, send notifications, or deploy merely to complete this brief.

Resolve guide examples against the actual repository:

- tools.md's React examples do not require a React rewrite; the app is vanilla JS.
- Its example `APPROVAL_PENDING` notification state maps to the actual
  `AWAITING_APPROVAL` state. Do not add a second enum or infer events from UI text.
- `/api/operator/analytics` is a suggested extension, not an existing endpoint.
  If aggregate data needs it, enforce operator authorization server-side and return
  minimal sanitized fields; test exact counts and that reads have no side effects.
- Public hosting requires reviewing the current loopback server, cookie/origin
  settings, OAuth callback configuration and durable storage. A hosting logo or
  successful process start is not evidence that deployment is ready.

For anything actually shipped, record its purpose, changed files/routes, version,
license/trial constraints, repeatable verification, failure behavior and known
limitations using tools.md §14's evidence format. A useful dashboard demonstration
must show a task completed with correct data; installation or a screenshot of a
logo does not count. Stop an integration if dependency churn threatens the working
core, and document that it was deferred rather than claiming it is complete.

## State-to-action contract (do not infer state from chat text)

| Backend case state | Creator experience | Operator experience |
|---|---|---|
| OPEN / INVESTIGATING / NEEDS_INFORMATION | Explain issue, answer questions, authenticate as needed | Inspect; explain why no approval is available |
| AWAITING_AUTH | PayPal login CTA | Waiting for recipient authentication |
| DESTINATION_VERIFIED | Submit request-review reason + confirmation, or ask assistant to propose | Destination verified is not yet an approval request |
| CLAIM_ASSISTANCE | Claim the original; show provider reason accurately | Monitor; no cancellation approval just because it is UNCLAIMED |
| ESCALATED | Clear manual-review reason | No automatic approval; do not invent an override/reset endpoint |
| AWAITING_APPROVAL | Waiting for marketplace review | Approve/reject current version |
| APPROVED | Show approved destination and next actor | Attempt cancellation; fresh backend checks still apply |
| CANCELLATION_PENDING | Unresolved original; no replacement | Inspect error/refresh; demo ONLY can simulate recovery |
| RETURNED_NO_REPLACEMENT | Original returned; no replacement sent | Fallback has real replacement sending disabled |
| ORIGINAL_PAID | Original was paid | No cancellation or second payment |
| CLOSED_SIMULATED | Demo completed, explicitly simulated | Completion card; earlier simulated error collapsed as history |
| INVESTIGATION_REQUIRED | Status/evidence unavailable or unexpected | Show stale/unknown state and safe refresh; no unsafe approval |

Current completion rendering requires demo mode, CLOSED_SIMULATED, a replacement
with simulated=true, and SIMULATED_SUCCESS. Never relax this to “last button clicked”.
The completion card says no PayPal funds moved. Keep the earlier error in audit and
expandable history. It must not be hidden for real CANCELLATION_PENDING cases.

## Files and API wiring

| File | Responsibility |
|---|---|
| static/index.html | Existing DOM structure, labels and stable control IDs |
| static/style.css | Current green/neutral design, responsive layout |
| static/app.js | API requests, role/state rendering, CSRF, polling, form actions |
| rescue/app.py | Loopback HTTP handlers, same-origin checks, sessions, routes, OAuth callback |
| rescue/workflow.py | Authoritative eligibility, matching, proposals, approvals, cancellation and simulation guards |
| rescue/store.py | SQLite records, versions, auth/session state, append-only audit |
| rescue/agent.py | NVIDIA tool loop and explicitly scripted demo assistant |
| tests/test_ui.cjs | DOM-double render checks; not browser layout verification |
| tests/test_app.py, tests/test_workflow.py | HTTP/role/state/security regression coverage |

GET `/api/session` supplies user role, csrf, payment mode and AI mode. GET
`/api/cases` and `/api/cases/{id}` supply authorized state. Use JSON POST plus
X-CSRF-Token and existing session cookie for actions below:

| Suffix on `/api/cases/{id}/` | Input / boundary |
|---|---|
| message | `{message}`; recipient only; may invalidate prior approval |
| clear-conversation | `{}`; recipient only; history clears but case/audit remain |
| refresh | `{}`; reads provider state, never retries payment mutations |
| authenticate | `{}`; recipient; sandbox; returns fresh OAuth URL |
| simulate-auth | `{account: "match" or "mismatch"}`; demo only |
| request-review | `{reason, confirmed: true}`; recipient, verified match, fresh UNCLAIMED |
| approve / reject | `{version}`; operator only, stale versions rejected |
| cancel | `{}`; operator, valid approval and fresh UNCLAIMED; repeated pending request reconciles |
| simulate-recovery | `{}`; operator, demo only, valid approved cancellation-pending case |

GET `/callback` is OAuth return handling, not a user-editable identity endpoint.
Keep the original API contracts unless extending them with corresponding tests.
Every authorization/state condition remains enforced by Python, even if UI controls
are hidden or disabled. Never accept browser-supplied authoritative payer evidence.

## Do not break these guarantees

- A user may only see their own cases; operator data is not publicly accessible.
- PayPal login establishes account control, not entitlement. Existing payee records
  are fixture records; do not quietly promote them into real verified customers.
- Original payout address and expected/verified payer ID are distinct evidence.
- Human proposals and AI proposals use the same backend gates; AI prose has no
  authority. Five recipient tools remain non-payment tools.
- New recipient information/identity changes invalidate old approvals. Approval
  fingerprint and version checks stay server-side.
- No replacement while the original is claimable. Real replacement execution is
  disabled even if a sandbox item returns. Demo recovery is explicit and isolated.
- Do not reset/delete `.runtime`, credentials, audit records or case states to make
  a demo look successful. Test fresh cases in isolated temporary fixtures.
- All user/model/provider text remains text, not unsanitized innerHTML/Markdown.
- Preserve CSP, origin checks, CSRF, HttpOnly session cookies, OAuth replay protection,
  sanitized errors and no-token logging. Never send service secrets to a browser.
- Preserve auditable failure evidence; hiding raw details in an accordion is fine,
  erasing them or changing authoritative status is not.

## Verification and handoff acceptance

Run `pixi run test` (59 Python tests plus UI render checks) and `pixi lock --check`.
Update tests when DOM components change; do not delete safety assertions just to
make a new layout pass. Current tests use HTTP handlers and DOM doubles. Perform
real-browser checks in a terminal permitting local sockets; the previous agent
could not open a local socket in its restricted environment.

Check recipient/operator in separate browser profiles at http://127.0.0.1:8765.
Local passwords live in ignored `.runtime/<mode>-accounts.json`. Do not include
credentials or personal account data in screenshots or committed fixtures.

Required walkthroughs:

1. Match → explicit proposal → operator approval: no missing/unexplained buttons.
2. Claim assistance: no premature cancellation controls.
3. Third-party request / mismatched identity: escalation, no approve bypass.
4. Real sandbox pending cancellation: error visible, replacement absent, refresh safe.
5. Demo completed: completion prominent, synthetic labels visible, old error collapsed;
   expanding details and then polling should not collapse them again.
6. Clear chat: transcript clears, approval/payment state and audit survive.
7. Small viewport and keyboard-only use; no clipped critical actions.
8. AI unavailable / stale review / failed polling: helpful recovery instructions,
   no fabricated success and no hidden unsent message loss.
9. If AG Studio is added: demonstrate the concrete operator tasks and guardrails
   listed above; include a basic-case-view fallback and document trial limitations.
10. If PayPal branding is added: the official identity button still produces a fresh,
    session-bound OAuth request; a failed image load leaves a usable control.

Deliver a revised UI, passing regression checks, screenshots of both roles and
completed/pending states where browser access permits, a short list of functional
improvements, and an updated report.md. Do not claim live cancellation recovery,
production readiness or full model evaluation from appearance or mocked tests.
