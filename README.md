# Payout Rescue — feasibility core

Nobody can change where your payout goes just by asking.

This repository implements the **first sandbox experiments in TASK.md §5**, using
`TASK.md` over the older `PROJECT.md`. It is not yet the recovery application.
See [report.md](report.md) for verified results and remaining gates.

## Setup

```sh
pixi install --locked
pixi run test
pixi run diagnose-ai
pixi run probe access
```

Python 3.11 and ChatNVIDIA 1.4.3 follow `../setup.md`. The lock initially came
from Counteroffer's matching dependencies and was validated with `pixi lock --check`.
Node 22 is retained to match that reusable environment; this milestone has no UI.

Credentials load from `../counteroffer/.env`, then optional local `.env`, then
process environment (highest priority). Required variables: `PAYPAL_CLIENT_ID`,
`PAYPAL_CLIENT_SECRET`, and `AI_API_KEY` or `NVIDIA_API_KEY`. No secrets are copied
or committed. Both service endpoints and the NVIDIA model are fixed to the setup
values; PayPal is always sandbox, regardless of `PAYMENT_MODE`.

## Run the six gates in order

All create commands send **USD 0.01 sandbox payouts**, never real funds. Names
identify durable experiments; reuse the same name to retry an uncertain request.
Do not delete `.runtime` or choose a new name to work around a timeout. Different
names mean different payouts. The payer-ID experiment is independent of the
unclaimed experiment, not a replacement or recovery action.

1. In PayPal Developer Dashboard confirm the existing app belongs to a funded
   US Business sandbox sender and has Payouts access. `probe access` only proves
   OAuth; successful creation below proves Payouts access.
2. Choose an email you control that is **not registered in the sandbox**:

   ```sh
   pixi run probe create-email unclaimed-01 YOUR_UNREGISTERED_TEST_EMAIL
   pixi run probe batch BATCH_ID_FROM_RESPONSE
   pixi run probe item ITEM_ID_FROM_BATCH
   ```

   Poll batch/item explicitly until the item is `UNCLAIMED`. Any other status
   does not pass this gate. Do not infer a reason unless PayPal returns one.
3. Enable Log in with PayPal and the account verification / payer-ID attributes
   for this app. Register `http://127.0.0.1:8765/callback` as the return URL.
   Run locally on the machine where your browser runs:

   ```sh
   pixi run probe login
   ```

   Open the printed URL and sign into the intended sandbox recipient account.
   The listener expires after 180 seconds and checks a random single-use state.
   It stores only payer ID and verification status, never OAuth tokens or codes.
   This establishes account control, **not marketplace entitlement**.
4. Use that authenticated identity:

   ```sh
   pixi run probe create-payer payer-01
   pixi run probe batch BATCH_ID_FROM_RESPONSE
   pixi run probe item ITEM_ID_FROM_BATCH
   ```

   The gate passes only when the actual item reaches `SUCCESS`. An accepted
   batch alone is insufficient. Typed payer IDs are not accepted by this command.
5. Cancel the separate unclaimed item from step 2:

   ```sh
   pixi run probe cancel ORIGINAL_UNCLAIMED_ITEM_ID
   ```

   The tool fetches fresh state, requires `UNCLAIMED`, attempts cancellation,
   then fetches again even after a transport/HTTP error. Only observed `RETURNED`
   gives `gate_passed: true`. No replacement is created by cancellation.
6. If API cancellation fails, sign into the sender's sandbox dashboard and try
   manual cancellation for the **same item**. Record the observed result, then
   run `probe item ITEM_ID` to independently check `RETURNED`. If still claimable,
   report cancellation pending; do not send a replacement.

Responses, IDs, timestamps and request payloads are recorded in ignored, private
`.runtime/experiments.sqlite3`. Treat these as sensitive recipient data. Tokens
and credentials are excluded. HTTP failures record a status code only; their
response bodies are suppressed. The evidence table is append-only by application
convention, not a tamper-proof audit store. Keep the database between runs.

## Decision after the gates

- Payer-ID `SUCCESS` and cancellation `RETURNED`: full flow becomes feasible.
- Payer-ID succeeds but cancellation fails: identity-only demonstration; label
  any simulated returned/replacement branch explicitly.
- Payer-ID fails: investigate authenticated-email fallback before implementing it.
- Both identity and payout fail: stop building the central promise.

User approval is still required to build the application after this milestone:
marketplace authentication and payee matching, proposals and approval, guarded
replacement execution, webhooks/polling workers, agent tools, UI and hosting.
The intended agent tool surface has only the five investigation/proposal tools
in TASK.md; cancellation and replacement will not be LLM-callable tools.
