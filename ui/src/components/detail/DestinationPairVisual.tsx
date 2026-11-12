import type { DestinationChangeCase } from '../../types/case';
import { Lock, Check, ArrowRight } from 'lucide-react';
import styles from '../../styles/destinationVisual.module.css';

interface Props {
  caseData: DestinationChangeCase;
}

export function DestinationPairVisual({ caseData }: Props) {
  const isUsable = caseData.payout_control.proposed_destination_usable;
  const isApproved = caseData.state === 'ACTIVE_NEW_DESTINATION';

  // Show backend-masked IDs exactly as received — DO NOT RE-MASK!
  const activePayerId = caseData.destinations.active.masked_payer_id;
  const proposedPayerId = caseData.destinations.proposed
    ? caseData.destinations.proposed.masked_payer_id
    : 'None registered';

  return (
    <div className={styles.container}>
      {/* Account A Card */}
      <div className={styles.accountCard}>
        <div className={styles.cardBadge}>{isApproved ? 'Previous account' : 'Current account'}</div>
        <div className={styles.payerId}>{isApproved ? 'No longer paid' : activePayerId}</div>
        <p className={styles.desc}>{isApproved ? 'Payouts moved to the new account' : 'Receives payouts today'}</p>
      </div>

      {/* Animated Connector */}
      <div className={`${styles.connector} ${isApproved ? styles.connectorActive : styles.connectorHeld}`}>
        <div className={styles.connectorLine} />
        <div className={styles.connectorPill}>
          {isApproved ? (
            <>
              <Check size={12} className={styles.iconOk} aria-hidden="true" />
              <span>Active</span>
            </>
          ) : (
            <>
              <Lock size={12} className={styles.iconHeld} aria-hidden="true" />
              <span>{isUsable ? 'Permitted' : 'Held'}</span>
            </>
          )}
        </div>
        <ArrowRight size={14} className={styles.connectorArrow} aria-hidden="true" />
      </div>

      {/* Account B Card */}
      <div className={`${styles.accountCard} ${caseData.destinations.proposed ? styles.proposedActive : ''}`}>
        <div className={styles.cardBadge}>New account</div>
        <div className={styles.payerIdProposed}>{proposedPayerId}</div>
        <p className={styles.desc}>
          {isApproved
            ? 'Receives payouts now'
            : isUsable
            ? 'Approved and ready to receive payouts'
            : 'Does not receive payouts yet'}
        </p>
      </div>
    </div>
  );
}
