# PayeeGuard HTTPS API contract

**Status:** Proposed v1 contract for the destination-change workflow. Adapt routing and serialization to the existing application after repository inspection, but preserve the security semantics. HTTPS/JSON is the primary interface. MCP, if built, is a thin adapter over the same application services.

## 1. Contract principles

- Every request is authenticated and scoped to a `tenant_id` and `seller_id` by the backend.
- Seller-facing operations require ownership of the seller/payee record. Operator operations require an authorized marketplace role.
- The API accepts seller intent and free-text explanation. It does **not** accept caller-supplied trusted PayPal authentication results, payer IDs, verification booleans, approvals, cooling-off completion, or hold-release values.
- The proposed new payer ID B enters the system only through the backend-validated PayPal callback flow, not a seller request body.
- Full payer IDs and PayPal evidence are restricted to authorized backend/operator views. Seller and external-agent responses should mask identifiers unless disclosure is necessary and authorized.
- Mutating requests use idempotency keys. Responses include stable error codes and correlation IDs, not stack traces.

## 2. Core case representation

Illustrative response shape (field names may be mapped to current code conventions):

```json
{
  "case_id": "chg_demo_0007",
  "tenant_id": "marketplace_demo",
  "seller_id": "seller_demo_0042",
  "state": "PENDING_OLD_ACCOUNT_AUTH",
  "created_at": "2026-11-10T12:00:00Z",
  "updated_at": "2026-11-10T12:04:00Z",
  "reason": {
    "seller_text": "I opened a new PayPal account for my shop.",
    "category_claimed_by_seller": "NEW_ACCOUNT"
  },
  "destinations": {
    "active": {"masked_payer_id": "PAYER-***-A"},
    "proposed": {"masked_payer_id": "PAYER-***-B"}
  },
  "authentication": {
    "new_account": {"status": "VALIDATED", "verified_by": "PAYPAL_CALLBACK", "validated_at": "2026-11-10T12:02:00Z"},
    "old_account": {"status": "PENDING", "verified_by": null, "validated_at": null}
  },
  "marketplace_review": {"status": "NOT_REQUIRED_YET", "decision": null},
  "cooling_off": {"status": "NOT_STARTED", "ends_at": null},
  "payout_control": {"proposed_destination_usable": false, "hold_reason": "OLD_ACCOUNT_AUTH_REQUIRED"},
  "ai_assessment": {
    "status": "AVAILABLE",
    "reason_category": "NEW_ACCOUNT",
    "risk_signals": [],
    "missing_information": [],
    "recommendation": "CONTINUE_REQUIRED_VERIFICATION",
    "advisory_only": true
  },
  "version": 3
}
```

All IDs and timestamps in this example are synthetic. The API must not expose the raw `payer_id` fields to ordinary seller/agent callers. The AI section is untrusted advisory output; `verified_by: PAYPAL_CALLBACK` and authentication statuses are backend-generated only.

## 3. Endpoints

### `POST /api/v1/destination-change-requests`

Create a new change case for the authenticated seller. Require `Idempotency-Key` header.

Request:

```json
{
  "reason_text": "I opened a new PayPal account for my shop.",
  "reason_category": "NEW_ACCOUNT"
}
```

`reason_category` is a seller-declared hint, not trusted fact. It may be omitted. Do not accept `payer_id`, `new_payer_id`, `old_payer_id`, `verified`, `approved`, `hold_released`, or provider callback fields.

Response `201 Created`:

```json
{
  "case_id": "chg_demo_0007",
  "state": "CHANGE_REQUESTED",
  "next_action": "CONNECT_PROPOSED_PAYPAL_ACCOUNT",
  "proposed_destination_usable": false,
  "version": 1
}
```

Repeated request with the same idempotency key and same logical payload returns the same logical case. Reuse with a different payload returns `409 IDEMPOTENCY_CONFLICT`.

### `GET /api/v1/destination-change-requests/{case_id}`

Return seller-safe case status after checking seller/tenant ownership. Mask payer IDs and omit internal risk notes and credentials.

### `GET /api/v1/destination-change-requests/{case_id}/summary`

Read-only summary. For seller callers, return next steps and reasons in plain language. For authorized operators, include separate sections for seller claims, backend-verified evidence, missing evidence, policy findings and AI advisory signals. Always mark AI output as advisory.

### `POST /api/v1/destination-change-requests/{case_id}/messages`

Append a seller message to the case-scoped investigation conversation. Example request:

```json
{"message": "I cannot access the previous PayPal account anymore."}
```

The message is untrusted content. AI may extract claims and follow-up questions but cannot change trusted evidence or case authorization state.

### `GET /api/v1/destination-change-requests/{case_id}/events`

Return an appropriately redacted event timeline. Seller can see seller-safe events; authorized operators can see the full audit details. Never expose OAuth state, access tokens, credentials or raw secrets.

### `POST /api/v1/destination-change-requests/{case_id}/review` — operator only

This route is not exposed to external agents. Require an operator role, CSRF protection or equivalent API authorization, reason, current case version, and any required evidence checks.

Approval request:

```json
{
  "decision": "APPROVE",
  "reason": "Marketplace recovery evidence reviewed and accepted.",
  "expected_version": 7
}
```

Rejection request:

```json
{
  "decision": "REJECT",
  "reason": "The proposed destination could not be authorized.",
  "expected_version": 7
}
```

