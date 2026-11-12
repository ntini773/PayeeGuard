import { useState } from 'react';
import type { AuditEvent } from '../../types/case';
import { formatDate } from '../../utils/format';
import { SimulatedBadge } from '../badges/Badges';
import { ChevronDown, ChevronRight, Activity, Shield, User, Bot } from 'lucide-react';
import styles from '../../styles/auditCompact.module.css';
import { humanizeEvent } from '../../content/labels';

interface Props {
  events: AuditEvent[];
}

export function CompactAuditDrawer({ events }: Props) {
  const [expandedIndices, setExpandedIndices] = useState<Record<number, boolean>>({});

  const toggleExpand = (idx: number) => {
    setExpandedIndices((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  const getActorIcon = (actor: string) => {
    if (actor.includes('operator')) return <User size={13} aria-hidden="true" />;
    if (actor.includes('policy') || actor.includes('system')) return <Shield size={13} aria-hidden="true" />;
    if (actor.includes('ai') || actor.includes('assistant')) return <Bot size={13} aria-hidden="true" />;
    return <Activity size={13} aria-hidden="true" />;
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <Activity size={16} className={styles.headerIcon} aria-hidden="true" />
          <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--text)' }}>
            Immutable Audit Stream
          </strong>
        </div>
        <span className={styles.badgeCount}>{events.length} recorded events</span>
      </div>

      <ol className={styles.eventList}>
        {events.map((evt, idx) => {
          const isExpanded = !!expandedIndices[idx];

          return (
            <li key={idx} className={styles.eventItem}>
              <button
                type="button"
                className={styles.summaryRow}
                onClick={() => toggleExpand(idx)}
                aria-expanded={isExpanded}
              >
                <div className={styles.summaryLeft}>
                  {isExpanded ? (
                    <ChevronDown size={14} className={styles.chevron} aria-hidden="true" />
                  ) : (
                    <ChevronRight size={14} className={styles.chevron} aria-hidden="true" />
                  )}
                  <span className={styles.actorIcon} title={`Actor: ${evt.actor}`}>
                    {getActorIcon(evt.actor)}
                  </span>
                  <span className={styles.eventName} title={evt.event}>{humanizeEvent(evt.event)}</span>
                  {evt.simulated && <SimulatedBadge />}
                </div>

                <div className={styles.summaryRight}>
                  <time dateTime={evt.timestamp} className={styles.timestamp} title={evt.timestamp}>
                    {formatDate(evt.timestamp)}
                  </time>
                </div>
              </button>

              {isExpanded && (
                <div className={styles.detailPane}>
                  <div className={styles.detailGrid}>
                    <div>
                      <span className={styles.detailLabel}>Actor:</span>
                      <code className={styles.detailCode}>{evt.actor}</code>
                    </div>
                    {evt.new_state && (
                      <div>
                        <span className={styles.detailLabel}>State Transition:</span>
                        <span className={styles.stateTransition}>
                          <code>{evt.previous_state || 'NONE'}</code> → <code>{evt.new_state}</code>
                        </span>
                      </div>
                    )}
                    <div>
                      <span className={styles.detailLabel}>Timestamp:</span>
                      <span className={styles.detailVal}>{evt.timestamp}</span>
                    </div>
                  </div>

                  {evt.reason && (
                    <div style={{ marginTop: 'var(--space-2)' }}>
                      <span className={styles.detailLabel}>Recorded Reason:</span>
                      <p className={styles.detailReason}>{evt.reason}</p>
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
