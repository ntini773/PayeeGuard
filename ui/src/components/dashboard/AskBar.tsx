import { useState } from 'react';

export interface AskResult { note: string; suggestions?: string[] }

/** One inline chat strip, not a window: recommendations as chips, a text box, and a one-line answer. */
export function AskBar({ placeholder, chips, onAsk }: { placeholder: string; chips: string[]; onAsk: (question: string) => Promise<AskResult> }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AskResult | null>(null);
  const run = async (q: string) => {
    if (q.trim().length < 3 || busy) return;
    setBusy(true); setResult(null);
    try { setResult(await onAsk(q.trim())); setText(''); } catch { setResult({ note: 'The assistant could not answer right now. Nothing was changed.' }); } finally { setBusy(false); }
  };
  const chip = { padding: '6px 12px', borderRadius: 999, border: '1px solid var(--line-dark)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontSize: 14 } as const;
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', margin: '0 0 12px' }} data-testid="ask-dashboard">
      <input aria-label="Ask the dashboard" value={text} maxLength={200} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void run(text); }}
        placeholder={placeholder} style={{ flex: '1 1 320px', padding: '10px 14px', borderRadius: 999, border: '1px solid var(--line-dark)', background: '#fff', color: '#001435' }} />
      <button type="button" disabled={busy} onClick={() => void run(text)} style={{ padding: '10px 18px', borderRadius: 999, border: 0, background: 'var(--gold)', color: 'var(--gold-text)', fontWeight: 600, cursor: 'pointer' }}>{busy ? 'Thinking…' : 'Add view'}</button>
      {chips.map(q => <button key={q} type="button" disabled={busy} onClick={() => void run(q)} style={chip}>{q}</button>)}
      {result && (
        <div style={{ flexBasis: '100%', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span role="status" data-testid="ask-note" style={{ color: 'var(--muted)', fontSize: 14 }}>{result.note}</span>
          {result.suggestions?.map(s => <button key={s} type="button" disabled={busy} onClick={() => void run(s)} style={chip}>{s}</button>)}
        </div>
      )}
    </div>
  );
}
