import { useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { useMotion } from '../../context/MotionContext';
import styles from '../../styles/logos.module.css';

const tools = [
  { name: 'PayPal', file: 'paypal.svg', detail: 'Sandbox authentication and payouts' },
  { name: 'AG Grid', file: 'ag-grid.svg', detail: 'Operator queue and dashboards' },
  { name: 'Postman', file: 'postman.svg', detail: 'API collections and verification' },
  { name: 'APIMatic', file: 'apimatic.svg', detail: 'PayPal Context Plugin review guidance' },
];

export function BuiltWithLogos() {
  const [paused, setPaused] = useState(false);
  const { reducedMotion } = useMotion();
  return (
    <section className={styles.section} aria-label="Tools used to build PayeeGuard">
      <div className={styles.caption}><span>BUILT WITH TOOLS WE TRUST</span>
        <button type="button" aria-label={paused ? 'Resume tool logos' : 'Pause tool logos'} aria-pressed={paused} onClick={() => setPaused((value) => !value)} disabled={reducedMotion}>
          {paused || reducedMotion ? <Play size={11} aria-hidden="true" /> : <Pause size={11} aria-hidden="true" />}<span>{reducedMotion ? 'Motion reduced' : paused ? 'Paused' : 'Pause'}</span>
        </button>
      </div>
      <div className={styles.marquee}>
        <div className={`${styles.track} ${paused || reducedMotion ? styles.paused : ''}`}>
          {[0, 1].map((group) => <div key={group} className={styles.group} aria-hidden={group === 1 ? true : undefined}>
            {[...tools, ...tools].map((tool, index) => <div key={`${tool.name}-${index}`} className={styles.logo} aria-hidden={index >= tools.length ? true : undefined} title={tool.detail}>
              <img src={`/logos/${tool.file}`} alt={tool.name} width={140} height={34} loading="lazy" decoding="async" />
            </div>)}
          </div>)}
        </div>
      </div>
    </section>
  );
}
