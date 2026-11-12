import { useEffect, useMemo, useRef, useState, type ReactNode, type MutableRefObject } from 'react';
import { AgStudio, AgStudioProvider, createWidgets } from 'ag-studio-react';
import { AgStudioAiModule, createAiHarness, directLlmRunner, studioTheme } from 'ag-studio';
import { llmAdapter, setViewHandler, type ViewReply } from './llmAdapter';
import styles from '../../styles/app.module.css';

const FONT = "'Geist', system-ui, sans-serif";
const SELLER_THEME = studioTheme.withParams({
  fontFamily: FONT, studioCanvasFontFamily: FONT,
  fontSize: 15, chartFontSize: 14, chartAxisLabelFontSize: 14, chartAxisTitleFontSize: 14, chartSeriesLabelFontSize: 14,
  studioWidgetSubtitleFontSize: 14, studioWidgetCaptionFontSize: 14,
  backgroundColor: '#ffffff', studioCanvasBackgroundColor: '#f8f8f2',
  textColor: '#1b2b20', borderColor: '#d9dfd1', accentColor: '#526d40',
  chartAccentColor: '#526d40', gridAccentColor: '#526d40', borderRadius: 7,
  chartPaletteFills1Color: '#55765a', chartPaletteFills2Color: '#9eaf7b',
  chartPaletteFills3Color: '#b9a376', chartPaletteFills4Color: '#5c8b80',
});

const OPERATOR_THEME = studioTheme.withParams({
  fontFamily: FONT, studioCanvasFontFamily: FONT,
  fontSize: 15, chartFontSize: 14, chartAxisLabelFontSize: 14, chartAxisTitleFontSize: 14, chartSeriesLabelFontSize: 14,
  studioWidgetSubtitleFontSize: 14, studioWidgetCaptionFontSize: 14,
  backgroundColor: '#ffffff', studioCanvasBackgroundColor: '#f4f7fb',
  textColor: '#23374b', borderColor: '#d7e0e8', accentColor: '#4d7191',
  chartAccentColor: '#4d7191', gridAccentColor: '#4d7191', borderRadius: 7,
  chartPaletteFills1Color: '#4b6b8c', chartPaletteFills2Color: '#7a9bb0',
  chartPaletteFills3Color: '#afa5bc', chartPaletteFills4Color: '#70a6a1',
});

/**
 * AG Studio dashboard. The licence key comes from VITE_AG_STUDIO_LICENSE (ui/.env.local, never committed).
 * Data is passed in as plain arrays. The dashboard is read-only (mode="view"): it shows, it never changes a case.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type StudioState = any;
/** A custom Studio widget: one tile with a headline number and a sentence. Content is passed in, not read from Studio data. */
export interface TileContent { heading: string; value: ReactNode; note: string }
function tileWidget(content: TileContent) {
  const Tile = () => (
    <div data-testid="custom-tile" style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '8px 16px', background: '#edf3e5', borderLeft: '3px solid #8eaa6d', fontFamily: FONT }}>
      <div style={{ fontSize: 14, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#5f7253' }}>{content.heading}</div>
      <div style={{ fontSize: 40, fontWeight: 500, color: '#253f2a', lineHeight: 1.15 }}>{content.value}</div>
      <div style={{ fontSize: 14, color: '#5f7253' }}>{content.note}</div>
    </div>
  );
  return {
    id: 'safeTile', label: 'Safety tile', icon: { url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path fill="%23001435" d="M8 1l6 2v4c0 4-3 7-6 8-3-1-6-4-6-8V3z"/></svg>' },
    dataMapping: {}, form: ({ createDefaults }: { createDefaults: (p: object) => unknown }) => createDefaults({}),
    comp: Tile, defaultSize: { width: 360, height: 120 }, minSize: { width: 200, height: 90 },
  };
}

const AGENT_INSTRUCTIONS = `You help a marketplace user change what an existing read-only dashboard shows. Do not add new widgets: a widget added in the same run cannot be configured, so reuse the ones already on the page.
Steps: 1) call view_schema and view_page to see the sources, fields and the existing widget ids. 2) Pick the existing widget that fits and call the matching configure tool (for example configure_line_chart) with that widgetId and a data mapping built only from field ids that view_schema returned, written as source.field.
For a request about risk flags or AI escalations in the last N days (N = 1 to 7), use the source named flagsr_N (fields date and the flag counts) and reconfigure the widget with id flags (line chart) or escalations (column chart). For a request about the last N days of the seller's sales or revenue, use the source named recent_N (N = 1, 2, 3, 5, 7, 14 or 30; round up) with day as the category and revenue (or sales) summed as the value. Reconfigure the widget with id income (a line chart) for revenue and income, and the widget with id count (a column chart) for numbers of sales. If a widget with that id does not exist, say what you can do instead.
Never invent fields or numbers. If the request cannot be answered from the schema, say so in one sentence and change nothing.
You can only view and edit this dashboard. You cannot change cases, approve anything, or move money. Reply in at most two short sentences.`;
// One agent, not Studio's five: the small model we run cannot reliably hand work between several agents.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const aiSetup = ({ api }: { api: any }) => createAiHarness(api, ({ tools: { studio } }: any) => ({
  agents: [directLlmRunner({ id: 'dashboard', adapter: llmAdapter, instructions: () => AGENT_INSTRUCTIONS,
    tools: () => [studio.viewSchema(), studio.viewPage(),
      ...['line-chart', 'column-chart-grouped', 'donut-chart'].map((widgetType) =>
        studio.configureWidget({ widgetType }, { name: 'configure_' + widgetType.replace(/-/g, '_') }))] })],
  primary: 'dashboard',
}));

