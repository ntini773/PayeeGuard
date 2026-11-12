# Local backend setup and verification

Run from `prototypes/payout_rescue`. No deployment is required for these steps.
This is the local fallback for optional TASK-074. The new operator UI still needs
its owner's real-API adapter and TASK-073 browser test; these instructions do not
claim the current mock UI is connected.

## Install and test

```bash
pixi install --locked
pixi run test
```

Python 3.11, Node 22 and ChatNVIDIA 1.4.3 are pinned. See [setup](../setup.md).
Keys are loaded only from this project's `.env` and then the shell environment.
Never copy private configuration into the repository or a public report.

## Disposable destination demo

Choose a directory that does not already exist:

```bash
pixi run python -m rescue.destination_demo --directory /tmp/payout-rescue-demo-20261110
pixi run python -m rescue.app serve --mode demo --ai fixture --runtime-dir /tmp/payout-rescue-demo-20261110
```

Open `http://127.0.0.1:8765`. Credentials are in the private
`/tmp/payout-rescue-demo-20261110/demo-accounts.json`; view them locally, not in chat.
The seed refuses to overwrite any existing directory. Stop the server with Ctrl-C;
restart with the same serve command to preserve the database and payout history.
Do not rerun the seed to reset a financial state.

The seed contains:

- `creator`: can request changes for the demo seller.
- `staff`: authenticated, but cannot manage payout destinations.
- `operator`: can review that seller and execute its stored earnings.
- `external`: can request changes, but cannot review or execute payments.
- One pending change with **simulated** new-account evidence, A still active and B
  held pending old-account authentication/recovery and marketplace review.
- One stored USD 0.01 earning. Executing it in demo mode produces a simulated
  provider receipt, never a PayPal request.

The currently served static page is the legacy console. Its login establishes the
same session used by the new API. After signing in, the following browser URLs
show the actual new backend data:

- `/api/v1/destination-change-requests` — scoped queue.
- `/api/v1/marketplace-payouts` — scoped stored earnings and execution receipts.
- `/api/v1/destination-change-requests/CASE_ID/summary`
- `/api/v1/destination-change-requests/CASE_ID/events`

Use the actual ID returned by the queue. Read the UI adaptation contract in
[BACKEND_REPORT.md](BACKEND_REPORT.md); flipping the existing mock flag alone is
not sufficient because its current types and response mapping differ.

## Repeatable HTTP demonstration

Stop other listeners on port 8765, then run:

```bash
pixi run python integrations/postman/run_destination.py
```

This creates and deletes its own temporary fixture database. It exercises the
real HTTP handlers and gate with simulated provider calls: scope, permissions,
missing evidence, idempotency, destination injection rejection, and a compromise
payout hold. It does not use your `.runtime` data or make PayPal/NVIDIA calls.
Postman CLI must be on PATH. The user reported **31 requests, 40 assertions,
zero failures** on 2026-11-10. The restricted agent environment cannot create
sockets, so that successful network run is user-supplied evidence.

## NVIDIA through the real reader

```bash
pixi run python -m rescue.configure_ai
pixi run diagnose-ai
pixi run python -m rescue.backend_evaluation --live --output /tmp/payout-backend-live.json
```

The first command prompts with hidden input, saves `NVIDIA_API_KEY` in `.env` with
mode 0600, and preserves PayPal settings. Do not paste the key into chat. The live
evaluation sends only synthetic dataset text to NVIDIA and uses real temporary
case storage and `BackendCaseReader`; it makes zero PayPal calls.

Offline integration check (no model-quality claim):

```bash
pixi run python -m rescue.backend_evaluation --output /tmp/payout-backend-offline.json
```

An unavailable model can pass the safety invariant by retaining the hold. It is
still a failed live-inference check; inspect `unavailable` as well as `safety_passed`.

## Sandbox destination workflow (interactive verification still required)

