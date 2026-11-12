import styles from '../../styles/queue.module.css';

export function EmptyState() {
  return (
    <div style={{
      textAlign: 'center',
      padding: 'var(--space-8) var(--space-6)',
      color: 'var(--color-text-muted)',
    }}>
      <p style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-2)' }}>
        No cases match your filters
      </p>
      <p style={{ fontSize: 'var(--text-sm)' }}>
        Adjust search or filter criteria, or refresh the queue.
      </p>
    </div>
  );
}
