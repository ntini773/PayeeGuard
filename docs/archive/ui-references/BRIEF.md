# UI reference brief: Stood-style PayeeGuard in PayPal colors

**For:** Antigravity (owns `ui/`). **Written by:** Claude Code, 2026-11-10. **Scope decided by the user:** console and landing page, equal priority.
**Source:** public pages of https://github.com/ma-za-kpe/stood, captured 2026-11-10 (Playwright, desktop 1440px and mobile 390px).
The screenshots are third-party design references. They are git-ignored here and must not be shipped, copied into `ui/`, or shown in the demo.

## 0. How to use this

1. Look at the screenshots below. 2. Copy the layout, rhythm, component shapes and interactions. 3. Use the PayPal palette in section 3, not Stood's colors.
4. Write your own copy for PayeeGuard (section 5). 5. Follow the rules in section 7. Do not edit anything outside `ui/`.

## 1. Two reference styles, one recommendation

Stood has two public pages with different looks. Use the first for structure and the second as a palette hint.

| Page | Look | Use it for |
|---|---|---|
| **Stood landing** (`/stood/`) "Volt" | Dark violet-black, big rounded type, pill chips, tilted decision card, lime accent, cream sections | **Layout, components, interactions.** This is the vibe the user asked for. |
| **Yard** (`/stood/yard/`) "Blueprint" | Navy `#071a33` with a faint 48px grid, amber `#ffb000`, cyan `#3fd0ff`, condensed all-caps headlines | **Colour inspiration.** It is already close to PayPal navy + gold. Optional: the faint grid background. |

**Recommendation:** Stood landing structure and components, painted with the PayPal-style palette. Optionally add Yard's faint grid texture to the hero.

## 2. Screenshot index and what to take from each

Files are in `docs/ui-references/`.

| File | What it shows | Copy this | Do not copy |
|---|---|---|---|
| `stood-landing-desktop-fold.png` | Hero: sticky nav, eyebrow pill with pulsing dot, huge 4-line headline with one highlighted word and thick underline, notice pill, lede, two buttons, tilted decision card | Two-column hero (copy left, card right). Headline at `clamp(44px, 8.4vw, 112px)`, weight 800, line-height 0.95, tracking -0.035em. One accent word with an underline bar. Mono uppercase eyebrow. Blurred radial glow behind the card. The "live sandbox, examples execute no payment" notice directly under the headline. | The words "Agents pay agents", the lime colour, the logo. |
| `stood-section-hero.png`, `stood-section-decision-card.png` | Decision card close-up: header row (parties, time), big outcome chip, one sentence, checklist rows with right-aligned values, footer row with payment status | Card rotated 2deg, straightens on hover. Radius 28px, 1px border, dark gradient, inset top highlight. Chip + one plain sentence + 4 to 6 check rows + status footer. | Stood's fields (signed tests, mutation score). |
| `stood-section-ticker.png` | Scrolling strip of example events | Marquee of synthetic events with a small colour dot each. Mark it simulated. | Its event text. |
| `stood-section-problem-cream.png` | Light "paper" section: mono blue kicker, short punchy H2, two side-by-side cards (one light, one dark), a giant stat, a highlighted sentence | Alternating dark and light sections. Kicker + H2 + two contrasting cards. Highlighter-style mark on the key sentence. | The $1B+ stat. PayeeGuard has no proven prevalence number, so do not invent one. |
| `stood-section-how-steps.png` | Numbered four-step flow | Numbered steps, one idea per step. | Its steps. |
| `stood-section-try-the-gate.png`, `stood-section-try-the-gate-refused.png` | Interactive demo: toggle chips for who is buying and building, scenario cards on the left, verdict panel on the right with checks and outcome | Left list of scenario buttons, right verdict panel with rows that fill in and an outcome chip and sentence. Always labelled as a simulation. | The buyer/builder toggles. |
| `stood-section-principles.png`, `stood-section-cta-footer.png` | Principles block, closing call to action and footer | Short principle statements. Closing CTA with two buttons. Honest footer. | Its badges and links. |
| `stood-section-nav.png` | Sticky blurred nav | Sticky nav, blur 14px, thin bottom border, mono-free links, one pill button on the right. | Its menu items. |
| `stood-landing-mobile-fold.png`, `stood-landing-mobile-full.png` | Mobile: nav collapses to brand + two links, hero stacks, card moves below the buttons | Single column below 900px. Full-width pill buttons. No horizontal scroll. | |
| `stood-yard-desktop-fold.png`, `stood-yard-*.png` | Yard: navy blueprint grid, amber CTA button, "SIMULATED" tag in a corner, notice with amber left border | Navy + gold pairing. A small "SIMULATED" tag on illustrative panels. Left-bordered notice block for "no payment is executed". | Condensed caps headline font, the crane illustration. |

The full-page captures (`*-full.png`) show the whole page order if you need the section rhythm.

## 3. PayPal-style palette (replaces Stood's lime and violet)

Define as CSS variables in `ui/src/styles/variables.css` (light and dark). Check WCAG AA contrast for every text/background pair and adjust a hex value if one fails.

| Role | Token | Value |
|---|---|---|
| Page dark | `--night` | `#001435` |
| Surface 2 / 3 | `--night-2` / `--night-3` | `#00205B` / `#003087` (PayPal brand dark blue) |
| Light section | `--paper` | `#F5F7FA` |
| Primary CTA / highlighted word | `--gold` | `#FFC439` with navy text `#001435` |
| Glow, links, focus ring | `--blue` / `--sky` | `#0070E0` / `#009CDE` |
| Released / Active | `--ok` | `#1FA971` |
| Refused / Blocked | `--bad` | `#D9363E` |
| Held / In review | `--sky` | `#009CDE` (keeps gold only for the CTA) |
| Text / muted on dark | `--text` / `--muted` | `#FFFFFF` / `#A9B8D6` |
| Borders | `--line-dark` / `--line-light` | `#1E3A78` / `#D9E2F0` |

