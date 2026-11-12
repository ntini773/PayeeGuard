# PayeeGuard authorization policy

**Status:** Draft baseline for implementation. This document defines conservative control outcomes, not empirically calibrated fraud scores. Numeric thresholds are intentionally not invented; configure and document them only after a marketplace owner supplies requirements.

## 1. Core invariant

A successful marketplace login and a successful login to proposed PayPal account B do **not** by themselves authorize redirecting marketplace earnings from stored account A to B.

The marketplace is the authority on which seller/payee is entitled to earnings. PayPal authentication supplies evidence of control of a PayPal account. The backend policy combines trusted evidence with marketplace authorization. AI output is advisory and untrusted.

## 2. Trusted inputs

The policy engine may consume only backend-loaded or backend-validated values:

- `tenant_id`, `seller_id`, marketplace session subject, session age/assurance as supplied by the marketplace's trusted auth layer.
- Stored active payer ID A and its binding/evidence metadata.
- Proposed payer ID B captured from a validated new-account PayPal callback.
- New-account callback result, verified-account attribute if available, callback timestamp, OAuth state/case binding and provider correlation.
- Old-account callback result and exact comparison with stored A.
- Marketplace seller/payee verification records and trusted risk attributes, when actually integrated.
- Seller's stated reason and AI-extracted facts/signals, explicitly marked untrusted/advisory.
- Payout exposure/amount/currency, configured cap/pause state, request age and configured cooling-off deadline.
- Authorized marketplace operator decision, role, reason, case version and timestamp.
- Current case state, active policy version and audit history.

The model must not submit or overwrite trusted booleans such as `new_account_verified`, `old_account_matched`, `operator_approved`, `cooling_off_complete`, or `payout_hold_released`.

## 3. Decision table

| Tier / condition | Required treatment | Backend outcome | May B become active? |
|---|---|---|---|
| T0 — No change: proposed payer ID equals stored active A | Treat as no destination change; retain normal payout controls. | `ALLOW_NO_CHANGE` | A remains active; no new activation. |
| T1 — Change requested, B not yet authenticated by a valid callback | Create case and hold the proposed change. | `HOLD` / `PENDING_NEW_ACCOUNT_AUTH` | No. |
| T2 — B authenticated, but old-account check is required and not completed | Store B as proposed evidence only; initiate old-account verification through backend flow. | `REQUIRE_OLD_ACCOUNT_AUTH` | No. |
| T3 — B authenticated and old-account callback returns exact stored A | This supports control of A and B at callback time. Evaluate marketplace evidence and risk. It is not approval on its own. | `PENDING_REVIEW` | No, not from authentication alone. |
| T4 — Old-account authentication returns a different payer ID, is invalid, expired, replayed, or cannot be bound to this seller/case | Do not mark old account matched. Keep B inactive; route for review or reject according to deterministic policy. | `HOLD` / `REQUIRE_MARKETPLACE_REVIEW`; invalid/replayed callback is rejected as evidence | No. |
| T5 — Seller says old account is lost/unavailable | Require marketplace-controlled recovery evidence or a separately enrolled recovery method. Set old-contact notice flag only where policy calls for it. Apply a longer configured hold/cooling-off and payout cap or pause based on whether A may be compromised. | `REQUIRE_MARKETPLACE_REVIEW` | No automatic activation. |
| T6 — Third-party destination, possible compromise, pressure to skip checks, contradictory facts, or other elevated-risk signal | Preserve claims and evidence separately. AI-generated signals may escalate review/hold, but must not by themselves establish fraud or auto-reject a seller. | `HOLD` / `REQUIRE_MARKETPLACE_REVIEW` | No until marketplace authorization is satisfied. |
| T7 — Required backend evidence is present and authorized marketplace reviewer approves with reason and current case version | Validate role, tenant, seller, case version, required evidence and policy version. Record decision and start configured cooling-off. | `APPROVE_COOLING_OFF` | Not yet. |
| T8 — Cooling-off has elapsed, no new blocking signal exists, approval remains valid, and policy is re-evaluated successfully | Atomically set B as active approved destination and close the change case. | `ACTIVATE` / `ACTIVE_NEW_DESTINATION` | Yes. |
| T9 — Reviewer rejects, request expires, or required evidence is not supplied by its deadline | Keep B inactive. Preserve A only if marketplace policy considers A safe; otherwise pause payouts. | `REJECT` or `EXPIRED` | No. |
| T10 — AI timeout, invalid structured output, unsafe tool request, or model unavailable | Do not weaken policy or remove a hold. Offer retry/manual review. | Existing hold remains; manual-review fallback | No. |
| T11 — PayPal payout create/cancel/retrieval returns timeout or 5xx / provider state is unknown | Re-fetch the payout item and reconcile actual provider state before retry or any replacement. | `HOLD` execution/reconciliation as appropriate | No destination activation implication. |

