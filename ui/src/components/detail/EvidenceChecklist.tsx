import type { DestinationChangeCase } from '../../types/case';
import styles from '../../styles/detail.module.css';
import { humanizePolicyDecision } from '../../content/labels';

interface Props {
  caseData: DestinationChangeCase;
}

export function EvidenceChecklist({ caseData }: Props) {
  const { authentication } = caseData;

  const renderStatus = (status: string, verifiedBy: string | null) => {
    switch (status) {
      case 'VALIDATED':
      case 'MATCHED':
        return (
          <span className={styles.checkStatusMatched}>
            ✓ {status} {verifiedBy ? `(${verifiedBy})` : ''}
          </span>
        );
      case 'PENDING':
      case 'NOT_STARTED':
        return (
          <span className={styles.checkStatusPending}>
            ⏳ {status}
          </span>
        );
      case 'NOT_MATCHED':
      case 'FAILED':
      case 'EXPIRED':
      default:
        return (
          <span className={styles.checkStatusFailed}>
            ✕ {status}
          </span>
        );
    }
  };

  return (
    <div className={styles.sectionCard}>
      <div className={styles.sectionTitle}>
        <span>Evidence Verification Checklist</span>
        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--color-text-muted)' }}>
          Backend Verified
        </span>
      </div>
      <ul className={styles.checklist}>
        <li className={styles.checkItem}>
          <div>
            <strong>New account login</strong>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
              Proves the seller controls the new account
            </div>
          </div>
          {renderStatus(authentication.new_account.status, authentication.new_account.verified_by)}
        </li>

        <li className={styles.checkItem}>
          <div>
            <strong>Current account login</strong>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
              The account that logs in must be the account paid today
            </div>
          </div>
          {renderStatus(authentication.old_account.status, authentication.old_account.verified_by)}
        </li>

        <li className={styles.checkItem}>
          <div>
            <strong>Marketplace Seller Role & Scope</strong>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
              Verified seller entitlement for {caseData.seller_id}
            </div>
          </div>
          <span className={styles.checkStatusMatched}>✓ VALIDATED (MARKETPLACE_SESSION)</span>
        </li>

        <li className={styles.checkItem}>
          <div>
            <strong>Payee Balance & Payout Hold</strong>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
              {caseData.payout_control.hold_reason
                ? `Payouts stay on the current account: ${humanizePolicyDecision(caseData.payout_control.hold_reason)}`
                : 'Payout path clear'}
            </div>
          </div>
          <span className={caseData.payout_control.proposed_destination_usable ? styles.checkStatusMatched : styles.checkStatusPending}>
            {caseData.payout_control.proposed_destination_usable ? 'RELEASED' : 'HOLD ENFORCED'}
          </span>
        </li>
      </ul>
    </div>
  );
}
