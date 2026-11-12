# Investigation agent (TASK-050)

**Status:** implemented as new modules; not yet wired to the HTTPS API (TASK-060 owner decides the wiring).

## Purpose and authority

The investigator reads one case and seller text. It returns an advisory `ai_assessment`.
It has **no** authority. It cannot verify PayPal accounts, approve, reject, activate, release holds,
shorten cooling-off, change a payer ID, or create/cancel payouts. No tool for these exists.

## Files

| File | Role |
|---|---|
| `rescue/investigator_schema.py` | Strict output schema, fail-closed `unavailable()`, non-weakening rule |
| `rescue/investigator.py` | Read-only tools, system prompt, bounded orchestration `investigate()` |
| `rescue/investigator_eval.py` | Live NVIDIA red-team evaluation (synthetic case) |
| `rescue/investigator_dataset.py`, `rescue/investigator_rules.py` | Shared red-team dataset and the rules-only baseline |
| `tests/test_investigator.py` | Offline unit, safety and red-team tests (scripted models) |
| `tests/investigator_reader_contract.py` | Reusable contract any real `CaseReader` must pass |

The legacy `rescue/agent.py` (payout-correction assistant) is unchanged.

## Tools (all read-only, no arguments)

`get_case_status`, `get_seller_claims`, `get_missing_evidence`. Scope (tenant, seller, case) is fixed
by the backend `CaseReader` the caller passes in. A tool call with any argument, or any other
name (for example `create_payout`), is denied and recorded in `denied_tool_calls`.
Raw payer IDs, tokens, OAuth state and secret-like keys are scrubbed before the model sees them.
Seller text is delimited and labelled `UNTRUSTED_SELLER_CLAIMS`; backend data is labelled `BACKEND_VERIFIED`.

## Integration contract (for the backend owner)

```python
class CaseReader:            # bound by the backend to one tenant/seller/case, returns masked data
    def snapshot(self) -> dict      # needs: policy_decision, state, authentication, marketplace_review
    def seller_messages(self) -> list[str]

result = investigate(reader, seller_text, model)   # never raises
# result['assessment']              -> store as ai_assessment (advisory only)
# result['effective_recommendation'] -> display only; never a state input
# result['can_change_state']        -> always False
```

`snapshot()['policy_decision']` is the deterministic policy result. Unknown or missing value is
treated as review required. The investigator does not import policy, state, payout or PayPal code.

## CaseReader contract test (for Codex)

Subclass `CaseReaderContract` from `tests/investigator_reader_contract.py` with `unittest.TestCase`, and implement
`make_reader()` and `make_reader_for_missing_case()`. It checks: only `snapshot()`/`seller_messages()` are public and take
no arguments (the investigator cannot choose scope); required snapshot keys; no raw payer ID or secret; messages are
strings; a missing or foreign case makes the investigator return UNAVAILABLE without calling the model.
Cross-seller rejection is the reader's job: it must raise or refuse when bound to another seller's case.
Status 2026-11-10: the real `BackendCaseReader` (`rescue/destination_reader.py`, Codex) passes this contract in `tests/test_destination_reader.py` (8 tests), including foreign seller/tenant, scope rebinding and logout, and missing payee. `DestinationService.assess` runs the investigator through it and persists the result as advisory `ai_assessment`. Interface handoff: `docs/HANDOFF_CASEREADER.md`.

## Output schema (`schema_version` "1")

`reason_category`, `claims`, `risk_signals`, `missing_information`, `follow_up_questions`,
`recommendation`, `summary`, `advisory_only` (must be `true`). Unknown keys are rejected.
`recommendation` is one of `CONTINUE_REQUIRED_VERIFICATION`, `ASK_FOLLOW_UP`, `ESCALATE_FOR_REVIEW`.
There is no approve value.

## Non-weakening rule

`effective_recommendation = most restrictive of {baseline floor, AI recommendation}`, and any risk
signal or category in {`OLD_ACCOUNT_LOST`, `OLD_ACCOUNT_COMPROMISE_SUSPECTED`, `THIRD_PARTY_DESTINATION`}
forces `ESCALATE_FOR_REVIEW` (policy T5/T6). Proved by an exhaustive test over baselines x recommendations x signals.

## Failure behavior (policy T10)

One repair retry is allowed for invalid output (the model sees only a fixed error string).
Timeout (30 s wall clock), model exception, truncated output, invalid JSON/schema, tool or step limit
(6 each), empty input: result is `status: UNAVAILABLE`, `recommendation: ESCALATE_FOR_REVIEW`. Existing hold remains.
Exceptions keep only the type name.

## Model

`nvidia/nemotron-3.5-bolt-e4b` (prompt version 3) via `langchain-nvidia-ai-endpoints` (same as the legacy agent), temperature 0.
Key is read in place by `rescue/config.py`; it is never printed or logged.

## Known limits

- Tested against a synthetic `CaseReader`; the real destination service does not exist yet in this repo.
- The assessment is not persisted by this task; the backend owner persists it.
- The model may output out-of-schema values; this fails closed (UNAVAILABLE) rather than being repaired.

## Operator AI Review and seller help chat (2026-11-11)

**AI Review (operator button).** `POST /api/v1/destination-change-requests/ID/ai-review` starts a background run (browser
reviewers only). `GET .../ai-review/RUN_ID` returns its steps as they happen: `start`, `tool`, `tool_result`, `model`, `final`.
The run always reads four sources first, then the model summarizes. All four are read-only:
`get_case_status`, `get_seller_claims` (untrusted), `get_missing_evidence`, and `get_recent_payouts`.
`get_recent_payouts` reads this seller's stored payout records and does a read-only `GET` to PayPal for each batch
(PayPal sandbox in sandbox mode). The receiver is masked. No create, cancel or retry exists on this path. The run
saves one advisory assessment through the same service path as every other assessment and can change no state.
One run per case at a time. Code: `rescue/ai_review.py`, `investigate(..., on_event, always_read)`. Tests: `tests/test_ai_review*.py`.
Prompt version is now `4` (the tool list grew).

**Seller help chat.** `POST /api/v1/seller-guide` (sellers only). It has no tools and never sees the case, payer IDs or
payout data. The history is validated (max 8 turns, 500 characters each, text only). Replies are sanitized. If the model fails,
a fixed scripted guide answers. It cannot approve or speed anything up. Code: `rescue/seller_guide.py`.

**Limits.** Both are advisory help. The operator AI Review only reads. A payout history never proves a change is legitimate.
In demo mode (`--ai fixture`) the AI is off, so AI Review reports "unavailable" and the chat uses the scripted guide.
