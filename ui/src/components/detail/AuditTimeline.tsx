import type { AuditEvent } from '../../types/case';
import { SimulatedBadge } from '../badges/Badges';
import { formatDate } from '../../utils/format';
import styles from '../../styles/detail.module.css';
import { humanizeEvent } from '../../content/labels';

interface Props {
  events: AuditEvent[];
}

export function AuditTimeline({ events }: Props) {
  return (
    <div className={styles.sectionCard}>
      <div className={styles.sectionTitle}>
        <span>Audit Timeline</span>
        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--color-text-muted)' }}>
          Immutable Backend Log
        </span>
      </div>

      <ol className={styles.timeline}>
        {events.map((evt, idx) => (
          <li key={idx} className={styles.timelineItem}>
            <span className={styles.timelineDot} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              <strong title={evt.event}>{humanizeEvent(evt.event)}</strong>
              {evt.simulated && <SimulatedBadge />}
            </div>

            <div className={styles.timelineMeta}>
              <span>Actor: <code>{evt.actor}</code></span>
              <span>•</span>
              <span>{formatDate(evt.timestamp)}</span>
            </div>

            {evt.reason && (
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
                {evt.reason}
              </p>
            )}

            {evt.new_state && (
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
                State: <code>{evt.previous_state || 'NONE'}</code> → <code>{evt.new_state}</code>
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
