# Handoff: CaseReader interface (Claude Code to Codex, TASK-060)

Status 2026-11-10: **closed.** Codex delivered `rescue/destination_reader.py` (`BackendCaseReader`). Claude Code verified: `tests/test_destination_reader.py` 8/8 pass; `pixi run test` 155 Python tests pass plus UI checks. Claude Code does not edit backend files.

## Interface the investigator consumes (fixed by `rescue/investigator.py`)

```python
class CaseReader(Protocol):
    def snapshot(self) -> dict          # no arguments
    def seller_messages(self) -> list   # list[str], no arguments
```

- Bind one instance to one authenticated tenant, seller and case in backend code. The investigator passes no ID.
- No other public methods or attributes that read or write (the contract test enforces this).
- `snapshot()` keys required: `state`, `policy_decision` (the deterministic policy result; unknown means review),
  `authentication` (`new_account.status`, `old_account.status`), `marketplace_review` (`decision`).
  Recommended: `destinations` (masked IDs only), `payout_control`, `cooling_off`.
- Return masked payer IDs only. No tokens, OAuth state, cookies, raw 13-character payer IDs.
- Missing case, wrong seller or wrong tenant: raise. The investigator then returns UNAVAILABLE and never calls the model.
- Store `result['assessment']` as `ai_assessment` (TASK-061). `effective_recommendation` is display-only.

## Acceptance (Codex runs, Claude Code reviews)

```python
from investigator_reader_contract import CaseReaderContract
class RealReaderContract(CaseReaderContract, unittest.TestCase):
    def make_reader(self): ...                  # valid case
    def make_reader_for_missing_case(self): ... # nonexistent or other seller's case
```

Also required from the backend side: a cross-seller test showing a reader bound to seller X cannot return seller Y's case.
Change requests to `rescue/investigator*.py` go through Claude Code.
