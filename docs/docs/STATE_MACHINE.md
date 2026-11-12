# PayeeGuard destination-change state machine

**Scope:** This state machine describes a marketplace destination-change case. It is deliberately separate from the PayPal Payouts item lifecycle (`PENDING`, `UNCLAIMED`, `SUCCESS`, `RETURNED`, etc.). A PayPal payout item's provider status must never be stored as the case state.

## 1. States

| State | Meaning | Destination B usable for payouts? |
|---|---|---|
| `ACTIVE` | Seller has a current approved active destination A and no open change case. | No new B exists; A is usable subject to normal payout controls. |
| `CHANGE_REQUESTED` | Authenticated seller submitted a change request; case and hold have been persisted. | No. |
| `PENDING_NEW_ACCOUNT_AUTH` | Backend is waiting for a valid PayPal callback for proposed account B. | No. |
| `PENDING_OLD_ACCOUNT_AUTH` | B evidence is captured; backend is waiting for old-account re-authentication of stored A. | No. |
| `PENDING_REVIEW` | Marketplace evidence/reviewer action is required. This is not a verification success. | No. |
| `APPROVED_COOLING_OFF` | Authorized marketplace decision has been recorded; configured waiting period has not elapsed. | No. |
| `REJECTED` | Marketplace/policy rejected the requested change. B remains inactive. | No. |
| `EXPIRED` | Request expired without completing required evidence/authorization. B remains inactive. | No. |
| `ACTIVE_NEW_DESTINATION` | B has been activated as the approved destination after all checks and cooling-off. Case is complete. | Yes, B only, through the controlled payout gate. |

A subsequent change begins a new case from the seller's current active state (`ACTIVE` or `ACTIVE_NEW_DESTINATION`). Do not mutate the prior completed case into a new request.

## 2. Allowed transitions

All transitions must be centralized in a backend case service. UI and AI code may request actions but may not write states directly.

| From | To | Trigger / required evidence | Actor / guard | Audit event |
|---|---|---|---|---|
| `ACTIVE` or `ACTIVE_NEW_DESTINATION` | `CHANGE_REQUESTED` | Authenticated seller requests a destination change; seller/payee ownership is checked; idempotency key accepted. | Seller session bound to tenant and seller. | `DESTINATION_CHANGE_REQUESTED` |
| `CHANGE_REQUESTED` | `PENDING_NEW_ACCOUNT_AUTH` | Case persisted; one-use, expiring PayPal OAuth state and case-bound auth attempt created. | Backend only. | `NEW_ACCOUNT_AUTH_STARTED` |
| `PENDING_NEW_ACCOUNT_AUTH` | `PENDING_OLD_ACCOUNT_AUTH` | Backend validates callback, state, session, case and seller; stores proposed payer ID B as evidence; B differs from A. | Trusted PayPal callback handler only. | `NEW_ACCOUNT_AUTH_VALIDATED` |
| `PENDING_NEW_ACCOUNT_AUTH` | `PENDING_REVIEW` | Seller reports old-account loss / exception, or policy routes to marketplace recovery. B may or may not yet be captured; state metadata must say which evidence is missing. | Backend policy; seller text itself is a claim. | `MARKETPLACE_REVIEW_REQUIRED` |
| `PENDING_NEW_ACCOUNT_AUTH` | `REJECTED` | Invalid request or deterministic policy rejection; never because the model merely labelled text suspicious. | Backend policy / authorized reviewer as configured. | `DESTINATION_CHANGE_REJECTED` |
| Any open pending state | `EXPIRED` | Configured request deadline elapsed and no valid completion was recorded. | Backend expiry worker/service. | `DESTINATION_CHANGE_EXPIRED` |
| `PENDING_OLD_ACCOUNT_AUTH` | `PENDING_REVIEW` | Old-account callback matches A and policy requires explicit marketplace review; or callback is unavailable/mismatched and recovery review is required. Evidence outcome is recorded distinctly. | Backend callback handler + policy. | `OLD_ACCOUNT_AUTH_MATCHED` or `OLD_ACCOUNT_AUTH_NOT_MATCHED`; then `MARKETPLACE_REVIEW_REQUIRED` |
| `PENDING_REVIEW` | `APPROVED_COOLING_OFF` | Required marketplace evidence is present; authorized operator approves with reason and current case version; policy re-evaluates. | Authorized operator only; server checks role, tenant, seller, case version and policy. | `DESTINATION_CHANGE_APPROVED` |
| `PENDING_REVIEW` | `REJECTED` | Authorized operator rejects with reason and current case version, or deterministic policy rejects. | Authorized operator / backend policy. | `DESTINATION_CHANGE_REJECTED` |
| `APPROVED_COOLING_OFF` | `ACTIVE_NEW_DESTINATION` | Configured deadline elapsed; approval still valid; no new blocking signal; policy re-evaluates; active destination update is atomic. | Backend only. | `DESTINATION_CHANGE_ACTIVATED` |
| `APPROVED_COOLING_OFF` | `PENDING_REVIEW` | New material risk/evidence arrives or approval becomes stale before activation. | Backend policy. | `APPROVAL_REOPENED_FOR_REVIEW` |

