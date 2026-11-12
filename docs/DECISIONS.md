# Backend configuration decisions

2026-11-10, prototype assumptions (not calibrated marketplace risk thresholds):

- The user explicitly specified a configurable **three-day demonstration cooling
  period**. Production configuration must be supplied explicitly; demo values
  cannot silently authorize production activation.
- The local users/session database is a prototype marketplace identity system.
  Destination permissions come from separate backend-provisioned grants, never
  the legacy `role` field or request JSON. Each user has one tenant/seller binding
  in this prototype. External-agent access is a distinct, restricted grant channel.
- New `pg_` tables are additive and separate from legacy correction records.
  Legacy users/payees are not automatically provisioned destination permissions.
- Investigator assessments are separate append-only advisory records with the
  observed case version. They do not change case versions, trusted evidence,
  approval, destination, or payout controls. Stale results are marked as such.
- All investigation inputs are bound to the authenticated backend scope. The
  reader exposes only two argumentless read methods and masks identifiers.

- Recovery demo cooling is seven days (strictly longer than the three-day normal
  path). Request expiry is fourteen days; OAuth nonce expiry ten minutes. All are
  named, validated configuration values. Compromise pauses A by default; an
  explicit `cap` policy retains the provisioned exposure cap instead.
- T0 (same authenticated payer ID as A) is represented as a completed `ACTIVE`
  case with `ALLOW_NO_CHANGE`. No payee mutation or activation occurs.
- Any new seller message during cooling invalidates approval for a fresh review.
  The content is still a claim, never trusted verification. No AI assessment is
  consulted by the transition policy.
- Accepted normal-path evidence is `SELLER_ENTITLEMENT`; recovery instead requires
  `ACCOUNT_RECOVERY`, recorded by an authorized marketplace reviewer in a trusted
  backend console. There is no public evidence-submission endpoint. Old-contact
  notification is explicitly a pending flag, not claimed delivered.
- Demo timer acceleration is a backend-only operation restricted to demo mode;
  it marks case and payee as simulated. Sandbox/production reject acceleration.

2026-11-11 reviewer follow-up: browser reviewer grants permit tenant-wide masked
queue inspection and centralized backend timer progression. Public detail/review
mutations remain seller-bound. Internal queue timer capabilities retain the actual
grant seller separately and revalidate the original session/grant in the transaction;
no request field can create this capability. Queue order is created_at DESC, ID DESC.

GET /api/v1/cases is not a side-effect-free snapshot: within a write transaction it
runs the centralized backend timer policy for each case on the requested page,
including other sellers in the authenticated reviewer's tenant. Elapsed cooling
can atomically activate a destination only when existing evidence, approval,
reviewer grant, policy version and cooldown remain valid. Pending requests can
expire. A queue read supplies no approval or evidence and cannot bypass those
checks. This deliberate lazy timer progression matches detail refresh and payout
gating; it is not permission for the reviewer to manually activate another seller.
Each resulting transition is audited. Cases outside the page progress when later
read or processed by the gate; there is no background timer worker in this prototype.


## Evidence entry from the reviewer's browser (2026-11-11, Claude Code, requested by the user for the demo)
Earlier decision: evidence is recorded only through the trusted backend console and there is no evidence endpoint.
Now: `POST /api/v1/destination-change-requests/ID/evidence` exists for signed-in **browser marketplace reviewers only**.
Sellers, staff and external agents get 403. It requires the current case version and PENDING_REVIEW. The operator UI has a form for it.
`accepted=false` keeps approval blocked. **Risk:** before, recording evidence needed local access to the host and a password prompt.
Now a hijacked reviewer browser session can record evidence. The reviewer role already approves, so the added power is small, but the
second factor is gone. **A real marketplace would feed evidence from its own systems (orders, KYC), not type it in.** Treat the
form as a prototype stand-in. Codex: please confirm or reverse this decision.

### Codex decision: confirm prototype-only reviewer evidence route

The user-requested browser form is retained for demo/sandbox only, superseding
the earlier blanket no-evidence-endpoint decision in those two environments.
An explicit server mode guard rejects the route outside demo/sandbox. Browser
reviewer permission, seller/tenant scope, CSRF, strict fields, current case version
and PENDING_REVIEW remain required. The service also guards prototype evidence
source by mode. Browser entries are labelled REVIEWER_PROTOTYPE_ENTRY in storage
and reviewer summaries; host-console entries are labelled HOST_CONSOLE. The caller
cannot submit its own source/verifier/time. Evidence alone never activates B;
separate review, cooling and final gate checks remain.

