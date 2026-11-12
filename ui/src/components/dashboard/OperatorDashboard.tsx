import { lazy, Suspense, useMemo, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import styles from '../../styles/app.module.css';
import { askDashboard } from '../../api/client';
import type { DestinationChangeCase } from '../../types/case';
import { simulatedFlags, simulatedRequests, simulatedSales } from './simulatedHistory';
import { humanizeState, humanizePolicyDecision, humanizeFinding } from '../../content/labels';

const StudioDashboard = lazy(() => import('./StudioDashboard'));

const col = (type: string, cat: string, vals: string[]) => ({ type, dataMapping: { categoryKey: [{ id: cat }], valueKey: vals.map(id => ({ id, aggregation: 'sum' })) } });
const cnt = (type: string, cat: string) => ({ type, dataMapping: { categoryKey: [{ id: cat }], valueKey: [{ id: 'cases.case_id', aggregation: 'count' }] } });
/** Read-only widgets the assistant may add. The backend only returns one of these ids. */
const FLAG_FIELDS = ['new_device', 'password_reset', 'country_change', 'destination_change'];
const VIEWS: Record<string, unknown | ((days?: number) => unknown)> = {
  flags_by_type: (n = 7) => col('line-chart', `flagsr_${n}.date`, FLAG_FIELDS.map(f => `flagsr_${n}.${f}`)),
  escalations: (n = 7) => col('column-chart-grouped', `flagsr_${n}.date`, [`flagsr_${n}.ai_escalations`]),
  requests_by_week: col('column-chart-stacked', 'requests.week', ['requests.approved', 'requests.auto_approved', 'requests.rejected']),
  rejections_by_week: col('column-chart-grouped', 'requests.week', ['requests.rejected']),
  cases_by_status: cnt('donut-chart', 'cases.status'),
  cases_by_policy: cnt('donut-chart', 'cases.policy'),
  income_trend: col('line-chart', 'history.date', ['history.revenue']),
  sales_count: col('column-chart-grouped', 'history.date', ['history.sales']),
};
const SUGGESTIONS = ['How many requests were rejected this month?', 'Which risk flags are rising?', 'Seller income over the past days'];

/** One row per case. Operator view: states, policy decisions and risk flags across the queue. */
export function OperatorDashboard({ cases }: { cases: DestinationChangeCase[] }) {
  const rows = useMemo(() => cases.map(c => ({
    case_id: c.case_id,
    seller: c.seller_id,
    status: humanizeState(c.state),
    policy: humanizePolicyDecision(c.policy.decision),
    risk_flags: (c.reviewer_findings ?? []).length,
    flag_names: (c.reviewer_findings ?? []).map(humanizeFinding).join(', ') || 'None',
    evidence_records: (c.marketplace_evidence ?? []).length,
    ai_advice: c.ai_assessment?.status === 'AVAILABLE' ? (c.ai_assessment.effective_recommendation ?? c.ai_assessment.recommendation).replace(/_/g, ' ').toLowerCase() : 'not run',
    simulation: c.simulation ? 'Simulated' : 'Real sandbox',
  })), [cases]);

  const flags = useMemo(() => simulatedFlags(), []);
  const requests = useMemo(() => simulatedRequests(), []);
  const adder = useRef<((key: string, widget: unknown, title: string) => void) | null>(null);
  const [ask, setAsk] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const added = useRef(0);
  const history = useMemo(() => simulatedSales(), []);
  const run = async (q: string) => {
    if (q.trim().length < 3 || busy) return;
    setBusy(true); setNote(null);
    try {
      const r = await askDashboard(q.trim());
      if (!r.view) { setNote([r.message ?? 'No matching view.', ...(r.suggestions ?? [])].join(' · ')); return; }
      const spec = VIEWS[r.view]; const widget = typeof spec === 'function' ? (spec as (d?: number) => unknown)(r.days ?? 7) : spec;
      if (!widget) { setNote('No matching view.'); return; }
      adder.current?.(r.view, widget, `${r.title} (${r.source === 'ai' ? 'AI pick' : 'rule match'}${r.verified ? ', checked by a second call' : ''}, simulated data where noted)`);
      setNote(`Added: ${r.title}`); setAsk('');
    } catch { setNote('The assistant could not answer right now. Nothing was changed.'); } finally { setBusy(false); }
  };
  const lastTopic = useRef('');
  const studioAsk = async (q: string): Promise<{ note: string; suggestions?: string[] }> => {
    let r = await askDashboard(q);
    // "last 2 days" on its own has no topic: continue the previous request, so it changes that view.
    if (!r.view && lastTopic.current && /\b(days?|week|today|yesterday)\b/i.test(q) && q.split(/\s+/).length <= 6) r = await askDashboard(`${lastTopic.current.replace(/\b(last|past|recent)?\s*\d+\s*days?\b|\byesterday\b|\btoday\b|\blast week\b/gi, ' ')} ${q}`);
    if (!r.view) return { note: r.message ?? 'I cannot chart that from the data I have. Try one of these:', suggestions: r.suggestions };
    const spec = VIEWS[r.view]; const widget = typeof spec === 'function' ? (spec as (d?: number) => unknown)(r.days ?? 7) : spec;
    if (!widget) return { note: 'No matching view.' };
    lastTopic.current = q;
    adder.current?.(r.view, widget, `${r.title} (${r.source === 'ai' ? 'AI pick' : 'rule match'}${r.verified ? ', checked by a second call' : ''})`);
    const fixedRange = !r.days && /\b\d+\s*days?\b|yesterday|today|last week/i.test(q) ? ' This view has a fixed range, so it shows the full range, not just the days you named.' : '';
    return { note: `Done: ${r.title}. It is at the top of the dashboard.${fixedRange}` };
  };
  const CARE_HELP = 'I can show: risk flags per day by type (7 days), AI escalations per day (7 days), account change requests per week (past month, by approved / auto-approved / rejected), rejected requests per week, live cases by status or by policy, and seller income or sales per day (14 days). Ask for one in plain words. Flags and requests are simulated history.';
  const protectedCount = cases.filter(c => !c.policy.may_activate_proposed_destination).length;
  const state = useMemo(() => ({
    pages: [{
      id: 'operator', name: 'Operator overview',
      widgets: {
        safe: { type: 'safeTile' },
        kpis: { type: 'multi-kpi', format: { style: { columns: 3 } }, dataMapping: { values: [{ id: 'cases.case_id', aggregation: 'count' }, { id: 'cases.risk_flags', aggregation: 'sum' }, { id: 'cases.evidence_records', aggregation: 'sum' }] } },
        title: { type: 'text', format: { style: { text: 'Risk flags and AI escalations, last 7 days (simulated marketplace feed)', typography: { fontSize: 15, fontWeight: 'bold' } } } },
        flags: { type: 'line-chart', dataMapping: { categoryKey: [{ id: 'flags.date' }], valueKey: [{ id: 'flags.new_device', aggregation: 'sum' }, { id: 'flags.password_reset', aggregation: 'sum' }, { id: 'flags.country_change', aggregation: 'sum' }, { id: 'flags.destination_change', aggregation: 'sum' }] } },
        escalations: { type: 'column-chart-grouped', dataMapping: { categoryKey: [{ id: 'flags.date' }], valueKey: [{ id: 'flags.ai_escalations', aggregation: 'sum' }] } },
        reqTitle: { type: 'text', format: { style: { text: 'Account change requests, past month (simulated history)', typography: { fontSize: 15, fontWeight: 'bold' } } } },
        requests: { type: 'column-chart-stacked', dataMapping: { categoryKey: [{ id: 'requests.week' }], valueKey: [{ id: 'requests.approved', aggregation: 'sum' }, { id: 'requests.auto_approved', aggregation: 'sum' }, { id: 'requests.rejected', aggregation: 'sum' }] } },
        liveTitle: { type: 'text', format: { style: { text: 'Live queue (real backend data)', typography: { fontSize: 15, fontWeight: 'bold' } } } },
        byPolicy: { type: 'donut-chart', dataMapping: { categoryKey: [{ id: 'cases.policy' }], valueKey: [{ id: 'cases.case_id', aggregation: 'count' }] } },
        table: { type: 'grid', dataMapping: { cols: [{ id: 'cases.case_id' }, { id: 'cases.seller' }, { id: 'cases.status' }, { id: 'cases.policy' }, { id: 'cases.flag_names' }, { id: 'cases.ai_advice' }] } },
      },
      widgetLayout: {
        safe: { xTrack: 0, yTrack: 0, xSpan: 9, ySpan: 6 },
        kpis: { xTrack: 9, yTrack: 0, xSpan: 15, ySpan: 6 },
        title: { xTrack: 0, yTrack: 6, xSpan: 24, ySpan: 2 },
        flags: { xTrack: 0, yTrack: 8, xSpan: 15, ySpan: 14 },
        escalations: { xTrack: 15, yTrack: 8, xSpan: 9, ySpan: 14 },
        reqTitle: { xTrack: 0, yTrack: 22, xSpan: 24, ySpan: 2 },
        requests: { xTrack: 0, yTrack: 24, xSpan: 24, ySpan: 11 },
        liveTitle: { xTrack: 0, yTrack: 35, xSpan: 24, ySpan: 2 },
        byPolicy: { xTrack: 0, yTrack: 37, xSpan: 8, ySpan: 12 },
        table: { xTrack: 8, yTrack: 37, xSpan: 16, ySpan: 12 },
      },
    }],
    selectedPageId: 'operator',
  }), []);

  return (
    <section aria-label="Operator dashboard" data-testid="operator-dashboard">
      <div className={styles.dashboardIntro}>
        <div><h2>Marketplace overview</h2><p>{rows.length} live case{rows.length === 1 ? '' : 's'}, with evidence and policy decisions from the backend. Historical trends below use explicitly simulated data.</p></div>
        <span className={styles.feedLabel}>AG Studio · Live queue / simulated trends</span>
      </div>
      <section className={styles.assistantPanel} data-testid="ask-dashboard" aria-label="Dashboard assistant">
        <div className={styles.assistantHeading}><Sparkles size={17} aria-hidden="true" /> Ask your dashboard <span>Read-only views</span></div>
        <div className={styles.askRow}>
          <input aria-label="Ask the dashboard" value={ask} maxLength={200} onChange={(e) => setAsk(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void run(ask); }} placeholder="What would you like to understand about this marketplace?" />
          <button type="button" disabled={busy} onClick={() => void run(ask)} className={styles.addView}>{busy ? 'Thinking…' : 'Add view'}</button>
        </div>
        <div className={styles.suggestions}>{SUGGESTIONS.map(q => <button key={q} type="button" disabled={busy} onClick={() => void run(q)}>{q}</button>)}</div>
        <p className={styles.advisoryNote}>The assistant adds a view from a fixed catalog. It cannot change a case, approve a request, or move money.</p>
        {note && <span role="status" data-testid="ask-note" className={styles.askNote}>{note}</span>}
      </section>
      <Suspense fallback={<p>Loading dashboard…</p>}>
        <StudioDashboard sources={[{ id: 'cases', data: rows }, { id: 'flags', data: flags as unknown as Record<string, unknown>[] }, { id: 'requests', data: requests as unknown as Record<string, unknown>[] }, { id: 'history', data: history as unknown as Record<string, unknown>[] }, ...[1, 2, 3, 4, 5, 6, 7].map(n => ({ id: `flagsr_${n}`, data: flags.slice(-n) as unknown as Record<string, unknown>[] }))]} initialState={state} height={1180} variant="operator" adder={adder} onAsk={studioAsk} helpText={CARE_HELP} tile={{ heading: 'Earnings kept safe', value: `${protectedCount} of ${rows.length}`, note: 'cases where payouts stay on the current account' }} />
      </Suspense>
    </section>
  );
}