No transition exists from an AI recommendation directly to any state. No agent tool can call transition methods.

## 3. Evidence semantics

Store outcomes as separate evidence records, not overloaded case states:

- `new_account_auth`: `NOT_STARTED`, `PENDING`, `MATCHED/VALID`, `FAILED`, `EXPIRED`, `REPLAYED`, or `INVALID` as appropriate.
- `old_account_auth`: `NOT_REQUIRED`, `NOT_STARTED`, `PENDING`, `MATCHED`, `NOT_MATCHED`, `UNAVAILABLE`, `EXPIRED`, or `INVALID`.
- `marketplace_recovery_evidence`: named evidence type, source, verifier, timestamp and outcome.
- `operator_decision`: `PENDING`, `APPROVED`, or `REJECTED`, with actor, role, reason, case version and timestamp.
- `ai_assessment`: advisory-only versioned output; never a trusted evidence record.

A `MATCHED` old-account result means the callback's payer ID exactly equals stored A. It does not prove the marketplace session is uncompromised or conclusively identify the human requester.

## 4. Invariants and concurrency

1. A callback must be one-use, expiring, and bound to tenant, seller, case, auth purpose (`NEW` or `OLD`) and authenticated marketplace session.
2. New-account callback for B cannot satisfy the old-account check for A.
3. Callback replay, OAuth-state mismatch, expired state, wrong seller, wrong case or wrong purpose is rejected and audited.
4. Callback success stores evidence; it never directly changes the active payer ID.
5. `PENDING_REVIEW` is not approval. AI output is never an approval event.
6. Only authorized marketplace review can approve where review is required; approval needs a reason and current case version.
7. Cooling-off completion is evaluated server-side using configured policy values, not browser clocks.
8. The transition into `ACTIVE_NEW_DESTINATION` and update of the active payer ID must be atomic and protected against concurrent approvals/requests.
9. A pending/rejected/expired/cooling-off case blocks payout to B. The payout gate reads the current active destination from storage.
10. Rejected/expired cases do not erase audit history or automatically disable A. Whether A remains usable depends on whether the marketplace believes A is safe; if A may be compromised, pause/cap payouts according to policy.
11. All consequential transitions emit append-only audit events with previous/new state, actor, timestamp, reason, policy version and evidence references.

## 5. Separate PayPal payout-item lifecycle

A PayPal payout item is a provider-side financial object, not a destination-change case. In particular:

- `UNCLAIMED` means the recipient has not claimed the payout; cancellation may be available, but the prototype's recorded cancellation attempt returned HTTP 500.
- `SUCCESS` means the item was paid/credited according to the provider response.
- `RETURNED` means funds were returned to the sender.

Do not use a case transition such as `REJECTED` to imply a payout item was cancelled or returned. Re-fetch the PayPal item to establish provider state. See `docs/PAYPAL.md`.
