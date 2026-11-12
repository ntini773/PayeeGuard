# PayeeGuard architecture

PayeeGuard is a marketplace-side authorization layer for changes to a seller's PayPal payout destination. **Rules decide, AI recommends, a person approves, and the payout gate pays only the stored active payer ID.**

## Components

```mermaid
flowchart LR
  S[Seller page<br/>React] -->|request, PayPal login| API
  O[Care console<br/>React + AG Grid + AG Studio] -->|review, evidence| API
  M[Marketplace backend / MCP agent] -->|API key, external channel| API
  API[HTTPS/JSON API<br/>rescue/destination_api.py] --> SVC[Service + deterministic policy<br/>destination_service.py, destination_policy.py]
  SVC --> DB[(SQLite: cases, evidence,<br/>audit, payouts, signals)]
  SVC --> GATE[Payout gate<br/>payout_gate.py]
  GATE -->|Payouts API| PP[(PayPal sandbox)]
  API -->|Log in with PayPal| PP
  SVC -.advisory only.-> AI[NVIDIA model<br/>investigator, Guardy, dashboard picker]
```

## Change of payout account

```mermaid
sequenceDiagram
  participant Seller
  participant App as PayeeGuard backend
  participant PayPal as PayPal sandbox
  participant AI as NVIDIA model (advisory)
  participant Care as Care team
  Seller->>App: Request change (reason)
  Seller->>PayPal: Log in as new account B
  PayPal-->>App: payer ID, name, country (callback, no AI)
  Seller->>PayPal: Log in as current account A
  PayPal-->>App: payer ID (must equal stored A, else flagged)
  App->>AI: Read case (read-only tools)
  AI-->>App: Recommendation (cannot approve or pay)
  App-->>Care: Case, evidence, risk flags, AI proposal
  Care->>App: Record marketplace evidence, approve or reject
  Note over App: Two risk flags block approval. A safety wait runs after approval.
  App->>PayPal: Payout to the stored active payer ID only
```

## Where each guarantee lives

| Guarantee | Where |
|---|---|
| AI never approves, rejects, verifies or moves money | `rescue/investigator.py` (5 read-only tools); the page, not the model, submits the seller's own request |
| New-account login is not authorization | `rescue/destination_policy.py`, `rescue/destination_service.py` |
| Payouts use only the stored active payer ID | `rescue/payout_gate.py` |
| Append-only audit trail | `rescue/destination_store.py` events |
| Marketplace API keys and MCP cannot approve or pay | `rescue/store.py` (external channel), `rescue/mcp_server.py` |
| Credentials are never regenerated on deploy | `deploy/start.py`, `rescue/judge_setup.py` |

More: [`docs/DECISIONS.md`](DECISIONS.md), [`docs/openapi.yaml`](openapi.yaml), [`docs/docs/STATE_MACHINE.md`](docs/STATE_MACHINE.md).
