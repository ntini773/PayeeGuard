import { useMotion } from '../../context/MotionContext';
import styles from '../../styles/mascot.module.css';

export type MascotMood = 'wave' | 'think' | 'happy' | 'alert' | 'idle';

interface Props {
  mood?: MascotMood;
  size?: number;
}

/**
 * Guardy, a friendly shield. Original artwork, not a PayPal mark. Decorative only: text always carries the meaning.
 * Moods: wave (greeting), think (working), happy (done), alert (needs attention).
 */
export function Mascot({ mood = 'idle', size = 64 }: Props) {
  const { reducedMotion } = useMotion();
  const live = !reducedMotion;
  return (
    <svg
      className={`${styles.mascot} ${live ? styles.live : ''}`}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
      data-mood={mood}
    >
      <defs>
        <linearGradient id="guardyBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#92b571" />
          <stop offset="1" stopColor="#42613a" />
        </linearGradient>
      </defs>
      {/* waving hand */}
      {mood === 'wave' && (
        <g className={styles.hand}>
          <circle cx="88" cy="42" r="8" fill="#d3e2b7" />
          <rect x="80" y="46" width="8" height="14" rx="4" fill="#d3e2b7" />
        </g>
      )}
      {/* shield body */}
      <path d="M50 8 L84 20 V46 C84 68 70 84 50 92 C30 84 16 68 16 46 V20 Z" fill="url(#guardyBody)" stroke="#698e4f" strokeWidth="3" />
      <path d="M50 16 L76 25 V46 C76 62 66 75 50 82" fill="none" stroke="#ffffff" strokeOpacity="0.18" strokeWidth="4" strokeLinecap="round" />
      {/* eyes */}
      {mood === 'happy' ? (
        <g stroke="#20381f" strokeWidth="4" strokeLinecap="round" fill="none">
          <path d="M34 44 Q40 36 46 44" />
          <path d="M54 44 Q60 36 66 44" />
        </g>
      ) : (
        <g className={styles.eyes}>
          <circle cx="40" cy="43" r="7" fill="#fff" />
          <circle cx="60" cy="43" r="7" fill="#fff" />
          <circle cx={mood === 'think' ? 43 : 41} cy={mood === 'think' ? 41 : 44} r="3.2" fill="#20381f" />
          <circle cx={mood === 'think' ? 63 : 61} cy={mood === 'think' ? 41 : 44} r="3.2" fill="#20381f" />
        </g>
      )}
      {/* mouth */}
      {mood === 'alert' ? (
        <path d="M42 66 Q50 62 58 66" stroke="#20381f" strokeWidth="4" strokeLinecap="round" fill="none" />
      ) : mood === 'think' ? (
        <circle cx="50" cy="66" r="3.5" fill="#20381f" />
      ) : (
        <path d="M40 62 Q50 74 60 62" stroke="#20381f" strokeWidth="4" strokeLinecap="round" fill="none" />
      )}
      {/* thought dots or alert mark */}
      {mood === 'think' && (
        <g className={styles.dots} fill="#d3e2b7">
          <circle cx="78" cy="14" r="3" />
          <circle cx="86" cy="8" r="2.4" />
          <circle cx="92" cy="3" r="1.8" />
        </g>
      )}
      {mood === 'alert' && (
        <g>
          <circle cx="82" cy="16" r="9" fill="#d3e2b7" />
          <rect x="80.5" y="10" width="3" height="8" rx="1.5" fill="#20381f" />
          <circle cx="82" cy="21" r="1.8" fill="#20381f" />
        </g>
      )}
    </svg>
  );
}
