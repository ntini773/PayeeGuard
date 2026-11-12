import { useState } from 'react';
import { login } from '../../api/client';
import { Button } from '../common/Button';
import { ArrowRight, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import styles from '../../styles/auth.module.css';

interface Props {
  onSignedIn: () => void;
  title?: string;
  hint?: string;
}

/** Marketplace sign-in. Sessions are HttpOnly cookies set by the backend. */
export function LoginPanel({ onSignedIn, title = 'Marketplace operator sign-in', hint = 'Sign in with your marketplace operator account to review payout destination changes.' }: Props) {
  const isSeller = useLocation().pathname === '/seller';
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(username.trim(), password);
      setPassword('');
      onSignedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.page}>
      <aside className={styles.intro} aria-label="Your marketplace workspace">
        <span className={styles.eyebrow}><ShieldCheck size={13} aria-hidden="true" /> YOUR MARKETPLACE. YOUR GUARDRAILS.</span>
        <h2>{isSeller ? <>Your earnings.<br /><span>The right destination.</span></> : <>Review with context.<br /><span>Decide with confidence.</span></>}</h2>
        <p>{isSeller ? 'Manage your payout account and follow each step of a change, with clear guidance along the way.' : 'See the evidence, understand the request, and keep marketplace earnings on their authorized path.'}</p>
        <div className={styles.boundary} aria-hidden="true"><span className={styles.account}>A</span><span className={styles.boundaryLine} /><span className={styles.gate}><ShieldCheck size={26} /></span><span className={styles.boundaryLine} /><span className={`${styles.account} ${styles.locked}`}>B</span></div>
        <div className={styles.boundaryNote}><LockKeyhole size={12} aria-hidden="true" /> A new login is evidence. Authorization is a separate step.</div>
      </aside>
      <div>
        <form onSubmit={submit} aria-labelledby="login-title" data-testid="login-form" className={styles.form}>
          <span className={styles.formIcon} aria-hidden="true">{isSeller ? <UserRound size={21} /> : <ShieldCheck size={21} />}</span>
          <div><h1 id="login-title">{title}</h1><p className={styles.hint}>{hint}</p></div>
          <label className={styles.field}>
            <span>Username</span>
            <input name="username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
          </label>
          <label className={styles.field}>
            <span>Password</span>
            <input name="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          {error && <div role="alert" className={styles.error}>{error}</div>}
          <Button type="submit" variant="primary" size="md" className={styles.submit} icon={<ArrowRight size={15} />} loading={busy} disabled={!username || !password}>Sign in</Button>
          <p className={styles.roleSwitch}>{isSeller ? 'Reviewing marketplace requests?' : 'Managing your own earnings?'} <Link to={isSeller ? '/console' : '/seller'}>{isSeller ? 'Operator sign-in' : 'Seller sign-in'}</Link></p>
        </form>
        <p className={styles.privacy}><LockKeyhole size={12} aria-hidden="true" /><span>Use your marketplace login here. PayPal account verification happens separately on PayPal.</span></p>
      </div>
    </div>
  );
}
