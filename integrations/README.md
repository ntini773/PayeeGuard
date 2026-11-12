# Sponsor setup and verification

UI work comes after the integrations. Current target: ClaimPal on Render, real
PayPal **sandbox** and real NVIDIA. No live PayPal environment or real replacement
endpoint is enabled. AG Studio remains for the later UI phase.

## Status (2026-11-11)

| Integration | Status | Evidence | Still required |
|---|---|---|---|
| PayPal (Log in with PayPal, Payouts) | **Live, sandbox** | Real two-account logins, 100 USD payouts reconciled to SUCCESS, see `docs/SANDBOX_RESULTS.md` | Nothing for the demo |
| NVIDIA | **Live** | Seller help chat and operator AI Review on `nvidia/nemotron-3.5-bolt-e4b`, `docs/EVALUATION.md` | None |
| AG Grid and AG Studio | **In the app** | AG Grid Community: operator queue and case audit trail. **AG Studio** (45-day trial, `ag-studio-react` 3.1.0): operator dashboard (KPI, column chart, donut, grid over live cases) and seller revenue dashboard (live earnings), themed per side, view-only | Custom "Earnings kept safe" widget, and the Studio Agent Framework wired to NVIDIA through our backend (`/api/v1/dashboard-llm`). Trial key lives in `ui/.env.local` (not committed) and expires 2026-12-26; production use needs a paid licence |
| Postman | **Run** | `docs/postman-run-2026-11-11.txt`: 46 requests, 62 assertions, 0 failed (real Postman CLI, real handlers, simulated PayPal, disposable DB) | None |
| OpenAPI / APIMatic | **Spec ready, import not run** | `docs/openapi.yaml`: 22 operations, local structural checks only (not an official validator) | Import into APIMatic with your account to generate SDKs and docs |
| APIMatic PayPal context plugin | **Installed (v0.4.1) and used for one review** | `docs/APIMATIC_USE.md`: review of `rescue/paypal.py` against the plugin's Python skills; one fix (app token expiry) with tests | Not an SDK integration; no claim form submitted |
| Render | **Skipped by decision** | `render.yaml` blueprint exists, nothing deployed | A paid service with a persistent disk, your account, secrets |

Hackathon rules were checked by hand on 2026-11-11 (`docs/HACKATHON_RULES_SUMMARY.md`). The APIMatic role comes from the project's `docs/archive/tools.md`
and PayPal's blog: a development-time context plugin that gives a coding agent PayPal API context. It is not a runtime component.
Confirm the exact sponsor requirements on the live Devpost page.

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
