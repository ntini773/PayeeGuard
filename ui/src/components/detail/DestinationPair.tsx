import type { DestinationChangeCase } from '../../types/case';
import { maskPayerId } from '../../utils/mask';
import styles from '../../styles/detail.module.css';

interface Props {
  caseData: DestinationChangeCase;
}

export function DestinationPair({ caseData }: Props) {
  const activeMasked = maskPayerId(caseData.destinations.active.masked_payer_id);
  const proposedMasked = caseData.destinations.proposed
    ? maskPayerId(caseData.destinations.proposed.masked_payer_id)
    : 'None registered';

  return (
    <div className={styles.destinationsGrid}>
      <div className={styles.destCard}>
        <div className={styles.destCardHeader}>Current account</div>
        <div className={styles.destPayerId}>{activeMasked}</div>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
          Entitled recipient on file
        </p>
      </div>

      <div className={styles.destCard} style={{ borderColor: caseData.destinations.proposed ? 'var(--color-accent)' : undefined }}>
        <div className={styles.destCardHeader}>New account</div>
        <div className={styles.destPayerId}>{proposedMasked}</div>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
          {caseData.payout_control.proposed_destination_usable
            ? 'Active for payouts'
            : 'Held / Inactive — Not authorized for payouts'}
        </p>
      </div>
    </div>
  );
}
