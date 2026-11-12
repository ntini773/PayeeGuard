import { useLocation } from 'react-router-dom';
import { RouteLink as Link } from '../../routing/RouteLink';
import { Shield, Eye, EyeOff } from 'lucide-react';
import { useMotion } from '../../context/MotionContext';
import styles from '../../styles/layout.module.css';

export function Footer() {
  const { reducedMotion, systemReducedMotion, toggleReducedMotion } = useMotion();
  const isLanding = useLocation().pathname === '/';

  return (
    <footer className={`${styles.footer} ${isLanding ? styles.landingFooter : ''}`}>
      <div className={styles.footerContainer}>
        <div className={styles.footerTop}>
          <div style={{ maxWidth: 420 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div className={styles.brandIcon} aria-hidden="true">
                <Shield size={16} />
              </div>
              <strong style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-lg)' }}>
                PayeeGuard
              </strong>
            </div>
            <p className={styles.footerDisclaimer}>
              Marketplace-side authorization layer for changes to a seller's PayPal payout destination.
              Enforces deterministic evidence validation and payout gating.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-8)', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 8, fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Navigation
              </div>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6, fontSize: 'var(--text-xs)' }}>
                <li><Link to="/" style={{ color: 'var(--muted)' }}>Overview & Demo</Link></li>
                <li><Link to="/console" style={{ color: 'var(--muted)' }}>Operator Console</Link></li>
                <li><Link to="/how-it-works" style={{ color: 'var(--muted)' }}>Docs</Link></li>
                <li><Link to="/schema" style={{ color: 'var(--muted)' }}>API & Schema Explorer</Link></li>
              </ul>
            </div>

            <div>
              <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 8, fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Boundaries & Trust
              </div>
              <p style={{ maxWidth: 280, fontSize: 'var(--text-xs)', color: 'var(--muted-dark)', lineHeight: 1.5 }}>
                UI renders backend state only. AI output is advisory and never authorizes or approves. Callbacks bypass AI directly to backend handlers.
              </p>
            </div>
          </div>
        </div>

        <div className={styles.footerBottom}>
          <div style={{ color: 'var(--muted)' }}>
            <strong>Built on PayPal Payouts. Not affiliated with or endorsed by PayPal.</strong>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button
              type="button"
              onClick={toggleReducedMotion}
              disabled={systemReducedMotion}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                color: 'var(--muted)',
                fontSize: 'var(--text-xs)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: 'var(--radius-sm)',
              }}
              aria-label={systemReducedMotion ? 'Motion reduced by your device preference' : reducedMotion ? 'Enable animations' : 'Reduce motion'}
            >
              {reducedMotion ? <EyeOff size={14} /> : <Eye size={14} />}
              <span>{systemReducedMotion ? 'System motion preference' : reducedMotion ? 'Animations reduced' : 'Reduce motion'}</span>
            </button>
            <span style={{ color: 'var(--muted-dark)' }}>Sandbox prototype</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
