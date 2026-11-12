import { useEffect, useState } from 'react';
import type { DestinationChangeCase } from '../../types/case';
import { Button } from '../common/Button';
import { Check, X, AlertCircle, RotateCcw } from 'lucide-react';
import { reviewErrorText } from '../../api/client';
import { humanizeState } from '../../content/labels';
import styles from '../../styles/stickyBar.module.css';

interface Props {
  caseData: DestinationChangeCase;
  onDecisionSubmitted?: (
    decision: 'APPROVE' | 'REJECT', reason: string, version: number
  ) => Promise<{ success: boolean; conflict?: boolean; error?: string }>;
  onRefresh?: () => void;
  /** Opens the evidence tab. Used when the backend says evidence is missing. */
  onNeedEvidence?: () => void;
}

export function StickyActionBar({ caseData, onDecisionSubmitted, onRefresh, onNeedEvidence }: Props) {
  const [reason, setReason] = useState('');
  // The AI card can type a draft rationale here. It only fills the box; the operator still presses Approve or Reject.
  useEffect(() => {
    let alive = true;
    const onType = async (e: Event) => {
      const text = String((e as CustomEvent<{ text?: string }>).detail?.text ?? '').slice(0, 600);
      const step = Math.max(2, Math.ceil(text.length / 80));
      for (let i = step; i < text.length && alive; i += step) { setReason(text.slice(0, i)); await new Promise((r) => setTimeout(r, 25)); }
      if (alive) setReason(text);
    };
    window.addEventListener('payeeguard:type-rationale', onType);
    return () => { alive = false; window.removeEventListener('payeeguard:type-rationale', onType); };
  }, []);
  const [isFocused, setIsFocused] = useState(false);
  const [isConfirmingReject, setIsConfirmingReject] = useState(false);
  const [conflictError, setConflictError] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [needsEvidence, setNeedsEvidence] = useState(false);
  const [busy, setBusy] = useState(false);

  const canReview = caseData.state === 'PENDING_REVIEW';
  const isDenyOrReject = caseData.policy.decision === 'REJECT';

  const hasReason = reason.trim().length >= 3;

  // Never claim success before the backend answers.
  const submit = async (decision: 'APPROVE' | 'REJECT') => {
    if (!hasReason || busy || !onDecisionSubmitted) return;
    setBusy(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const result = await onDecisionSubmitted(decision, reason.trim(), caseData.version);
      if (result.success) {
        setStatusMessage(decision === 'APPROVE'
          ? 'The backend accepted the approval. The case now waits out cooling-off.'
          : 'The backend recorded the rejection.');
        setReason('');
        setIsConfirmingReject(false);
        onRefresh?.();
      } else if (result.conflict) {
        setConflictError(true);
      } else {
        setErrorMessage(reviewErrorText(result.error));
        setNeedsEvidence(result.error === 'POLICY_REVIEW_REQUIRED');
        setIsConfirmingReject(false);
      }
    } catch {
      setErrorMessage('Could not reach the backend. Nothing was changed.');
    } finally {
      setBusy(false);
    }
  };
  const handleApprove = () => { void submit('APPROVE'); };
  const handleConfirmReject = () => { void submit('REJECT'); };

  return (
    <aside
      aria-label="Operator Authorization Actions"
      className={styles.stickyBar}
    >
      <div className={styles.innerContainer}>
        {/* Left: Status & Notice */}
        <div className={styles.statusCol}>
          {!canReview ? (
            <div className={styles.notReviewableNote}>
              <span>Case is <strong>{humanizeState(caseData.state)}</strong>. Review opens when the case is waiting for the operator.</span>
            </div>
          ) : conflictError ? (
            <div className={styles.conflictWarning}>
              <AlertCircle size={15} />
              <span>Version conflict (409): Someone modified this case. Please reload.</span>
            </div>
          ) : (
            <div className={styles.reviewReadyNote}>
              <span className={styles.versionTag}>Target Version: v{caseData.version}</span>
              <span className={styles.noteSub}>
                Marketplace operator approval requires reason and initiates cooling-off.
              </span>
            </div>
          )}

          {errorMessage && (
            <div role="alert" className={styles.conflictWarning} data-testid="review-error">
              <AlertCircle size={15} />
              <span>{errorMessage}</span>
              {needsEvidence && onNeedEvidence && (
                <Button variant="secondary" size="sm" onClick={() => { onNeedEvidence(); setTimeout(() => document.getElementById('evidence-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 250); }}>
                  Record evidence
                </Button>
              )}
            </div>
          )}

          {statusMessage && (
            <div role="status" aria-live="polite" className={styles.successMessage}>
              <Check size={14} />
              <span>{statusMessage}</span>
            </div>
          )}
        </div>

        {/* Right: Controls & Reason input */}
        <div className={styles.actionsCol}>
          {conflictError ? (
            <Button
              variant="primary"
              size="md"
              icon={<RotateCcw size={14} />}
              onClick={() => {
                setConflictError(false);
                onRefresh?.();
              }}
            >
              Reload Case
            </Button>
          ) : canReview ? (
            <>
              {/* Reason Input */}
              <div className={`${styles.reasonWrapper} ${isFocused || reason ? styles.expanded : ''}`}>
                <input
                  type="text"
                  name="operator_reason"
                  autoComplete="off"
                  className={styles.reasonInput}
                  placeholder="Rationale / evidence notes (required to approve/reject)…"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  aria-label="Operator rationale"
                />
              </div>

              {/* Action Buttons */}
              <div className={styles.buttonsGroup}>
                {isConfirmingReject ? (
                  <div className={styles.confirmBox}>
                    <span className={styles.confirmPrompt}>Confirm rejection?</span>
                    <Button
                      variant="reject"
                      size="md"
                      onClick={handleConfirmReject}
                      disabled={!hasReason || busy}
                      disabledReason={!hasReason ? 'Enter a reason to reject' : undefined}
                    >
                      Confirm Reject
                    </Button>
                    <Button
                      variant="quiet"
                      size="sm"
                      onClick={() => setIsConfirmingReject(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <>
                    <Button
                      variant="reject"
                      size="md"
                      icon={<X size={15} />}
                      onClick={() => setIsConfirmingReject(true)}
                      disabled={!hasReason || busy}
                      disabledReason={!hasReason ? 'Enter a rationale before rejecting' : undefined}
                    >
                      Reject change
                    </Button>

                    {!isDenyOrReject && (
                      <Button
                        variant="approve"
                        size="md"
                        icon={<Check size={16} />}
                        onClick={handleApprove}
                        disabled={!hasReason || busy}
                        disabledReason={
                          !hasReason
                            ? 'Add a reason before approving'
                            : undefined
                        }
                      >
                        Approve change
                      </Button>
                    )}
                  </>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
