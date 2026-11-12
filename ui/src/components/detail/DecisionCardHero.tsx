import type { DestinationChangeCase } from '../../types/case';
import { STATE_LABELS, humanizeAuthStatus, humanizeReviewStatus } from '../../content/labels';
import { HeroStateChip } from '../badges/Badges';
import { formatDate } from '../../utils/format';
import { ShieldCheck, UserCheck, CheckCircle2, Clock, XCircle, ArrowRight } from 'lucide-react';
import styles from '../../styles/decisionCard.module.css';
import { accountNames, withId } from '../../utils/accounts';

interface Props {
  caseData: DestinationChangeCase;
  isHeroTilt?: boolean;
}

export function DecisionCardHero({ caseData, isHeroTilt = false }: Props) {
  const stateConfig = STATE_LABELS[caseData.state] ?? {
    chip: 'Pending',
    sentence: 'Evaluating authorization criteria.',
    tone: 'held',
  };

  const getCheckIcon = (status: string) => {
    if (status === 'VALIDATED' || status === 'MATCHED') {
      return <CheckCircle2 size={15} className={styles.iconOk} aria-hidden="true" />;
    }
    if (status === 'PENDING' || status === 'NOT_STARTED') {
      return <Clock size={15} className={styles.iconPending} aria-hidden="true" />;
    }
    return <XCircle size={15} className={styles.iconBad} aria-hidden="true" />;
  };

  const isUsable = caseData.payout_control.proposed_destination_usable;
  const names = accountNames(caseData);

  return (
    <section
      aria-label="Case Decision Card"
      className={`${styles.card} ${isHeroTilt ? styles.tiltHover : ''}`}
    >
      <div className={styles.topHighlight} aria-hidden="true" />

      {/* Header Row: Parties & Case Info */}
      <div className={styles.headerRow}>
        <div className={styles.caseBadge}>
          <span className={styles.monoLabel}>CASE</span>
          <span className={styles.caseId}>{caseData.case_id}</span>
        </div>
        <div className={styles.partiesRow}>
          <span className={styles.sellerName} title={caseData.seller_id}>
            <UserCheck size={14} aria-hidden="true" />
            <span>{caseData.seller_id}</span>
          </span>
          <span className={styles.dotDivider}>•</span>
          <span className={styles.timestamp}>{formatDate(caseData.created_at)}</span>
          <span className={styles.versionBadge}>v{caseData.version}</span>
        </div>
      </div>

      {/* Outcome Chip & Humanized Verdict Sentence */}
      <div className={styles.outcomeZone}>
        <HeroStateChip state={caseData.state} />
        <p className={styles.outcomeSentence}>{stateConfig.sentence}</p>
      </div>

      {/* Checklist Rows (Backend-verified, solid border) */}
      <div className={styles.checklist}>
        <div className={styles.checkRow}>
          <span className={styles.checkLabel}>
            <ShieldCheck size={14} className={styles.iconTeal} aria-hidden="true" />
            <span>{withId('New account login', names.newId)}</span>
          </span>
          <span className={styles.checkValue}>
            {getCheckIcon(caseData.authentication.new_account.status)}
            <span className={styles.checkStatusText}>
              {caseData.authentication.new_account.status === 'VALIDATED'
                ? 'Verified callback'
                : humanizeAuthStatus(caseData.authentication.new_account.status)}
            </span>
          </span>
        </div>

        <div className={styles.checkRow}>
          <span className={styles.checkLabel}>
            <ShieldCheck size={14} className={styles.iconTeal} aria-hidden="true" />
            <span>{withId('Current account login', names.currentId)}</span>
          </span>
          <span className={styles.checkValue}>
            {getCheckIcon(caseData.authentication.old_account.status)}
            <span className={styles.checkStatusText}>
              {caseData.authentication.old_account.status === 'MATCHED'
                ? 'Matches current account'
                : caseData.authentication.old_account.status === 'PENDING'
                ? 'Waiting for login'
                : humanizeAuthStatus(caseData.authentication.old_account.status)}
            </span>
          </span>
        </div>

        <div className={styles.checkRow}>
          <span className={styles.checkLabel}>
            <UserCheck size={14} className={styles.iconTeal} aria-hidden="true" />
            <span>Marketplace Entitlement</span>
          </span>
          <span className={styles.checkValue}>
            <CheckCircle2 size={15} className={styles.iconOk} aria-hidden="true" />
            <span className={styles.checkStatusText}>Verified session</span>
          </span>
        </div>

        <div className={styles.checkRow}>
          <span className={styles.checkLabel}>
            <ShieldCheck size={14} className={styles.iconTeal} aria-hidden="true" />
            <span>Marketplace Review Decision</span>
          </span>
          <span className={styles.checkValue}>
            {caseData.marketplace_review.status === 'APPROVED' ? (
              <CheckCircle2 size={15} className={styles.iconOk} aria-hidden="true" />
            ) : caseData.marketplace_review.status === 'REJECTED' ? (
              <XCircle size={15} className={styles.iconBad} aria-hidden="true" />
            ) : (
              <Clock size={15} className={styles.iconPending} aria-hidden="true" />
            )}
            <span className={styles.checkStatusText}>
              {humanizeReviewStatus(caseData.marketplace_review.status)}
            </span>
          </span>
        </div>
      </div>

      {/* Footer Row: Payment Payout Status */}
      <div className={styles.footerRow}>
        <div className={styles.footerItem}>
          <span className={styles.footerLabel}>Payout Gate:</span>
          <span className={isUsable ? styles.statusActive : styles.statusHeld}>
            {isUsable ? 'New account is paid' : names.newId ? 'New account on hold' : 'No new account yet'}
          </span>
        </div>
        <div className={styles.destPreview}>
          <span className={styles.destMono}>{names.currentId ?? 'Previous account'}</span>
          <ArrowRight size={13} className={styles.destArrow} aria-hidden="true" />
          <span className={styles.destMonoProposed}>
            {caseData.destinations.proposed
              ? caseData.destinations.proposed.masked_payer_id
              : 'None'}
          </span>
        </div>
      </div>
    </section>
  );
}
