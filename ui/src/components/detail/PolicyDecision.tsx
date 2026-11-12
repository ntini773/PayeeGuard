import { humanizePolicyDecision, humanizeReasonCode } from '../../content/labels';
import type { DestinationChangeCase } from '../../types/case';
import { countdown } from '../../utils/format';
import styles from '../../styles/detail.module.css';

interface Props {
  caseData: DestinationChangeCase;
}

export function PolicyDecision({ caseData }: Props) {
  const { policy, cooling_off } = caseData;
  const remaining = countdown(cooling_off.ends_at);

  return (
    <div className={styles.policyBox}>
      <div className={styles.policyTitle}>Deterministic Policy Evaluation</div>
      <div style={{ fontSize: 'var(--text-sm)', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
        <div>
          <span>Decision: </span>
          <strong style={{ color: policy.decision === 'REJECT' ? '#991b1b' : policy.decision === 'ACTIVATE' ? '#065f46' : '#1e3a8a' }}>
            {humanizePolicyDecision(policy.decision)}
          </strong>
        </div>

        <div>
          <span>Reason Codes: </span>
          <span>{policy.reason_codes.map(humanizeReasonCode).join(', ') || 'None'}</span>
        </div>

        <div>
          <span>Payout Gate Activation Permitted: </span>
          <strong>{policy.may_activate_proposed_destination ? 'YES' : 'NO (BLOCKED)'}</strong>
        </div>

        {cooling_off.status === 'ACTIVE' && (
          <div style={{ marginTop: 'var(--space-2)', padding: 'var(--space-2)', background: '#edf3e8', borderRadius: 'var(--radius-sm)' }}>
            <strong style={{ color: '#386b61' }}>Cooling-off Period Active: </strong>
            <span>{remaining ? remaining : 'Cooling-off complete / finalizing'}</span>
          </div>
        )}
      </div>
    </div>
  );
}
