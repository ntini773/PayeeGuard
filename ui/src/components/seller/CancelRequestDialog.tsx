import { useEffect, useId, useRef } from 'react';
import { Button } from '../common/Button';
import styles from '../../styles/cancelRequest.module.css';

export function CancelRequestDialog({ onDismiss, onConfirm }: { onDismiss: () => void; onConfirm: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId();
  const description = useId();
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby={title} aria-describedby={description}
    onCancel={onDismiss}>
    <h2 id={title}>Cancel this request?</h2>
    <p id={description}>Are you sure? This stops your request to change payout accounts. Your current payout account will stay in place if the cancellation succeeds.</p>
    <div className={styles.actions}>
      <Button variant="secondary" autoFocus onClick={onDismiss}>Keep request</Button>
      <Button variant="reject" onClick={onConfirm}>Yes, cancel request</Button>
    </div>
  </dialog>;
}
