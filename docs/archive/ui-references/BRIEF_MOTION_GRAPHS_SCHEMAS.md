# Brief v2 for Antigravity: motion, data-flow graphs, schema views, Mermaid

**Extends** `docs/ui-references/BRIEF.md` (style, palette, content mapping, rules). Read that first.
**Goal from the user:** a genuinely beautiful TypeScript UI with strong animation, node-graph data flows, better schema display,
and Mermaid support. Written by Claude Code, 2026-11-10. Antigravity owns all edits in `ui/`. No backend files.

## 1. Stack (all TypeScript, React 19 + Vite, which `ui/` already uses)

Current `ui/` deps: react, react-dom, ag-grid-react, vite, typescript. Add only what is listed. Pin exact versions (latest on 2026-11-10 shown).

| Need | Library | Version seen | Why |
|---|---|---|---|
| Node graph / data-flow diagram | `@xyflow/react` (React Flow) | 12.12.1 | Custom nodes and animated edges as React components, pan/zoom, keyboard accessible |
| Auto layout (only if layout is not hand-placed) | `elkjs` | 0.12.1 | Layered layout for the larger graphs. Skip it if hand-placed coordinates look better |
| Mermaid diagrams | `mermaid` | 12.3.0 | Sequence, state, ER, flowchart. Lazy-loaded |
| Animation | `motion` (Motion for React, formerly Framer Motion) | 14.12.0 | Springs, layout animations, scroll-linked effects, `useReducedMotion` |
| Code and schema highlighting | `shiki` | 4.6.0 | Accurate highlighting, themed to our palette. Lazy-loaded |
| Routing (landing + console + docs) | `react-router-dom` | 7.18.5 | Only if you build several pages in one app |
| Smooth scroll (optional) | `lenis` | 1.3.27 | Landing page only. Skip if it fights keyboard or reduced-motion |

Rules: lazy-load Mermaid, Shiki and React Flow with `import()` so the console's first load stays small. No other new libraries without a reason written in the report.
Use CSS for simple motion (hover, chips, glow). Use `motion` for layout, scroll-linked and gesture motion. Animate only `transform` and `opacity`.

## 2. Motion language ("goated", but disciplined)

- **Landing hero:** staggered headline reveal (words slide up, 40ms apart), accent-word underline draws in, glow drifts, decision card enters with a spring and tilts toward the pointer (max 6deg). Ticker marquee pauses on hover.
- **Scroll:** sections reveal with a small rise and fade. A pinned "how it works" section where scrolling advances the four steps and the flow graph highlights the matching node.
- **Chips and status:** state changes animate with a quick pop and an icon morph (clock to check). Cooling-off shows a live countdown ring.
- **Numbers:** counters tick on change, tabular numerals.
- **Lists and grids:** layout animation when rows filter or reorder (`layout` prop). AG Grid keeps its own row animation.
- **Page transitions:** short crossfade, under 200ms.
- **Micro-interactions:** magnetic primary button, focus rings that animate in, ripple-free press scale (0.98).
- **Budget:** keep 60fps on a mid laptop. No animation longer than 1.2s except ambient glow and ticker. Ambient loops stop when the tab is hidden.
- **Reduced motion:** with `prefers-reduced-motion: reduce` replace all of the above with instant state changes. Provide a visible "Reduce motion" toggle in the footer too. Test both modes.

## 3. Data-flow graph (React Flow)

A reusable `<FlowGraph>` component, typed props, nodes and edges as plain typed data. Two uses:

**A. "How a destination change flows" (landing page and console help panel). Illustrative.** Nodes, left to right:

1. Seller signs in to marketplace (untrusted session)
2. Requests destination change
3. Backend creates case + **payout hold** (trusted)
4. New PayPal account login (callback goes straight to backend)
5. Old PayPal account login (must match stored account A)
6. Deterministic policy (trusted)
7. Operator review (human, role-checked)
8. Cooling-off (backend clock)
9. Activate new destination (backend only)
10. Payout gate reads the **stored** destination, then PayPal Payouts
Side node: **AI investigator** (advisory). Draws a dashed read-only edge from the case data into it, and a dashed "summary only" edge out to Operator review. **No edge** from the AI node to policy, activation, gate or payout. Show a small lock icon and the label "No write path".

**B. Live case graph (console, case detail). Bound to backend state.** The same graph, with the current state's node highlighted, completed nodes marked done, and blocked nodes dimmed, derived from the case `state` and `authentication` fields. If the data is mock, show the "MOCK DATA" banner and an "Illustrative" tag.

