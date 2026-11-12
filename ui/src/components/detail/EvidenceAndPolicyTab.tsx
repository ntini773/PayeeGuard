import type { DestinationChangeCase } from '../../types/case';
import { humanizeAuthStatus, humanizePolicyDecision, humanizeReasonCode, humanizeVerifiedBy, isRiskFlagCode } from '../../content/labels';
import { ShieldCheck, CheckCircle2, Clock, XCircle, AlertTriangle, Lock } from 'lucide-react';
import { formatDate } from '../../utils/format';
import styles from '../../styles/detailTabs.module.css';
import { accountNames, withId } from '../../utils/accounts';

interface Props {
  caseData: DestinationChangeCase;
}

/** Red for codes that mean risk, green for codes that mean a check passed, plain for the rest. */
function reasonTone(code: string): 'risk' | 'ok' | 'plain' {
  if (isRiskFlagCode(code) || /BLOCK|UNAVAILABLE|NOT_MATCHED|REJECT/.test(code)) return 'risk';
  if (/^(VERIFIED|CONFIRMED|MATCH|MATCHED|CLEAR|APPROVED|ACTIVATE)|_(VERIFIED|CONFIRMED|MATCHED|CLEAR)$/.test(code)) return 'ok';
  return 'plain';
}

export function EvidenceAndPolicyTab({ caseData }: Props) {
  const { policy, authentication, payout_control } = caseData;
  const names = accountNames(caseData);

  const renderAuthStatus = (status: string, verifiedBy: string | null, validatedAt: string | null) => {
    const isSuccess = status === 'VALIDATED' || status === 'MATCHED';
    const isPending = status === 'PENDING' || status === 'NOT_STARTED';

    return (
      <div className={styles.authStatusBadge}>
        {isSuccess ? (
          <CheckCircle2 size={14} className={styles.iconOk} aria-hidden="true" />
        ) : isPending ? (
          <Clock size={14} className={styles.iconPending} aria-hidden="true" />
        ) : (
          <XCircle size={14} className={styles.iconBad} aria-hidden="true" />
        )}
        <span className={isSuccess ? styles.textOk : isPending ? styles.textPending : styles.textBad}>
          {humanizeAuthStatus(status)}
        </span>
        {verifiedBy && (
          <span className={styles.subMeta}>via {humanizeVerifiedBy(verifiedBy)}</span>
        )}
        {validatedAt && (
          <span className={styles.subMeta}>({formatDate(validatedAt)})</span>
        )}
      </div>
    );
  };

  return (
    <div className={styles.tabContent}>
      {/* Policy Card */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <ShieldCheck size={16} className={styles.iconTeal} aria-hidden="true" />
            <strong>Deterministic Policy Outcome</strong>
          </div>
          <span className={styles.monoTag} title="Policy version">POLICY DRAFT-1</span>
        </div>

        <div className={styles.policyGrid}>
          <div>
            <span className={styles.fieldLabel}>Evaluated Decision</span>
            <div className={styles.decisionValue}>
              <strong style={{ color: policy.decision === 'ACTIVATE' ? 'var(--ok-text)' : 'var(--bad-text)' }}>
                {humanizePolicyDecision(policy.decision)}
              </strong>
              
            </div>
          </div>

          <div>
            <span className={styles.fieldLabel}>Payout Gate Activation</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {policy.may_activate_proposed_destination ? (
                <CheckCircle2 size={15} className={styles.iconOk} aria-hidden="true" />
              ) : (
                <Lock size={15} className={styles.iconHeld} aria-hidden="true" />
              )}
              <span style={{ fontWeight: 600, color: policy.may_activate_proposed_destination ? 'var(--ok-text)' : 'var(--bad-text)' }}>
                {policy.may_activate_proposed_destination ? 'Permitted' : 'Blocked (Hold enforced)'}
              </span>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 'var(--space-4)' }}>
          <span className={styles.fieldLabel}>Governing Reason Codes</span>
          <div className={styles.chipsRow}>
            {policy.reason_codes.map((code, i) => (
              <span key={i} className={`${styles.reasonChip} ${reasonTone(code) === 'risk' ? styles.reasonChipRisk : reasonTone(code) === 'ok' ? styles.reasonChipOk : ''}`} title={`Code: ${code}`}>
                {humanizeReasonCode(code)}
              </span>
            ))}
          </div>
        </div>

        {payout_control.hold_reason && (
          <div className={styles.holdNotice}>
            <AlertTriangle size={15} className={styles.iconAmber} aria-hidden="true" />
            <span>
              <strong>Payouts stay on the current account:</strong> {humanizePolicyDecision(payout_control.hold_reason)}
            </span>
          </div>
        )}
      </div>

      {/* Backend Evidence Checklist Card */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <CheckCircle2 size={16} className={styles.iconTeal} aria-hidden="true" />
            <strong>Verified Backend Evidence</strong>
          </div>
          <span className={styles.trustBadge}>TRUSTED BACKEND AUTHORITY</span>
        </div>

        <ul className={styles.evidenceList}>
          <li className={styles.evidenceRow}>
            <div>
              <strong className={styles.evidenceTitle}>{withId('New account login', names.newId)}</strong>
              <p className={styles.evidenceSub}>
                Proves the seller controls the new account, through a PayPal login the backend verified.
              </p>
            </div>
            {renderAuthStatus(
              authentication.new_account.status,
              authentication.new_account.verified_by,
              authentication.new_account.validated_at
            )}
          </li>

          <li className={styles.evidenceRow}>
            <div>
              <strong className={styles.evidenceTitle}>{withId('Current account login', names.currentId)}</strong>
              <p className={styles.evidenceSub}>
                The account that logs in must be exactly the account that is paid today.
              </p>
            </div>
            {renderAuthStatus(
              authentication.old_account.status,
              authentication.old_account.verified_by,
              authentication.old_account.validated_at
            )}
          </li>

          <li className={styles.evidenceRow}>
            <div>
              <strong className={styles.evidenceTitle}>Seller Entitlement Session</strong>
              <p className={styles.evidenceSub}>
                Marketplace-authenticated session bound to tenant {caseData.tenant_id}.
              </p>
            </div>
            <div className={styles.authStatusBadge}>
              <CheckCircle2 size={14} className={styles.iconOk} aria-hidden="true" />
              <span className={styles.textOk}>Verified session</span>
            </div>
          </li>
        </ul>
      </div>
    </div>
  );
}
