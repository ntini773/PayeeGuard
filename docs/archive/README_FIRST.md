# PayeeGuard spec starter pack

This folder contains the six pre-coding specification files plus a short Claude Code pointer:

- `AGENTS.md` — canonical shared rules.
- `CLAUDE.md` — points Claude Code back to `AGENTS.md`.
- `docs/POLICY.md` — deterministic authorization decision table.
- `docs/STATE_MACHINE.md` — case lifecycle, separate from PayPal payout-item status.
- `docs/API_CONTRACT.md` — v1 HTTPS case API and example payloads.
- `docs/PAYPAL.md` — integration notes, historical sandbox evidence and cancellation failure.
- `docs/TASKS.md` — task cards, ownership contract and required reporting.

## Before coding

1. Copy these files to the repository root / `docs/` paths.
2. Run TASK-000 in `docs/TASKS.md` to inspect the actual repository, record the exact source paths, verify test commands, and identify the three coding tools.
3. Replace `Tool A`, `Tool B`, and `Tool C` in task ownership with the actual tool names.
4. Verify each tool's project-instruction discovery. `AGENTS.md` is canonical; `CLAUDE.md` is a pointer. Add a minimal pointer for a third tool only if it does not read the canonical file.
5. Review the policy defaults with the marketplace assumptions. Cooling-off, amount, tenure, expiry and cap thresholds are intentionally unset until confirmed. Do not invent values.
6. Only then dispatch code tasks.

## Important limitations carried into the spec

- The existing prototype was reported to have payout correction, not the complete approved destination-migration path.
- The PayPal cancellation test returned HTTP 500 and successful cancellation / `RETURNED` was not demonstrated.
- The market prevalence of fraudulent PayPal payout-destination changes is not established.
- A PayeeGuard hold applies only to payout execution paths that actually pass through its payout gate.