Use the existing initialized `.runtime/app-sandbox.sqlite3`; preserve its records.
For a new legacy app database, follow `pixi run configure-app --help` and provide
real sandbox fixture values from the established marketplace record, not invented
PayPal IDs. No legacy user automatically gains new destination permissions.

Provision explicitly using trusted marketplace data (replace uppercase arguments):

```bash
pixi run python -m rescue.destination_admin --database .runtime/app-sandbox.sqlite3 --mode sandbox grant --user creator --tenant MARKETPLACE --seller SELLER --manage
pixi run python -m rescue.destination_admin --database .runtime/app-sandbox.sqlite3 --mode sandbox grant --user operator --tenant MARKETPLACE --seller SELLER --review
pixi run python -m rescue.destination_admin --database .runtime/app-sandbox.sqlite3 --mode sandbox payee --tenant MARKETPLACE --seller SELLER --active-payer-id ESTABLISHED_A --cap 0.01 --currency USD
pixi run start
```

Payee insertion refuses to replace an existing entitlement. These are backend
provisioning operations, not seller-verifiable claims. For hosted HTTPS, export
`RESCUE_PUBLIC_ORIGIN=https://YOUR_HOST` before starting; a trusted TLS proxy must
terminate HTTPS. The application itself serves HTTP behind that proxy.

Register the exact callback URL on the matching PayPal sandbox app:
`YOUR_ORIGIN/api/v1/paypal/callback` (local origin is `http://127.0.0.1:8765`).
Both new and old logins use this fixed URL; their purpose/case/session bindings
are stored server-side. Use the configured app's allowed redirect settings.

Authenticated browser/API steps:

1. Sign in as the seller, obtain CSRF from `GET /api/session`, then create a
   destination request with `Idempotency-Key` and `reason_text`.
2. POST `{}` to `/api/v1/destination-change-requests/CASE_ID/auth/NEW` with
   `X-CSRF-Token`; open the returned `authorization_url` in the same browser
   session. Authenticate sandbox B. This must leave A active and B pending.
3. Repeat with `/auth/OLD`, authenticating stored A. A mismatch must not approve.
   Lost access uses `/recovery` with a `reason_text` claim instead.
4. Record actual marketplace evidence using the trusted console, never chat:

   ```bash
   pixi run python -m rescue.destination_admin --database .runtime/app-sandbox.sqlite3 --mode sandbox evidence --user operator --case CASE_ID --kind SELLER_ENTITLEMENT --reference RECORD_ID --reason 'Marketplace record reviewed' --accepted --version CURRENT_VERSION
   ```

   Recovery requires `ACCOUNT_RECOVERY` evidence. The console prompts for the
   marketplace password privately. Evidence must reflect an actual review.
5. The operator POSTs a reasoned, versioned `/review`. Approval starts cooling;
   status refresh and the payout gate recheck the backend deadline and policy.
   There is no sandbox timer-override HTTP endpoint.
6. The marketplace ledger must provision a legitimate earning through
   `MarketplacePayouts.provision`. Only then can the operator execute its stored
   ID at `/api/v1/marketplace-payouts/EARNING_ID/execute` with body `{}` and CSRF.
   **Sandbox mode invokes PayPal.** This work has not executed that live path.
   Retrying the same earning retains the same operation, including uncertainty.

Record callback outcomes and masked A/B evidence without tokens, codes or keys.
Real new/old callbacks and a gated sandbox payout remain unverified for this new
workflow; historical payout feasibility is not a substitute.

## Environment variable names

PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, NVIDIA_API_KEY, AI_API_KEY,
RESCUE_PUBLIC_ORIGIN, RESCUE_RUNTIME_DIR, RESCUE_COOLING_SECONDS,
RESCUE_RECOVERY_SECONDS, RESCUE_REQUEST_SECONDS, RESCUE_OAUTH_SECONDS,
RESCUE_COMPROMISE_POLICY, PORT. Secret values are never documentation content.
