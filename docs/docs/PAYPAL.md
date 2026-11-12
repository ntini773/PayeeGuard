# PayPal integration notes and sandbox evidence

**Purpose:** Working notes for anyone touching PayPal OAuth or Payouts. This file records what was reported as tested, what failed, and what remains unverified. Re-run probes before treating any historical result as current.

## 1. Integration boundary

- PayPal OAuth / Log in with PayPal authenticates a PayPal account and supplies a payer ID through a validated backend callback.
- The marketplace remains responsible for deciding which seller is entitled to earnings and whether a change is authorized.
- A successful login to proposed account B proves control of B at that moment. It does not authorize marketplace earnings to be redirected to B.
- Store the proposed payer ID as evidence; do not update the active destination on callback alone.
- Use `PAYPAL_ID` for Payouts where supported and configured. The payout gate must supply the stored, active, approved payer ID; do not accept payer IDs from seller text or an agent.

## 2. App identity and secrets

- **Working sandbox app:** confirm against the local environment before use.
- **PayPal client ID suffix:** `TODO — fill after checking the active app; print only the last 6 characters.`
- **Client secret:** never copy into this file, logs, screenshots, commits, task reports, or prompts. Never print it to the terminal. Read it only through the existing secret-handling path.
- **Environment:** distinguish sandbox from live in configuration and on-screen labels. Never use live credentials for hackathon tests.
- **OAuth redirect URI:** verify exact match with the configured PayPal app and current local/deployed host before testing.

Do not guess which client ID is active. Multiple sandbox apps/accounts may exist; identify the actual one without exposing the secret.

## 3. Sandbox results recorded in the handoff

These are historical handoff observations, not a fresh run:

| Probe | Recorded result | Interpretation |
|---|---|---|
| US Business sandbox sender | Payout creation and item retrieval worked. | A working sandbox sender was available. Reconfirm configuration before demo. |
| India sandbox sender | Country restriction prevented use as sender. | Use the known US Business sandbox sender for the demo if the restriction remains. Do not claim India sender support was tested successfully. |
| Payer-ID payout | A separate authenticated payer-ID payout reached `SUCCESS`. | Demonstrates a successful payout to a payer ID in sandbox; it is not the email/unclaimed test item below. |
| Unregistered-recipient payout | Payout item `U8ZN7X3NYLJAG` was `UNCLAIMED`; response included `RECEIVER_UNREGISTERED`. | The recipient did not yet have a PayPal account/claim. Registration later was not proof of claim. Check item status; `SUCCESS` is the success signal. |
| Cancellation attempt | `POST /v1/payments/payouts-item/U8ZN7X3NYLJAG/cancel` returned HTTP 500. PayPal debug ID: `f4294337bbcb4`. | Cancellation was not demonstrated. Do not report it as cancelled. |
| Re-fetch after cancellation error | `GET` for the same payout item still showed `UNCLAIMED`; debug ID `f846868d48b19`. | Provider state remained claimable at the time of re-fetch. No replacement payout was issued. |
| Dashboard inspection | Business dashboard attempt returned a data-retrieval error. | No cancellation confirmation was obtained from the dashboard. |

The email recipient value is intentionally omitted from this shared note. Do not use the recorded sandbox transaction as a real-payee test.

## 4. Cancellation and payout reconciliation rules

- The recorded PayPal support response said cancellation is supported for an `UNCLAIMED` payout item and a successful cancellation should return HTTP 200 with the item moving to `RETURNED`. The sandbox attempt above did not achieve this; the cause remained unresolved/account- or sandbox-specific.
- PayPal's unclaimed-recipient guidance in the handoff indicated an unclaimed payout may be claimed within 30 days, after which it is returned. Confirm current provider documentation before relying on this timing in production.
- A registered PayPal account is not proof that the particular payout item has been claimed. Re-fetch the item and inspect its actual status.
- If a cancel request times out or returns 5xx, re-fetch the payout item. Do not infer cancellation from the failed request, retry blindly, or create a replacement while the original may still be claimable.
- Only proceed with any replacement flow after provider state is authoritatively confirmed as `RETURNED`, plus all marketplace approval, amount/currency, idempotency and single-replacement checks pass.
- Do not make cancellation a dependency of the core destination-change demo. The primary demo should show the payout gate refusing B while a change is pending and allowing B only after authorized activation.

## 5. Webhook handling

Do not trust a webhook payload **by itself** as the sole basis for a consequential financial action.

1. Validate PayPal webhook signature/authenticity using the supported verification flow.
2. Deduplicate events and validate the event/resource belongs to the expected payout item and environment.
3. Persist the notification as an event/candidate update.
4. Re-fetch the payout item from PayPal before retrying, cancelling, replacing, or otherwise acting on financial state.
5. Record provider status, request correlation, webhook event ID, retrieval time and reconciliation outcome.

The correct rule is not “ignore webhooks”; it is “authenticate webhooks, deduplicate them, and reconcile provider state before consequential action.”

Relevant webhook event names noted in the handoff:

- `PAYMENT.PAYOUTS-ITEM.UNCLAIMED`
- `PAYMENT.PAYOUTS-ITEM.CANCELED`
- `PAYMENT.PAYOUTS-ITEM.RETURNED`

Verify supported event names and subscription configuration against current PayPal documentation before relying on them.

## 6. PayPal item status is not case status

Keep provider lifecycle separate from PayeeGuard's destination-change state machine:

- `UNCLAIMED`: the recipient has not claimed the payout; it may still be claimable.
- `SUCCESS`: payout item succeeded/was credited according to provider response.
- `RETURNED`: funds were returned to sender.

A PayeeGuard case state such as `REJECTED` does not imply the provider payout was cancelled or returned. See `docs/STATE_MACHINE.md`.

## 7. Useful reference links

- PayPal Payouts Agreement (US): https://securepayments.paypal.com/us/legalhub/paypal/paypal-payouts-agreement
- PayPal Payouts API documentation: https://developer.paypal.com/docs/api/payments.payouts-batch/v1/
- PayPal Log in with PayPal documentation: https://developer.paypal.com/docs/log-in-with-paypal/

The reviewed US agreement puts responsibility for accurate payout instructions on the sender and says PayPal may rely on the supplied identifier. This is a US-agreement statement; do not universalize its legal scope to every country or agreement.
