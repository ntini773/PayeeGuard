# PayeeGuard — project summary and handoff

Updated: 2026-11-10. Start here for current direction, implemented behavior and
remaining work. This is a documentation update, not a change to runtime policy.

## Product direction

**PayeeGuard helps marketplaces prevent unauthorized changes to sellers' payout
destinations.** PayPal account authentication supplies account-control evidence;
the marketplace's records and deterministic approval rules determine whether a
destination is authorized. AI assists investigation without payment authority.

The user selected this positioning to replace the broader Payout Rescue pitch.
The focus shifts from recovering an existing unclaimed payout to securing requests
to change where future seller earnings are sent. Full explanation, Alice example
and presentation pitch: [PROBLEM_STATEMENT.md](PROBLEM_STATEMENT.md).

Naming currently differs across artifacts:

- Product direction: **PayeeGuard**.
- GitHub repository: `ntini773/ClaimPal`; local branch: `main`.
- Prepared Render service name: `claimpal`.
- Existing directory, Python module and much of the UI: `payout_rescue` / `rescue`
  / Payout Rescue. No repository, deployment, database or code rename was made.

## What the prototype actually does

- Authenticated marketplace creator and operator roles, with separate sessions.
- PayPal sandbox login; server-side payer-ID and verified-account evidence.
- Exact comparison with an existing, manually seeded marketplace payee record.
- Matching evidence permits an eligible correction proposal for an existing
  unclaimed payout; an operator reviews the current version.
- A different payer ID escalates. It is not automatically accepted or treated as
  proof of fraud. There is no approved different-account migration path yet.
- Cancellation requires current evidence/approval and fresh provider checks.
  Errors reconcile status without automatically retrying or sending a replacement.
- An isolated demo can explicitly simulate RETURNED and a replacement, visibly
  labeled as simulation with no PayPal funds moved.

The existing correction flow distinguishes an inaccessible original payout email
from the established payee's authenticated PayPal account. This is different from
authorizing a genuinely new PayPal account for future earnings.

## Evidence so far

| Check | Observed result | Limit |
|---|---|---|
| AI connectivity / JSON validation | User's NVIDIA diagnostic passed | Not full conversational-quality evaluation |
| PayPal account authentication | Payer ID and verified-account evidence returned | Account control does not prove marketplace entitlement |
| PAYPAL_ID payout | Independent USD 0.01 sandbox payout reached SUCCESS | Not a recovered/replacement payout |
| Unregistered email payout | UNCLAIMED / RECEIVER_UNREGISTERED | Original address issue, not absence of a marketplace user |
| Actual cancellation | HTTP 500 INTERNAL_SERVICE_ERROR; original remained UNCLAIMED | Successful cancellation/RETURNED has not been demonstrated |
| Web approval and failure handling | User completed proposal → approval → failed cancellation; no replacement | Correct safe failure, not money recovery |
| Simulated recovery | CLOSED_SIMULATED / SIMULATED_SUCCESS | Isolated synthetic records; no PayPal funds moved |
| Automated checks | 62 Python tests + UI checks passed; 2 bootstrap tests passed separately | 64 Python tests total; UI checks use DOM doubles, not browser layout QA |
| Postman collection | 24 requests replayed through actual HTTP handlers; JS syntax checked | Real Postman run blocked at local socket startup |

These are last recorded observations, not fresh provider status checks. See
[report.md](report.md) for details; consult current provider state before action.

## Architecture and security boundaries

Python backend, SQLite case/auth/audit storage and vanilla JavaScript UI. The agent
already uses LangChain messages and NVIDIA's ChatNVIDIA integration. Conversation
history is case-scoped and bounded when sent to the model. Elastic is not required
for memory or API validation; it remains an optional future retrieval component.

Five agent tools: `get_payout_status`, `get_payee_record`,
`request_paypal_authentication`, `compare_payee_evidence`, `propose_action`.
No AI cancellation, payout execution or arbitrary-destination tool exists.

Preserve role/ownership checks, CSRF, exact payer matching, session-bound one-use
OAuth state, approval versions/fingerprints, fresh status checks, redacted errors,
append-only audit and separation of simulation from sandbox. The established
payee record is a fixture, not a real marketplace entitlement integration.
Real replacement execution is disabled even when a real original returns.

