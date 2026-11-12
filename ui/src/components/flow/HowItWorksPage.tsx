import { useState } from 'react';
import { FlowGraph } from './FlowGraph';
import { MermaidDiagram } from '../mermaid/MermaidDiagram';
import {
  STATE_MACHINE_DIAGRAM,
  CALLBACK_SEQUENCE_DIAGRAM,
  DATA_MODEL_ER_DIAGRAM,
} from '../../content/diagrams';
import { GitGraph, ArrowRight, Shield, Layers, FileCode } from 'lucide-react';
import styles from '../../styles/howItWorks.module.css';

interface StateTransitionRow {
  from: string;
  to: string;
  trigger: string;
  actor: string;
  auditEvent: string;
}

const STATE_TRANSITIONS: StateTransitionRow[] = [
  {
    from: 'ACTIVE',
    to: 'CHANGE_REQUESTED',
    trigger: 'Seller requests destination change',
    actor: 'Authenticated seller',
    auditEvent: 'DESTINATION_CHANGE_REQUESTED',
  },
  {
    from: 'CHANGE_REQUESTED',
    to: 'PENDING_NEW_ACCOUNT_AUTH',
    trigger: 'Expiring PayPal OAuth state created',
    actor: 'Backend only',
    auditEvent: 'NEW_ACCOUNT_AUTH_STARTED',
  },
  {
    from: 'PENDING_NEW_ACCOUNT_AUTH',
    to: 'PENDING_OLD_ACCOUNT_AUTH',
    trigger: 'PayPal callback validates proposed B',
    actor: 'PayPal callback handler',
    auditEvent: 'NEW_ACCOUNT_AUTH_VALIDATED',
  },
  {
    from: 'PENDING_NEW_ACCOUNT_AUTH',
    to: 'PENDING_REVIEW',
    trigger: 'Seller reports prior account lost / exception',
    actor: 'Backend policy',
    auditEvent: 'MARKETPLACE_REVIEW_REQUIRED',
  },
  {
    from: 'PENDING_OLD_ACCOUNT_AUTH',
    to: 'PENDING_REVIEW',
    trigger: 'Old account matches A; explicit review required',
    actor: 'Callback handler + policy',
    auditEvent: 'OLD_ACCOUNT_AUTH_MATCHED',
  },
  {
    from: 'PENDING_REVIEW',
    to: 'APPROVED_COOLING_OFF',
    trigger: 'Authorized operator approves with reason & version',
    actor: 'Authorized operator',
    auditEvent: 'DESTINATION_CHANGE_APPROVED',
  },
  {
    from: 'PENDING_REVIEW',
    to: 'REJECTED',
    trigger: 'Authorized operator or deterministic policy rejects',
    actor: 'Operator / policy',
    auditEvent: 'DESTINATION_CHANGE_REJECTED',
  },
  {
    from: 'APPROVED_COOLING_OFF',
    to: 'ACTIVE_NEW_DESTINATION',
    trigger: 'Cooling-off elapsed, no new risk, atomic update',
    actor: 'Backend only',
    auditEvent: 'DESTINATION_CHANGE_ACTIVATED',
  },
];

