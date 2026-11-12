/**
 * Simulated history for the dashboards. It is NOT real PayPal or marketplace data.
 * The live sandbox has only a handful of sales and cases, so charts of trends over time would be empty.
 * A small fixed-seed generator gives the same numbers on every load, and every widget that uses it says "simulated".
 */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const DAY = 86_400_000;
const label = (t: number) => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export interface SalesDay { date: string; sales: number; revenue: number; refunds: number }
export function simulatedSales(days = 14, now = Date.now()): SalesDay[] {
  const rnd = seeded(42);
  return Array.from({ length: days }, (_, i) => {
    const t = now - (days - 1 - i) * DAY;
    const weekend = [0, 6].includes(new Date(t).getDay());
    const sales = Math.round((weekend ? 6 : 3) + rnd() * 6 + i * 0.25);
    const revenue = Math.round(sales * (38 + rnd() * 55));
    return { date: label(t), sales, revenue, refunds: rnd() < 0.3 ? 1 : 0 };
  });
}

export interface FlagDay { date: string; new_device: number; password_reset: number; country_change: number; destination_change: number; ai_escalations: number }
export function simulatedFlags(days = 7, now = Date.now()): FlagDay[] {
  const rnd = seeded(7);
  return Array.from({ length: days }, (_, i) => {
    const t = now - (days - 1 - i) * DAY;
    const spike = i === days - 3 ? 3 : 0;   // one burst of takeover signals, so the chart has a story
    const n = () => Math.floor(rnd() * 3);
    const f = { new_device: n() + spike, password_reset: n() + spike, country_change: Math.floor(rnd() * 2), destination_change: n() };
    return { date: label(t), ...f, ai_escalations: Math.min(f.new_device + f.password_reset, 5) };
  });
}

export interface RequestWeek { week: string; approved: number; auto_approved: number; rejected: number }
/** Account change requests per week over the past month, simulated. */
export function simulatedRequests(weeks = 5, now = Date.now()): RequestWeek[] {
  const rnd = seeded(11);
  return Array.from({ length: weeks }, (_, i) => {
    const t = now - (weeks - 1 - i) * 7 * DAY;
    const rejected = 1 + Math.floor(rnd() * 3);
    const auto_approved = 2 + Math.floor(rnd() * 4);
    return { week: 'Week of ' + label(t), approved: 3 + Math.floor(rnd() * 5), auto_approved, rejected };
  });
}
