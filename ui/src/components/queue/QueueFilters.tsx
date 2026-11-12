import { useState, useMemo } from 'react';
import type { DestinationChangeCase, CaseState } from '../../types/case';
import styles from '../../styles/queue.module.css';

type SortField = 'created_at' | 'updated_at' | 'state';
type SortDir = 'asc' | 'desc';

/** State severity for sorting — higher = more urgent */
const STATE_SEVERITY: Record<CaseState, number> = {
  PENDING_REVIEW: 5,
  PENDING_OLD_ACCOUNT_AUTH: 4,
  PENDING_NEW_ACCOUNT_AUTH: 4,
  CHANGE_REQUESTED: 3,
  APPROVED_COOLING_OFF: 2,
  ACTIVE_NEW_DESTINATION: 1,
  ACTIVE: 1,
  REJECTED: 1,
  EXPIRED: 0,
};

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  stateFilter: string;
  onStateFilterChange: (v: string) => void;
  sortField: SortField;
  onSortFieldChange: (v: SortField) => void;
  sortDir: SortDir;
  onSortDirChange: (v: SortDir) => void;
}

export function QueueFilters({
  search, onSearchChange,
  stateFilter, onStateFilterChange,
  sortField, onSortFieldChange,
  sortDir, onSortDirChange,
}: Props) {
  return (
    <div className={styles.filters}>
      <input
        className={styles.searchInput}
        type="search"
        name="case_search"
        autoComplete="off"
        spellCheck={false}
        placeholder="Search by case ID, seller, or reason…"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        aria-label="Search cases"
      />
      <select
        className={styles.filterSelect}
        value={stateFilter}
        onChange={(e) => onStateFilterChange(e.target.value)}
        aria-label="Filter by state"
      >
        <option value="">All states</option>
        <option value="held">Held (Pending)</option>
        <option value="needs-review">Needs Review</option>
        <option value="cooling-off">Cooling Off</option>
        <option value="approved">Approved</option>
        <option value="rejected">Rejected</option>
        <option value="expired">Expired</option>
      </select>
      <select
        className={styles.filterSelect}
        value={`${sortField}:${sortDir}`}
        onChange={(e) => {
          const [f, d] = e.target.value.split(':') as [SortField, SortDir];
          onSortFieldChange(f);
          onSortDirChange(d);
        }}
        aria-label="Sort cases"
      >
        <option value="updated_at:desc">Recently updated</option>
        <option value="created_at:desc">Newest first</option>
        <option value="created_at:asc">Oldest first</option>
        <option value="state:desc">Urgency (high → low)</option>
      </select>
    </div>
  );
}

/** Map states to filter categories */
function stateCategory(s: CaseState): string {
  switch (s) {
    case 'PENDING_REVIEW': return 'needs-review';
    case 'APPROVED_COOLING_OFF': return 'cooling-off';
    case 'ACTIVE_NEW_DESTINATION': return 'approved';
    case 'REJECTED': return 'rejected';
    case 'EXPIRED': return 'expired';
    default: return 'held';
  }
}

export function useQueueFilter(cases: DestinationChangeCase[]) {
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [sortField, setSortField] = useState<SortField>('updated_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const filtered = useMemo(() => {
    let result = cases;

    if (stateFilter) {
      result = result.filter((c) => stateCategory(c.state) === stateFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.case_id.toLowerCase().includes(q) ||
          c.seller_id.toLowerCase().includes(q) ||
          (c.reason?.seller_text ?? '').toLowerCase().includes(q)
      );
    }

    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'state') {
        cmp = (STATE_SEVERITY[a.state] ?? 0) - (STATE_SEVERITY[b.state] ?? 0);
      } else {
        cmp = String(a[sortField] ?? '').localeCompare(String(b[sortField] ?? ''));
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });

    return result;
  }, [cases, search, stateFilter, sortField, sortDir]);

  return {
    filtered,
    search, setSearch,
    stateFilter, setStateFilter,
    sortField, setSortField,
    sortDir, setSortDir,
  };
}

export { stateCategory, STATE_SEVERITY };
export type { SortField, SortDir };
