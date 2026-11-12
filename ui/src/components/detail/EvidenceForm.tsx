import { useState } from 'react';
import type { DestinationChangeCase } from '../../types/case';
import { recordEvidence, ApiError } from '../../api/client';
import { Button } from '../common/Button';
import { humanizeFinding } from '../../content/labels';
import { ClipboardCheck, AlertTriangle } from 'lucide-react';
import { formatDate } from '../../utils/format';
import styles from '../../styles/journey.module.css';

interface Props {
  caseData: DestinationChangeCase;
  onRefresh?: () => void;
}

/** Marketplace evidence: what the marketplace's own records show about this change. A reviewer records it before approval. */
export function EvidenceForm({ caseData, onRefresh }: Props) {
  const recovery = caseData.authentication.old_account.status !== 'MATCHED';
  const kind = recovery ? 'ACCOUNT_RECOVERY' : 'SELLER_ENTITLEMENT';
  const [reference, setReference] = useState('');
  const [reason, setReason] = useState('');
  const [confirms, setConfirms] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const open = caseData.state === 'PENDING_REVIEW';
  const ready = reference.trim().length >= 3 && reason.trim().length >= 5 && confirms !== null;

  const submit = async () => {
    if (!ready || confirms === null) return;
    setBusy(true); setError(null); setDone(null);
    try {
      await recordEvidence(caseData.case_id, { kind, reference: reference.trim(), reason: reason.trim(), accepted: confirms, expectedVersion: caseData.version });
      setDone(confirms ? 'Recorded: the records confirm this request.' : 'Recorded: the records do not confirm this request. Approval stays blocked.');
      setReference(''); setReason(''); setConfirms(null);
      onRefresh?.();
    } catch (err) {
      setError(err instanceof ApiError && err.code === 'CASE_VERSION_CONFLICT' ? 'Someone changed this case. Reload and try again.'
        : err instanceof ApiError && err.code === 'CASE_STATE_CONFLICT' ? 'Evidence can only be recorded while the case waits for review.'
        : err instanceof ApiError && err.status === 403 ? 'Only a marketplace operator can record evidence.'
        : 'The backend did not accept that evidence.');
    } finally { setBusy(false); }
  };

  const field: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line-dark)', background: 'var(--night)', color: 'var(--text)', fontFamily: 'inherit', fontSize: 'var(--text-sm)' };
  const findings = caseData.reviewer_findings ?? [];
  const recorded = caseData.marketplace_evidence ?? [];

  return (
    <section id="evidence-form" className={styles.wrap} aria-label="Marketplace evidence" data-testid="evidence-form" style={{ marginTop: 'var(--space-4)' }}>
      <div className={styles.head}>
        <h2 className={styles.title} style={{ display: 'flex', gap: 8, alignItems: 'center' }}><ClipboardCheck size={18} aria-hidden="true" />Marketplace evidence</h2>
        <span className={styles.advisory}>{recovery ? 'RECOVERY REVIEW' : 'ENTITLEMENT CHECK'}</span>
      </div>
      <p className={styles.aiSummary}>
        {recovery
          ? 'The seller could not prove the current account by PayPal login. Check the marketplace\'s own records (account history, identity checks) and record what they show.'
          : 'Check the marketplace\'s own records that this seller owns the change, then record what they show.'}
        {' '}Approval stays blocked until evidence is recorded and confirms the request.
      </p>

      {findings.length > 0 && (
        <div className={styles.notice} role="alert" data-testid="reviewer-findings" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <AlertTriangle size={15} aria-hidden="true" /><span><strong>Warning for reviewers:</strong> {findings.map(humanizeFinding).join(' ')}</span>
        </div>
      )}

      {recorded.length > 0 && (
        <ul className={styles.questions} aria-label="Evidence already recorded">
          {recorded.map((e, i) => (
            <li key={i}>{e.accepted ? 'Confirms' : 'Does not confirm'} · {e.kind === 'ACCOUNT_RECOVERY' ? 'account recovery' : 'seller entitlement'} · {e.reference} · {formatDate(e.at)}</li>
          ))}
        </ul>
      )}

      <p className={styles.fine} data-testid="evidence-prototype-note">Prototype step: here a reviewer types in what the records show. A real marketplace would feed this from its own systems.</p>

      {open ? (
        <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
          <input style={field} aria-label="Evidence reference" placeholder="Reference, for example the record or ticket number" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={100} />
          <textarea style={{ ...field, minHeight: 72 }} aria-label="What the records show" placeholder="What do the marketplace's records show?" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} />
          <div role="radiogroup" aria-label="Do the records confirm the request?" style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', fontSize: 'var(--text-sm)' }}>
            <label><input type="radio" name="confirms" checked={confirms === true} onChange={() => setConfirms(true)} /> The records confirm this request</label>
            <label><input type="radio" name="confirms" checked={confirms === false} onChange={() => setConfirms(false)} /> The records do not confirm it</label>
          </div>
          {error && <div role="alert" className={styles.notice}>{error}</div>}
          {done && <div role="status" className={styles.notice} data-testid="evidence-done">{done}</div>}
          <div><Button variant="primary" size="md" loading={busy} disabled={!ready} disabledReason={!ready ? 'Add a reference, what the records show, and your finding' : undefined} onClick={() => void submit()}>Record evidence</Button></div>
        </div>
      ) : (
        <p className={styles.fine}>Evidence can be recorded while the case waits for the operator.</p>
      )}
    </section>
  );
}
