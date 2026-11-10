# Payout Rescue implementation report

Updated: 2026-11-10. Scope authority: `TASK.md`, with the older `PROJECT.md`
used for the backend/agent/UI phase details where consistent.

## Current outcome

**The specified identity and destination-verification fallback is implemented.**
It includes the deterministic backend, five-tool NVIDIA agent, recipient/operator
web interface, real sandbox login/status/cancellation integration, and a separate
explicitly simulated RETURNED/replacement demonstration. Changes are committed
feature by feature. The user's latest instruction authorized these phases;
earlier report entries that deferred them are historical.

The real feasibility result is unchanged: payer-ID payouts succeeded; cancellation
returned HTTP 500 and the dashboard could not retrieve data. No real replacement
is sent by this application. It does not claim working automatic recovery.

## Completed behavior

| Requirement | Implementation / evidence |
|---|---|
| Marketplace identity distinct from PayPal control | Local scrypt-password accounts, expiring server sessions, recipient case ownership checks; operator cannot authenticate on recipient's behalf |
| Existing payee/entitlement lookup | Seeded operator-provided marketplace fixtures; exact payer ID, amount/currency; fixture source visible in UI |
| PayPal authentication | Provider code exchange only; callback state bound to marketplace session and case, expires after 10 minutes and consumed once |
| Evidence comparison | Exact expected payer ID and verified-account status, including provider string `"true"` normalization; mismatch escalates |
| Proposal and operator approval | Change proposal requires recent UNCLAIMED status and sufficient match; approval bound to destination, original item, entitlement, proposal and payee record |
| Stale/changed requests | Review version checked; new recipient messages and reauthentication clear prior approval; case updates use optimistic version checks |
| Deterministic cancellation | Operator only, fresh item/amount/currency check, approval revalidation, durable CANCELLATION_PENDING before call, post-call retrieval even after errors |
| Duplicate prevention | Repeated cancel requests while pending only reconcile; simulation replacement is one per case; original feasibility runner retains persisted sender batch IDs |
| Fallback behavior | Claimable originals never get a replacement; RETURNED sandbox items stop at RETURNED_NO_REPLACEMENT; web application has no real replacement API |
| Five AI tools | get_payout_status, get_payee_record, request_paypal_authentication, compare_payee_evidence, propose_action; arguments bound to signed-in case; no payment execution tool |
| Adaptive investigation | NVIDIA bounded tool loop with conversation history; separate paths for claim guidance, destination verification, clarification and escalation; model failures displayed without fabricating a decision |
| UI | Responsive two-pane recipient conversation and operator evidence/approval console; role-specific controls, status/reason, amounts, IDs, tool calls and append-only audit |
| Tracking | Active page retrieves local state every 5 seconds and current provider status every 30 seconds; manual refresh available; no payment mutations during polling |
| Simulation labeling | Separate demo database/provider; persistent SIMULATION banner; scripted AI explicitly labeled; synthetic payment IDs and SIMULATED_SUCCESS; sandbox denies simulation endpoints |
| Audit | Every state transition and AI tool invocation/result recorded; SQL triggers deny update/delete; no claim of filesystem-level tamper resistance |

No separate redesign or implementation plan was introduced. The five-tool boundary
and cancellation-failure branch come directly from TASK.md. Polling is the allowed
webhook fallback. Sponsor services and hosting were not added.

## Verification

- **PASS:** `pixi run test` — 59 Python tests and UI render checks using a DOM double.
- **PASS:** JavaScript syntax and Python compilation checks.
- **PASS:** `pixi lock --check` — existing lock remains valid; no new dependencies.
- **PASS:** HTTP handlers tested end to end through an in-memory request/response
  transport, including login cookies, unauthorized reads, CSRF/origin checks,
  operator/recipient separation, OAuth replay/session protection and the complete
  demo verification → approval → cancellation failure → simulated recovery flow.
- **PASS:** State-machine tests cover different payees, unverified destinations,
  claimed originals, wrong amounts/items, network failures, stale approvals,
  changed trusted records, restart reconciliation and duplicate simulation.
- **PASS:** Agent tests use injected model responses to verify real orchestration,
  tool allowlisting, argument checks, truncation rejection and SDK-error redaction.
