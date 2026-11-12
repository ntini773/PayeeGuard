import { useEffect, useRef, useState } from 'react';
import { askSellerGuide, draftSellerRequest, ApiError, type GuideTurn } from '../../api/client';
import { Mascot } from '../common/Mascot';
import { Button } from '../common/Button';
import { Send } from 'lucide-react';
import styles from '../../styles/guideChat.module.css';

const HELLO = 'Hi! I am Guardy. I can help you update your payout account and word your reason. What is the main reason: a new PayPal account, lost access to the old one, or something else?';
const CHIPS = ['I opened a new PayPal account', 'I lost access to my old account', 'How does this work?'];

type Turn = GuideTurn & { local?: boolean };
type Stage = 'idle' | 'offered' | 'filled' | 'done' | 'declined';
// Intent is matched loosely so natural replies work ("Yes fill it in, happy to add more", "submit the request").
const AFFIRM = /^\s*(yes|yeah|yep|yup|sure|ok|okay|please|go ahead|do it|absolutely|definitely|of course)\b/i;
const WANTS_FILL = /\b(fill|draft|write)\b/i;
const WANTS_SUBMIT = /\b(submit|send|file)\b/i;
const REFUSE = /^\s*(no|nope|not yet|no thanks|nah|later|wait)\b|\b(don'?t|do not|not now)\b/i;
const LABEL: Record<string, string> = { new_paypal_account: 'New PayPal account', lost_access: 'Lost access to the old account', shop_moved: 'Shop or business changed', other: 'Other' };

interface Props {
  /** Copies words into the request box (and a category). Filling is not submitting. */
  onUseReason: (text: string, category?: string) => void;
  /** Submits the form as it is now. Only called after the seller says yes. The model never calls this. */
  onSubmit?: () => Promise<void>;
  /** False while a request is already open: then there is nothing to fill or submit, so the offer is not made. */
  canFill?: boolean;
}

export function SellerGuideChat({ onUseReason, onSubmit, canFill = true }: Props) {
  const [turns, setTurns] = useState<Turn[]>([{ role: 'assistant', text: HELLO }]);
  const [stage, setStage] = useState<Stage>('idle');
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState<'ai' | 'scripted' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll the transcript only; new replies must not move the seller's page.
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [turns, busy]);

  const say = (text: string): Turn => ({ role: 'assistant', text, local: true });
  const real = (list: Turn[]): GuideTurn[] => list.filter((t) => !t.local).map(({ role, text }) => ({ role, text }));

  const fill = async (base: Turn[]) => {
    setBusy(true); setError(null);
    try {
      const d = await draftSellerRequest(real(base));
      // Type the draft into the form so the seller sees it being written, then set the category.
      const text = d.reason_text; const step = Math.max(2, Math.ceil(text.length / 70));
      for (let i = step; i < text.length; i += step) { onUseReason(text.slice(0, i)); await new Promise((r) => setTimeout(r, 28)); }
      onUseReason(text, d.reason_category);
      setStage('filled');
      setTurns([...base, say(`I filled in your request: "${d.reason_text}" (${LABEL[d.reason_category] ?? 'Other'}). Please check it in the form. Should I submit it now? You can also edit it and press Submit yourself.`)]);
    } catch { setError('I could not draft it. You can write it in the form yourself.'); setTurns(base); }
    finally { setBusy(false); }
  };
  const submit = async (base: Turn[]) => {
    setBusy(true); setError(null);
    try {
      await onSubmit?.();
      setStage('done');
      setTurns([...base, say('Done. I sent your request exactly as it is in the form. Next you verify your PayPal accounts.')]);
    } catch { setError('I could not submit it. Please press Submit in the form.'); setTurns(base); }
    finally { setBusy(false); }
  };

  const send = async (text: string) => {
    const clean = text.trim();
    if (!clean || busy) return;
    const next: Turn[] = [...turns, { role: 'user', text: clean.slice(0, 500) }];
    setTurns(next);
    setDraft('');
    // Confirmations are handled here, in the page, and never reach the model.
    const affirm = AFFIRM.test(clean); const refuse = REFUSE.test(clean) && !affirm;
    const wantsFill = WANTS_FILL.test(clean); const wantsSubmit = WANTS_SUBMIT.test(clean);
    const userTurns = real(next).filter((t) => t.role === 'user').length;
    if (stage === 'filled' && onSubmit) {
      if (refuse) { setStage('declined'); setTurns([...next, say('Okay, I will not submit it. Press Submit when you are ready.')]); return; }
      if (affirm || wantsSubmit) { await submit(next); return; }
    } else if (canFill && stage === 'offered') {
      if (refuse) { setStage('declined'); setTurns([...next, say('No problem. You can write the reason yourself in the form.')]); return; }
      if (affirm || wantsFill || wantsSubmit) { await fill(next); return; }   // asking to submit first fills it, so the seller sees it before anything is sent
    } else if (canFill && (stage === 'idle' || stage === 'declined') && (wantsFill || wantsSubmit) && !refuse && userTurns >= 2) {
      await fill(next); return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await askSellerGuide(real(next));
      setSource(res.source);
      const withReply: Turn[] = [...next, { role: 'assistant', text: res.reply }];
      if (canFill && stage === 'idle' && real(next).filter((t) => t.role === 'user').length >= 2) {
        setStage('offered');
        withReply.push(say('Would you like me to fill in your request from what you told me? Nothing is sent until you say so.'));
      }
      setTurns(withReply);
    } catch (err) {
      setError(err instanceof ApiError && err.code === 'RATE_LIMITED' ? 'Too many messages. Wait a minute.' : 'The helper is not reachable right now. You can still fill in the request yourself.');
    } finally {
      setBusy(false);
    }
  };

  const lastUser = [...turns].reverse().find((t) => t.role === 'user');

  return (
    <aside className={styles.panel} aria-label="Help chat" data-testid="guide-chat">
      <div className={styles.head}>
        <Mascot mood={busy ? 'think' : 'wave'} size={36} />
        <div>
          <strong>Guardy, your guide</strong>
          <div className={styles.sub}>{source === 'ai' ? 'AI helper' : source === 'scripted' ? 'Built-in guide' : 'Ask me anything about this page'}</div>
        </div>
      </div>

      <div ref={logRef} className={styles.log} role="log" aria-live="polite">
        {turns.map((t, i) => (
          <div key={i} className={t.role === 'user' ? styles.me : styles.bot}>{t.text}</div>
        ))}
        {busy && <div className={styles.bot} aria-label="Guardy is typing">…</div>}
      </div>

      {error && <div role="alert" className={styles.err}>{error}</div>}

      <div className={styles.chips}>
        {stage === 'offered' && (<>
          <button type="button" className={styles.chip} onClick={() => void send('Yes, fill it in')} disabled={busy} data-testid="guide-fill-yes">Yes, fill it in</button>
          <button type="button" className={styles.chip} onClick={() => void send('No thanks')} disabled={busy}>No thanks</button>
        </>)}
        {stage === 'filled' && onSubmit && (<>
          <button type="button" className={styles.chip} onClick={() => void send('Yes, submit it')} disabled={busy} data-testid="guide-submit-yes">Yes, submit it</button>
          <button type="button" className={styles.chip} onClick={() => void send('Not yet')} disabled={busy}>Not yet</button>
        </>)}
        {stage !== 'offered' && stage !== 'filled' && CHIPS.map((c) => (
          <button key={c} type="button" className={styles.chip} onClick={() => void send(c)} disabled={busy}>{c}</button>
        ))}
      </div>

      <form className={styles.form} onSubmit={(e) => { e.preventDefault(); void send(draft); }}>
        <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={500} placeholder="Type a message"
          aria-label="Message to the help chat" className={styles.input} />
        <Button type="submit" variant="primary" size="sm" icon={<Send size={14} />} disabled={busy || !draft.trim()}>Send</Button>
      </form>

      {lastUser && (
        <Button variant="secondary" size="sm" onClick={() => onUseReason(lastUser.text)}>Use my last answer as my reason</Button>
      )}
      <p className={styles.fine}>Guidance only. It cannot see your case, approve anything or speed up the review. Never type passwords or PayPal IDs here.</p>
    </aside>
  );
}
