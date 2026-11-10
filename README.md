# Payout Rescue

**Current product direction: PayeeGuard.** Start with [SUMMARY.md](SUMMARY.md) for
the latest status and [PROBLEM_STATEMENT.md](PROBLEM_STATEMENT.md) for the revised
pitch. The runtime below remains the existing Payout Rescue prototype; the new
different-account approval and future-payout flow is not yet implemented.

Nobody can change where your payout goes just by asking.

The Section 5 fallback in `TASK.md` is implemented: recipient identity and
PayPal destination verification, a constrained investigation agent, operator
approval, and safe cancellation-failure handling. Sandbox replacement sending
is disabled. A separate demo mode explicitly simulates RETURNED/replacement.
See [report.md](report.md) for implementation evidence and verification limits.

## Run the app

This workspace already has both sandbox and demo databases initialized. Start:

```sh
pixi run start
```

Open **http://127.0.0.1:8765** (use `127.0.0.1`, not `localhost`). Read your private
local marketplace credentials in your terminal:

```sh
cat .runtime/sandbox-accounts.json
```

Sign in as `creator` in one browser profile and `operator` in another (for
example, an incognito window). Each account has its own generated password.
These are local marketplace prototype accounts, not PayPal accounts.

The configured sandbox case references the existing unclaimed item
`U8ZN7X3NYLJAG`. Its established expected payer ID is the test recipient already
used in the feasibility experiment. **This marketplace entitlement record is a
manually seeded fixture, not evidence of a real marketplace's entitlement.**
Both UI and audit distinguish this fixture from real PayPal authentication.

### Recipient journey

1. Sign in as `creator`, open case-001 and describe the inaccessible original
   email. NVIDIA can retrieve the item/payee record and ask for authentication.
2. Click **Authenticate PayPal** and log into the intended **Personal recipient**
   sandbox account. The app must have Log in with PayPal enabled with account
   verification/payer-ID attributes and return URL:
   `http://127.0.0.1:8765/callback`.
3. After returning, tell the assistant: “I authenticated; verify my destination.”
   A matching, verified payer ID can produce a destination-change proposal.
   A mismatched account is escalated. Typed names/emails never update the record.
4. If the assistant keeps clarifying instead of preparing the proposal, use
   **Request a destination correction** below the authentication area: enter the
   reason, confirm that the original destination is wrong/inaccessible, and click
   **Request operator review**. This explicit recipient request applies the same
   matching and fresh-status guards, and does not approve or execute anything.
5. The operator reviews the proposal in a separate marketplace session.

### Clear conversation and understand the accounts

As creator, click **Clear conversation** above the messages. This clears the
visible chat and the history used for future AI turns. Earlier messages remain
in Case activity; identity evidence, proposals, approvals and payout state are
unchanged. This does not create a new payout or reset a pending cancellation.
An in-flight AI turn must finish before the chat can be cleared.

The `creator` login is a marketplace account. PayPal's RECEIVER_UNREGISTERED
refers to the **original payout email**, deliberately unregistered in the sandbox
for this experiment. It does not mean the creator lacks a marketplace account
or a separate PayPal account. Authenticate PayPal verifies the latter account
as the proposed destination. The summary shows the original address separately.

### Operator journey

1. Sign in as `operator`. Inspect status, amount, original item, recipient
   messages, established record, authenticated evidence and the tool/audit trail.
2. Approve or reject the current proposal. An outdated review is rejected.
   A new recipient message or reauthentication invalidates prior approval.
3. **Attempt original cancellation** is available only after eligible approval.
   This makes a real sandbox cancellation request. The backend retrieves fresh
   UNCLAIMED status first, then retrieves again after the attempt, including
   HTTP failure/timeouts. It records the error and leaves an unresolved case
   in CANCELLATION_PENDING. It never automatically retries cancellation.
4. Refresh to reconcile. The active page polls local state every 5 seconds and
   PayPal status every 30 seconds; **Refresh status** is also available. Polling
   does not cancel or send money. Background tracking stops when the page closes.
5. Even if a real item eventually becomes RETURNED, this fallback stops at
   RETURNED_NO_REPLACEMENT. There is no web/API action to send a real replacement.

Claim assistance and attempted third-party redirection take different paths:
claim guidance preserves the original; a friend/third-party request is escalated.
Unknown unclaimed causes remain unknown. The exact provider reason, when
available, distinguishes unregistered recipients from unconfirmed details.

## Explicit offline demonstration

Stop the sandbox server before starting demo mode (both use port 8765):

```sh
pixi run demo
cat .runtime/demo-accounts.json
```