Node and edge design:
- Node types with distinct borders and icons: **Trusted backend** (solid sky border), **Untrusted input** (dashed, italic), **Human** (gold), **Advisory AI** (dashed violet-free, use sky + "Advisory" badge), **External** (PayPal, plain border, no logo).
- Edges animate a dot travelling along the path only on the active segment. Idle edges are static. Edge labels in Geist Mono.
- Click a node: side panel with plain-language description and the exact rule from `docs/POLICY.md` or `docs/STATE_MACHINE.md` that governs it.
- Keyboard: nodes focusable, arrow keys move focus along edges, Enter opens the panel. Provide a text list alternative (`<ol>`) for screen readers.
- Fit view on load, mini-map off on mobile, no drag-to-edit (read-only graph).
- Never imply real execution. Landing graph is labelled "Illustrative".

## 4. Schema and API display (a "Schema explorer")

Replace raw JSON dumps with a structured view. Source of truth is hand-written TypeScript types that mirror `docs/API_CONTRACT.md` (`ui/src/types/case.ts`); do not invent fields.

- **Field tree**: collapsible, one row per field with name (mono), type chip, enum values as pills, required marker, and a **trust label**: `Backend-verified`, `Seller input (untrusted)`, `AI advisory`, `Masked`. Colour plus text, never colour alone.
- **Example payload** beside the tree with Shiki highlighting. Hover a field in the tree to highlight its line in the payload, and the reverse. Copy button.
- **Request/response cards** per endpoint (method pill, path, auth, idempotency header, error codes from the contract). Show which fields the caller **may not** send (`payer_id`, `verified`, `approved`, `hold_released`) in a red "Rejected by server" box.
- **State table** from `docs/STATE_MACHINE.md` as an interactive table: filter by from-state, click a row to highlight the transition in the state diagram.
- **Entity relations** (case, evidence records, audit events, ai_assessment): render with Mermaid `erDiagram` or a small React Flow graph.
- Provide "Copy as JSON Schema / TypeScript" only if generated from the same types. Skip if that adds risk.

## 5. Mermaid support

