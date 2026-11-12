# UI handoff for Antigravity: risk flags, PayPal facts, AI audit (2026-11-11)

Backend work is done and tested. No file in `ui/` was changed for it. Show these things.

**Reviewer-only fields on `GET /api/v1/destination-change-requests/ID`** (absent for sellers, staff and agents):
- `risk_findings`: `[{code, level: "ELEVATED", detail}]`. Codes: `NEW_DEVICE_RECENT`, `PASSWORD_RESET_RECENT`, `COUNTRY_CHANGE_RECENT`,
  `DESTINATION_CHANGE_RECENT`, `PAYPAL_ACCOUNT_YOUNG`, `PAYPAL_NAME_MISMATCH`. `detail` is a plain sentence you can show.
- `risk_blocks_approval`: true when two or more flags are active.
- `risk_signals_source`: `SIMULATED_FEED`, `MARKETPLACE_FEED`, or null when no feed row exists.
- `paypal_facts`: `{new: {account_type, account_age_days|null, name_match: MATCH|PARTIAL|MISMATCH|UNKNOWN, country_match}, old: {...}}`.

**Show:** green/amber/red rows for each fact on the case page (clear = green, flag = amber, blocked = red banner), near the decision.
Label the marketplace signals "simulated feed" while `risk_signals_source` (also reviewer-only, same response) is `SIMULATED_FEED`.
One flag means a longer safety wait. Two or more means approval is blocked. The operator can still reject.

**New error:** `POST .../review` APPROVE returns 409 `POLICY_BLOCKED` when flags block approval. Today the UI prints
"The backend refused this action (POLICY_BLOCKED)". Replace it with a sentence such as "Two or more risk flags are active, so approval is blocked. You can still reject."
The existing 409 `POLICY_REVIEW_REQUIRED` still means evidence is missing.

**AI Review** now has a fifth step, `get_account_audit`. The UI maps tool names to words in `TOOL_TEXT` (`AiInlineCard.tsx`). Add
`get_account_audit: 'Checking risk flags and account facts'`. Until then the raw tool name shows.

**Policy reason codes** `RISK_SIGNALS_BLOCK_APPROVAL` and the flag codes appear in `policy.reason_codes`. Add plain labels in `content/labels.ts`.

## Added later the same day
- **Fast lane (reviewers):** `fast_lane: {enabled, eligible, sampled, missing: [codes]}` on the case. Codes: `BOTH_ACCOUNTS_NOT_VERIFIED`, `NAME_NOT_CONFIRMED`,
  `COUNTRY_NOT_CONFIRMED`, `RISK_FLAGS_PRESENT`, `ENTITLEMENT_NOT_CONFIRMED`, `EVIDENCE_REJECTED`, `SELLER_ON_HOLD`, `SAMPLED_FOR_REVIEW`, `FAST_LANE_OFF`.
  Show "Approved by rules" (not "Operator approved") when `marketplace_review.actor` is `policy:fast-lane`. The audit event is `DESTINATION_CHANGE_AUTO_APPROVED`
  (the UI currently prints it through a generic fallback).
- **Seller cancel:** `POST /api/v1/destination-change-requests/ID/cancel` (body `{}`). Add a "Cancel this request" button on the seller page for open and waiting requests.
- **Earnings:** `GET /api/v1/marketplace-payouts` now includes `received_at` (epoch seconds). The operator Payouts tab already filters on it.
- **AG Grid** is the default operator queue view. The Table view is still available.