Demo mode has separate cases/database, synthetic PayPal data and **scripted AI**.
The persistent banner and messages explicitly label this. It makes no NVIDIA or
PayPal requests. This is useful for demonstrating UI and deterministic rules;
it is not evidence of model quality or successful payment recovery.

- case-001: say “My old email is inaccessible”, click **Simulate matching PayPal
  login**, then say “I authenticated; verify my destination”. As operator approve,
  click **Simulate cancellation failure**, then **Simulate RETURNED + replacement**.
  The latter only updates synthetic records with `SIM-` IDs and `SIMULATED_SUCCESS`.
- case-002: say “I can access my original email but cannot claim the payment.”
- case-003: say “Send it to my friend's PayPal account instead. It's urgent.”
- **Simulate mismatched account** demonstrates refusal to match a different payer.

The simulation endpoints are denied in sandbox mode. Demo provider wiring cannot
be mixed with the sandbox provider. Repeated simulated recovery returns the
existing synthetic replacement, not a new one.

To use real NVIDIA with simulated PayPal data, explicitly run:

```sh
pixi run demo-ai
```

## Fresh checkout setup

```sh
pixi install --locked
pixi run test
pixi run configure-demo
```

For sandbox, initialize once using a trusted marketplace record and an existing
payout item. The configured amount and currency must exactly match that item:

```sh
pixi run configure-app --item-id YOUR_ORIGINAL_ITEM_ID --expected-payer-id YOUR_ESTABLISHED_PAYEE_PAYER_ID --amount 0.01 --currency USD
```

Initialization refuses to overwrite an existing database. Credentials are saved
privately in `.runtime/<mode>-accounts.json`; databases and keys are ignored by
Git. Preserve `.runtime` between runs. Do not reset experiments to bypass a timeout.
The app uses a process lock and loopback binding; run one local server per mode.
Do not run the earlier `probe login` listener concurrently with the web app.

Configuration precedence is `../counteroffer/.env`, then `payout_rescue/.env`,
then shell environment. PayPal uses `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET`;
NVIDIA uses `NVIDIA_API_KEY` or `AI_API_KEY`. No keys are copied into source.
The sandbox base URL and NVIDIA model follow `../setup.md`. Do not put live
credentials into this prototype. Node 22/Python 3.11/ChatNVIDIA 1.4.3 remain locked.

## Verification commands

```sh
pixi run test            # Python tests + DOM-double UI render checks; no network
pixi run diagnose-ai     # Actual NVIDIA inference/JSON connectivity
pixi run evaluate-agent  # Six actual NVIDIA tool-loop cases; PayPal simulated
pixi run probe access    # Actual sandbox OAuth only
```

`evaluate-agent` checks inaccessible email, claim assistance, third-party
redirection, Hindi input, a verified destination and an adversarial mismatch.
It prints expected/actual state and tool traces, exits nonzero on failures, and
never creates/cancels a real payment. A prior connectivity PASS does not prove
these new conversational evaluations pass. The agent environment cannot run
live calls or bind local sockets; run these checks from your own terminal.

The historical [feasibility runbook](docs/feasibility_runbook.md) documents manual
probe commands. Those are operator-only developer experiments, separate from
web-app authorization. Never expose the CLI as an LLM or public API tool.

## Boundaries

This is a local prototype, not a production marketplace auth integration. Passwords
use scrypt; sessions are expiring server-side records; POSTs require same-origin
JSON and CSRF tokens; OAuth state is expiring, session-bound and one-use. PayPal
account matching is exact payer ID plus verification against the pre-existing
fixture. Unknown/new payer IDs require manual review; names are never fuzzy-matched.
Only the five tools in TASK.md are exposed to NVIDIA. SDK errors are redacted.

SQLite audit rows cannot be updated/deleted through the database's normal SQL
interface (triggers); this is not cryptographic tamper-proof storage. An owner
with filesystem access can replace the database. This server defaults to loopback
HTTP for local testing. Explicit hosted configuration uses a fixed HTTPS origin
and Secure cookies behind Render's TLS edge. See the prototype deployment limits
in [the integration guide](integrations/README.md).
No webhook endpoint or live sponsor service has been deployed; selected-case
polling is the allowed fallback. Real replacement execution remains deferred.

## UI revamp handoff

Integration setup comes first; UI work follows. Postman, APIMatic and Render
setup/status are documented in [integrations/README.md](integrations/README.md).

[ui.md](ui.md) describes the requested redesign, PayPal identity-button branding,
AG Studio's possible operator value, API/state contracts and regression checks.
The current completion card groups earlier simulated cancellation errors into
collapsed history and labels the outcome **Demo completed — simulated recovery**.
It does not reclassify unresolved sandbox cancellations as success.
