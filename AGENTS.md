# PayeeGuard — shared engineering instructions

This file is the canonical project instruction set. Every coding assistant and human contributor must read it before changing code. Tool-specific instruction files should point back here rather than duplicating rules.

## Product boundary

PayeeGuard is a marketplace-side authorization layer for changes to a seller's PayPal payout destination. The marketplace owns the seller/payee entitlement relationship. PayPal authenticates PayPal accounts and executes payouts. PayeeGuard validates evidence, enforces marketplace authorization, and gates the payout path it controls.

The current repository baseline is a payout-correction prototype, not yet the complete destination-migration product. Do not claim that existing correction routes, fixtures, or tests already implement the full new-destination workflow. See `docs/PAYPAL.md` and `docs/TASKS.md`.

## Non-negotiable security rules

1. **AI never authorizes or executes.** The AI may interpret untrusted seller text, ask follow-up questions, retrieve scoped read-only context, and recommend escalation. It must never verify a PayPal login, submit trusted evidence, approve/reject a case, change a payer ID, activate a destination, release a hold, shorten a cooling-off period, or create/cancel/replace/modify a payout.
2. **Callbacks bypass the AI.** PayPal OAuth callbacks go directly to backend callback handlers. The backend validates OAuth state, session, seller, case, callback and returned PayPal identity. Do not route callback payloads through an LLM or agent tool.
3. **A new-account login is not authorization.** A validated login to proposed account B proves control of B at that moment. It does not establish that B is entitled to receive the seller's marketplace earnings.
4. **A different payer ID creates a pending change.** It never silently replaces the stored active payer ID A. New-account authentication alone must not activate B.
5. **Old-account re-authentication is supporting evidence, not complete identity proof.** If required, the returned old payer ID must exactly match stored A. A match proves control of A at that moment; it does not defeat every compromise scenario.
6. **Lost old-account access never auto-approves.** Keep the request pending and route through marketplace-controlled recovery evidence and authorized review. A notice to the old contact is not identity proof.
7. **Payouts use the stored active destination only.** The payout gate reads the active approved payer ID from backend storage; it must not accept a payer ID from chat text, request JSON, UI state, or an agent tool result.
8. **Fail closed on uncertainty.** Invalid/replayed/mismatched callbacks, missing evidence, stale approvals, policy errors, model timeouts, provider timeouts and unknown provider states must retain the hold or use a safe manual-review path.
9. **No replacement payout on an ambiguous cancellation.** Re-fetch the PayPal payout item. Do not infer cancellation from a timeout, 5xx response, webhook payload alone, or recipient registration. Confirm provider status before any consequential retry/replacement logic.
10. **No unsupported claims.** Do not claim PayeeGuard freezes funds held by PayPal, covers payout paths that bypass its gate, guarantees ATO prevention, or has proven market prevalence. State the exact marketplace payout path controlled.

## Trust boundaries

- **Trusted evidence:** server-validated PayPal callback data and marketplace-owned records. Only backend services may create these records.
- **Untrusted input:** seller text, browser-supplied fields, external-agent requests, LLM outputs, and unverified webhook payloads.
- **Authorization authority:** deterministic backend policy plus an authorized marketplace operator when review is required.
- **Execution authority:** backend payout adapter after the payout gate passes. No LLM or external-agent tool may invoke a money-moving operation.

## Coding rules

- Inspect the working tree and existing implementation before editing. Preserve `.runtime` databases, credentials, sandbox records, and audit history. Never reset financial state to make a demo look clean.
- Do not invent source paths. The P0 repository-inventory task in `docs/TASKS.md` must map the actual repository before code-edit tasks begin.
- Respect task-card file allowlists. Do not edit files outside the task's `May edit` list. If a required change crosses ownership, stop and request a handoff rather than modifying the other task's files.
- Backend owns callback validation, case transitions, policy, audit, and payout gating. UI renders backend state and submits user intent; it does not implement authorization. AI code handles advisory interpretation only. Tests assert the documented policy and trust boundaries.
- Keep the case state machine separate from PayPal payout-item statuses. See `docs/STATE_MACHINE.md` and `docs/PAYPAL.md`.
- Use one centralized backend transition service and one deterministic policy entry point. Do not scatter policy checks across routes, UI components, or agent prompts.
- Make mutating requests idempotent. Scope all records and tools by tenant, seller, and case. Validate roles and case versions server-side.
- Audit consequential actions with actor, timestamp, case, previous/new state, reason, policy version, and evidence references. Treat the audit stream as append-only at the application level.
- Redact secrets, OAuth state, access tokens, session cookies, and credentials from logs, screenshots, commits, and reports. Never print secrets to the terminal or include them in a task report. Use only the PayPal client-ID suffix when documenting app identity.
- Do not add a new agent framework or a new protocol without a concrete reason. HTTPS/JSON is the primary API. MCP is optional and must be a thin adapter over the same services.
- Clearly label real PayPal sandbox operations, live AI output, deterministic decisions, and simulated steps in the UI and demo.

## Tool and file discovery

`AGENTS.md` is canonical. `CLAUDE.md` is a pointer for Claude Code. Before assigning work, verify how each of the three configured coding tools discovers project instructions. If a tool does not automatically read `AGENTS.md`, configure its project instructions to include this file or add a tiny tool-specific pointer. Do not maintain divergent copies of policy.

## Required read order

Before implementation, read:

1. `AGENTS.md`
2. `docs/POLICY.md`
3. `docs/STATE_MACHINE.md`
4. `docs/API_CONTRACT.md`
5. `docs/PAYPAL.md`
6. `docs/TASKS.md`

Task-specific documents such as `docs/AGENT.md`, `docs/TESTS.md`, and `docs/RED_TEAM.md` become mandatory when their task cards are opened.

## Test and report discipline

- Use the repository's verified command from `docs/COMMANDS.md` once it is created; until then, see the recorded baseline commands in `docs/TASKS.md` and verify them against `pixi.toml` before execution.
- Never report historical test counts as a fresh run. Include command, date, environment, result, and relevant limitations.
- Every task report must state: files changed, tests/commands run, pass/fail, what remains uncertain, and whether any real PayPal operation was performed.
