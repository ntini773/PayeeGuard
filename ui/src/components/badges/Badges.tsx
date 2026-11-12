import type { CaseState } from '../../types/case';
import { STATE_LABELS, humanizeState } from '../../content/labels';
import { Clock, CheckCircle2, XCircle, ShieldCheck, Sparkles } from 'lucide-react';
import styles from '../../styles/badges.module.css';

export function StatusBadge({ state }: { state: CaseState }) {
  const config = STATE_LABELS[state];
  const tone = config?.tone ?? 'expired';
  const label = config?.label ?? humanizeState(state);

  const getIcon = () => {
    switch (tone) {
      case 'active':
        return <CheckCircle2 size={13} aria-hidden="true" />;
      case 'blocked':
      case 'expired':
        return <XCircle size={13} aria-hidden="true" />;
      case 'cooling':
      case 'held':
      default:
        return <Clock size={13} aria-hidden="true" />;
    }
  };

  return (
    <span
      className={`${styles.badge} ${styles[tone]}`}
      role="status"
      title={`Code: ${state}`}
    >
      {getIcon()}
      <span>{label}</span>
    </span>
  );
}

export function HeroStateChip({ state }: { state: CaseState }) {
  const config = STATE_LABELS[state] ?? {
    chip: 'Status',
    tone: 'held',
  };

  const getChipStyle = () => {
    switch (config.tone) {
      case 'active':
        return styles.heroChipActive;
      case 'blocked':
        return styles.heroChipBlocked;
      case 'cooling':
        return styles.heroChipCooling;
      case 'expired':
        return styles.heroChipExpired;
      case 'held':
      default:
        return styles.heroChipHeld;
    }
  };

  const getIcon = () => {
    switch (config.tone) {
      case 'active':
        return <CheckCircle2 size={20} aria-hidden="true" />;
      case 'blocked':
      case 'expired':
        return <XCircle size={20} aria-hidden="true" />;
      case 'cooling':
      case 'held':
      default:
        return <Clock size={20} aria-hidden="true" />;
    }
  };

  return (
    <div className={`${styles.heroChip} ${getChipStyle()}`} role="status">
      {getIcon()}
      <span>{config.chip}</span>
    </div>
  );
}

export function SimulatedBadge({ label = 'Simulated' }: { label?: string }) {
  return (
    <span className={`${styles.badge} ${styles.simulated}`} aria-label="Simulated environment">
      <Sparkles size={11} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

export function AdvisoryBadge() {
  return (
    <span className={`${styles.badge} ${styles.advisory}`} aria-label="AI advisory output — non-authoritative">
      <span>AI Advisory (Non-binding)</span>
    </span>
  );
}

export function TrustedBadge({ label = 'Backend-verified' }: { label?: string }) {
  return (
    <span className={`${styles.badge} ${styles.trusted}`} aria-label="Backend-verified record">
      <ShieldCheck size={12} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

export function UntrustedBadge({ label = 'Seller input (untrusted)' }: { label?: string }) {
  return (
    <span className={`${styles.badge} ${styles.untrusted}`} aria-label="Untrusted seller input">
      <span>{label}</span>
    </span>
  );
}

export function MaskedBadge({ label = 'Masked' }: { label?: string }) {
  return (
    <span className={`${styles.badge} ${styles.masked}`} aria-label="Masked identifier">
      <span>{label}</span>
    </span>
  );
}
