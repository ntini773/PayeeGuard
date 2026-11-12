# Verified commands

Run from `payout_rescue/`. Configuration source: `pixi.toml`.

- `pixi run test`: Python unittest discovery and Node UI DOM-double checks.
- `pixi lock --check`: check the existing lock without dependency changes.
- `pixi run python -m unittest discover -s tests -p 'test_destination*.py' -v`:
  focused destination backend tests once added.
- `pixi run python -m unittest discover -s tests -p 'test_payout_gate.py' -v`:
  focused payout gate tests once added.

Fresh pre-change baseline, 2026-11-10, local restricted Linux/Pixi environment:
64 Python tests passed; UI DOM checks passed; lock check passed. These tests use
synthetic providers and temporary databases. No real PayPal operation was performed.
The required specs currently reside in `docs/docs/`.
- `pixi run python -m unittest tests/test_investigator.py -v`: Run the investigator unit and red-team tests offline. Replace the path to run another test file.
- `pixi run evaluate-investigator`: Live NVIDIA vs rules-only comparison on the shared dataset. Arguments: `--runs 3`, `--output docs/eval/run.json`, `--rules-only` (offline, no key). Sends synthetic text to NVIDIA only; no PayPal call.

## Destination backend completion checks (2026-11-10)

- `pixi run test`: fresh run passed 162 Python tests and existing UI DOM checks.
- `pixi run python integrations/postman/run_destination.py`: user terminal passed
  31 HTTP requests / 40 assertions, zero failures. Agent socket creation is denied.
- `pixi run python -m rescue.destination_demo --directory /tmp/NEW-DEMO-DIRECTORY`:
  create a disposable seeded demo; refuses existing directories.
- `pixi run python -m rescue.backend_evaluation --output /tmp/backend-offline.json`:
  real scoped reader with offline rules transport, no external provider calls.
- `pixi run python -m rescue.configure_ai`: hidden local NVIDIA key prompt.
- `pixi run python -m rescue.backend_evaluation --live --output /tmp/backend-live.json`:
  real scoped reader and NVIDIA, synthetic cases, zero PayPal calls.

See `LOCAL_DEMO.md` for startup, provisioning, sandbox callback procedure and policy
configuration. See `BACKEND_REPORT.md` for evidence dates and outstanding gates.

User live verification, 2026-11-10 18:29:46 UTC: `pixi run diagnose-ai` passed;
`pixi run python -m rescue.backend_evaluation --live --output /tmp/payout-backend-live.json`
returned 21 available assessments, all safety invariants preserved, zero PayPal
calls. Quality limitations and the full artifact are recorded in BACKEND_REPORT.md.
- `pixi run python -m rescue.destination_admin --database DB --mode sandbox signals --tenant T --seller S --new-device-hours-ago 3 --password-reset-hours-ago 20`: Import SIMULATED marketplace security signals (hours since each event; leave a flag out for "never"). Other flags: `--country-change-hours-ago`, `--destination-change-hours-ago`. No PayPal call.
- `pixi run python -m rescue.destination_admin --database DB --mode sandbox payee ... --legal-name "Jane Doe" --country US`: Seller name and country on marketplace records. They are compared with the PayPal account's name and country.
- `cd ui && NODE_OPTIONS=--max-old-space-size=6144 npm run build`: Build the UI. AG Studio needs the larger Node heap (the default runs out of memory). Put the AG Studio trial key in `ui/.env.local` as `VITE_AG_STUDIO_LICENSE=...` (git-ignored).
- `pixi run python -m rescue.destination_admin --database <runtime>/app-sandbox.sqlite3 --mode sandbox apikey --user <external-user> --label <name>`: Create a marketplace backend API key (saved privately to `<runtime>/api-key-<label>.txt`, shown once, only a digest is stored). Add `--revoke` to revoke it. The user must have an `external` channel grant (see the `grant` command with `--channel external`).
- `PAYEEGUARD_API_KEY=pgk_... pixi run python -m rescue.mcp_server`: Start the PayeeGuard MCP server (stdio). `PAYEEGUARD_URL` can be changed (default `http://127.0.0.1:8765`). Tools only list, read, create and cancel a seller's own change requests and start a PayPal verification link. There is no approve, reject or payout tool.
- `RESCUE_DASHBOARD_MODEL` (in `.env`): Optional NVIDIA model id for the dashboard assistant and the Studio agent. Unset uses the same model as the core investigator, through a separate client.
- `RESCUE_STUDIO_MODEL` (in `.env`) plus `?studioTools=1` on the dashboard URL: Use AG Studio's own tools through a stronger NVIDIA-hosted model. Default `mistralai/mistral-large-4-1t-a52b`. Same NVIDIA key. See [`MODELS.md`](MODELS.md). The default dashboard chat uses the small-model picker.
- `pixi run python -m rescue.judge_setup --directory /tmp/payeeguard-judge --active-payer-id <id> --legal-name "<name>" --country <US>`: Create the sandbox database and the judge logins (`seller`, `seller_stolen`, `operator`) once. Passwords come from `JUDGE_SELLER_PASSWORD` and `JUDGE_OPERATOR_PASSWORD`, or are generated into `judge-accounts.json`. Safe to re-run, existing users are never changed. Add `--require-passwords` to fail instead of generating.
- `python deploy/start.py`: Render start command. Creates the judge accounts on the first start only, then serves. Needs the `JUDGE_*` variables on the first start.
- `node integrations/e2e/judge_flow.cjs genuine` (or `stolen`): End-to-end check with real PayPal sandbox logins (headless) against a server started from a `judge_setup` database on port 8765. Reads `.runtime/judge.env` and `.runtime/sandbox-paypal-accounts.json`, never prints them. Makes one 1.00 USD sandbox payout.
- `pixi run judge-setup` and `pixi run judge-serve`: Local judge flow. Setup creates the four logins (`seller`, `operator`, `seller_stolen`, `operator_stolen`) in `.runtime/judge`, reading `JUDGE_ACTIVE_PAYER_ID`, `JUDGE_SELLER_LEGAL_NAME` and `JUDGE_SELLER_COUNTRY` from the environment, and writes generated passwords to `.runtime/judge/judge-accounts.json`. Serve starts the sandbox app on port 8765.