Risk clarification: allowing the same reviewer session to both manufacture an
accepted evidence record and approve the case is a material collapse of independent
controls. Do not describe the added power as small. Host access was an additional
access boundary, not necessarily a distinct authentication factor. This prototype
attestation does not establish that marketplace/KYC records were independently
verified, and does not demonstrate resistance to reviewer account takeover.
Production must obtain evidence from trusted marketplace systems with suitable
independent authorization. This decision does not authorize enabling the browser
route for production or weakening deterministic requirements.

Demo interpretation: the pressure/attacker example shows deterministic enforcement;
an AI follow-up recommendation is not proof that AI detected or stopped the attack.
Using a seller session and a different PayPal account simulates stolen-session
conditions; it is not an actual account compromise. Real wrong-OLD-account
callback behavior remains a distinct unrecorded sandbox scenario until executed
and evidenced. Synthetic mismatch regressions are not a substitute for it.


## Risk flags, PayPal facts and the AI audit tool (2026-11-11, Claude Code, requested by the user)
**Why.** A hijacked marketplace login with a calm, normal request gave the AI nothing to find. Text is the only thing the AI sees.
**What.** Two kinds of trusted facts now feed deterministic flags (`rescue/destination_risk.py`, used by `evaluate`):
marketplace security signals (new device, password reset, country change, recent payout-account change) and PayPal account
facts derived at login (account type, age in days, name match, country match).
- **One flag** lengthens the safety wait to the recovery length. **Two or more flags block approval** (`POLICY_BLOCKED`, 409).
  A reviewer can still reject. The AI cannot block or approve anything.
- **Windows** (defaults): new device 24 hours, password reset 7 days, country change 7 days, recent payout change 30 days,
  PayPal account younger than 30 days. Flags clear by themselves when the window passes. The check runs again whenever the case is
  evaluated, including when the safety wait ends, so a flag that appears during the wait sends the case back to review.
  (The user said "new device in a day is fine, but after the cooldown". Read as: a day is the window, and signals are checked again
  at activation. Tell me if you meant something else.)
- **Marketplace signals are SIMULATED in this prototype** (`destination_admin signals ...`, source `SIMULATED_FEED`). There is no
  HTTP route to import them. A real marketplace would feed them from its own systems.
- **PayPal facts:** the app currently gets only payer ID and a verified flag. Name and country need the `profile` and `address`
  settings enabled in the PayPal Developer Dashboard and `RESCUE_PAYPAL_SCOPES` set. Account age only works if PayPal returns a creation date.
  Missing data is UNKNOWN and never raises a flag. Only derived facts are stored. The raw name and address are dropped after use.
  I know of no PayPal API that tells a Payouts sender whether another account was flagged by PayPal. We do not claim that.
- **Visibility:** flags and facts are reviewer-only, like the AI assessment, so a seller cannot learn what trips them.
- **AI:** a fifth read-only tool, `get_account_audit`, lets the AI Review explain which flags fired. Prompt version 5.
- **Known costs:** false positives (a seller who gets a new phone and resets a password in the same week is blocked until a window
  passes), and a feed is only as good as the marketplace that supplies it.

### Update: what PayPal sandbox really returns (2026-11-11, probed with the app's `profile` and `address` settings enabled)
- Both userinfo endpoints (`openidconnect ... schema=openid` and `oauth2 ... schema=paypalv1.1`) return the same fields.
- **Account B:** name and a full address (country, region, city, postal code, street). **Account A:** an empty address and no name.
- **Neither account returns `account_type` or `account_creation_date`.** The `PAYPAL_ACCOUNT_YOUNG` flag therefore cannot fire from
  PayPal data here. It stays in the code and only fires if PayPal sends a creation date.
- Added the `PAYPAL_COUNTRY_MISMATCH` flag (PayPal account country vs the seller country on file). Name mismatch plus country mismatch
  is two flags, which blocks approval.
- Missing data is `UNKNOWN` and never raises a flag, so a seller whose PayPal profile is empty (like account A) is not penalised.
- `RESCUE_PAYPAL_SCOPES=openid profile address https://uri.paypal.com/services/paypalattributes` is set in `.env`.

