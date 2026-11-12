import { useCallback, useEffect, useState } from 'react';
import type { DestinationChangeCase } from '../../types/case';
import { listEarnings, executePayout, reconcilePayout, payoutErrorText, ApiError, type Earning } from '../../api/client';
import { accountNames } from '../../utils/accounts';
import { Button } from '../common/Button';
import { Wallet, RefreshCw, Send } from 'lucide-react';
import styles from '../../styles/journey.module.css';

function statusWords(e: Earning): { text: string; tone: 'ok' | 'wait' | 'bad' | 'none' } {
  const op = e.payout;
  if (!op) return { text: 'Not paid yet', tone: 'none' };
  if (op.needs_attention) return { text: `Needs attention: PayPal says ${op.provider_status.toLowerCase()}`, tone: 'bad' };
  if (op.provider_status === 'SUCCESS') return { text: 'Paid. PayPal says success', tone: 'ok' };
  if (op.provider_status === 'PENDING') return { text: 'Sent. PayPal is still processing', tone: 'wait' };
  return { text: `PayPal says ${op.provider_status.toLowerCase()}`, tone: 'wait' };
}

/** Pays the seller's stored earnings through the payout gate. The gate pays only the account the backend has on file. */
export function PayoutsPanel({ caseData }: { caseData: DestinationChangeCase }) {
  const names = accountNames(caseData);
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try { setEarnings(await listEarnings()); setError(null); } catch { setError('Could not load the earnings.'); } finally { setLoaded(true); }
  }, []);
  useEffect(() => { void load(); }, [load, caseData.version]);

  const act = async (id: string, kind: 'pay' | 'check') => {
    setBusy(id + kind); setError(null);
    try { if (kind === 'pay') await executePayout(id); else await reconcilePayout(id); await load(); }
    catch (err) { setError(err instanceof ApiError ? payoutErrorText(err.code) : 'Could not reach the backend. Nothing was sent.'); }
    finally { setBusy(null); }
  };

  // Everything goes to the current account until the backend activates the new one. Sales that arrived before this request
  // are still payable, so they are shown and marked, not hidden.
  const startedAt = Date.parse(caseData.created_at) / 1000;
  const shown = earnings;
  const beforeRequest = (e: Earning) => e.received_at !== undefined && !Number.isNaN(startedAt) && e.received_at < startedAt;
  const paidAccount = names.activated ? names.newId : names.currentId;
  const tone: Record<string, string> = { ok: 'var(--ok)', wait: 'var(--sky)', bad: 'var(--bad)', none: 'var(--muted)' };

  return (
    <section className={styles.wrap} aria-label="Payouts" data-testid="payouts-panel" style={{ marginTop: 'var(--space-4)' }}>
      <div className={styles.head}>
        <h2 className={styles.title} style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Wallet size={18} aria-hidden="true" />Seller earnings</h2>
        <span className={styles.next} role="status" data-testid="paid-account">
          Payouts go to: {paidAccount ? <strong>{paidAccount}</strong> : 'the account on file'} {names.activated ? '(the new account)' : '(the current account)'}
        </span>
      </div>
      <p className={styles.aiSummary}>
        These are the seller's sales. The payout gate sends each one to the account the backend has on file. You cannot choose an amount or an account here.
        {!names.activated && ' While a change is waiting, earnings still go to the current account.'}
      </p>
      {error && <div role="alert" className={styles.notice}>{error}</div>}
      {loaded && shown.length === 0 && <p className={styles.fine}>No earnings yet.</p>}
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 'var(--space-3)' }}>
        {shown.map((e) => {
          const w = statusWords(e);
          return (
            <li key={e.earning_id} data-testid={`earning-${e.earning_id}`} style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', border: '1px solid var(--line-dark)', borderRadius: 'var(--radius-sm)', background: 'var(--night)' }}>
              <div>
                <strong>Sale {e.earning_id}</strong> · {e.amount} {e.currency}{beforeRequest(e) ? ' · arrived before this request' : ''}
                <div style={{ fontSize: 'var(--text-xs)', color: tone[w.tone] }}>{w.text}</div>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                {!e.payout && (
                  <Button variant="primary" size="sm" icon={<Send size={13} />} loading={busy === e.earning_id + 'pay'} onClick={() => void act(e.earning_id, 'pay')}>Pay this earning</Button>
                )}
                {e.payout && (
                  <Button variant="secondary" size="sm" icon={<RefreshCw size={13} />} loading={busy === e.earning_id + 'check'} onClick={() => void act(e.earning_id, 'check')}>Check with PayPal</Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