export function HowItWorksPage() {
  const [filterState, setFilterState] = useState('');

  const filteredTransitions = filterState
    ? STATE_TRANSITIONS.filter((t) => t.from === filterState || t.to === filterState)
    : STATE_TRANSITIONS;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.kicker}>ARCHITECTURE & SPECIFICATION</span>
        <h1 className={styles.title}>Data Flow & Security Architecture</h1>
        <p className={styles.sub}>
          Verified state machine transitions, private PayPal callback boundaries, and immutable audit logs.
        </p>
      </div>

      {/* 1. Interactive Node Graph */}
      <section className={styles.section} aria-label="Interactive Data-Flow Node Graph">
        <div className={styles.sectionTitleRow}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <GitGraph size={18} className={styles.iconGold} aria-hidden="true" />
            <h2>Interactive Data-Flow Graph</h2>
          </div>
          <span className={styles.specRef}>@xyflow/react</span>
        </div>
        <p className={styles.sectionDesc}>
          Click any step to inspect its role, boundaries, and governing specification rule. Notice the AI node has read-only advisory edges and NO write edge to policy, activation, or payouts.
        </p>
        <FlowGraph isLive={false} />
      </section>

      {/* 2. State Machine Table & Mermaid */}
      <section className={styles.section} aria-label="State Machine Specification">
        <div className={styles.sectionTitleRow}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Layers size={18} className={styles.iconSky} aria-hidden="true" />
            <h2>State Machine Transitions</h2>
          </div>
          <span className={styles.specRef}>STATE_MACHINE.md § 2</span>
        </div>

        {/* State Table with filter */}
        <div className={styles.tableWrapper}>
          <div className={styles.tableToolbar}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>
              Filter by state:
            </span>
            <select
              className={styles.filterSelect}
              value={filterState}
              onChange={(e) => setFilterState(e.target.value)}
              aria-label="Filter state machine transitions"
            >
              <option value="">All transitions ({STATE_TRANSITIONS.length})</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="CHANGE_REQUESTED">CHANGE_REQUESTED</option>
              <option value="PENDING_NEW_ACCOUNT_AUTH">PENDING_NEW_ACCOUNT_AUTH</option>
              <option value="PENDING_OLD_ACCOUNT_AUTH">PENDING_OLD_ACCOUNT_AUTH</option>
              <option value="PENDING_REVIEW">PENDING_REVIEW</option>
              <option value="APPROVED_COOLING_OFF">APPROVED_COOLING_OFF</option>
              <option value="ACTIVE_NEW_DESTINATION">ACTIVE_NEW_DESTINATION</option>
            </select>
          </div>

          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">From State</th>
                <th scope="col">To State</th>
                <th scope="col">Trigger / Guard</th>
                <th scope="col">Authorized Actor</th>
                <th scope="col">Emitted Audit Event</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransitions.map((t, i) => (
                <tr key={i}>
                  <td><code className={styles.stateCode}>{t.from}</code></td>
                  <td><code className={styles.stateCodeTarget}>{t.to}</code></td>
                  <td style={{ color: 'var(--text)', fontSize: 'var(--text-xs)' }}>{t.trigger}</td>
                  <td><span className={styles.actorBadge}>{t.actor}</span></td>
                  <td><code className={styles.auditCode}>{t.auditEvent}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 'var(--space-6)' }}>
          <MermaidDiagram
            source={STATE_MACHINE_DIAGRAM}
            ariaLabel="State Machine State Diagram"
            title="State Machine Transition Diagram (stateDiagram-v2)"
          />
        </div>
      </section>

      {/* 3. PayPal Callback Sequence Diagram */}
      <section className={styles.section} aria-label="Callback Sequence Architecture">
        <div className={styles.sectionTitleRow}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shield size={18} className={styles.iconGold} aria-hidden="true" />
            <h2>PayPal OAuth Callback Boundary</h2>
          </div>
          <span className={styles.specRef}>API_CONTRACT.md § 4</span>
        </div>
        <p className={styles.sectionDesc}>
          PayPal OAuth callback routes are private backend-owned provider integration routes. Callbacks go straight to the server and completely bypass the AI investigator.
        </p>

        <MermaidDiagram
          source={CALLBACK_SEQUENCE_DIAGRAM}
          ariaLabel="PayPal Callback OAuth Sequence Diagram"
          title="Server-Side OAuth Callback Sequence (sequenceDiagram)"
        />
      </section>

      {/* 4. Data Model ER Diagram */}
      <section className={styles.section} aria-label="Data Model Entity Relations">
        <div className={styles.sectionTitleRow}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileCode size={18} className={styles.iconSky} aria-hidden="true" />
            <h2>Case Entity Relations</h2>
          </div>
          <span className={styles.specRef}>STATE_MACHINE.md § 3</span>
        </div>
        <p className={styles.sectionDesc}>
          Evidence records, operator decisions, and audit events are stored as distinct relational entities rather than overloaded case status strings.
        </p>

        <MermaidDiagram
          source={DATA_MODEL_ER_DIAGRAM}
          ariaLabel="Entity Relationship Diagram for Case Data Models"
          title="Entity Relationship Model (erDiagram)"
        />
      </section>
    </div>
  );
}
