import type { DestinationChangeCase } from '../../types/case';
import { accountNames, withId } from '../../utils/accounts';
import { countdown, formatDate } from '../../utils/format';
import { Check, Clock, AlertTriangle, XCircle, Circle } from 'lucide-react';
import styles from '../../styles/journey.module.css';

type Viewer = 'seller' | 'operator';
type Status = 'done' | 'current' | 'todo' | 'attention' | 'stopped';
interface Step { key: string; title: string; actor: string; detail: string; status: Status }

function nextLine(c: DestinationChangeCase, viewer: Viewer): string {
  switch (c.state) {
    case 'CHANGE_REQUESTED':
    case 'PENDING_NEW_ACCOUNT_AUTH': return 'Next: verify the new account with PayPal.';
    case 'PENDING_OLD_ACCOUNT_AUTH': return 'Next: verify the current account, or ask for a recovery review.';
    case 'PENDING_REVIEW': return viewer === 'operator' ? 'Next: you review and decide.' : 'Next: the operator reviews.';
    case 'APPROVED_COOLING_OFF': return 'Next: the safety wait ends, then the backend switches the account.';
    case 'ACTIVE_NEW_DESTINATION': return 'Done: the new account is now paid.';
    case 'REJECTED': return 'Stopped: rejected. The current account keeps receiving payouts.';
    case 'EXPIRED': return 'Stopped: expired. The current account keeps receiving payouts.';
    default: return 'No change: the connected account is already the paid account.';
  }
}

function buildSteps(c: DestinationChangeCase): Step[] {
  const { activated, currentId, newId } = accountNames(c);
  const dead = c.state === 'REJECTED' || c.state === 'EXPIRED';
  const pending = (is: boolean): Status => (dead ? 'stopped' : is ? 'current' : 'todo');
  const newOk = c.authentication.new_account.status === 'VALIDATED';
  const old = c.authentication.old_account.status;
  const review = c.marketplace_review.status;
  const cooling = c.state === 'APPROVED_COOLING_OFF';
  const left = countdown(c.cooling_off.ends_at);

  return [
    { key: 'request', title: '1. Request', actor: 'Seller', status: 'done',
      detail: `Requested ${formatDate(c.created_at)}` },
    { key: 'new', title: '2. Verify new account', actor: 'Seller + PayPal',
      status: newOk ? 'done' : pending(c.state === 'CHANGE_REQUESTED' || c.state === 'PENDING_NEW_ACCOUNT_AUTH'),
      detail: newOk ? withId('Verified', newId) : 'Prove the new account is yours' },
    { key: 'old', title: '3. Verify current account', actor: 'Seller + PayPal',
      status: old === 'MATCHED' ? 'done' : old === 'UNAVAILABLE' || old === 'NOT_MATCHED' ? 'attention'
        : pending(newOk && c.state === 'PENDING_OLD_ACCOUNT_AUTH'),
      detail: old === 'MATCHED' ? withId('Matches the paid account', currentId)
        : old === 'UNAVAILABLE' ? 'Cannot log in: recovery review'
        : old === 'NOT_MATCHED' ? 'A different account logged in: recovery review'
        : withId('Must match the paid account', currentId) },
    { key: 'review', title: '4. Review', actor: 'Operator',
      status: review === 'APPROVED' ? 'done' : review === 'REJECTED' ? 'stopped' : pending(c.state === 'PENDING_REVIEW'),
      detail: review === 'APPROVED' ? 'Approved' : review === 'REJECTED' ? 'Rejected' : 'Needs evidence and a reason' },
    { key: 'cool', title: '5. Safety wait', actor: 'Backend timer',
      status: activated ? 'done' : cooling ? 'current' : dead ? 'stopped' : 'todo',
      detail: cooling ? (left ?? `Ends ${formatDate(c.cooling_off.ends_at)}`) : activated ? 'Elapsed' : 'Starts after approval' },
    { key: 'paid', title: '6. Updated', actor: 'Backend',
      status: activated ? 'done' : dead ? 'stopped' : 'todo',
      detail: activated ? withId('Receives payouts', newId) : withId('Payouts still go to the current account', currentId) },
  ];
}

const ICON: Record<Status, React.ReactNode> = {
  done: <Check size={13} aria-hidden="true" />, current: <Clock size={13} aria-hidden="true" />,
  attention: <AlertTriangle size={13} aria-hidden="true" />, stopped: <XCircle size={13} aria-hidden="true" />,
  todo: <Circle size={13} aria-hidden="true" />,
};
const WORD: Record<Status, string> = { done: 'Done', current: 'Now', attention: 'Needs review', stopped: 'Stopped', todo: 'Later' };

export function JourneyStepper({ caseData, viewer = 'operator' }: { caseData: DestinationChangeCase; viewer?: Viewer }) {
  const steps = buildSteps(caseData);
  const markClass: Record<Status, string> = {
    done: styles.markDone, current: styles.markCurrent, attention: styles.markAttention,
    stopped: styles.markStopped, todo: styles.markTodo,
  };
  return (
    <section className={`${styles.wrap} ${viewer === 'seller' ? styles.sellerJourney : ''}`} aria-label="Progress of this request" data-testid="journey">
      <div className={styles.head}>
        <h2 className={styles.title}>Progress</h2>
        <span className={styles.next} role="status">{nextLine(caseData, viewer)}</span>
      </div>
      <ol className={styles.steps}>
        {steps.map((s) => (
          <li key={s.key} className={`${styles.step} ${styles[s.status]}`} aria-current={s.status === 'current' ? 'step' : undefined}>
            <span className={`${styles.mark} ${markClass[s.status]}`}>{ICON[s.status]}{WORD[s.status]}</span>
            <span className={styles.stepTitle}>{s.title}</span>
            <span className={styles.actor}>{s.actor}</span>
            <span className={styles.detail}>{s.detail}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
