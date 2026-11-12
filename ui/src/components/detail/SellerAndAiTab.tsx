import type { DestinationChangeCase } from '../../types/case';
import { humanizeAiRecommendation } from '../../content/labels';
import { Bot, MessageSquare, AlertTriangle, HelpCircle, ShieldAlert, Check } from 'lucide-react';
import styles from '../../styles/detailTabs.module.css';

interface Props {
  caseData: DestinationChangeCase;
}

export function SellerAndAiTab({ caseData }: Props) {
  const assessment = caseData.ai_assessment;

  return (
    <div className={styles.tabContent}>
      {/* Seller Claim Card (Untrusted) */}
      <div className={styles.claimCard}>
        <div className={styles.claimHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <MessageSquare size={16} className={styles.iconAmber} aria-hidden="true" />
            <strong>Seller Stated Request (Untrusted Input)</strong>
          </div>
          <span className={styles.untrustedTag}>SELLER SAYS</span>
        </div>

        <blockquote className={styles.claimText}>
          "{caseData.reason.seller_text}"
        </blockquote>

        <div className={styles.claimMeta}>
          <span>Claimed Category:</span>
          <code>{caseData.reason.category_claimed_by_seller}</code>
          <span style={{ color: 'var(--muted)', fontSize: 'var(--text-xs)' }}>
            (Category is a declared hint, not backend verified)
          </span>
        </div>
      </div>

      {/* AI Advisory Assessment Card */}
      <div className={styles.aiCard}>
        <div className={styles.aiHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Bot size={18} className={styles.iconSky} aria-hidden="true" />
            <strong>Investigation Assistant Assessment</strong>
          </div>
          <span className={styles.advisoryTag}>ADVISORY ONLY — CANNOT AUTHORIZE</span>
        </div>

        {/* Safety Disclaimer Banner */}
        <div className={styles.aiSafetyBanner}>
          <ShieldAlert size={15} aria-hidden="true" />
          <span>
            AI output is advisory interpretation. It cannot verify PayPal logins, approve/reject cases, activate destinations, release holds, or move funds.
          </span>
        </div>

        {assessment ? (
          <div className={styles.aiBody}>
            <div className={styles.aiGrid}>
              <div>
                <span className={styles.fieldLabel}>Interpreted Category</span>
                <span className={styles.aiValue}>{assessment.reason_category}</span>
              </div>

              <div>
                <span className={styles.fieldLabel}>Advisory Recommendation</span>
                <span className={styles.aiRecommendation}>
                  {humanizeAiRecommendation(assessment.recommendation)}
                </span>
              </div>
            </div>

            {/* Risk Signals */}
            {assessment.risk_signals.length > 0 && (
              <div style={{ marginTop: 'var(--space-4)' }}>
                <span className={styles.fieldLabel}>Detected Risk Signals</span>
                <div className={styles.riskList}>
                  {assessment.risk_signals.map((sig, i) => (
                    <div key={i} className={styles.riskItem}>
                      <AlertTriangle size={14} className={styles.iconBad} aria-hidden="true" />
                      <span>{sig}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Missing Info */}
            {assessment.missing_information.length > 0 && (
              <div style={{ marginTop: 'var(--space-4)' }}>
                <span className={styles.fieldLabel}>Missing Verification Information</span>
                <div className={styles.missingList}>
                  {assessment.missing_information.map((item, i) => (
                    <div key={i} className={styles.missingItem}>
                      <HelpCircle size={14} className={styles.iconAmber} aria-hidden="true" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p style={{ color: 'var(--muted)', fontSize: 'var(--text-sm)', margin: 'var(--space-4) 0 0' }}>
            No assistant assessment has been run for this case.
          </p>
        )}
      </div>
    </div>
  );
}
