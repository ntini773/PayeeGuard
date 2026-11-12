Screens: operator queue, case detail, seller “connect PayPal” and request status. That is enough.
Case detail shows: masked old and new payer IDs side by side, a checklist of evidence (old-account login, new-account login, role, balance), the AI summary, the policy decision and the audit timeline.
Labels: an AI advisory badge on the summary and a Simulated badge on any simulated step. Use one shared component for each.
States: held, cooling-off with a countdown, approved, rejected, error and empty. Use amber, red and green with text labels, not colour alone.
Rules: no approve button when the policy says deny. No bulk approve. Never display full payer IDs.
Build against the mock case JSON first. Switch to the real API once the backend passes its tests.
Check: ask Antigravity to open the running app, screenshot every state, and list anything that breaks, clips or contradicts the brief.