- **LIMIT:** A real browser/layout preview could not run: the agent environment
  denies `socket()` even for 127.0.0.1. HTTP tests use actual handlers without a
  listening socket; DOM-double tests are not real browser tests.
- **LIMIT:** `pixi run evaluate-agent` was attempted. The first case stopped with
  `ConnectionError`, zero tool calls and no proposal. Live model tool-use quality
  is **not yet verified**. The six-case evaluation is available for the user's
  terminal and uses only synthetic PayPal tools.
- **LIMIT:** The new web OAuth callback has handler tests; the real browser login
  was proven previously through the CLI, not yet through the new web UI.

Local fixtures for both modes have been initialized in this workspace. Sandbox
case-001 points at the user's previously tested unclaimed item. The expected
payer ID is seeded as a **test marketplace record**, not asserted to be an
independently verified real-world entitlement. Local passwords are private in
`.runtime/sandbox-accounts.json` and `.runtime/demo-accounts.json`.

## Real sandbox evidence from the feasibility milestone

| Experiment | Result |
|---|---|
| NVIDIA inference and JSON validation | User terminal PASS |
| Sandbox OAuth and Payouts access | PASS after changing app; sender US-region user-confirmed |
| Recipient PayPal login | Returned payer ID and verified_account `"true"` |
| PAYPAL_ID payout | Batch HVCBQC6NBW3PC; item 4BV5LMRQQW65J; individual retrieval SUCCESS; USD 0.01 |
| Unregistered recipient | Batch QGWGTJQCBWW8S; item U8ZN7X3NYLJAG; UNCLAIMED / RECEIVER_UNREGISTERED |
| API cancellation | HTTP 500 INTERNAL_SERVICE_ERROR; debug ID f360717bbcc19; subsequent retrieval UNCLAIMED |
| Dashboard cancellation fallback | User saw “Sorry, we couldn't retrieve your data. Please try again later.” |

The existing payout has not been cancelled during this implementation turn. No
new PayPal payout or cancellation was attempted by the implementation tests.
See [historical feasibility report](docs/feasibility_report.md) for the original
chronology, country/app diagnostics, source links and gate records.

## Run and remaining verification

Run `pixi run start`, open http://127.0.0.1:8765, and use the private local account
passwords. Sign in as creator and operator in separate browser profiles. The
[README](README.md) gives the exact recipient/operator sequence and fresh-checkout
setup. `pixi run demo` runs the isolated scripted demonstration; stop one server
before starting the other. `pixi run evaluate-agent` exercises the live NVIDIA
agent without touching real PayPal payments.

Remaining external verification is the new web flow in a browser and actual-model
evaluation from a terminal with service access. Production SSO/marketplace
records, public deployment, cryptographic audit hardening and reliable sandbox
cancellation are not claimed. The implemented fallback remains safe and explicit
about those limits.

## Missing approval button: diagnosed and fixed

The user's actual sandbox app case had matching, verified PayPal evidence and
UNCLAIMED status, but remained INVESTIGATING with no proposal. The live agent
called compare_payee_evidence and then narrated that approval was required,
without invoking propose_action. The UI correctly withheld approval controls.

The agent now explicitly requires a recorded resolution proposal before ending
an investigation. When it produces prose without one, the tool loop gives it one
bounded correction opportunity; repeated omission returns an incomplete-
investigation response rather than claiming approval readiness. Payment-handling
states remain exempt from new proposals, and all evidence/approval guards remain
in force. The operator UI now explains when no proposal exists.

Regression tests cover correction to AWAITING_APPROVAL, persistent omission, and
attempts to bypass mismatched-evidence checks. All 59 Python tests and UI render
checks pass. The user's existing case and approvals were not edited or fabricated.
Restart the app and ask the assistant to prepare the proposal to exercise the
fix against the live model. Live case evidence also demonstrates the web login
and model investigation paths were exercised; full browser/layout QA and the
six-case actual-model evaluation remain unverified here.

## Matching identity mistaken for no need to correct the destination

A subsequent real model turn called propose_action(clarify), incorrectly reasoning
that a matching expected payer ID meant the original payout destination needed
no correction. Matching the established payee and establishing access to the
original email are different checks. The prompt and tool results now make this
explicit, include the provider's original recipient type/address, and retain the
initial issue in longer conversations.

