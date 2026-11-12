import { useCallback, useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import type { DestinationChangeCase } from '../../types/case';
import {
  AuthRequiredError, ApiError, beginPayPalLogin, cancelRequest, createRequest, fetchSession, listMyCases, logout,
  requestRecovery, sendSellerMessage, sellerErrorText, type SessionInfo,
} from '../../api/client';
import { USE_MOCK_DATA } from '../../config';
import { LoginPanel } from '../console/LoginPanel';
import { JourneyStepper } from '../detail/JourneyStepper';
import { DestinationPairVisual } from '../detail/DestinationPairVisual';
import { Button } from '../common/Button';
import { Greeting } from '../common/Greeting';
import { SellerDashboard } from '../dashboard/SellerDashboard';
import { SellerGuideChat } from './SellerGuideChat';
import { CancelRequestDialog } from './CancelRequestDialog';
import { accountNames, withId } from '../../utils/accounts';
import { countdown } from '../../utils/format';
import { LogIn, Send, LifeBuoy } from 'lucide-react';
import journey from '../../styles/journey.module.css';
import seller from '../../styles/sellerWorkspace.module.css';

const OPEN = new Set(['CHANGE_REQUESTED', 'PENDING_NEW_ACCOUNT_AUTH', 'PENDING_OLD_ACCOUNT_AUTH', 'PENDING_REVIEW', 'APPROVED_COOLING_OFF']);

const box: React.CSSProperties = {
  marginTop: 'var(--space-5)', padding: 'var(--space-5)', border: '1px solid var(--line-dark)',
  borderRadius: 'var(--radius-md)', background: 'var(--night-2)', display: 'grid', gap: 'var(--space-3)',
};
const field: React.CSSProperties = {
  width: '100%', padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line-dark)',
  background: 'var(--night)', color: 'var(--text)', fontSize: 'var(--text-base)', fontFamily: 'inherit',
};