An approval may move the case only to `APPROVED_COOLING_OFF`; it must not directly activate B. Activation occurs later through the backend after cooling-off and fresh policy evaluation. Stale `expected_version` returns `409 CASE_VERSION_CONFLICT`.

## 4. Private provider callback boundary

PayPal OAuth callback routes are backend-owned provider integration routes, not public agent tools. They must:

1. Validate one-use OAuth state and expiry.
2. Bind callback purpose (`NEW` or `OLD`), tenant, seller, case and authenticated marketplace session.
3. Exchange/validate provider response server-side.
4. Retrieve the payer ID from the trusted PayPal response.
5. For old-account auth, compare exactly with stored active A.
6. Persist evidence and audit event.
7. Invoke deterministic policy/state service; never let the callback directly activate B.

No public endpoint accepts `verified=true` or a caller-asserted authentication result.

## 5. Error model

Use stable machine-readable codes, for example:

- `AUTH_REQUIRED`
- `TENANT_SCOPE_DENIED`
- `SELLER_SCOPE_DENIED`
- `CASE_NOT_FOUND`
- `CASE_STATE_CONFLICT`
- `CASE_VERSION_CONFLICT`
- `IDEMPOTENCY_CONFLICT`
- `INVALID_REQUEST`
- `RATE_LIMITED`
- `PAYPAL_AUTH_PENDING`
- `PAYPAL_CALLBACK_INVALID`
- `POLICY_REVIEW_REQUIRED`
- `INTERNAL_ERROR`

Do not return raw provider credentials, OAuth state, internal stack traces, database paths or secret-bearing environment values.

## 6. Security and operational requirements

- Enforce tenant/seller scoping on every read and write; do not trust IDs supplied in the body as authorization.
- Validate request schema, length and content type; rate-limit creation and message endpoints.
- Use idempotency on case creation and any future money-moving operation.
- Keep read-only case tools separate from operator review.
- Include request correlation ID and authenticated caller identity in audit events.
- Redact sensitive values in logs.
- Reject unknown/invalid state transitions in the backend service.
- Protect concurrent review with case-version checks and atomic database updates.
- No endpoint for external agents to approve, activate, release holds, create payouts, cancel payouts or submit trusted verification results.

## 7. Optional MCP adapter (deferred)

Only after this HTTPS contract and its authorization tests pass, a thin MCP adapter may expose:

- `request_destination_change` — create a pending request only.
- `get_change_status` — read-only.
- `get_case_summary` — read-only, claims and verified evidence separated.

It must call the same services and enforce the same caller scope. Do not expose `submit_verification_result`, `approve_destination_change`, `activate_destination`, `release_payout_hold`, `create_payout`, `cancel_payout`, or arbitrary SQL/URL tools. MCP is an adapter, not a new authorization layer or custom protocol.

## 8. Backend integration extensions (2026-11-10)

- `GET /api/v1/destination-change-requests` returns
  `{cases: [...], correlation_id: ...}`. Only the authenticated grant's tenant and
  seller are listed. Prototype operators have one explicit seller binding; no
  implicit tenant-wide privilege is granted. Optional `limit` (1–100, default 50)
  and `before` (case ID cursor) paginate newest-first. Queue items use the same
  masked representation as detail. Backend expiry/activation checks run first.
- `GET /api/v1/marketplace-payouts` returns `{earnings: [...], correlation_id: ...}`
  for the authenticated scope. Earnings are inserted only by a trusted backend
  source, not a seller, model or public request.
- `POST /api/v1/marketplace-payouts/{earning_id}/execute` requires an authorized
  browser marketplace reviewer and CSRF. Body must be `{}`. Amount, currency,
  operation identity and active payer ID all come from backend storage. The
  earning ID is the durable payout idempotency identity, irrespective of client
  retry headers. External-agent grants and ordinary sellers cannot execute.
- `POST /api/v1/marketplace-payouts/{earning_id}/reconcile` has the same permission
  and empty-body requirements; it only re-fetches a known provider batch.
- No route permits a requested payer ID, creates an earning, accelerates cooling,
  or submits trusted identity/evidence. Pending B remains unusable; if A is safe,
  scheduled earnings continue to A according to the configured policy.

These routes control only provisioned marketplace earnings. Standalone historical
feasibility probes are not marketplace payouts and remain outside this path.

## Operator queue alias
GET /api/v1/cases is browser-reviewer-only, tenant-scoped and masked. It returns {cases,next_cursor,correlation_id}. limit is 1–100. before identifies an exclusive newest-first (created_at,case_id) cursor; follow next_cursor. Seller mutation permissions are unchanged. See docs/HANDOFF_UI.md.

## Prototype reviewer evidence exception (confirmed)

POST /api/v1/destination-change-requests/ID/evidence is available only in demo or
sandbox to a signed-in browser marketplace reviewer, with CSRF and seller scope.
Strict body: kind, reference, reason, accepted, expected_version. Requires current
version and PENDING_REVIEW. Server records REVIEWER_PROTOTYPE_ENTRY, actual reviewer
and timestamp; accepted evidence is a manual prototype attestation. It does not
activate or replace review/cooling. Other roles, external agents and production
mode are denied. This supersedes earlier no-evidence-route language only for this
labelled prototype exception; see DECISIONS.md for the reviewer-compromise risk.