## Gaps between the new pitch and the existing build

| New product capability | Current position |
|---|---|
| Recognize a different authenticated destination | Match/mismatch comparison exists; mismatch escalates |
| Independently verify a legitimate different-account change | Evidence policy and workflow still need definition and implementation |
| Approve and store a new registered destination | Not implemented; do not repurpose existing correction approval without redesigning this policy |
| Enforce the approved destination on future payouts | No payout-scheduler integration exists |
| Hold marketplace earnings | Not implemented; blocking a request is not holding funds |
| Detect account takeover reliably | No validated fraud detector; AI warning signs are advisory |

Do not describe the entire new flow as completed. Preserve existing safety gates
while defining the additional verification and destination-update branch.

## Integrations and hosting

The user requested **integrations first, UI last**.

- **Postman:** CLI 1.87.0 confirmed. Collection and temporary fixture runner ready.
  Run `pixi run test-postman` in a terminal permitting sockets, with port 8765 free.
- **APIMatic:** development-time PayPal API review selected. Installer attempt
  failed on npm DNS; plugin-backed review has not been verified. Review brief:
  [integrations/apimatic/review.md](integrations/apimatic/review.md).
- **Render:** user chose dashboard deployment and reported granting GitHub access.
  Blueprint targets PayPal sandbox + real NVIDIA, a single service and persistent
  SQLite disk. Hosting code includes an explicit HTTPS origin, Secure cookies,
  matching OAuth callback and health check. No successful deployment is recorded.
- **Hosting blocker:** Render requested payment information. User has hackathon
  credits but lacks a US-issued card; US issuance is not itself a stated requirement.
  Credit redemption/card acceptance or a sponsor exception remains unresolved.
  Prior estimate: $7.25/month base before tax/overages, with credit expiry to verify;
  confirm the dashboard price rather than treating this note as a billing guarantee.
- **GitHub:** remote and `main` are configured locally. The agent's push failed on
  DNS; a successful user push has not been confirmed in this conversation.
- **AG Studio:** selected for later useful operator analytics; not installed.
  PayPal identity-button presentation and the wider UI revamp are deferred.
- **Other sponsors:** no Elastic, Zapier, Bryntum, KERNEL, Astropods or Channel3
  implementation. Add only for a demonstrated product need.

The agent environment cannot bind local sockets or resolve service/package hosts.
Do not mistake these environment failures for failures of the user's working app.
Setup and deployment limits: [integrations/README.md](integrations/README.md).

## Commands and data to preserve

| Command | Behavior |
|---|---|
| `pixi run start` | Real PayPal sandbox + NVIDIA |
| `pixi run demo` | Isolated simulated PayPal + scripted assistant |
| `pixi run demo-ai` | Isolated simulated PayPal + real NVIDIA |
| `pixi run test` | Python regression and DOM-double UI checks |
| `pixi run test-postman` | Disposable offline fixture + real Postman CLI |
| `pixi run evaluate-agent` | Six real NVIDIA scenarios with simulated PayPal |

Preserve ignored `.runtime` databases, generated credentials and existing audit
records. Never commit secrets or reset cases to obtain a successful demonstration.
Clear conversation only clears working chat; it does not reset financial state.

## Document map and next work

- [PROBLEM_STATEMENT.md](PROBLEM_STATEMENT.md): latest user-selected positioning.
- This summary: current facts, gaps and handoff baseline.
- [README.md](README.md): local operation and demonstrations.
- [report.md](report.md): implementation history and verification evidence.
- [TASK.md](TASK.md): earlier scope and cancellation-failure fallback; its existing
  safety rules remain relevant, but it does not specify the new account-change branch.
- [PROJECT.md](PROJECT.md): older proposal, not current implementation authority.
- [tools.md](tools.md): sponsor candidates, not a list of installed tools.
- [ui.md](ui.md): later UI handoff; revise its journeys against the new policy before
  implementing the PayeeGuard redesign.

Next: define independent evidence for legitimate destination changes; update the
task specification with that policy and acceptance cases; complete sponsor testing
and resolve hosting; implement any approved backend changes; then revamp the UI.
No new implementation branch has been authorized or silently introduced by this
documentation update.
