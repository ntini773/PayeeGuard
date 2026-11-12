import { useState } from 'react';
import type { DestinationChangeCase } from '../../types/case';
import styles from '../../styles/detail.module.css';

interface Props {
  caseData: DestinationChangeCase;
  onDecisionSubmitted?: (decision: 'APPROVE' | 'REJECT', reason: string) => void;
}

export function ReviewActions({ caseData, onDecisionSubmitted }: Props) {
  const [reason, setReason] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const policyDecision = caseData.policy.decision;
  // Hard Rule: Never display an "Approve" button if policy decision is 'deny' or 'REJECT'
  const isDenyOrReject = policyDecision === 'REJECT';

  // Can only approve or reject if in reviewable state or cooling off
  const canReview = caseData.state === 'PENDING_REVIEW';

  const handleApprove = () => {
    if (!reason.trim()) {
      setStatusMessage('Please enter an operator reason before approving.');
      return;
    }
    setStatusMessage(`Destination change approved. Case transitioning to cooling-off (v${caseData.version}).`);
    onDecisionSubmitted?.('APPROVE', reason);
  };

  const handleReject = () => {
    if (!reason.trim()) {
      setStatusMessage('Please enter an operator reason before rejecting.');
      return;
    }
    setStatusMessage(`Destination change rejected. Proposed account blocked (v${caseData.version}).`);
    onDecisionSubmitted?.('REJECT', reason);
  };

  if (!canReview) {
    return (
      <div style={{ marginTop: 'var(--space-4)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
        Case is currently in <strong>{caseData.state}</strong>. Operator review actions are only enabled in <code>PENDING_REVIEW</code> state. Bulk approvals are strictly disallowed.
      </div>
    );
  }

  return (
    <div style={{ marginTop: 'var(--space-5)', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-4)' }}>
      <h4 style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--space-2)' }}>Operator Authorization</h4>
      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-3)' }}>
        Marketplace authorization requires recorded operator identity, reason, and current case version (v{caseData.version}). Approval initiates mandatory cooling-off; it does not directly activate destination B.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <input
          type="text"
          name="operator_reason"
          autoComplete="off"
          spellCheck={true}
          className={styles.reasonInput}
          placeholder="Operator rationale / verification evidence review notes (required)…"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          aria-label="Operator review reason"
        />

        <div className={styles.actionsBar}>
          {/* HARD RULE: Never display "Approve" button if policy decision is deny/REJECT */}
          {!isDenyOrReject && (
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={handleApprove}
            >
              Approve Destination Change
            </button>
          )}

          <button
            type="button"
            className={styles.btnDanger}
            onClick={handleReject}
          >
            Reject Destination Change
          </button>
        </div>

        {statusMessage && (
          <div role="status" aria-live="polite" style={{ fontSize: 'var(--text-xs)', color: '#0f766e', marginTop: 'var(--space-2)' }}>
            {statusMessage}
          </div>
        )}
      </div>
    </div>
  );
}
