You are Antigravity, the UI owner for PayeeGuard. Task: redesign and extend the TypeScript UI in `ui/` so it looks polished and animated, in the style described in the briefs below, using PayPal-style colors.

READ FIRST, in this order:
1. `AGENTS.md` (rules, security boundaries) and `docs/UI_BRIEF.md`
2. `docs/API_CONTRACT.md`, `docs/STATE_MACHINE.md`, `docs/POLICY.md` (in `docs/docs/`)
3. `docs/ui-references/BRIEF.md` (style, palette, content mapping, rules, with reference screenshots `docs/ui-references/stood-*.png`)
4. `docs/ui-references/BRIEF_MOTION_GRAPHS_SCHEMAS.md` (motion, node graphs, schema explorer, Mermaid, and section 10 on content density, chat console and buttons)
5. `docs/ui-checks/state-needs-review.png` (the previous UI; section 10.1 explains what to fix)

SCOPE (all work inside `ui/` only):
- Operator console restyle: decision-card hero, three zones (what is happening / why / what you can do), sticky Approve/Reject bar, compact audit drawer, humanized labels from one mapping file, tabs or drawer instead of ten stacked boxes.
- Landing page with the sections in BRIEF.md section 5, including the "Try the attack" simulation and ticker (both labelled illustrative).
- Data-flow graph with `@xyflow/react`: illustrative full flow, and a live case graph driven by case state. The AI node has read-only advisory edges and NO edge to policy, activation, hold release or payout. Add a test asserting that.
- Schema explorer with short comments on every field, trust chips, example payload with Shiki, and a test that fails when a field has no comment.
- Mermaid support via a lazy-loaded `<MermaidDiagram>` (strict security, themed from our tokens) and Markdown fences. Only render repo-authored diagram text.
- Chat console for seller messages and the investigator: structured assessment cards, tool-activity pills, stale and unavailable states, advisory-only banner.
- One Button/IconButton system with the rules in section 10.5.
- Motion with `motion`, all disabled under `prefers-reduced-motion`, plus a visible toggle.
- Console stays on mock data for now. Show a visible "MOCK DATA" banner while `USE_MOCK_DATA` is true. Do not invent endpoints. The real list endpoint and demo seed are pending from Codex; when they exist, flip the flag, add the `/api/v1` proxy, and show backend-masked IDs exactly as received.

PRIORITY ORDER: (1) console restyle and buttons, (2) landing page, (3) flow graph and Mermaid, (4) schema explorer, (5) chat console polish. If time runs out, finish in this order and report what is missing.

HARD RULES:
- The UI renders backend state. It never authorizes, approves, activates or moves money. AI output is advisory and never styled as approval or success.
- Label every simulated, mock or illustrative element. No invented statistics, customers or capabilities.
- No PayPal logo, wordmark or monogram (only the official "Log in with PayPal" button if a real login control is needed). Footer: "Built on PayPal Payouts. Not affiliated with or endorsed by PayPal."
- No full payer IDs in the DOM, no tokens or credentials in the bundle. Do not re-mask IDs the backend already masked.
- Do not copy Stood's name, logo, copy or colors. The screenshots are style references only; do not commit or ship them.
- Do not edit `rescue/`, `tests/` (backend), `docs/docs/*`, `pixi.toml` or any file outside `ui/`. If you need a backend change, write it down for Codex instead.
- Pin exact versions for new dependencies, lazy-load React Flow, Mermaid and Shiki, `strict` TypeScript, no `any` for API data.

QUALITY BAR: `cd ui && npm run build` passes with no console errors. Keyboard-only path and visible focus everywhere. WCAG AA contrast for every color pair. No horizontal scroll at 390px. Lighthouse mobile on the landing page: report real numbers.

DELIVER A REPORT with: files changed (all under `ui/`), libraries added with versions, screenshots per route and state at 1440px and 390px plus a reduced-motion run, before/after screenshots of the needs-review case, bundle sizes, Lighthouse numbers, what is mock versus live, tests added and their results, accessibility results, and anything not done or uncertain. Do not claim a feature works until its test or check has run.
