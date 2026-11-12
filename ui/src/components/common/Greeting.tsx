import type { MascotMood } from './Mascot';
import { ShieldCheck, UserRound } from 'lucide-react';
import { displayName, roleName } from '../../utils/names';
import styles from '../../styles/app.module.css';

interface Props {
  userId: string;
  role: string;
  line: string;
  mood?: MascotMood;
  children?: React.ReactNode;
}

/** The big hello after sign-in. Shows who is using the site. */
export function Greeting({ userId, role, line, mood = 'wave', children }: Props) {
  return (
    <header className={styles.sessionHeader} data-testid="session-bar">
      <div className={styles.identity}>
        <span className={styles.avatar} aria-hidden="true">{role === 'operator' ? <ShieldCheck size={25} /> : <UserRound size={24} />}</span>
        <div>
          <span className={styles.workspaceLabel}>{roleName(role)} workspace</span>
          <h1 className={styles.greetingTitle}>Hi, <span>{displayName(userId)}</span></h1>
          <p className={styles.identityLine}>Signed in as <strong>{userId}</strong>. {line}</p>
        </div>
      </div>
      <div className={styles.sessionControls}>{children}</div>
    </header>
  );
}
