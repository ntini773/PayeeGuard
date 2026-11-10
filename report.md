# Payout Rescue core feasibility report

Date: 2026-11-10

## Outcome

**Experiment tooling is built and locally tested. Live feasibility remains
unproven because outbound service connections are blocked in this environment.**
No successful payout creation, recipient login, cancellation, or AI inference
is claimed. The user confirmed the existing sandbox app is configured and may
be used. Its server-side permissions and country have not been independently
verified here.

`TASK.md` supersedes `PROJECT.md`. Its final instruction is to prove payer-ID
payouts and cancellation before building the rest. This milestone therefore
contains a standalone Pixi project, small sandbox client, interactive PayPal
login experiment, persistent payout experiment runner, NVIDIA connectivity
check, initial tests and runbook. The recovery application has not been built.

## Verification evidence

| Requirement | Observed evidence | Result |
|---|---|---|
| Pixi setup following setup.md | `pixi install --locked`; `pixi lock --check`; `pixi run python --version` = Python 3.11.18 | PASS |
| NVIDIA setup using existing private key | ChatNVIDIA 1.4.3, explicit model registration, 4096 tokens, validated final JSON; attempted actual inference | Configured; connection failed |
| Initial tests | `pixi run test`: 11 tests passed | PASS, mocked network only |
| Durable request identity | Restart-after-timeout test compares identical payloads; completed request not resent | PASS locally |
| Cancel safety | Tests cover non-UNCLAIMED denial, cancel timeout, pending result, failed recheck, and returned confirmation | PASS locally |
| PayPal identity scope handling | Mock test requires payer ID and verification attribute; tokens excluded from stored identity | PASS locally; browser flow unverified |
| Feature commits | Separate scaffold, probes/tests, environment lock, and documentation commits | Implemented |

The environment initially denied writes to the shared Pixi cache. Using a
writable `/tmp/payout-rescue-pixi-cache` and copies of existing package caches
allowed a real isolated Pixi installation. The manifest uses the same dependency
set as Counteroffer so its existing lock can be reused and checked without a
network solve. No environment symlink or fake installation was substituted.

## TASK.md §5 gate results

| Gate | Evidence / blocker | Status |
|---|---|---|
| 1. US Business sender and Payouts access | User confirms app setup. Actual OAuth probe reports transport failure; OAuth alone would not prove Payouts access | UNVERIFIED |
| 2. Real unregistered-recipient UNCLAIMED payout | No successful API connection; no chosen unregistered test destination | NOT RUN |
| 3. Login returns payer ID and account verification | Interactive state-checked loopback login implemented; requires recipient browser login | NOT RUN |
| 4. Authenticated PAYPAL_ID payout reaches SUCCESS | Creation uses identity returned by gate 3; no authenticated identity yet | NOT RUN |
| 5. Separate unclaimed payout cancellation reaches RETURNED | Cancellation runner implemented; no live unclaimed item available | NOT RUN |
| 6. Dashboard fallback if API cancellation fails | Requires sandbox sender browser session; no actual cancellation failure tested yet | NOT RUN / conditional |

The attempted PayPal call failed before any payout mutation. The attempted AI
call returned a connection error. Errors were redacted; keys were neither
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
case-level recovery idempotency. The login handler's real callback behavior and
SDK/provider interoperability still need live verification.

## Next action and stop boundary

Follow [README.md](README.md) from a terminal with service access, using the
existing sandbox app. Choose an unregistered test email, complete recipient
login, and save observed item status transitions. Update this report with the
actual gate results. Then apply TASK.md's go/no-go matrix before requesting any
further application build. UI, agent framework, payee database, approvals,
replacement workflow, webhooks, sponsor integrations and hosting remain deferred.

## Documentation checked

Official sources inspected on 2026-11-10:

- [Payouts API](https://developer.paypal.com/api/payments.payouts-batch/v1): create, batch/item retrieval and cancellation routes.
- [Login integration](https://developer.paypal.com/log-in/build): app configuration and authorization-code exchange.
- [Login scopes](https://developer.paypal.com/log-in/references/): account verification and payer-ID scope.
- [Identity API](https://developer.paypal.com/api/identity/v1/userinfo-get): userinfo endpoint.

Documentation supports the proposed integration, but is not evidence that this
app's payer-ID payout or cancellation succeeds in sandbox.
