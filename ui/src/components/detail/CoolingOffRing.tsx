import { useEffect, useState } from 'react';
import { countdown } from '../../utils/format';
import { Clock, ShieldAlert } from 'lucide-react';

interface Props {
  endsAt: string | null;
}

export function CoolingOffRing({ endsAt }: Props) {
  const [timeLeft, setTimeLeft] = useState<string | null>(() => countdown(endsAt));

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(countdown(endsAt));
    }, 1000);
    return () => clearInterval(timer);
  }, [endsAt]);

  if (!endsAt) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 20px',
        background: 'rgba(var(--info-rgb), 0.12)',
        border: '1.5px solid var(--sky)',
        borderRadius: 'var(--radius-md)',
        marginBottom: 'var(--space-6)',
        flexWrap: 'wrap',
        gap: 'var(--space-3)',
      }}
      role="status"
      aria-live="polite"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'rgba(var(--info-rgb), 0.25)',
            color: 'var(--sky)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Clock size={18} aria-hidden="true" />
        </div>
        <div>
          <strong style={{ color: 'var(--text)', fontSize: 'var(--text-sm)', display: 'block' }}>
            Cooling-Off Window Active
          </strong>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>
            Mandatory waiting period enforces security delay before destination activation
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Time Remaining
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-md)', fontWeight: 700, color: 'var(--accent-text)' }}>
            {timeLeft ? timeLeft : 'Elapsed — evaluating final policy'}
          </span>
        </div>
        <ShieldAlert size={16} style={{ color: 'var(--sky)' }} aria-hidden="true" />
      </div>
    </div>
  );
}
