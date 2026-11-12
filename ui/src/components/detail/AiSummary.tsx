import type { DestinationChangeCase } from '../../types/case';
import { AdvisoryBadge } from '../badges/Badges';
import styles from '../../styles/detail.module.css';

interface Props {
  caseData: DestinationChangeCase;
}

export function AiSummary({ caseData }: Props) {
  const assessment = caseData.ai_assessment;

  return (
    <div className={styles.aiSection}>
      <div className={styles.aiHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <strong style={{ fontSize: 'var(--text-sm)' }}>Investigation Assistant Assessment</strong>
          <AdvisoryBadge />
        </div>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
          Non-authoritative
        </span>
      </div>

      {assessment ? (
        <div style={{ fontSize: 'var(--text-sm)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <div>
            <span style={{ color: 'var(--color-text-secondary)' }}>Detected Category: </span>
            <strong>{assessment.reason_category}</strong>
          </div>

          <div>
            <span style={{ color: 'var(--color-text-secondary)' }}>Recommendation: </span>
            <span style={{ fontWeight: 600, color: '#386b61' }}>{assessment.recommendation}</span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginLeft: 'var(--space-2)' }}>
              (Advisory only — does not approve or authorize)
            </span>
          </div>

          {assessment.risk_signals.length > 0 && (
            <div>
              <span style={{ color: '#991b1b', fontWeight: 600 }}>Risk Signals Detected:</span>
              <ul style={{ paddingLeft: 'var(--space-4)', marginTop: 'var(--space-1)' }}>
                {assessment.risk_signals.map((sig, i) => (
                  <li key={i} style={{ color: '#991b1b', fontSize: 'var(--text-xs)' }}>{sig}</li>
                ))}
              </ul>
            </div>
          )}

          {assessment.missing_information.length > 0 && (
            <div>
              <span style={{ color: '#92400e', fontWeight: 600 }}>Missing Required Information:</span>
              <ul style={{ paddingLeft: 'var(--space-4)', marginTop: 'var(--space-1)' }}>
                {assessment.missing_information.map((item, i) => (
                  <li key={i} style={{ color: '#92400e', fontSize: 'var(--text-xs)' }}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
          No AI assessment generated for this case.
        </p>
      )}
    </div>
  );
}
