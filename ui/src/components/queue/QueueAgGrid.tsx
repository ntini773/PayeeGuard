import { useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule, ColDef, RowClickedEvent } from 'ag-grid-community';
import { operatorGridTheme } from './gridTheme';
import type { DestinationChangeCase } from '../../types/case';
import { StatusBadge } from '../badges/Badges';
import { formatDate } from '../../utils/format';

// Register community modules once
ModuleRegistry.registerModules([AllCommunityModule]);

interface Props {
  cases: DestinationChangeCase[];
  selectedId: string | null;
  onSelect: (caseId: string) => void;
}

export function QueueAgGrid({ cases, selectedId, onSelect }: Props) {
  const columnDefs = useMemo<ColDef<DestinationChangeCase>[]>(() => [
    {
      field: 'case_id',
      headerName: 'Case ID',
      width: 170,
      cellRenderer: (params: { value: string }) => (
        <code style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--accent-text)' }}>
          {params.value}
        </code>
      ),
    },
    {
      field: 'seller_id',
      headerName: 'Seller ID',
      width: 150,
      cellRenderer: (params: { value: string }) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--text)' }}>
          {params.value}
        </span>
      ),
    },
    {
      headerName: 'Reason Claim',
      flex: 1,
      minWidth: 220,
      valueGetter: (params) => params.data?.reason.seller_text || '—',
      cellRenderer: (params: { value: string }) => (
        <span
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--muted)',
            display: 'inline-block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '100%',
          }}
          title={params.value}
        >
          {params.value && params.value !== '—' ? `"${params.value}"` : '—'}
        </span>
      ),
    },
    {
      headerName: 'Current',
      width: 160,
      valueGetter: (params) => params.data?.destinations.active.masked_payer_id ?? '',
      cellRenderer: (params: { value: string }) => (
        <code style={{ fontSize: 'var(--text-xs)', color: 'var(--text)' }}>
          {/* Show backend-masked ID directly — do not re-mask */}
          {params.value}
        </code>
      ),
    },
    {
      headerName: 'New',
      width: 160,
      valueGetter: (params) => params.data?.destinations.proposed?.masked_payer_id ?? '—',
      cellRenderer: (params: { value: string }) => (
        <code style={{ fontSize: 'var(--text-xs)', color: 'var(--gold-accent)', fontWeight: 600 }}>
          {params.value}
        </code>
      ),
    },
    {
      field: 'state',
      headerName: 'Status',
      width: 230,
      cellRenderer: (params: { data?: DestinationChangeCase }) => {
        if (!params.data) return null;
        return <StatusBadge state={params.data.state} />;
      },
    },
    {
      field: 'updated_at',
      headerName: 'Updated',
      width: 160,
      valueFormatter: (params) => formatDate(params.value),
      cellStyle: { fontSize: 'var(--text-xs)', color: 'var(--muted)' },
    },
  ], []);

  const defaultColDef = useMemo<ColDef>(() => ({
    sortable: true,
    filter: true,
    resizable: true,
  }), []);

  const handleRowClicked = (event: RowClickedEvent<DestinationChangeCase>) => {
    if (event.data?.case_id) {
      onSelect(event.data.case_id);
    }
  };

  return (
    <div
      style={{
        height: 480,
        width: '100%',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        border: '1px solid var(--line-dark)',
        background: 'var(--night-2)',
      }}
    >
      <AgGridReact
        rowData={cases}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        onRowClicked={handleRowClicked}
        rowSelection={{ mode: 'singleRow' }}
        theme={operatorGridTheme}
        autoSizeStrategy={{ type: 'fitGridWidth', defaultMinWidth: 110 }}
        aria-label="Operator Queue Data Grid"
      />
    </div>
  );
}
