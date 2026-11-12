import { USE_MOCK_DATA } from '../../config';
import { Sparkles } from 'lucide-react';

export function MockDataBanner() {
  if (!USE_MOCK_DATA) return null;

  return (
    <aside
      aria-label="Mock data notification"
      style={{
        background: 'var(--workspace-soft)',
        color: 'var(--workspace-strong)',
        borderBottom: '1px solid rgba(var(--brand-rgb), 0.3)',
        padding: '6px 16px',
        fontSize: 'var(--text-xs)',
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-2)',
        textAlign: 'center',
        zIndex: 1000,
      }}
    >
      <Sparkles size={13} aria-hidden="true" />
      <span>
        MOCK DATA MODE — Using synthetic fixtures. Backend-masked IDs shown as received. No money moves.
      </span>
    </aside>
  );
}
