/**
 * Trusted, repo-authored Mermaid diagram definitions.
 * Sourced from docs/STATE_MACHINE.md, docs/API_CONTRACT.md, and docs/POLICY.md.
 *
 * CRITICAL SECURITY INVARIANT: Only repo-authored constants are rendered in Mermaid.
 * Never pass untrusted user text or API responses into Mermaid.
 */

export const STATE_MACHINE_DIAGRAM = `
stateDiagram-v2
    [*] --> CHANGE_REQUESTED: Seller submits change request
    CHANGE_REQUESTED --> PENDING_NEW_ACCOUNT_AUTH: Expiring OAuth state generated
    PENDING_NEW_ACCOUNT_AUTH --> PENDING_OLD_ACCOUNT_AUTH: Proposed Account B validated
    PENDING_NEW_ACCOUNT_AUTH --> PENDING_REVIEW: Exception / old account lost
    PENDING_OLD_ACCOUNT_AUTH --> PENDING_REVIEW: Account A matches or recovery required
    PENDING_REVIEW --> APPROVED_COOLING_OFF: Operator approves with expected_version
    PENDING_REVIEW --> REJECTED: Operator or deterministic policy rejects
    APPROVED_COOLING_OFF --> ACTIVE_NEW_DESTINATION: Waiting period elapses & policy re-evaluates
    APPROVED_COOLING_OFF --> PENDING_REVIEW: Stale approval / new risk signal
    PENDING_NEW_ACCOUNT_AUTH --> EXPIRED: Request deadline elapsed
    PENDING_OLD_ACCOUNT_AUTH --> EXPIRED: Request deadline elapsed
    PENDING_REVIEW --> EXPIRED: Request deadline elapsed
    ACTIVE_NEW_DESTINATION --> [*]
    REJECTED --> [*]
    EXPIRED --> [*]
`;

export const CALLBACK_SEQUENCE_DIAGRAM = `
sequenceDiagram
    autonumber
    actor Seller
    participant Marketplace as Marketplace Frontend
    participant Backend as Marketplace Backend
    participant PayPal as PayPal Identity Provider
    actor Operator as Marketplace Operator

    Seller->>Marketplace: Request payout destination update
    Marketplace->>Backend: POST /destination-change-requests
    Backend-->>Marketplace: Case created (Payout hold enforced on B)
    Marketplace->>PayPal: Redirect to Connect PayPal (Account B)
    PayPal->>Backend: Server-side OAuth callback (B)
    Note over Backend: Callback bypasses AI.<br/>Backend verifies one-use state & extracts B.
    Backend->>Backend: Store proposed B as evidence. Hold remains.
    Marketplace->>PayPal: Re-authenticate Prior Account A
    PayPal->>Backend: Server-side OAuth callback (A)
    Note over Backend: Compares returned A exactly with stored A.
    Backend->>Backend: Policy evaluates T3 -> PENDING_REVIEW
    Operator->>Backend: POST /review (Approve change, reason, v4)
    Backend-->>Backend: Transition to APPROVED_COOLING_OFF
    Note over Backend: Cooling-off clock elapses. Final policy check.
    Backend->>Backend: Atomic activation: set active destination to B.
`;

export const DATA_MODEL_ER_DIAGRAM = `
erDiagram
    DESTINATION_CHANGE_CASE ||--|| DESTINATION_PAIR : owns
    DESTINATION_CHANGE_CASE ||--|{ AUTH_EVIDENCE : contains
    DESTINATION_CHANGE_CASE ||--o| OPERATOR_REVIEW : evaluated_by
    DESTINATION_CHANGE_CASE ||--o| AI_ASSESSMENT : assisted_by
    DESTINATION_CHANGE_CASE ||--|{ AUDIT_EVENT : records

    DESTINATION_CHANGE_CASE {
        string case_id PK
        string tenant_id
        string seller_id
        string state
        int version
        datetime created_at
    }

    DESTINATION_PAIR {
        string active_masked_payer_id
        string proposed_masked_payer_id
        boolean proposed_usable
    }

    AUTH_EVIDENCE {
        string target_account
        string status
        string verified_by
        datetime validated_at
    }

    OPERATOR_REVIEW {
        string decision
        string reason
        string operator_id
        int expected_version
    }

    AI_ASSESSMENT {
        string recommendation
        boolean advisory_only
        string reason_category
    }

    AUDIT_EVENT {
        string event
        string actor
        string reason
        datetime timestamp
    }
`;
