import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { RouteLink as Link } from '../../routing/RouteLink';
import { ArrowUpRight, Menu, Pause, Play, Shield, X } from 'lucide-react';
import { useMotion } from '../../context/MotionContext';
import styles from '../../styles/layout.module.css';

const navigation = [
  { path: '/', label: 'Overview' },
  { path: '/how-it-works', label: 'Docs' },
  { path: '/seller', label: 'Seller' },
  { path: '/console', label: 'Operator' },
  { path: '/schema', label: 'API' },
];

export function Header() {
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { reducedMotion, systemReducedMotion, toggleReducedMotion } = useMotion();
  const isLanding = pathname === '/';

  useEffect(() => { setMenuOpen(false); }, [pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    document.querySelector<HTMLAnchorElement>('#primary-navigation a')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        document.getElementById('navigation-toggle')?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  return (
    <header className={`${styles.header} ${isLanding ? styles.landingHeader : ''}`}>
      <div className={styles.headerInner}>
        <Link to="/" className={styles.brand} aria-label="PayeeGuard home">
          <span className={styles.brandIcon} aria-hidden="true"><Shield size={19} strokeWidth={2} /></span>
          <span className={styles.title}>PayeeGuard<span className={styles.brandPeriod}>.</span></span>
        </Link>

        <nav id="primary-navigation" className={`${styles.nav} ${menuOpen ? styles.navOpen : ''}`} aria-label="Primary navigation">
          {navigation.map(({ path, label }) => (
            <Link key={path} to={path} aria-current={pathname === path ? 'page' : undefined}
              className={`${styles.navLink} ${pathname === path ? styles.activeLink : ''}`}
              onClick={() => setMenuOpen(false)}>
              {label}
            </Link>
          ))}
        </nav>

        <div className={styles.controls}>
          <button type="button" onClick={toggleReducedMotion} className={styles.motionToggle}
            disabled={systemReducedMotion} aria-pressed={reducedMotion}
            title={systemReducedMotion ? 'Motion reduced by your device preference' : reducedMotion ? 'Enable animations' : 'Reduce motion'}
            aria-label={systemReducedMotion ? 'Motion reduced by your device preference' : reducedMotion ? 'Enable animations' : 'Reduce motion'}>
            {reducedMotion ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}
          </button>
          {pathname !== '/console' && (
            <Link to="/console" className={styles.consoleLink}><span className={styles.consoleFull}>Open console</span><span className={styles.consoleShort}>Console</span><ArrowUpRight size={15} aria-hidden="true" /></Link>
          )}
          <button id="navigation-toggle" type="button" className={styles.menuToggle}
            aria-controls="primary-navigation" aria-expanded={menuOpen}
            aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} onClick={() => setMenuOpen((open) => !open)}>
            {menuOpen ? <X size={21} aria-hidden="true" /> : <Menu size={21} aria-hidden="true" />}
          </button>
        </div>
      </div>
    </header>
  );
}
