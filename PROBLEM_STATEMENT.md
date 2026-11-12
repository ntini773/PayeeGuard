# PayeeGuard — Making Marketplace Payments Safer

Updated: 2026-11-10. User-selected product direction. This replaces the earlier
payout-recovery positioning; it is not a claim that every capability below has
already been implemented. See [SUMMARY.md](docs/archive/SUMMARY.md) for delivery status.

## The problem

Marketplaces must decide whether a request to change a seller's payment account
is authorized. If someone compromises a seller's marketplace account, they could
try to redirect future earnings to an account they control.

An authenticated marketplace session alone does not resolve that risk. PayPal
authentication establishes control of a PayPal account, but does not independently
prove that the account is entitled to receive a particular seller's earnings.

## The proposed solution

PayeeGuard connects the marketplace's established seller records with PayPal
account authentication and a controlled destination-change review process.

The intended flow is:

1. Receive the request through an authenticated marketplace session.
2. Authenticate the proposed PayPal account through PayPal.
3. Compare it with the marketplace's established destination record.
4. If it differs, hold the **change request** for additional verification and review.
5. Allow a destination update only after the required evidence and approval are
   satisfied; retain a record of the request, evidence and decision.
6. Future payouts use only the marketplace's approved destination.

Steps 4–6 need further implementation for a genuine change to a different PayPal
account. The current prototype escalates mismatches and does not update the
registered destination or execute future payouts. Holding a change request is
not a provider-level hold on funds. Any future payout-scheduling hold requires
an explicit marketplace integration and separate implementation evidence.

AI helps interpret requests, ask questions and surface potential warning signs.
Deterministic backend rules control identity matching, evidence, approval and
actions. AI text and retrieved information cannot grant payment authorization.
The prototype has not established fraud-detection accuracy or prevention rates.

## Alice example — target behavior

Alice has earned $500 on a marketplace. Her account is linked to an established
PayPal destination. Someone requests a different destination for future earnings.

PayeeGuard detects the difference and holds the request for review rather than
automatically accepting it. The marketplace must establish that Alice authorized
the change using evidence beyond the potentially compromised session and control
of the proposed account. Only a verified, approved change can update the record.

This is an illustrative future scenario, not a completed $500 transaction or an
implemented account-migration flow. The current tested payout amount is USD 0.01.

## One-minute pitch

**PayeeGuard: Making Marketplace Payments Safer**

Online marketplaces pay thousands of sellers, but what happens when someone
requests a change to the account receiving their earnings?

If a seller's account has been compromised, an attacker could attempt to redirect
those payments to another account.

PayeeGuard helps prevent unauthorized payment changes.

It connects a marketplace's existing seller records with PayPal account
authentication, detects when a payment destination changes, and ensures that
additional verification and approval happen before payments are redirected.

AI helps understand requests and identify potential warning signs, while strict
security rules control whether a change is allowed.

**Our goal is simple: make sure marketplace earnings reach an account that the
marketplace has properly authorized to receive them.**

When presenting the current build, describe different-account approval and
future-payout enforcement as the target product direction. Demonstrate the existing
match/mismatch gates and operator review as the implemented foundation.

## Decisions needed before implementing the new branch

- What independent evidence can authorize a legitimate different-account change
  when the marketplace session might be compromised? Proposed-account login plus
  an operator click is not, by itself, sufficient proof.
- Who can approve, what evidence must they review, and how are stale approvals
  revoked when evidence or the destination changes?
- How is a versioned approved destination stored and enforced by the future
  payout scheduler? The current prototype has neither integration.
- What happens to payouts already issued to the previous destination? Keep their
  reconciliation separate from authorizing future instructions.

Do not relax the current mismatch escalation just to make the new example pass.
Define and test the new authorization policy first.
