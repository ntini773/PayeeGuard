import { useEffect, useRef, useState } from 'react';
import type { DestinationChangeCase } from '../../types/case';
import { humanizeAiRecommendation } from '../../content/labels';
import { plainWords } from '../../utils/accounts';
import { USE_MOCK_DATA } from '../../config';
import { startAiReview, getAiReview, ApiError, type AiReviewEvent } from '../../api/client';
import { humanizeFinding, humanizeReasonCode, isRiskFlagCode } from '../../content/labels';
import { Mascot } from '../common/Mascot';
import { Button } from '../common/Button';
import { Sparkles, Loader2 } from 'lucide-react';
import styles from '../../styles/journey.module.css';
import { AiReviewTimeline } from './AiReviewTimeline';

interface Props {
  caseData: DestinationChangeCase;
  /** Called when a review finishes, so the case reloads with the new assessment. */
  onRefresh?: () => void;
  /** Backend mode, for the PayPal label. */
  mode?: string;
}

/** The AI investigator, shown next to the decision. The operator can run it live. It is advisory and has no path to approval. */
export function AiInlineCard({ caseData, onRefresh, mode }: Props) {
  const a = caseData.ai_assessment;
  // Trusted flags come from the backend. Older saved assessments fall back to the reviewer findings on the case.
  // An assessment saved before the backend sent `backend_flags` has no list. Then use the case's own findings and risk codes, and never claim "clean".
  const fallbackFlags = Array.from(new Set([
    ...(caseData.reviewer_findings ?? []).map(humanizeFinding),
    ...(caseData.policy?.reason_codes ?? []).filter(isRiskFlagCode).map(humanizeReasonCode),
  ]));
  const knownClean = a?.backend_flags !== undefined && a.backend_flags.length === 0 && fallbackFlags.length === 0;
  const backendFlags = a?.backend_flags?.length ? a.backend_flags : fallbackFlags;
  // The backend puts its flags in front of the model's text. Show the flags in their own box and the model's words below them.
  const flagLead = 'Backend flags: ' + (a?.backend_flags ?? []).join(' ') + ' ';
  const modelText = a?.summary ? (a.backend_flags?.length && a.summary.startsWith(flagLead) ? a.summary.slice(flagLead.length) : a.summary) : '';
  const [running, setRunning] = useState(false);
  const [events, setEvents] = useState<AiReviewEvent[]>([]);
  const [finished, setFinished] = useState<'done' | 'failed' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  const run = async () => {
    setRunning(true); setFinished(null); setEvents([]); setError(null);
    try {
      const runId = await startAiReview(caseData.case_id);
      timer.current = setInterval(async () => {
        try {
          const s = await getAiReview(caseData.case_id, runId);
          setEvents(s.events);
          if (s.status !== 'running') {
            if (timer.current) clearInterval(timer.current);
            setRunning(false); setFinished(s.status);
            onRefresh?.();
          }
        } catch {
          if (timer.current) clearInterval(timer.current);
          setRunning(false); setError('Lost contact with the backend. Nothing was changed.');
        }
      }, 700);
    } catch (err) {
      setRunning(false);
      setError(err instanceof ApiError && err.code === 'CASE_STATE_CONFLICT' ? 'A review is already running for this case.'
        : err instanceof ApiError && (err.status === 403 || err.code === 'REQUEST_DENIED') ? 'Only a marketplace operator can run an AI review.'
        : 'Could not start the AI review.');
    }
  };

  // Every case opens with the AI's proposal already prepared: run it once per case when none exists or the case changed since.
  const autoRan = useRef<Set<string>>(new Set());
  useEffect(() => {
    // Refresh once when a case opens, and again each time the case changes after an assessment (stale), so the summary never lags the evidence.
    const outdated = a && a.backend_flags === undefined && !a.stale;   // saved before the backend sent structured flags
    const key = a?.stale || outdated ? `${caseData.case_id}:v${caseData.version}:${a?.stale ? 's' : 'o'}` : caseData.case_id;
    if (USE_MOCK_DATA || running || autoRan.current.has(key)) return;
    autoRan.current.add(key); void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseData.case_id, caseData.version, a?.stale, !a, a?.backend_flags === undefined]);

  const mood = running ? 'think' : finished === 'failed' || a?.status === 'UNAVAILABLE' ? 'alert' : a ? 'happy' : 'idle';
  const paypalWord = mode === 'sandbox' ? 'PayPal sandbox' : mode === 'demo' ? 'simulated PayPal' : 'PayPal';

  return (
    <section className={styles.aiCard} aria-label="AI investigator" data-testid="ai-inline">
      <div className={styles.aiTop}>
        <h2 className={styles.aiTitle}><Mascot mood={mood} size={46} />AI investigator</h2>
        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
          <span className={styles.advisory}>ADVISORY ONLY</span>
          {!USE_MOCK_DATA && (
            <Button variant="primary" size="md" icon={running ? <Loader2 size={15} /> : <Sparkles size={15} />} loading={running} onClick={() => void run()}
              data-testid="ai-review-button">
              {a ? 'Run AI review again' : 'Run AI review'}
            </Button>
          )}
        </div>
      </div>

      {error && <div className={styles.notice} role="alert">{error}</div>}

      {(running || events.length > 0) && (
        <AiReviewTimeline events={events} running={running} failed={finished === 'failed' || Boolean(error)} paypalWord={paypalWord} />
      )}

      {!a && !running && events.length === 0 && (
        <p className={styles.aiSummary}>No assessment yet. Press AI Review to have the AI read this case and check PayPal for recent payouts. You can still decide from the evidence.</p>
      )}

      {a && a.status === 'UNAVAILABLE' && (
        <div className={styles.notice} role="status">
          The AI could not assess this case{a.unavailable_reason ? ` (${plainWords(a.unavailable_reason)})` : ''}. Nothing was approved.
          The case stays on hold, and you review it by hand.
        </div>
      )}

      {a && a.stale && (
        <div className={styles.notice} role="status">This case changed after the assessment ran, so treat it as out of date. Run the review again.</div>
      )}

      {a && a.status !== 'UNAVAILABLE' && !USE_MOCK_DATA && caseData.state === 'PENDING_REVIEW' && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', margin: '0 0 12px' }}>
          <Button variant="secondary" size="sm" data-testid="ai-type-rationale" onClick={() => {
            const flags = (caseData.reviewer_findings ?? []).map(humanizeFinding);
            const evidence = (caseData.marketplace_evidence ?? []).filter((e) => e.accepted).length;
            const text = `Reviewed the case. AI advisory: ${humanizeAiRecommendation(a.effective_recommendation ?? a.recommendation)}. `
              + (flags.length ? `Backend flags: ${flags.join('; ')}. ` : 'No backend risk flags. ')
              + `Marketplace evidence recorded: ${evidence}. Payouts stay on the current account until this decision.`;
            window.dispatchEvent(new CustomEvent('payeeguard:type-rationale', { detail: { text } }));
          }}>Type a rationale for me</Button>
          <span style={{ color: 'var(--muted)', fontSize: 'var(--text-xs)' }}>The AI types a draft from its advisory and the backend facts. You read it and press Approve or Reject yourself.</span>
        </div>
      )}

      {a && a.status !== 'UNAVAILABLE' && (
        <>
          <div className={styles.summaryBox} data-testid="ai-summary-box">
            <div className={styles.summaryLabel}>AI summary</div>
            <p className={styles.summaryLead}>
              The AI suggests: <strong>{humanizeAiRecommendation(a.recommendation)}</strong>
              {' '}· it read the request as <strong>{plainWords(a.reason_category)}</strong>.
              {a.effective_recommendation && a.effective_recommendation !== a.recommendation && (
                <> The backend rules still require: <strong>{humanizeAiRecommendation(a.effective_recommendation)}</strong>.</>
              )}
            </p>
            {/* The small model can miss facts, so the backend's own findings are shown first, in their own box, and are never contradicted by a chip. */}
            {backendFlags.length > 0 ? (
              <div className={styles.backendFindings} data-testid="backend-findings" role="alert">
                <strong>What the backend found ({backendFlags.length})</strong>
                <ul>{backendFlags.map((f) => <li key={'f' + f}>{f}</li>)}</ul>
              </div>
            ) : knownClean ? (
              <div className={styles.backendClear} data-testid="backend-clear"><strong>No backend risk flags.</strong> The marketplace and PayPal facts checked so far look clean.</div>
            ) : null}
            {modelText && <p className={styles.summaryText}><span className={styles.summaryLabel}>The AI's reading of the seller's message</span><br />{modelText}</p>}
            <ul className={styles.summaryChips} aria-label="Signals the AI found">
              {a.risk_signals.map((s) => <li key={s} className={`${styles.summaryChip} ${styles.summaryChipRisk}`}>{plainWords(s)}</li>)}
              {a.missing_information.filter((m) => !(/new.?account/i.test(m) && caseData.authentication?.new_account?.status === 'VALIDATED')).map((m) => <li key={m} className={styles.summaryChip}>Still needed: {plainWords(m)}</li>)}
            </ul>
            {a.follow_up_questions && a.follow_up_questions.length > 0 && (
              <>
                <strong className={styles.summaryText}>Questions the AI would ask the seller</strong>
                <ul className={styles.summaryList}>{a.follow_up_questions.map((q) => <li key={q}>{q}</li>)}</ul>
              </>
            )}
          </div>
        </>
      )}

      <p className={styles.fine}>
        The AI reads with read-only tools. It cannot verify a PayPal login, approve, reject, release a hold or move money.
        The backend rules decide, and you approve.
      </p>
    </section>
  );
}
