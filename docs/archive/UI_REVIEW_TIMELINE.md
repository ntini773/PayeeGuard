# Readability and AI review timeline

2026-11-11. Presentation changes complete. Production frontend rebuilt. No
commits, credentials displayed, real AI review, or PayPal operation in this task.

## Changes

- Increased shared small/body typography from 12/13/15 px to 13/14/16 px.
- Increased small fixed labels in navigation, login forms, workspace dashboards,
  queue filters, case details and chat. AG Grid body text is now 14 px.
- Replaced the AI review event list with a connected vertical timeline: green
  checked circles for completed steps, spinning/pulsing current node, and distinct
  failed/blocked nodes. The current step is also identified in text.
- A tool call and its result share a node. Repeated tool calls remain separate.
  A missing tool result never becomes a green check simply because the review ends.
- Kept simulated versus live PayPal read labels and advisory-only boundary.
- Both OS and application reduced motion disable spin/pulse animations.

## Files changed by this task

- `ui/src/components/detail/AiInlineCard.tsx`
- `ui/src/components/detail/AiReviewTimeline.tsx` (new presentation component)
- `ui/src/utils/reviewTimeline.ts` (new event-to-display mapping)
- `ui/src/styles/reviewTimeline.module.css` (new)
- `ui/src/styles/variables.css`
- `ui/src/styles/{auth,app,layout,queue,detail,detailTabs,guideChat}.module.css`
- `ui/src/components/queue/gridTheme.ts`
- `ui/src/test/reviewTimeline.test.ts` (new)
- `ui/tests/reviewTimeline.browser.mjs` (new)
- `ui/dist` (build output)

This task did not edit backend services, payout policy, gate, API contracts or the
API client. Other concurrent working-tree changes were preserved.

## Fresh checks

Run from `ui/`, local Chrome and Vite at `http://127.0.0.1:5175`:

- `npm test`: PASS, 9 tests, including 4 review-progress tests.
- `npx tsc -b`: PASS.
- `PAYEEGUARD_UI_URL=http://127.0.0.1:5175 node tests/reviewTimeline.browser.mjs`:
  PASS, 5 browser check groups. Tests running/completed/failed timelines, connected
  lines, larger text, reduced motion and 320 px long-text wrapping. All API
  requests blocked; the timeline is mounted with an explicitly synthetic fixture.
- `PAYEEGUARD_UI_URL=http://127.0.0.1:5175 node tests/landing.browser.mjs`:
  PASS, 26 public-page checks.
- `NODE_OPTIONS=--max-old-space-size=6144 npm run build`: PASS, existing large
  vendor-chunk warnings remain.

No new live provider or financial execution verification is claimed. Existing
AI polling and backend decisions remain the sources of review progress/state.
