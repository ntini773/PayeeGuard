# Sponsor setup and verification

UI work comes after the integrations. Current target: ClaimPal on Render, real
PayPal **sandbox** and real NVIDIA. No live PayPal environment or real replacement
endpoint is enabled. AG Studio remains for the later UI phase.

## Status (2026-11-10)

| Integration | Prepared | Still required |
|---|---|---|
| Postman | CLI 1.87.0 confirmed; local v2.1 collection and disposable fixture runner | Execute from a terminal permitting sockets |
| APIMatic | Focused adapter-review brief | Installation and actual plugin-backed review |
| Render | Blueprint, persistent runtime directory, fixed HTTPS origin, Secure cookies, hosted callback tests | Account connection, repository push, configured secrets, deployment and hosted smoke test |

This environment cannot resolve npm/Postman download hosts or bind local sockets.
Those failures are not successful sponsor verification. No Render service has
been created. Do not put provider credentials into chat or committed files.
After the user installed Postman, `pixi run test-postman` reached fixture startup
but could not bind its socket. All 24 collection requests separately passed an
in-memory replay through the real application handlers, and embedded JavaScript
passed syntax checks. Neither result substitutes for a real Postman CLI run.

## Postman

Install the CLI using [Postman's official instructions](https://learning.postman.com/docs/postman-cli/postman-cli-installation/)
(the desktop app's Help menu can install it), then:

```sh
postman -v
# Stop your local app first: the disposable server needs port 8765.
pixi run test-postman
```

The runner initializes a new temporary demo database, generates temporary accounts,
starts scripted demo mode, runs the real Postman CLI, terminates the server and
removes temporary state. Existing `.runtime` data is never used or reset.
The collection requires local demo mode and unique fixture credentials. Do not
point it at the hosted sandbox. It uses an unlinked local collection file, CLI
reporting and no Postman API key; do not upload environments or credential-bearing
reports to a workspace. See [local collection execution](https://learning.postman.com/docs/postman-cli/postman-cli-run-collection).

Coverage: anonymous/role/CSRF rejection, verified proposal, stale approval,
claimable-original replacement rejection, simulated cancellation error,
explicit simulated recovery, replay idempotency, and mismatched identity denial.
This proves application behavior with simulated PayPal, not live API availability.

## APIMatic

From the repository, using Node 18+:

```sh
npx context-plugins install paypal
```

Confirm the plugin is visible in the coding assistant you actually use; follow any
reload instructions. The [official plugin page](https://context.apimatic.io/plugins/paypal/)
lists Codex support and a development-time SDK/context workflow. Its installer can
configure multiple detected assistants: inspect the resulting changes before
committing. Do not install its tools into the recipient chatbot.

Use [the review brief](apimatic/review.md), record the installed version and actual
sources used, then run existing adapter tests after any reviewed changes. The
attempt here failed at npm DNS (`EAI_AGAIN`); no APIMatic review has passed yet.

## Render / ClaimPal

Repository target: `https://github.com/ntini773/ClaimPal`, branch `main`.
Connect Render and grant it access to this repository. `render.yaml` is at the
repository root, for a **single paid service with a 1 GB persistent disk**. Confirm
the current cost in Render before creation; no resource purchase has occurred.
[Render requires a paid service for persistent disks](https://render.com/docs/disks).
An ephemeral free filesystem would lose SQLite state, so it is not the supplied
deployment strategy. This is a hosted prototype, not a production auth platform.

Use Render's Blueprint flow after the reviewed commit is pushed. Supply:

- `RESCUE_PUBLIC_ORIGIN`: exact assigned HTTPS origin, no trailing slash or path.
- `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`: existing working **sandbox** app.
- `NVIDIA_API_KEY`: model credential, server-side only.
- `RESCUE_ITEM_ID`: existing original unclaimed payout item (no new payout needed).
- `RESCUE_EXPECTED_PAYER_ID`: existing trusted marketplace fixture payer ID.
- `RESCUE_AMOUNT` and `RESCUE_CURRENCY`: must match the original; defaults are
  `0.01` and `USD`, and must be reviewed before first startup.

Register `<RESCUE_PUBLIC_ORIGIN>/callback` in the sandbox PayPal application's
Log in with PayPal configuration. Keep the local callback if you still use it.
The same configured hosted URI is used for authorization and token exchange.

The bootstrap initializes fresh hosted storage once, and refuses to silently
replace an existing database. It does not upload your local `.runtime`. Hosted
case history begins fresh; refresh reconciles the existing provider item. Do not
use local and hosted sessions to operate on the same item concurrently: locks
are per database, not shared across deployments. If local audit continuity is
required, stop both servers and arrange a consistent SQLite backup/migration
before deployment instead of copying a live database or deleting hosted state.

Use Render's private Shell to retrieve the generated marketplace passwords:

```sh
cat /var/data/rescue/sandbox-accounts.json
```

Never publish these passwords. Keep one service instance: workflow locks are
process-local and SQLite is on one attached disk. Automatic deploys are off.
`/healthz` checks DB mode without exposing records or invoking PayPal/NVIDIA.
Render terminates HTTPS; the app binds its internal port only when an explicit
public HTTPS origin is configured. It ignores forwarded host/origin headers.
The current stdlib HTTP server remains a prototype limitation; do not market this
as a production-ready financial service. Login throttling is conservative behind
the proxy and may group clients sharing the proxy address.

Before claiming hosting works, verify health, separate creator/operator sessions,
Secure cookies, correct PayPal callback, NVIDIA response, no wrong-role access,
and state/audit persistence after a restart. Refresh the original safely; no new
cancellation or payout is required for a hosting smoke test. Document the URL,
deployed commit and results. Never display a real HTTP 500 as successful recovery.

## Why no Elastic memory

`rescue/agent.py` already uses LangChain messages and ChatNVIDIA. SQLite stores
case-scoped conversation history, identity evidence, proposals and audit records.
The model receives bounded conversation context and five non-payment tools.
Elastic would be an optional search/retrieval layer for sanitized policy or prior
cases, not the authorization layer or a requirement for conversational memory.
Neither retrieved documents nor model-generated API claims can replace current
PayPal responses or deterministic identity/approval checks.