## 4. Prototype defaults

These are conservative prototype defaults, not claims about universal marketplace practice:

1. A different payer ID immediately creates a pending case and blocks use of B in PayeeGuard's controlled payout path.
2. New-account authentication is required to capture B, but is never sufficient to approve B.
3. The default destination-change path requires old-account re-authentication matching stored A. A marketplace may configure a recovery exception, but that exception always routes to marketplace review.
4. Lost-old-account access never auto-approves. The old-contact notification is a signal/event, not proof of identity.
5. Every change requires explicit marketplace authorization before activation. An operator approval must be role-checked and reasoned.
6. Approval enters cooling-off; B activates only after the configured deadline and a fresh policy check.
7. AI may add escalation/review signals. It cannot remove a baseline hold or turn a missing trusted fact into a verified fact.
8. If A may itself be compromised, pause or cap payouts rather than assuming A is safe. The marketplace owns this risk decision.

## 5. Thresholds and configuration

No numerical values for cooling-off duration, transaction thresholds, seller-tenure thresholds, retry windows, payout caps, or expiry deadlines are established in the source plan. Do not hard-code made-up values or call them risk tiers with calibrated meaning.

Implement these as named, versioned configuration values supplied by the marketplace, with safe explicit defaults for the demo. Record the exact values used in `docs/DECISIONS.md` and label unvalidated values as demo assumptions. If no value is configured, use the safer manual-review/hold path rather than silently permitting activation.

## 6. Policy result contract

The policy function should be deterministic and side-effect free. Its result should include at least:

```json
{
  "decision": "REQUIRE_MARKETPLACE_REVIEW",
  "reason_codes": ["OLD_ACCOUNT_AUTH_UNAVAILABLE", "MARKETPLACE_EVIDENCE_REQUIRED"],
  "required_actions": ["COLLECT_MARKETPLACE_RECOVERY_EVIDENCE", "AUTHORIZED_OPERATOR_REVIEW"],
  "may_activate_proposed_destination": false,
  "policy_version": "draft-1"
}
```

The caller persists the result and executes permitted transitions. The example is illustrative; adapt field names to the existing codebase without weakening semantics.

## 7. Payout gate invariants

- Read the active approved payer ID from the server-side payee record at execution time.
- Reject any destination supplied by chat, request body, query string, UI state or AI tool output.
- Do not pay to B while a destination-change case is pending, rejected, expired, or in cooling-off.
- Enforce configured amount/currency/cap/pause controls.
- Persist a stable `sender_batch_id` before creating the payout; reuse it for retries of the same logical operation and use a new one only for a genuinely new operation.
- On timeout/5xx, re-fetch provider item state. Do not assume a payout failed or cancellation succeeded from the HTTP response alone.
- The hold covers only payout execution paths that actually pass through this gate. Document any path not integrated.

## 8. Explicit non-goals

This policy does not prove the seller's identity from AI analysis, guarantee prevention of account takeover, freeze PayPal-held funds, reverse completed payouts, or establish how common payout-destination fraud is. Those claims must not appear in UI, README, or demo narration.
