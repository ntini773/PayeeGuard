# Historical feasibility milestone

This record predates the subsequently authorized application build. See the
[current report](../report.md) for current scope and verification.

# Payout Rescue core feasibility report

Date: 2026-11-10

## Outcome

**Experiment tooling is built and locally tested. The user's terminal has now
passed NVIDIA inference, PayPal OAuth, recipient login and an authenticated
payer-ID payout reaching SUCCESS. A separate payout reached UNCLAIMED, but
API cancellation returned HTTP 500 and the last retrieved item is UNCLAIMED.
The dashboard fallback also failed to retrieve the payment data.**

**Decision: conditional GO for a future identity/destination-verification flow;
NO-GO for claiming working automatic cancellation and recovery today.** The
requested feasibility milestone is complete with these mixed results. Further
application development awaits the user's instruction.
The user confirmed the existing sandbox app is configured and may
be used. Payouts access is demonstrated by the successful transaction; sender country
is user-confirmed, not independently inspected in the dashboard.

`TASK.md` supersedes `PROJECT.md`. Its final instruction is to prove payer-ID
payouts and cancellation before building the rest. This milestone therefore
contains a standalone Pixi project, small sandbox client, interactive PayPal
login experiment, persistent payout experiment runner, NVIDIA connectivity
check, initial tests and runbook. The recovery application has not been built.

## Verification evidence

| Requirement | Observed evidence | Result |
|---|---|---|
| Pixi setup following setup.md | `pixi install --locked`; `pixi lock --check`; `pixi run python --version` = Python 3.11.18 | PASS |
| NVIDIA setup using existing private key | User supplied terminal output: `AI inference and JSON validation: PASS` | PASS in user's terminal |
| Initial tests | `pixi run test`: 17 tests passed | PASS, mocked network only |
| Durable request identity | Restart-after-timeout test compares identical payloads; completed request not resent | PASS locally |
| Cancel safety | Tests cover non-UNCLAIMED denial, cancel timeout, pending result, failed recheck, and returned confirmation | PASS locally |
| PayPal identity scope handling | Mock tests and user-provided login output containing payer ID and verification status | PASS locally and in user terminal |
| Feature commits | Separate scaffold, probes/tests, environment lock, and documentation commits | Implemented |

The environment initially denied writes to the shared Pixi cache. Using a
writable `/tmp/payout-rescue-pixi-cache` and copies of existing package caches
allowed a real isolated Pixi installation. The manifest and existing compatible lock were checked without a
network solve. No environment symlink or fake installation was substituted.

## TASK.md §5 gate results

| Gate | Evidence / blocker | Status |
|---|---|---|
| 1. US Business sender and Payouts access | User confirms US sender; OAuth passed and PayPal accepted batch HVCBQC6NBW3PC | API access PASS; country user-confirmed |
| 2. Real unregistered-recipient UNCLAIMED payout | Item U8ZN7X3NYLJAG in batch QGWGTJQCBWW8S is UNCLAIMED with RECEIVER_UNREGISTERED | PASS |
| 3. Login returns payer ID and account verification | User supplied login output with payer ID and verified_account string "true" | PASS in user terminal |
| 4. Authenticated PAYPAL_ID payout reaches SUCCESS | Batch HVCBQC6NBW3PC and separate item retrieval for 4BV5LMRQQW65J both show item SUCCESS, recipient_type PAYPAL_ID, USD 0.01 | PASS in user terminal |
| 5. Separate unclaimed payout cancellation reaches RETURNED | HTTP 500 INTERNAL_SERVICE_ERROR; subsequent retrieval still UNCLAIMED | FAILED attempt; RETURNED unproven |
| 6. Dashboard fallback if API cancellation fails | User attempted sender dashboard cancellation; dashboard could not retrieve data | Attempted; unavailable in this test |

Earlier calls from the agent environment failed on network access. Subsequent
user-terminal results above supersede those failures for the demonstrated gates. Errors were redacted; keys were neither
printed nor copied. This does not establish invalid credentials or failed
PayPal product feasibility. Do not treat unit-test fixtures as sandbox evidence.

## What the core enforces

- Only fixed sandbox URLs and USD 0.01 experimental payouts.
- A persisted sender batch ID before each create request; same payload on retry.
- Changed destinations rejected for an existing experiment name.
- Uncertain requests older than 28 days require manual reconciliation instead
  of relying on PayPal's 30-day duplicate window.