Build a `<MermaidDiagram source="…" />` component and a Markdown renderer that turns ```mermaid fences into diagrams.

- `import('mermaid')` on first use. Initialize once with `securityLevel: 'strict'`, `startOnLoad: false`, and `theme: 'base'` with `themeVariables` taken from our CSS tokens (re-initialise when the theme or reduced-motion setting changes).
- **Only render trusted, repo-authored diagram text.** Never pass seller text, AI output or API data into Mermaid. Sanitize any label that comes from code constants.
- Render to SVG inside a container with `role="img"` and an `aria-label` plus a collapsible "Diagram source" block for accessibility and copy.
- Supported types to style and test: `flowchart`, `sequenceDiagram`, `stateDiagram-v2`, `erDiagram`. Ship ready diagrams for: destination-change flow, case state machine, callback sequence (seller, backend, PayPal), data model.
- Pan/zoom for wide diagrams, fit-to-width on mobile, dark and light variants, error state that shows the source instead of crashing.
- A `/docs` (or "Learn") route renders `docs/architecture.md`-style Markdown with these components. Keep the source Markdown in `ui/src/content/` (copy of repo docs is fine); do not read repo files at runtime.
- If a Content-Security-Policy applies, Mermaid and Shiki must work without `unsafe-eval`. If they cannot, say so in the report rather than loosening CSP.

## 6. Pages

| Route | Content |
|---|---|
| `/` | Landing (per `BRIEF.md` section 5), with hero decision card, scroll-driven flow graph, "Try the attack" simulation, limitations |
| `/console` | Operator queue (AG Grid) and case detail, with the live case graph |
| `/how-it-works` | Full flow graph, Mermaid diagrams, state table |
| `/schema` | Schema explorer and endpoint cards |

Console stays the priority for correctness. Landing and diagrams are equal priority for visual polish, per the user.

## 7. Performance and quality bar

- Lighthouse (mobile) targets for landing: Performance 90+, Accessibility 100, Best Practices 100. Report the real numbers.
- Initial JS for `/` under 200 KB gzip excluding lazy chunks. React Flow, Mermaid and Shiki are separate lazy chunks.
- No layout shift from fonts (`font-display: swap`, preload the display font). No horizontal scroll at 390px.
- Keyboard-only path for every interaction, visible focus, `aria-live="polite"` for state changes, contrast AA.
- Type-safe: `strict` TypeScript, no `any` for API data, typed node and edge data.
- Tests: Playwright screenshots for each route at 1440px and 390px, plus a reduced-motion run. Unit test the state-to-graph mapping (given a case state, which nodes are done/active/blocked).

## 8. Truthfulness rules (non-negotiable)

- Every simulated, mock or illustrative element is labelled. The landing graph and "Try the attack" say "Illustrative simulation".
- The graph must never show a path from AI output to approval, activation, hold release or payout. This is a core product claim; test it (assert no edge exists from the AI node to those nodes).
- No PayPal logo or wordmark. "Built on PayPal Payouts. Not affiliated with or endorsed by PayPal."
- No invented statistics, customers, or capabilities. Do not show real payer IDs, tokens or credentials.
- UI renders backend state only. It never authorizes anything.

## 9. Deliverables and report

Antigravity returns: changed files (all under `ui/`), screenshots per route and state (desktop, mobile, reduced-motion), Lighthouse numbers, bundle sizes, which libraries were added with versions, what is mock versus live, accessibility results, and anything that could not be done.

---

# 10. Content density, presentation, schema comments, chat console, buttons (added after reviewing the first UI)

## 10.1 What was wrong with the first console (`docs/ui-checks/state-needs-review.png`)

Seen in the screenshot, not guessed:
- **One long page of about ten stacked boxes** (header, A/B cards, claim, evidence, checklist, AI box, policy, operator form, audit). Everything has the same weight, so nothing leads.
- **Every row is a title + sub-line + status in capitals** (for example "VALIDATED (PAYPAL_CALLBACK)"). Raw enum strings are shown to the user (`REQUIRE_MARKETPLACE_REVIEW`, `ALL_AUTH_COMPLETE`).
- **Small grey body text** on white and light grey cards. No colour hierarchy beyond small badges, system font only, no icons, no motion.
- A developer "Target State Views" strip sits at the top of the real screen.
- The audit timeline spends four lines per event (name, actor, time, summary, state change).
- The decision (Approve / Reject) is at the bottom after scrolling past everything, and the buttons look like plain form buttons.

The content is right. The presentation needs to carry it. **Keep every fact, show fewer words at once.**

## 10.2 Rules for content-rich but not text-heavy

1. **One hero per screen.** The case page opens with the decision card from `BRIEF.md` (outcome chip, one sentence, 4 to 6 check rows with icons). Everything else supports it.
2. **Text budget:** a label is 1 to 4 words, a helper line is at most 12 words, a paragraph is at most 2 short lines. Anything longer goes behind a "Why?" popover or an expandable row.
3. **Progressive disclosure:** summary visible, detail on demand. Use tabs or a side drawer (Evidence, Policy, AI notes, Audit) instead of stacking all of them. Default tab shows only the next action and the blockers.
4. **Humanize enums.** Map codes to short phrases in one place (`ui/src/content/labels.ts`): `REQUIRE_MARKETPLACE_REVIEW` shows "Needs operator review". Keep the raw code in a small mono tooltip for debugging and copy.
5. **Icons and shape instead of words:** check, clock, lock, shield, user, bot icons beside labels. Status is chip + icon + one word.
6. **Group into 3 zones, not 10 boxes:** (a) *What is happening* (decision card, A to B pair, countdown), (b) *Why* (evidence checklist, policy result, AI advisory), (c) *What you can do* (sticky action bar). Audit sits in a drawer.
7. **Sticky action bar** for Approve / Reject at the bottom of the case view, always visible, with the reason field inside it (collapsed to one line until focused).
8. **Audit timeline compact:** one line per event (icon, short phrase, relative time). Click a row to expand actor, state change, policy version, evidence refs. Show absolute time in a tooltip.
9. **Whitespace and scale:** 16px minimum body, clear type scale (display, title, body, mono label), 24px+ between zones, generous card padding. Dark theme default, matching `BRIEF.md`.
10. **Empty and loading states** designed, not blank: skeleton shimmer for loading, a small illustration or icon with one line and one action for empty.
11. Remove the dev state-switcher from the production view. Keep it behind `?dev=1` or a clearly labelled dev drawer.

## 10.3 Schema display with short comments

For the Schema explorer (section 4) and any JSON shown anywhere:

- **Inline gutter comments:** each field row has a small muted comment, 12 words max, in plain English. Example style:
  - `state` , "Where the case is now. Only the backend changes it."
  - `proposed.masked_payer_id` , "New account, masked. Never the full ID."
  - `authentication.old_account.status` , "Did the old account log in and match? Set by PayPal callback only."
  - `ai_assessment.recommendation` , "Advice for the reviewer. Cannot approve anything."
  - `version` , "Send this back when you review, so stale decisions are rejected."
- **Comment styling:** `// like this` in Geist Mono, muted, with a small "i" icon that opens a longer note (max 3 lines) and the doc reference (`docs/API_CONTRACT.md` section).
- **Trust chip on every field** (Backend-verified, Seller input, AI advisory, Masked), colour + icon + word.
- **Hover linking:** hover a field comment, highlight the field in the tree and in the example payload.
- **Toggle "Show comments"** (on by default in the Learn page, off in the console to keep it clean).
- **Comments are repo-authored constants** in `ui/src/content/schemaNotes.ts`, typed by field path. They are not from the API, AI or sellers. Every field in the type must have a note (a unit test fails if one is missing).
- Same idea for the state table and Mermaid diagrams: node and edge tooltips with one sentence of "why this exists".