/** The seller's side of the flow. The seller asks, and proves they own the accounts. The backend and the operator decide. */
export function SellerPage() {
  const [params, setParams] = useSearchParams();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [needLogin, setNeedLogin] = useState(false);
  const [latest, setLatest] = useState<DestinationChangeCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const [category, setCategory] = useState('');
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryText, setRecoveryText] = useState('');
  const [note, setNote] = useState('');
  const [noteSent, setNoteSent] = useState(false);
  const [cancelCaseId, setCancelCaseId] = useState<string | null>(null);
  const [cancelledCaseId, setCancelledCaseId] = useState<string | null>(null);

  const authResult = params.get('auth');
  const authCode = params.get('code');

  const load = useCallback(async () => {
    try {
      const info = await fetchSession();
      setSession(info);
      if (!info.user) { setNeedLogin(true); setLoading(false); return; }
      setNeedLogin(false);
      const mine = await listMyCases();
      setLatest(mine.length ? mine[0] : null);
      setError(null);
    } catch (err) {
      if (err instanceof AuthRequiredError) setNeedLogin(true);
      else setError(err instanceof Error ? err.message : 'Could not load your requests.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // While the case is open, check again every 5 seconds so the page follows the operator and the backend timer.
  useEffect(() => {
    if (!latest || !OPEN.has(latest.state)) return undefined;
    const t = setInterval(() => { void load(); }, 5000);
    return () => clearInterval(t);
  }, [latest, load]);

  const submitRequest = () => run(async () => { const c = await createRequest(reason.trim(), category); setLatest(c); setReason(''); setCategory(''); setParams({}); });
  const run = async (task: () => Promise<void>, conflictMessage?: string) => {
    setBusy(true);
    setError(null);
    try { await task(); } catch (err) {
      if (err instanceof AuthRequiredError) setNeedLogin(true);
      else if (err instanceof ApiError && err.status === 409 && conflictMessage) {
        await load();
        setError(conflictMessage);
      }
      else if (err instanceof ApiError) setError(sellerErrorText(err.code));
      else setError('Could not reach the backend. Nothing was changed.');
    } finally { setBusy(false); }
  };

  const goToPayPal = (purpose: 'NEW' | 'OLD') => run(async () => {
    if (!latest) return;
    const url = await beginPayPalLogin(latest.case_id, purpose);
    window.location.assign(url); // leaves this site for PayPal, then PayPal returns through the backend
  });

  if (USE_MOCK_DATA) {
    return <div style={{ maxWidth: 720, margin: '64px auto', padding: '0 var(--space-4)' }}>The seller page needs the live backend. Mock mode has no seller data.</div>;
  }
  if (needLogin) {
    return <LoginPanel title="Seller sign-in" hint="Sign in with your marketplace seller account to change where your earnings are paid." onSignedIn={() => { setLoading(true); void load(); }} />;
  }
  if (loading) return <div style={{ padding: '64px', textAlign: 'center', color: 'var(--muted)' }}>Loading your payout settings…</div>;

  const isSeller = session?.user?.role === 'recipient';
  const names = latest ? accountNames(latest) : null;
  const open = latest && OPEN.has(latest.state);
  const cancelButton = latest && OPEN.has(latest.state) ? (
    <Button variant="secondary" className={seller.cancelButton} data-testid="seller-cancel"
      disabled={busy} onClick={() => setCancelCaseId(latest.case_id)}>
      Cancel this request
    </Button>
  ) : null;


  return (
    <div className={seller.workspace} data-testid="seller-workspace">
      {cancelCaseId && <CancelRequestDialog onDismiss={() => setCancelCaseId(null)} onConfirm={() => {
        const target = cancelCaseId;
        setCancelCaseId(null);
        void run(async () => {
          const result = await cancelRequest(target);
          setLatest(result);
          setCancelledCaseId(result.case_id);
          setRecoveryOpen(false);
          setNoteSent(false);
          setParams({});
        }, 'This request can no longer be cancelled. Its state changed; check the latest status below.');
      }} />}
      {session?.user && (
        <Greeting userId={session.user.id} role={session.user.role} mood="wave"
          line={isSeller ? 'Manage where your marketplace earnings are paid.' : 'This page is for sellers.'}>
          <span className={`${journey.pill} ${journey.pillLive}`}>LIVE BACKEND</span>
          <span className={journey.pill}>{session.mode === 'demo' ? 'DEMO · simulated PayPal' : session.mode === 'sandbox' ? 'SANDBOX · real PayPal test accounts' : session.mode}</span>
          <Button variant="quiet" size="sm" onClick={() => { void logout().then(() => { setLatest(null); setNeedLogin(true); }); }}>Sign out</Button>
        </Greeting>
      )}

      {!isSeller && (
        <div role="alert" style={box} data-testid="not-a-seller">
          <strong>You are signed in as {session?.user?.role}, not as a seller.</strong>
          <span style={{ color: 'var(--muted)' }}>Sellers make requests here. Operators review them in the <Link to="/console">operator console</Link>. Sign out to use a seller account.</span>
        </div>
      )}

      {authResult === 'ok' && (
        <div role="status" style={{ ...box, borderColor: 'var(--ok)' }} data-testid="auth-ok">
          <strong>PayPal verification received.</strong>
          <span style={{ color: 'var(--muted)' }}>The backend checked it. The progress below shows the result.</span>
        </div>
      )}
      {authResult === 'failed' && (
        <div role="alert" style={{ ...box, borderColor: 'var(--bad)' }} data-testid="auth-failed">
          <strong>PayPal verification was not accepted.</strong>
          <span style={{ color: 'var(--muted)' }}>{sellerErrorText(authCode === 'PAYPAL_CALLBACK_INVALID' || !authCode ? 'PAYPAL_CALLBACK_INVALID' : authCode)} Nothing was changed.</span>
        </div>
      )}
      {error && <div role="alert" style={{ ...box, borderColor: 'var(--bad)' }}>{error}</div>}

      {isSeller && (
        <div className={`${journey.sellerGrid} ${seller.columns}`}>
          <div style={{ minWidth: 0 }}>
            {!open && (
              <section className={seller.section} aria-label="Payout account request" data-testid="request-form">
                <h2 style={{ margin: 0, fontSize: 'var(--text-lg)' }}>{latest ? 'Start a new request' : 'Update your payout account'}</h2>
                <p style={{ margin: 0, color: 'var(--muted)', fontSize: 'var(--text-sm)' }}>
                  Step 1 of 6. Tell us why. Then you verify your accounts with PayPal, and the marketplace reviews the request.
                </p>
                <textarea style={{ ...field, minHeight: 96 }} aria-label="Reason for the change" placeholder="For example: I opened a new PayPal account for my shop."
                  value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} />
                <div>
                  <Button variant="primary" size="md" icon={<Send size={15} />} loading={busy} disabled={reason.trim().length < 5}
                    disabledReason={reason.trim().length < 5 ? 'Write at least a short reason' : undefined}
                    onClick={() => submitRequest()}>
                    Submit request
                  </Button>
                </div>
              </section>
            )}

            {latest && (
              <>
                <div className={seller.accounts}><DestinationPairVisual caseData={latest} /></div>

                {cancelledCaseId === latest.case_id && latest.state === 'REJECTED' && (
                  <p role="status" data-testid="request-cancelled" style={{ ...box, color: 'var(--ok-text)' }}>
                    Request cancelled. Payouts still go to your current account.
                  </p>
                )}

                {(latest.state === 'CHANGE_REQUESTED' || latest.state === 'PENDING_NEW_ACCOUNT_AUTH') && (
                  <section className={seller.section} aria-label="Next step" data-testid="next-new">
                    <h2 style={{ margin: 0, fontSize: 'var(--text-lg)' }}>Step 2 · Verify your new account</h2>
                    <p style={{ margin: 0, color: 'var(--muted)', fontSize: 'var(--text-sm)' }}>
                      Continue on PayPal with the account that should receive your earnings. This only proves it is yours. Nothing changes yet.
                    </p>
                    <div className={seller.stepActions}><Button variant="primary" size="lg" icon={<LogIn size={16} />} loading={busy} onClick={() => goToPayPal('NEW')}>Continue with PayPal</Button>{cancelButton}</div>
                  </section>
                )}

                {latest.state === 'PENDING_OLD_ACCOUNT_AUTH' && (
                  <section className={seller.section} aria-label="Next step" data-testid="next-old">
                    <h2 style={{ margin: 0, fontSize: 'var(--text-lg)' }}>Step 3 · Verify your current account{names?.currentId ? ` (${names.currentId})` : ''}</h2>
                    <p style={{ margin: 0, color: 'var(--muted)', fontSize: 'var(--text-sm)' }}>
                      New account verified{withId('', names?.newId ?? null)}. Now verify the account you are paid on today. It must be the same one.
                    </p>
                    <div className={seller.stepActions}>
                      <div className={seller.primaryActions}><Button variant="primary" size="lg" icon={<LogIn size={16} />} loading={busy} onClick={() => goToPayPal('OLD')}>Continue with PayPal</Button>
                      <Button variant="secondary" size="lg" icon={<LifeBuoy size={16} />} onClick={() => setRecoveryOpen(!recoveryOpen)}>I cannot access it</Button></div>
                      {cancelButton}
                    </div>
                    {recoveryOpen && (
                      <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                        <textarea style={{ ...field, minHeight: 80 }} aria-label="Why you cannot log in to the current account" placeholder="Tell the marketplace what happened to the account."
                          value={recoveryText} onChange={(e) => setRecoveryText(e.target.value)} maxLength={1000} />
                        <div><Button variant="secondary" size="md" loading={busy} disabled={recoveryText.trim().length < 5}
                          onClick={() => run(async () => { setLatest(await requestRecovery(latest.case_id, recoveryText.trim())); setRecoveryOpen(false); })}>
                          Ask for a recovery review</Button></div>
                        <span style={{ color: 'var(--muted)', fontSize: 'var(--text-xs)' }}>A recovery review takes longer. Your explanation is a claim, not proof.</span>
                      </div>
                    )}
                  </section>
                )}

                {latest.state === 'PENDING_REVIEW' && (
                  <section className={seller.section} aria-label="Next step" data-testid="next-review">
                    <h2 style={{ margin: 0, fontSize: 'var(--text-lg)' }}>Step 4 · Under review</h2>
                    <p style={{ margin: 0, color: 'var(--muted)', fontSize: 'var(--text-sm)' }}>Your part is done. A marketplace operator is reviewing. Payouts stay on your current account. This page updates by itself.</p>
                    <div className={seller.stepActions}>{cancelButton}</div>
                  </section>
                )}

                {latest.state === 'APPROVED_COOLING_OFF' && (
                  <section className={seller.section} aria-label="Next step" data-testid="next-cooling">
                    <h2 style={{ margin: 0, fontSize: 'var(--text-lg)' }}>Step 5 · Safety wait</h2>
                    <p style={{ margin: 0, color: 'var(--muted)', fontSize: 'var(--text-sm)' }}>
                      Approved. {countdown(latest.cooling_off.ends_at) ?? 'The wait is ending.'} Until it ends, payouts stay on your current account. The backend then switches by itself.
                    </p>
                    <div className={seller.stepActions}>{cancelButton}</div>
                  </section>
                )}

                <JourneyStepper caseData={latest} viewer="seller" />

                {OPEN.has(latest.state) && (
                  <section className={seller.section} aria-label="Message the marketplace" data-testid="seller-message">
                    <h2 style={{ margin: 0, fontSize: 'var(--text-lg)' }}>Add a note for the marketplace</h2>
                    <p style={{ margin: 0, color: 'var(--muted)', fontSize: 'var(--text-sm)' }}>
                      Anything the operator should know. A note is a claim, not proof, and the reviewer still checks the evidence.
                      {latest.state === 'APPROVED_COOLING_OFF' && ' Sending a note now sends the request back to review.'}
                    </p>
                    <textarea style={{ ...field, minHeight: 72 }} aria-label="Note for the marketplace" placeholder="Write a note"
                      value={note} onChange={(e) => { setNote(e.target.value); setNoteSent(false); }} maxLength={1000} />
                    <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                      <Button variant="secondary" size="md" loading={busy} disabled={note.trim().length < 3}
                        onClick={() => run(async () => { setLatest(await sendSellerMessage(latest.case_id, note.trim())); setNote(''); setNoteSent(true); })}>
                        Send note
                      </Button>
                      {noteSent && <span role="status" data-testid="note-sent" style={{ color: 'var(--ok)', fontSize: 'var(--text-sm)' }}>Sent to the marketplace.</span>}
                    </div>
                  </section>
                )}

                {latest.state === 'ACTIVE_NEW_DESTINATION' && (
                  <section style={{ ...box, borderColor: 'var(--ok)' }} aria-label="Result" data-testid="next-done">
                    <h2 style={{ margin: 0, fontSize: 'var(--text-lg)' }}>Step 6 · Updated. Earnings now go to the new account{names?.newId ? ` (${names.newId})` : ''}</h2>
                  </section>
                )}
              </>
            )}
          </div>

          <div className={`${journey.sellerChat} ${seller.assistantColumn}`}>
            <SellerGuideChat canFill={!open} onUseReason={(text, cat) => { setReason(text); if (cat) setCategory(cat); }}
              onSubmit={async () => { if (reason.trim().length < 5) throw new Error('empty'); const c = await createRequest(reason.trim(), category); setLatest(c); setReason(''); setCategory(''); setParams({}); }} />
          </div>
        </div>
      )}

      {isSeller && (
        <section style={{ ...box, marginTop: 'var(--space-5)' }} aria-label="My earnings">
          <h2 style={{ margin: '0 0 var(--space-3)', fontSize: 'var(--text-lg)' }}>My earnings</h2>
          <SellerDashboard />
        </section>
      )}
    </div>
  );
}
