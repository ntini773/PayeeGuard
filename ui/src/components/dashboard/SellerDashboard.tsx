import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { askDashboard, listEarnings, type Earning } from '../../api/client';
import { AskBar, type AskResult } from './AskBar';
import { col, DAY_WINDOWS } from './dashboardSpecs';
import { simulatedSales } from './simulatedHistory';

const StudioDashboard = lazy(() => import('./StudioDashboard'));

function paidLabel(e: Earning): string {
  const status = e.payout?.provider_status;
  if (status === 'SUCCESS') return 'Paid';
  if (e.payout) return 'Processing';
  return 'Recorded';
}

const SUGGESTIONS = ['Show my earnings for the last 2 days', 'My sales by payout status', 'Income trend over 14 days'];
const DAY = 86_400_000;

/** Seller revenue dashboard: the seller's own sales and where they stand. */
export function SellerDashboard() {
  const [earnings, setEarnings] = useState<Earning[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => { void listEarnings().then(setEarnings).catch(() => setError(true)); }, []);

  const rows = useMemo(() => (earnings ?? []).map((e, i) => ({
    sale: e.earning_id, amount: Number(e.amount) || 0, currency: e.currency, payout: paidLabel(e),
    order: i + 1, received: e.received_at ? new Date(e.received_at * 1000).toLocaleDateString() : 'unknown',
  })), [earnings]);

  const history = useMemo(() => simulatedSales(), []);

  // Real sales per day for each window the assistant may pick. Numbers come from our records, never from a model.
  const recent = useMemo(() => {
    const out: Record<number, { day: string; revenue: number; sales: number }[]> = {};
    for (const n of DAY_WINDOWS) {
      out[n] = Array.from({ length: n }, (_, i) => {
        const start = new Date(Date.now() - (n - 1 - i) * DAY); start.setHours(0, 0, 0, 0);
        const inDay = (earnings ?? []).filter(e => e.received_at && e.received_at * 1000 >= start.getTime() && e.received_at * 1000 < start.getTime() + DAY);
        return { day: start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), revenue: inDay.reduce((t, e) => t + (Number(e.amount) || 0), 0), sales: inDay.length };
      });
    }
    return out;
  }, [earnings]);

  const adder = useRef<((key: string, widget: unknown, title: string) => void) | null>(null);
  const added = useRef(0);
  const lastTopic = useRef('');
  const onAsk = async (q: string): Promise<AskResult> => {
    let r = await askDashboard(q);
    // "last 2 days" on its own has no topic: continue the previous request, so it changes that view.
    if (!r.view && lastTopic.current && /\b(days?|week|today|yesterday)\b/i.test(q) && q.split(/\s+/).length <= 6) r = await askDashboard(`${lastTopic.current.replace(/\b(last|past|recent)?\s*\d+\s*days?\b|\byesterday\b|\btoday\b|\blast week\b/gi, ' ')} ${q}`);
    if (!r.view) return { note: r.message ?? 'No matching view.', suggestions: r.suggestions };
    const tag = `${r.source === 'ai' ? 'AI pick' : 'rule match'}${r.verified ? ', checked by a second call' : ''}`;
    let widget: unknown; let title = `${r.title} (${tag})`;
    if (r.view === 'earnings_by_day') {
      const n = DAY_WINDOWS.includes(r.days ?? 0) ? (r.days as number) : 7;
      if (recent[n].every(d => d.sales === 0)) return { note: `You have no recorded sales in the last ${n} day${n > 1 ? 's' : ''}.` };
      widget = col('column-chart-grouped', `recent_${n}.day`, [`recent_${n}.revenue`]);
    } else if (r.view === 'earnings_by_status') {
      widget = { type: 'donut-chart', dataMapping: { categoryKey: [{ id: 'sales.payout' }], valueKey: [{ id: 'sales.amount', aggregation: 'sum' }] } };
    } else if (r.view === 'income_trend') { widget = col('line-chart', 'history.date', ['history.revenue']); title += ' - simulated';
    } else if (r.view === 'sales_count') { widget = col('column-chart-grouped', 'history.date', ['history.sales']); title += ' - simulated';
    } else return { note: 'No matching view.' };
    lastTopic.current = q;
    adder.current?.(r.view, widget, title);
    const fixedRange = r.view !== 'earnings_by_day' && /\b\d+\s*days?\b|yesterday|today|last week/i.test(q) ? ' This view has a fixed range, so it shows the full range, not just the days you named.' : '';
    return { note: `Done: ${r.title}. It is at the top of the dashboard.${fixedRange}` };
  };

  const state = useMemo(() => ({
    pages: [{
      id: 'seller', name: 'My earnings',
      widgets: {
        title: { type: 'text', format: { style: { text: 'Last 14 days (simulated history)', typography: { fontSize: 15, fontWeight: 'bold' } } } },
        kpis: { type: 'multi-kpi', format: { style: { columns: 4 } }, dataMapping: { values: [{ id: 'history.revenue', aggregation: 'sum' }, { id: 'history.sales', aggregation: 'sum' }, { id: 'history.revenue', aggregation: 'avg' }, { id: 'history.revenue', aggregation: 'max' }] } },
        income: { type: 'line-chart', dataMapping: { categoryKey: [{ id: 'history.date' }], valueKey: [{ id: 'history.revenue', aggregation: 'sum' }] } },
        count: { type: 'column-chart-grouped', dataMapping: { categoryKey: [{ id: 'history.date' }], valueKey: [{ id: 'history.sales', aggregation: 'sum' }] } },
        recentTitle: { type: 'text', format: { style: { text: 'Your real sandbox sales', typography: { fontSize: 15, fontWeight: 'bold' } } } },
        table: { type: 'grid', dataMapping: { cols: [{ id: 'sales.sale' }, { id: 'sales.amount' }, { id: 'sales.currency' }, { id: 'sales.payout' }, { id: 'sales.received' }] } },
      },
      widgetLayout: {
        title: { xTrack: 0, yTrack: 0, xSpan: 24, ySpan: 2 },
        kpis: { xTrack: 0, yTrack: 2, xSpan: 24, ySpan: 6 },
        income: { xTrack: 0, yTrack: 8, xSpan: 15, ySpan: 14 },
        count: { xTrack: 15, yTrack: 8, xSpan: 9, ySpan: 14 },
        recentTitle: { xTrack: 0, yTrack: 22, xSpan: 24, ySpan: 2 },
        table: { xTrack: 0, yTrack: 24, xSpan: 24, ySpan: 10 },
      },
    }],
    selectedPageId: 'seller',
  }), []);

  if (error) return <p role="status" style={{ color: 'var(--muted)' }}>Your earnings could not be loaded right now.</p>;
  if (earnings === null) return <p role="status">Loading your earnings…</p>;
  if (rows.length === 0) return <p role="status" style={{ color: 'var(--muted)' }}>No sales yet. Sales appear here when they arrive.</p>;
  return (
    <section aria-label="Your earnings dashboard" data-testid="seller-dashboard">
      <AskBar placeholder="Ask for a view of your earnings, for example: last 2 days" chips={SUGGESTIONS} onAsk={onAsk} />
      <Suspense fallback={<p>Loading dashboard…</p>}>
        <StudioDashboard sources={[{ id: 'sales', data: rows }, { id: 'history', data: history as unknown as Record<string, unknown>[] }, ...DAY_WINDOWS.map(n => ({ id: `recent_${n}`, data: recent[n] as unknown as Record<string, unknown>[] }))]} initialState={state} height={900} adder={adder} onAsk={onAsk} helpText={'I can show your real recorded sales per day for the last 1 to 30 days (for example "show revenue for the last 2 days"), your sales grouped by payout status, and a 14-day income or sales trend (simulated history).'} />
      </Suspense>
    </section>
  );
}