## Fast lane: clean changes approved by rules, no operator (2026-11-11, Claude Code, requested by the user)
**What.** With `RESCUE_FAST_LANE=on` (default OFF, refused in production mode), a change goes straight into the safety wait with no
operator when every check is clear. Code: `fast_lane_status` in `rescue/destination_risk.py`, the `AUTO_APPROVE` branch in `evaluate`,
and `_refresh` in `rescue/destination_service.py`. All of these must hold: both PayPal accounts verified with the old one an exact match;
PayPal name and country MATCH the seller records (UNKNOWN does not count); no risk flag; the marketplace feed says `entitlement_confirmed`
(simulated); no rejected evidence; seller not paused or flagged; and the case is not picked by sampling.
**Sampling.** `RESCUE_FAST_LANE_SAMPLE_PERCENT` (default 10) of otherwise-clean cases go to a person anyway. The pick is a hash of the case ID,
so retrying cannot change it. The demo recordings set it to 0 so the fast lane is visible.
**The safety wait still runs** (3 days by default). The approval actor is `policy:fast-lane` and the audit event is
`DESTINATION_CHANGE_AUTO_APPROVED`. A flag or a withdrawn entitlement that appears during the wait sends the case back to a person.
**The seller can cancel** an open or waiting request (`POST .../cancel`). The old-contact notice is only recorded as `SIMULATED_SENT`. No message is sent.
**Not claimed:** that the fast lane is safe. It has no measured false-pass rate. The simulated feed supplies the entitlement fact.
**Known risk:** a compromised seller device could complete the old-account PayPal login from an already-signed-in browser. The safety wait,
the cancel option, the flags and the sampling are the mitigations.

## Earnings shown to the operator (2026-11-11)
Each earning records `received_at`. The operator's Payouts tab shows only sales that arrived after the request started, because every
payout goes to the current account until the backend activates the new one.

## 2026-11-12: What the AI may submit (final checks)
- **Seller side:** the help chat may draft the seller's request, type it into the form and submit it, but only after the seller says yes (button or typed "yes"). The page performs the submit, not the model, and one open request per seller still applies.
- **Care (operator) side:** the AI may type a draft rationale into the box (`Type a rationale for me`) from its advisory and the backend facts. It does **not** approve or reject. Approval and rejection stay with a person and the deterministic policy (see `AGENTS.md`). This is the product's central safeguard, so the AI is not given a submit path for decisions, even by typing into the box.
- **Studio agent:** its tools only view and edit the dashboard (schema, page, add, remove, position widgets). No query tool, so rows are not sent to the model.

## 2026-11-12: Studio chat uses our view picker, not Studio's configure tools
- With nemotron-3.5-bolt-e4b, Studio's `configure_*` tools were rejected on every attempt ("Expected an object… Expected one of: <widget ids>") and the model still reported success. The chat now answers plain-words requests through the same pipeline as the Ask box (router call, checker call, days parsed by code, our code builds the mapping). The model never fills the mapping.
- Views are keyed by name: asking again changes the existing view (for example 2 days to 7 days); a new view goes to the top.

### Follow-up: which NVIDIA models can drive Studio's own tools (tested 2026-11-12, same NVIDIA key)
- I replayed the real request Studio sends (9 tools, `configure_line_chart` has a 22 KB op/value/widgetId schema) against 11 models on the NVIDIA free endpoint and validated each tool call against that schema.
- Valid: `deepseek-ai/deepseek-v4.1-flash` (about 11 s per call) and `mistralai/mistral-large-4-1t-a52b` (about 16 s). Invalid or no call: `nvidia/nemotron-3.5-bolt-e4b` (our default), `nemotron-3.5-lightning-30b-a3b`, `z-ai/glm-5.3-flash`, and several others that returned errors or text only. An earlier probe where the small model succeeded was not fair: the prompt contained the answer.
- End to end with `RESCUE_STUDIO_MODEL=deepseek-ai/deepseek-v4.1-flash` and `?studioTools=1` on the page URL, "Show revenue for the last 2 days" read the schema, read the page and configured the existing `income` chart to `recent_2` with no failures.
- Default stays our picker pipeline (about 3 s, works with the default model). Studio native mode needs 3 model calls per request, so it is slower (roughly 30 to 45 s, estimated from the per-call times above).