Status always has an icon and a word. Never colour alone.

## 4. Type, shape, motion (from Stood's CSS, keep these)

- Fonts, all from Google Fonts: **Bricolage Grotesque** (display, 800, `font-stretch` 90 to 92%), **Geist** (body 17px/1.55), **Geist Mono** (labels, IDs, kickers uppercase with 0.12em tracking, 13px).
- Radii: 10 / 18 / 28px and pill (999px). Gutter `clamp(16px, 4vw, 48px)`. Max width 1200px.
- Buttons: 48px high, pill, 600 weight. Primary gold; ghost has a 1.5px border. Hover lifts 2px, primary gets a soft glow shadow.
- Chips: pill, display font 800 20px, icon (check, cross, clock) + word.
- Focus: 3px outline in `--gold` or `--sky` with 3px offset, on every interactive element.
- Motion: glow drifts (14s), headline underline draws in (1.1s), chip pops (0.45s), cards reveal on scroll, magnetic buttons, card tilt. **All must turn off under `prefers-reduced-motion`.**

## 5. PayeeGuard content mapping

**Case states as decision-card chips (console and landing)**

| Backend state | Chip | One sentence |
|---|---|---|
| `PENDING_NEW_ACCOUNT_AUTH`, `PENDING_OLD_ACCOUNT_AUTH`, `PENDING_REVIEW` | Held (sky, clock) | "The new account cannot be paid yet." |
| `APPROVED_COOLING_OFF` | Cooling off (sky, clock) | "Approved. Waiting until <backend deadline>." |
| `ACTIVE_NEW_DESTINATION` | Active (green, check) | "The approved account now receives payouts." |
| `REJECTED` | Blocked (red, cross) | "The change was rejected. The proposed account stays unused." |
| `EXPIRED` | Expired (red, cross) | "The request expired without the required evidence." |

**Checklist rows (backend-verified, solid border):** New account login · Old account match · Seller entitlement · Marketplace approval · Cooling-off · Payout gate.
**Seller claims:** dashed border, italic, labelled "Seller says". **AI summary:** always shows an "Advisory" badge and is never the last word on a decision.

**Landing page sections (in this order)**
1. Hero. Headline idea: "A login is not **permission** to redirect someone's earnings." Decision card shows a Held case. Notice: "Simulation. No payment is executed."
2. Problem (paper section). Two cards: "The attacker logs in with their own PayPal." and "The seller loses future earnings." No invented statistics.
3. Four steps: Detect, Hold, Verify and review, Pay only the approved account.
4. **Try the attack** (interactive, client-side fixtures only): scenarios "Attacker logs in with own PayPal" (Held), "Old account check fails" (Held, review required), "Operator approves" (Cooling off), "Cooling-off ends" (Active), "Request to pay a friend" (Held, escalated). Label: "Illustrative simulation. Not the live backend."
5. "AI investigates. Rules authorize. The gate enforces. PayPal moves the money." (principles)
6. Limitations (honest list from `AGENTS.md` rule 10 and the plan).
7. CTA and footer: "Built on PayPal Payouts. Not affiliated with or endorsed by PayPal."

**Console** keeps the existing screens (queue with AG Grid, case detail, review) and gets: the new tokens and fonts, the decision-card header on case detail, chips on queue rows, the evidence checklist styling, and the sticky blurred nav.

## 6. Build notes

- Landing page: keep it light. Plain HTML/CSS/JS or a second Vite entry in `ui/`, no new heavy libraries. Stood's landing page uses none.
- Reuse what exists: `ui/src/components/badges`, `detail`, `queue`, `ui/src/styles/*.css`. Restyle, do not rewrite behavior.
- Console data: it still runs on mock data (`ui/src/config.ts`: `USE_MOCK_DATA = true`). Show a visible "MOCK DATA" banner while that is on. Switching to the real backend waits for Codex's list endpoint and demo seed.
- Show backend-masked payer IDs exactly as received. Do not mask them again.

## 7. Rules (from `AGENTS.md` and `ui.md`, repeated)

- The UI renders backend state. It never authorizes, approves or activates. AI output is advisory and never shown as approval.
- Label every simulated or mock element. Do not claim a feature works until it does.
- No PayPal logo, wordmark or monogram, except the official "Log in with PayPal" button where it is a real login control. No sponsor logo strips.
- No full payer IDs in the DOM, no tokens or credentials in the bundle.
- Do not edit `rescue/`, `tests/` (backend), `docs/docs/*` or any file outside `ui/`.
- Do not use Stood's name, logo, copy or colours. This is a style reference only.

## 8. Acceptance checklist

- [ ] `cd ui && npm run build` passes; no console errors.
- [ ] Screenshots of the console in all 7 states and of the landing page, at 1440px and 390px; no horizontal scroll, no clipped text.
- [ ] Contrast checked for every status colour pair; keyboard-only pass; reduced-motion honored.
- [ ] Landing page "Try the attack" and ticker are labelled as simulation.
- [ ] Footer disclaimer present. No invented statistics or claims.
- [ ] Console shows the MOCK DATA banner while `USE_MOCK_DATA` is true.