- Fresh UNCLAIMED state before cancellation and a separate retrieval afterward.
- Cancellation never automatically creates a payout.
- Login identity records only payer ID and verification status. Login is not
  entitlement, name matching, or marketplace approval.
- The NVIDIA check has no payment tools and sends no recipient data.

These are experiment-level checks. There is no claim of production-grade
concurrency control, tamper-proof audit, marketplace identity matching or
case-level recovery idempotency. The user's real login and payout results verify
the exercised integration paths; API cancellation has failed in the observed attempt.

## Next action and stop boundary

The feasibility experiments have produced a decision under TASK.md §5: payer-ID
payouts work, but neither cancellation route succeeded in this test. Keep item
`U8ZN7X3NYLJAG` unresolved; its last authoritative status is UNCLAIMED. Do not
create a replacement unless a fresh retrieval confirms RETURNED and the future
approval/policy workflow permits it.

Optional provider follow-up: report cancellation HTTP 500 INTERNAL_SERVICE_ERROR,
debug ID `f360717bbcc19`, item `U8ZN7X3NYLJAG`, batch `QGWGTJQCBWW8S`, and the
sandbox dashboard retrieval failure to PayPal technical support. A later
`pixi run probe item U8ZN7X3NYLJAG` can check for a changed status without mutation.

If the user authorizes the next build, TASK.md supports identity and destination
verification with the cancellation failure demonstrated honestly. Any simulated
RETURNED/replacement branch must be explicitly labeled. UI, agent framework,
marketplace identity/payee matching, approvals, recovery execution, webhooks,
sponsor integrations and hosting remain deferred under the current instruction.

## Documentation checked

Official sources inspected on 2026-11-10:

- [Payouts API](https://developer.paypal.com/api/payments.payouts-batch/v1): create, batch/item retrieval and cancellation routes.
- [Login integration](https://developer.paypal.com/log-in/build): app configuration and authorization-code exchange.
- [Login scopes](https://developer.paypal.com/log-in/references/): account verification and payer-ID scope.
- [Identity API](https://developer.paypal.com/api/identity/v1/userinfo-get): userinfo endpoint.

Documentation supports the proposed integration, but is not evidence that this
app's payer-ID payout or cancellation succeeds in sandbox.

## Follow-up verification

A subsequent `pixi run probe access` again failed with a transport error, and
`pixi run diagnose-ai` again failed with a connection error. No live gate has
advanced. Review of the login probe added explicit rejection of HTTP redirects
(to keep Authorization headers on the configured service), duplicate callback
parameters, empty codes, error callbacks and mismatched Unicode state values.
The expanded suite passes all 14 tests. These checks do not replace the pending
browser login and actual sandbox transaction tests.

## Payout authorization diagnostic

The user completed recipient login, then the authenticated payer-ID creation
request received HTTP 403. This proves the service was reachable, but does not
establish the precise refusal reason or disprove payer-ID compatibility. The
client now exposes only validated error-name and debug-ID fields, while keeping
messages, recipient details and tokens suppressed. All 17 tests pass, including
redaction and malformed-body checks. Retry `pixi run probe create-payer payer-01`
to collect the error name using the same persisted sender batch ID.

## Identified payout refusal

The user retried the same experiment and received HTTP 403 with error name
`PAYOUT_NOT_AVAILABLE` (debug ID `f914693cee821`). Sender-country eligibility is
the leading diagnosis, pending inspection of the app-linked sender account.
PayPal's official country table lists India as receive-and-withdraw only, which
does not permit sending payouts. Inspect the linked account country; if needed,
create a United States Business sandbox account and a Merchant app linked to it.
Store new app credentials in ignored `payout_rescue/.env`. Configure login on that app and authenticate the same recipient again
before retrying the existing experiment. Do not delete prior experiment evidence.
If the sender is already US Business, use the debug ID with PayPal support to
investigate account eligibility rather than assuming the country is wrong.

Sources: https://developer.paypal.com/payouts/supported-features/ and
https://developer.paypal.com/sandbox-testing/accounts (checked 2026-11-10).

## Retry with project-specific app

The user authenticated the same recipient again and received another
`PAYOUT_NOT_AVAILABLE` refusal, debug ID `f718292bd6c36`. A read-only configuration
inspection found `payout_rescue/.env` present, with an effective client-ID suffix
matching the user's latest login URL.
No PayPal shell overrides were present in the agent process. This confirms the
project-specific app is selected locally; it does not establish the country or
Payouts eligibility of that app's linked Business account. Next inspect that exact
app's linked sender in Developer Dashboard. If confirmed US Business, investigate
Payouts enablement with PayPal support using the debug ID. Recipient login is
already working and need not be repeated while the app stays unchanged.

The user subsequently confirmed that the app-linked sender is US-region. The
country hypothesis is therefore not established as the cause of this refusal.
The next check is Payouts availability/enablement for that sandbox app and sender;
if enabled, PayPal technical support must trace debug ID `f718292bd6c36`. No
further account recreation or recipient login is indicated by current evidence.

The user reports the same refusal after the feature-check guidance. Exact
Payouts feature status has not been supplied, so app configuration versus
PayPal-side provisioning remains unresolved. Repeated creation attempts have
not advanced the gate. Next action: ask PayPal technical support to trace the
sandbox request using the debug ID, app-linked sandbox sender and request time.
Do not submit secrets or access tokens. Preserve the existing experiment and
resume its verification after account eligibility is resolved. No payout,
cancellation, or full recovery success is claimed.

## Payer-ID payout accepted after app change

The user's latest login used a different app (client-ID suffix `meTHlUjs`) and
returned the same recipient payer ID. Retrying `create-payer payer-01` then
returned batch `HVCBQC6NBW3PC`, status `PENDING`, using the existing sender batch
ID. This supersedes the earlier access blocker for the currently selected app.
It proves batch acceptance, not completed payment. Retrieve the batch, then its
item, and require item `SUCCESS` to pass gate 4. The exact configuration difference
behind the previous country refusal has not been independently established.

## Payer-ID gate passed

The user supplied both batch and individual-item retrieval responses. Item
`4BV5LMRQQW65J` in batch `HVCBQC6NBW3PC` has `transaction_status: SUCCESS`,
`recipient_type: PAYPAL_ID`, and USD 0.01 sent to the same payer ID obtained
through login. PayPal reports processing at `2026-11-10T00:52:42Z` and batch
completion at `2026-11-10T00:52:49Z`. The reported sandbox fee is USD 0.25.
This is actual provider output supplied by the user, not a mocked test result.

Next create a separate USD 0.01 experiment addressed to an email controlled by
the tester that is not registered in the PayPal sandbox. Verify UNCLAIMED before
attempting cancellation and independently confirm RETURNED afterward. Do not
attempt to cancel the successful payer-ID item. Keep the application build
on hold until the cancellation experiment establishes the supported scope.

## Unclaimed gate passed; cancellation API failed

The user's separate email experiment created batch `QGWGTJQCBWW8S`, item
`U8ZN7X3NYLJAG`, USD 0.01. The actual item reports `UNCLAIMED` and
`RECEIVER_UNREGISTERED`. The cancel command returned `gate_passed: false` and a
fresh UNCLAIMED item. Read-only inspection of the local experiment database
found the cancellation error: HTTP 500 `INTERNAL_SERVICE_ERROR`, debug ID
`f360717bbcc19`. The error was previously saved but omitted from the displayed
result. The probe now includes its redacted `cancellation_error`; all 17 tests
pass, including updated assertions covering that field.

No replacement was created by the cancel command. The original remains claimable.
TASK.md's next experiment is manual cancellation in the sandbox sender dashboard,
followed by `pixi run probe item U8ZN7X3NYLJAG`. If no Cancel control exists or it
fails, record that limitation. The current evidence supports authenticated
identity/payer-ID payout feasibility, but not automatic cancellation/recovery.

## Dashboard fallback result and milestone closeout

The user attempted cancellation through the sender sandbox dashboard and received:
"Sorry, we couldn't retrieve your data. Please try again later."
This establishes that manual cancellation was unavailable in the observed test;
it does not prove a permanent PayPal outage or that manual cancellation can never
work. No RETURNED status has been observed, and no replacement has been created
by this harness. The independent successful payer-ID experiment is not a recovery
replacement.

Delivered: isolated Pixi setup and validated lock, NVIDIA setup using the existing
private key, sandbox OAuth and identity/payout/cancel experiment tooling, durable
experiment IDs and saved evidence, 17 passing initial tests, feature-by-feature
commits, runbook and this report. All six feasibility experiments now have
observed outcomes (four successful, API cancellation failed, dashboard fallback
unavailable). The user-terminal evidence supplies the live results because the
agent environment's network is restricted. Experiment order differed from the
suggested list: recipient login and payer-ID payout were exercised before the
unregistered-recipient payout. The latter remained a separate cancellation item.
The requested stop boundary is preserved; no subsequent application phase was built.
