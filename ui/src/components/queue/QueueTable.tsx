import type { DestinationChangeCase } from '../../types/case';
import { StatusBadge } from '../badges/Badges';
import { formatDate } from '../../utils/format';
import styles from '../../styles/queue.module.css';

interface Props {
  cases: DestinationChangeCase[];
  selectedId: string | null;
  onSelect: (caseId: string) => void;
}

export function QueueTable({ cases, selectedId, onSelect }: Props) {
  if (cases.length === 0) {
    return null;
  }

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table} role="grid" aria-label="Destination change queue">
        <thead>
          <tr>
            <th scope="col">Case</th>
            <th scope="col">Seller</th>
            <th scope="col">Reason Claim</th>
            <th scope="col">Current account</th>
            <th scope="col">New account</th>
            <th scope="col">Status</th>
            <th scope="col">Updated</th>
          </tr>
        </thead>
        <tbody>
          {cases.map((c) => (
            <tr
              key={c.case_id}
              onClick={() => onSelect(c.case_id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(c.case_id);
                }
              }}
              tabIndex={0}
              role="row"
              aria-selected={c.case_id === selectedId}
              className={c.case_id === selectedId ? styles.selectedRow : undefined}
            >
              <td>
                <code className={styles.monoCaseId}>{c.case_id}</code>
              </td>
              <td>
                <span className={styles.sellerId}>{c.seller_id}</span>
              </td>
              <td>
                <span className={styles.sellerText} title={c.reason.seller_text}>
                  {c.reason.seller_text ? `"${c.reason.seller_text}"` : '—'}
                </span>
              </td>
              <td>
                {/* Show backend-masked ID directly — do not re-mask */}
                <code className={styles.monoId}>{c.destinations.active.masked_payer_id}</code>
              </td>
              <td>
                <code className={styles.monoProposedId}>
                  {c.destinations.proposed
                    ? c.destinations.proposed.masked_payer_id
                    : '—'}
                </code>
              </td>
              <td>
                <StatusBadge state={c.state} />
              </td>
              <td style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>
                {formatDate(c.updated_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