A verified recipient can also explicitly request operator review through a form
that requires a reason and confirmation of the wrong/inaccessible original
address. The backend refreshes the original payout, verifies the same ownership,
identity and status guards, and creates an unapproved destination-change proposal.
Operator approval and cancellation remain separate guarded actions. This removes
dependency on model wording for a clear human request without adding an LLM tool
or granting the model payment authority. Escalated cases cannot use this action.

All 59 Python tests plus UI component checks pass. Added tests cover explicit
review after AI clarification, missing consent, mismatched evidence, wrong actor,
claimed originals, and distinction of the original email from the expected payer
ID. Existing live case state was left untouched; restart and use the new recipient
form to submit a review request. Live-model improvement is not yet verified here.

## Conversation clearing and account distinction

Added recipient-only Clear conversation with session/CSRF/ownership checks and
the same per-case lock used for agent turns. It removes working chat history,
keeps earlier message audit events, and preserves verification, proposals,
approval and payment state. It cannot reset an unresolved cancellation. No user
conversation was cleared during implementation; the recipient controls the action.

The UI now explains RECEIVER_UNREGISTERED as the original payout email's sandbox
registration status, distinguishes it from the creator marketplace login and
separate authenticated PayPal account, and displays the original payout address.
The agent instructions and scripted guidance use the same distinction. All 59
Python tests and UI component checks pass, including audit/state preservation,
role restrictions and in-flight chat protection.

## Real web fallback exercised successfully

The user completed the browser journey through a recorded change_destination
proposal and operator approval. Read-only inspection of the current sandbox case
confirms CANCELLATION_PENDING, PayPal status UNCLAIMED, an approval bound to the
proposal/evidence, and replacement=null. The cancellation error is HTTP 500
INTERNAL_SERVICE_ERROR, debug ID `f672532e9721b`. Subsequent status polling still
reports UNCLAIMED. The proposal explanation correctly distinguishes the inaccessible
original email from the matching verified PayPal account.

This verifies the intended real sandbox failure-handling path in the new web
application. It does not establish successful cancellation or money recovery.
The earlier note that the web journey was wholly unverified is superseded by this
user run and persisted evidence. Automated real-browser/layout QA and the full
six-case NVIDIA evaluation remain outstanding. Next demonstrate the isolated
simulation branch and the claim-assistance/third-party escalation scenarios;
leave the unresolved sandbox case intact.

## Simulated recovery verified in the UI

The user completed the explicit demo recovery action. Read-only database inspection
confirms demo case-001 is CLOSED_SIMULATED, original status is simulated RETURNED,
and its single replacement is SIMULATED_SUCCESS for USD 0.01 with simulated=true.
The UI displayed the simulated cancellation failure as preceding the simulated
recovery and explicitly stated that no PayPal funds moved.

The separate sandbox case remains CANCELLATION_PENDING / UNCLAIMED with
replacement=null. The simulation did not alter the sandbox workflow or create a
real replacement. The demonstrated paths now include real sandbox failure handling
and explicitly labeled simulated recovery. The additional claim-assistance and
third-party-escalation UI scenarios and full live NVIDIA evaluation remain separate
checks; automated tests already cover their deterministic/demo behaviors.

## Completion presentation and UI handoff

Completed simulation now leads with “Demo completed” / “Completed (simulation)”,
keeps the no-funds-moved statement visible, and moves the earlier simulated HTTP
500 into collapsed history. Synthetic replacement identifiers are expandable.
Real unresolved sandbox errors remain visible and never receive this completion
label. UI checks cover completion eligibility, preservation of history and open
accordion state during polling.

Added `pixi run demo-ai` as a convenience for actual NVIDIA conversations with
simulated PayPal data. `pixi run demo` remains an explicitly scripted offline
fixture; payment mode and assistant mode remain independent.

Created [ui.md](ui.md) for the requested next-agent revamp. It documents observed
UX problems, state/action expectations, safe conversation clearing, correct PayPal
identity-button branding, and an AG Studio assessment grounded in official sponsor
and product documentation. Sponsor integration must perform useful operator tasks;
no new sponsor library or branded PayPal button was installed in this patch.
The handoff preserves API/auth/financial invariants and calls for real-browser QA.
