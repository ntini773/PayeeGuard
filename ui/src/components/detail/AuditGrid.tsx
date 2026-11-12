import { useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule, type ColDef } from 'ag-grid-community';
import type { AuditEvent } from '../../types/case';
import { formatDate } from '../../utils/format';
import { humanizeEvent, humanizeState } from '../../content/labels';
import { operatorGridTheme } from '../queue/gridTheme';

ModuleRegistry.registerModules([AllCommunityModule]);

/** The audit trail as an AG Grid table: sort, filter and search by column. Same data as the timeline view. */
export function AuditGrid({ events }: { events: AuditEvent[] }) {
  const columns = useMemo<ColDef<AuditEvent>[]>(() => [
    { headerName: 'Time', field: 'timestamp', width: 190, valueFormatter: (p) => formatDate(p.value), sort: 'asc' },
    { headerName: 'What happened', field: 'event', flex: 1.4, minWidth: 220, valueFormatter: (p) => humanizeEvent(p.value), tooltipField: 'event' },
    { headerName: 'Who', field: 'actor', width: 170 },
    { headerName: 'From', field: 'previous_state', width: 210, valueFormatter: (p) => (p.value ? humanizeState(p.value) : '—') },
    { headerName: 'To', field: 'new_state', width: 210, valueFormatter: (p) => (p.value ? humanizeState(p.value) : '—') },
    { headerName: 'Reason', field: 'reason', flex: 1, minWidth: 160, valueFormatter: (p) => (p.value ? String(p.value).replace(/_/g, ' ').toLowerCase() : '—') },
  ], []);
  const height = Math.min(720, 64 + events.length * 54);   // rows are about 52 px tall in this theme, so every event fits up to a scroll limit
  return (
    <div style={{ height, width: '100%', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--line-dark)' }} data-testid="audit-grid">
      <AgGridReact<AuditEvent>
        rowData={events}
        columnDefs={columns}
        defaultColDef={{ sortable: true, filter: true, resizable: true }}
        theme={operatorGridTheme}
        aria-label="Audit trail data grid"
        tooltipShowDelay={400}
      />
    </div>
  );
}
