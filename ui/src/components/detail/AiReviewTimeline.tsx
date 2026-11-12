import { Check, Circle, Globe, Loader2, ShieldAlert } from 'lucide-react';
import type { AiReviewEvent } from '../../api/client';
import { reviewSteps } from '../../utils/reviewTimeline';
import styles from '../../styles/reviewTimeline.module.css';

interface Props {
  events: AiReviewEvent[];
  running: boolean;
  failed: boolean;
  paypalWord: string;
}

export function AiReviewTimeline({ events, running, failed, paypalWord }: Props) {
  const steps = reviewSteps(events, running);
  return <div className={styles.panel} data-testid="ai-live">
    <div className={styles.heading}>
      <span>Review activity</span>
      <span className={styles.status} role="status">{running ? 'In progress' : failed ? 'Review stopped' : 'Review complete'}</span>
    </div>
    <ol className={styles.timeline} aria-label="What the AI is doing" aria-live="polite" aria-relevant="additions text">
      {steps.map(step => <li key={step.id} className={styles.step} data-state={step.state}
        data-testid="ai-review-step" aria-current={step.state === 'running' ? 'step' : undefined}>
        <span className={styles.node} role="img" aria-label={step.state === 'done' ? 'Completed' : step.state === 'running' ? 'In progress' : step.state === 'waiting' ? 'Unconfirmed' : step.state === 'error' ? 'Failed' : 'Blocked'}>
          {step.state === 'done' ? <Check size={16} strokeWidth={2.5} />
            : step.state === 'running' ? <Loader2 size={17} className={styles.spinner} />
            : step.state === 'blocked' || step.state === 'error' ? <ShieldAlert size={16} /> : <Circle size={10} />}
        </span>
        <div className={styles.content}>
          <div className={styles.titleRow}><strong>{step.title}</strong>
            {step.tool === 'get_recent_payouts' && <span className={styles.paypalTag}><Globe size={12} aria-hidden="true" />{paypalWord === 'simulated PayPal' ? 'Simulated read' : `Live read · ${paypalWord}`}</span>}
          </div>
          {step.detail && <p className={styles.detail}>{step.detail}</p>}
          {step.state === 'running' && <span className={styles.current}>Working on this step</span>}
          {step.state === 'waiting' && !running && <span className={styles.current}>Completion not confirmed</span>}
        </div>
      </li>)}
    </ol>
  </div>;
}