export interface StudioSource { id: string; data: Record<string, unknown>[] }

export default function StudioDashboard({ sources, initialState, height = 640, variant = 'seller', tile, adder, agent = true, onAsk, helpText = '' }: { sources: StudioSource[]; initialState: StudioState; height?: number; variant?: 'operator' | 'seller'; tile?: TileContent; agent?: boolean; onAsk?: (q: string) => Promise<ViewReply>; helpText?: string; adder?: MutableRefObject<((key: string, widget: unknown, title: string) => void) | null> }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const widgets = useMemo(() => tile ? (config: any) => createWidgets<any>({ additionalTypes: [tileWidget(tile) as any], menu: [...config.menu, { label: 'PayeeGuard', widgetIds: ['safeTile'] }] }) : undefined, [tile]);
  // The assistant adds a widget by building a new state from the current one. Nothing else in the state is touched.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const studioRef = useRef<any>(null);
  if (adder) adder.current = (key, widget, title) => {
    const api = studioRef.current?.api; if (!api) return;
    const state = structuredClone(api.getState());
    const page = state.pages.find((p: { id: string }) => p.id === state.selectedPageId) ?? state.pages[0];
    const titleWidget = { type: 'text', format: { style: { text: title, typography: { fontSize: 15, fontWeight: 'bold' } } } };
    if (page.widgets[key]) {
      // The same view was asked for before: change it in place (for example the number of days), do not add a copy.
      page.widgets[key] = widget; page.widgets[key + '_t'] = titleWidget;
      api.setState(state);
      setTimeout(() => document.querySelector('[data-testid="studio-dashboard"]')?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 150);
      return;
    }
    // A new view goes to the TOP: push everything else down by one block (title + chart), then place the new block at row 0.
    const BLOCK = 14;
    for (const layout of Object.values(page.widgetLayout as Record<string, { yTrack: number }>)) layout.yTrack += BLOCK;
    page.widgets[key + '_t'] = titleWidget;
    page.widgets[key] = widget;
    page.widgetLayout[key + '_t'] = { xTrack: 0, yTrack: 0, xSpan: 24, ySpan: 2 };
    page.widgetLayout[key] = { xTrack: 0, yTrack: 2, xSpan: 24, ySpan: 12 };
    api.setState(state);
    setAddedRows((n) => n + 14);
    setTimeout(() => document.querySelector('[data-testid="studio-dashboard"]')?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 150);
  };
  // Default: Studio's own tools, driven by a stronger NVIDIA model (RESCUE_STUDIO_MODEL, deepseek by default).
  // ?studioTools=0 switches to the small-model picker pipeline, which is faster and needs no second model.
  const studioToolsMode = !(typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('studioTools') === '0');
  useEffect(() => { setViewHandler(studioToolsMode ? null : (onAsk ?? null), helpText); return () => setViewHandler(null); });
  const licenseKey = import.meta.env.VITE_AG_STUDIO_LICENSE as string | undefined;
  // The clean full-width view is the default. Studio's AI panel needs edit mode, which adds side panels, so it opens on demand.
  const [assist, setAssist] = useState(false);
  // Height follows the widgets: the layout's last row, plus 14 rows for each widget the assistant adds (title + chart).
  const [addedRows, setAddedRows] = useState(0);
  const layoutBottom = useMemo(() => {
    const page = initialState?.pages?.[0];
    const rows = Object.values((page?.widgetLayout ?? {}) as Record<string, { yTrack: number; ySpan: number }>).map(l => l.yTrack + l.ySpan);
    return rows.length ? Math.max(...rows) : 0;
  }, [initialState]);
  const fit = layoutBottom > 0 ? (layoutBottom + addedRows) * 16 + 72 : height;
  return (
    <>
      {agent && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, flexWrap: 'wrap', margin: '0 0 8px' }}>
          <span style={{ color: 'var(--muted)', fontSize: 'var(--text-xs)' }}>Ask in plain words, for example "show revenue for the last 2 days". Asking again for the same view changes it in place.</span>
          <button type="button" aria-pressed={assist} data-testid="open-ai-assistant" onClick={() => setAssist(a => !a)}
            style={{ padding: '8px 16px', borderRadius: 999, border: '1px solid var(--line-dark)', background: assist ? 'var(--gold)' : 'transparent', color: assist ? 'var(--gold-text)' : 'var(--text)', fontWeight: 600, cursor: 'pointer' }}>
            <img src="/logos/ag-grid.svg" alt="" height={16} style={{ height: 16, width: 'auto', marginRight: 8, verticalAlign: 'middle' }} />{assist ? 'Close AG Studio AI Assistant' : 'Open AG Studio AI Assistant'}
          </button>
        </div>
      )}
    <div className={styles.studioFrame} style={{ height: assist ? Math.max(fit, 780) : fit }} data-testid="studio-dashboard">
      <AgStudioProvider licenseKey={licenseKey} modules={[AgStudioAiModule]}>
        <AgStudio ref={studioRef} style={{ height: '100%' }} data={{ sources }} initialState={{ ...initialState, panels: { filters: { collapsed: true }, compose: { collapsed: true }, widgets: { collapsed: true }, data: { collapsed: true } } }} mode={agent && assist ? "edit" : "view"} widgets={widgets} ai={agent ? aiSetup : undefined} theme={variant === 'operator' ? OPERATOR_THEME : SELLER_THEME} />
      </AgStudioProvider>
    </div>
    </>
  );
}