## 10.4 Chat console (seller messages and AI investigator)

The seller sends messages, the investigator reads them, the operator reads the result. Design it as a polished console, not a plain text log.

- **Layout:** left, the conversation; right, a collapsible "Investigator notes" panel. On mobile, notes become a bottom sheet.
- **Messages:** bubbles with role label and avatar icon (seller, assistant, system). Seller messages carry a small "Seller says" tag. Assistant messages carry "Advisory" and never look like a decision.
- **Structured replies, not walls of text.** Render the investigator's assessment as a compact card: reason category chip, risk-signal chips (each with icon), missing-information checklist, up to 3 follow-up questions as **tappable suggestion chips**, and a one-line summary. Show the raw JSON only in a "Details" drawer using the schema view.
- **Tool activity line:** small inline pills such as "Read case status" or "Read seller messages" while it works, with a subtle animated dot. Shows it is read-only. If the backend reports a denied tool call, show a muted "Blocked: not allowed" pill.
- **Streaming and states:** typing indicator, message enter animation (slide and fade 150ms), scroll-anchoring, "Assessment out of date" banner when the backend `stale` flag is true, error and "assistant unavailable, case stays restricted" state with a retry button.
- **Composer:** auto-growing textarea, character counter near the limit, send button with loading state, Enter to send and Shift+Enter for a new line, attach nothing. A one-line hint: "Messages are saved to the case. The assistant cannot approve changes."
- **Safety presentation:** a persistent slim banner on the investigator panel: "Advisory only. Cannot approve, activate or move money." Never use green success styling for AI output.
- **Accessibility:** `role="log"` with `aria-live="polite"`, focus management after send, visible focus on every control.

## 10.5 Buttons and controls system

Build one `<Button>` and one `<IconButton>` in `ui/src/components/common`, with tokens from `BRIEF.md`.

| Variant | Use | Look |
|---|---|---|
| Primary | The main safe action on a screen (Request change, Send) | Gold fill, navy text, pill, lift on hover, soft glow |
| Secondary | Other actions | Ghost: 1.5px border, fills on hover |
| Approve | Operator approval | Green fill with check icon, needs reason filled and current version |
| Reject | Operator rejection | Red outline, red fill on hover, confirm step |
| Quiet / link | Tertiary, "Why?" | Text with underline on hover |
| Icon button | Copy, expand, close | 40px target, tooltip, accessible name |

- Sizes: sm 36px, md 44px, lg 52px. Minimum touch target 44px on mobile.
- States for every variant: default, hover, focus-visible ring, pressed (scale 0.98), loading (spinner, width stays fixed, `aria-busy`), disabled **with a visible reason** ("Add a reason to approve", "Case changed, refresh") via tooltip and `aria-describedby`, not just greyed out.
- **Approve and Reject:** only shown when the backend says the user may review. Approve is disabled until reason is entered, and sends `expected_version`. Reject asks one confirm. On `409` show "Someone changed this case. Reload." with a reload button. No bulk actions.
- Button groups and the sticky action bar use a segmented layout with a clear primary.
- Keyboard: Enter/Space activate, Escape closes popovers and drawers, shortcuts only if listed in a help popover.
- No button may say or imply it moves money. Labels: "Approve change", "Reject change", not "Pay" or "Release".

## 10.6 Other presentation upgrades

- **A to B destination pair** as a visual: two account cards joined by an animated connector that shows "Held" (dashed, lock) until activation, then "Active" (solid).
- **Cooling-off** as a ring or progress bar with the backend deadline and "Ends in 2d 4h".
- **Command palette** (Ctrl/Cmd+K) to jump to a case or route, optional and lazy-loaded.
- **Toasts** for save, error and stale-version events, with `aria-live`.
- **Theme:** dark default, light variant available, both AA contrast.
- Consistent icon set (one library, for example Lucide). Add it with a pinned version.

## 10.7 Acceptance checks added by this section

- [ ] Case view shows hero card, three zones, and sticky action bar. No more than about 3 screens of scroll on desktop for any case.
- [ ] No raw enum strings in the main UI. Labels come from one mapping file. Raw codes only in tooltips and the details drawer.
- [ ] Every schema field has a short comment. A test fails when a field has none.
- [ ] Chat console shows structured assessment cards and tool-activity pills. Raw JSON only in the details drawer.
- [ ] Every disabled button explains why. Approve and Reject follow the rules in 10.5.
- [ ] Before and after screenshots of the same case (needs-review) at 1440px and 390px for comparison, and a reduced-motion run.
