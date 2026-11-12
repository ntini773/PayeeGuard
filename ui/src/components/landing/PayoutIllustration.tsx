import { useEffect, useId, useRef } from 'react';
import { ArrowUpRight, Check, CreditCard, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useMotion } from '../../context/MotionContext';
import styles from '../../styles/landing.module.css';

/** Explanatory artwork only: no requests, timers, financial data, or authorization. */
export function PayoutIllustration() {
  const id = useId().replace(/:/g, '');
  const root = useRef<HTMLDivElement>(null);
  const { reducedMotion } = useMotion();

  useEffect(() => {
    const target = root.current;
    if (!target) return;
    let inView = !('IntersectionObserver' in window);
    const update = () => {
      target.dataset.active = String(inView && !document.hidden && !reducedMotion);
    };
    const observer = 'IntersectionObserver' in window ? new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      update();
    }) : null;
    observer?.observe(target);
    document.addEventListener('visibilitychange', update);
    update();
    return () => {
      observer?.disconnect();
      document.removeEventListener('visibilitychange', update);
    };
  }, [reducedMotion]);

  return (
    <div ref={root} data-active="false" className={styles.payoutIllustration} aria-label="Illustration: the payout gate keeps account A active while proposed account B awaits authorization">
      <div className={styles.diagramGrid} aria-hidden="true" />
      <svg className={styles.beamDiagram} viewBox="0 0 1000 340" preserveAspectRatio="none" aria-hidden="true">
        <defs><linearGradient id={`${id}-beam`}><stop stopColor="#829c70" stopOpacity="0" /><stop offset=".5" stopColor="#b6dc8b" /><stop offset="1" stopColor="#829c70" stopOpacity="0" /></linearGradient></defs>
        <path d="M210 170 H440 Q465 170 465 145 V115 Q465 90 490 90 H790" fill="none" stroke="#bec6b6" />
        <path d="M520 170 H580 Q600 170 600 190 V235 Q600 255 625 255 H790" fill="none" stroke="#a5afa0" strokeDasharray="4 6" />
        <path className={styles.liveBeam} d="M210 170 H440 Q465 170 465 145 V115 Q465 90 490 90 H790" fill="none" stroke={`url(#${id}-beam)`} strokeWidth="3" strokeDasharray="100 900" />
      </svg>
      <div className={styles.earningsNode}>
        <div className={styles.nodeIcon}><CreditCard size={18} aria-hidden="true" /></div>
        <span className={styles.nodeKicker}>MARKETPLACE</span>
        <strong>Seller earnings</strong>
        <span className={styles.nodeDescription}>Destination read from<br />the approved record</span>
        <div className={styles.earningsLines} aria-hidden="true"><i /><i /><i /></div>
      </div>
      <div className={styles.gateSculpture}>
        <svg viewBox="0 0 240 280" aria-hidden="true">
          <defs>
            <linearGradient id={`${id}-face`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#f0f3e5" /><stop offset=".5" stopColor="#c0c9ae" /><stop offset="1" stopColor="#879977" /></linearGradient>
            <linearGradient id={`${id}-side`} x1="0" y1="0" x2="1" y2="0"><stop stopColor="#7c9068" /><stop offset="1" stopColor="#a4b68e" /></linearGradient>
            <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#f1f7e0" stopOpacity=".75" /><stop offset="1" stopColor="#94ae78" stopOpacity=".16" /></linearGradient>
            <filter id={`${id}-shadow`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="10" /></filter>
          </defs>
          <ellipse cx="127" cy="255" rx="75" ry="10" fill="#4b6043" opacity=".16" filter={`url(#${id}-shadow)`} />
          <path d="M48 53 77 31 204 31 175 53Z" fill="#e5ebd8" stroke="#cdd6bf" />
          <path d="M175 53 204 31 204 219 175 241Z" fill={`url(#${id}-side)`} stroke="#8d9f7b" />
          <path d="M48 53H175V241H146V85H77V241H48Z" fill={`url(#${id}-face)`} stroke="#c4cdb7" />
          <path d="M77 85H146V241H77Z" fill={`url(#${id}-glass)`} />
          <path d="M83 91H140V234H83Z" fill="none" stroke="#f5f8eb" strokeOpacity=".8" />
          <path d="M77 85 89 75 158 75 146 85" fill="#d6dfc9" />
          <path d="M146 85 158 75 158 231 146 241" fill="#829772" opacity=".5" />
          <path d="M64 61H163" stroke="white" strokeOpacity=".8" />
          <path d="M63 67H163" stroke="#8c9a7b" strokeOpacity=".25" />
          <path d="M92 137 111 129 130 137V151C130 166 111 178 111 178S92 166 92 151Z" fill="#263d2e" />
          <path d="m103 152 6 6 12-14" fill="none" stroke="#e2efc9" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="62" cy="218" r="3" fill="#527844" />
        </svg>
        <div className={styles.gateLabel}><ShieldCheck size={13} aria-hidden="true" />PayeeGuard</div>
      </div>
      <div className={styles.destinationNodes}>
        <div className={styles.approvedNode}>
          <span className={styles.accountLetter}>A</span>
          <div><span className={styles.nodeKicker}>CURRENT ACCOUNT</span><strong>Approved destination</strong><span className={styles.approvedStatus}><Check size={12} aria-hidden="true" /> Remains active</span></div>
          <ArrowUpRight size={17} className={styles.accountArrow} aria-hidden="true" />
        </div>
        <div className={styles.pendingNode}>
          <span className={styles.accountLetter}>B</span>
          <div><span className={styles.nodeKicker}>PROPOSED ACCOUNT</span><strong>New login verified</strong><span className={styles.pendingStatus}><LockKeyhole size={11} aria-hidden="true" /> Authorization pending</span></div>
        </div>
      </div>
      <div className={styles.diagramAnnotation}><span />CONTROL OF AN ACCOUNT ≠ ENTITLEMENT TO EARNINGS</div>
    </div>
  );
}
