# PayeeGuard (draft for the Devpost description)

**Tagline.** A login is not permission to redirect someone else's earnings.

**The problem.** Marketplaces pay sellers through PayPal. Someone who gets into a seller's marketplace account can connect their own PayPal
account and redirect the seller's future earnings. PayPal authenticates the new account. It does not decide whether the marketplace should
pay it. That decision belongs to the marketplace.

**What PayeeGuard does.** It is an authorization layer between a marketplace and PayPal Payouts. A change of payout account is a case with a
state machine. The new account is held, the seller proves both accounts through PayPal login, deterministic rules weigh the evidence and risk
flags, and the payout gate pays only the account the backend has on file. Every step is audited.
- **Safe path:** old account proven by PayPal login, name and country match, no flags, marketplace records confirm: the rules can approve with
  no operator (fast lane, off by default). The safety wait still runs and the seller can cancel.
- **Review path:** one flag, unknown facts, or an account that cannot be proven: a person reviews. Two or more flags block approval.
- **AI:** an NVIDIA model helps both sides. A seller help chat guides the request. The operator's AI Review reads the case with read-only tools,
  including a live read-only PayPal lookup, and writes a plain summary. **The AI never approves, verifies, activates or moves money.**

**How it was built.** Python backend (SQLite, deterministic policy, payout gate, audit trail), React and TypeScript website served by the backend
(seller page, operator console with an AG Grid queue, data-flow graph, schema explorer), NVIDIA `nemotron-3.5-bolt-e4b` through the NVIDIA API,
Log in with PayPal and PayPal Payouts in the **sandbox**.

**Tools used (what is real).**
- **PayPal (sandbox):** Log in with PayPal for both accounts (identity, verified account, name, country) and Payouts (create and batch read).
  100 USD sandbox payouts reconciled to SUCCESS.
- **NVIDIA:** seller help chat and operator AI Review.
- **AG Grid:** the operator queue.
- **Postman:** 46-request collection, 62 assertions, run with the real Postman CLI against the real HTTP handlers.
- **OpenAPI:** a spec for the API (`docs/openapi.yaml`).
- **AG Grid / AG Studio:** the operator queue and audit trail use AG Grid Community. A Dashboard view (operator) and a My earnings dashboard (seller) use AG Studio with grid, chart and KPI widgets on live backend data, themed per side, plus a custom Studio widget and the Studio Agent Framework (see below).
- **APIMatic Context Plugin (PayPal, v0.4.1):** used to review our PayPal adapter against its SDK guidance. It led to one fix: refreshing the expiring app token. We do not use the generated SDK. See `docs/APIMATIC_USE.md`.

**Honest limits.**
- Sandbox only. Live PayPal was never used.
- The marketplace's security signals (new device, password reset) and the "entitlement confirmed" fact are a **simulated feed**. A real marketplace would supply them.
- PayPal's sandbox returns no account age or type, so the account-age check cannot run.
- Evidence entry in the operator console is a prototype stand-in.
- The fast lane has no measured false-pass rate and is off by default.
- The AI is a weak reader of new facts. The rules and a person do the blocking. AI results come from one 21-case, author-labelled set and vary between runs.

**What we learned.** The AI saw nothing wrong with a calm request from a stolen login. What caught it was the old-account check, the marketplace signals and a person.

*Built on PayPal Payouts. Not affiliated with or endorsed by PayPal.*

## What changed in this existing project (git history starts 2026-11-10)
Disclose for judges: the repo began as a PayPal sandbox probe (`rescue/experiments.py`). Since then we built the destination-change policy and payout gate, the NVIDIA investigator and seller guide, the React operator and seller UI, risk flags, the fast lane, the Postman run, and the demo recordings. Marketplace signals and entitlement data are **simulated**. Rule-based policy decides; the AI only advises.

## Demo video credits
Narration is synthetic: ElevenLabs text-to-speech (Flash v2.5, free tier), reading our own script (`docs/demo/voiceover-script.md`). Captions (`docs/demo/payeeguard-demo.srt`) come from the same script. Screen recordings are of the running app against the PayPal sandbox; marketplace signals and trend charts are simulated and labelled as such.

## For a marketplace's own systems: API keys and MCP
- **API keys:** a marketplace backend can call the same REST API with `Authorization: Bearer pgk_...` (only a digest is stored; revocable; valid only for an `external`-channel grant, so it can create, read and cancel its own seller's requests, never approve, review or run payouts).
- **MCP server:** `rescue/mcp_server.py` is a thin stdio adapter over that API (5 tools: list, read, create, cancel, start PayPal verification). It has no approve, reject or payout tool. Tests cover both; a live round trip against the running sandbox server was not run before submission.
- **AG Studio Agent Framework:** used. Studio's AI Assistant chat runs through `createAiHarness` and `directLlmRunner`, with our own model adapter. The adapter sends each turn to our backend (`/api/v1/dashboard-llm`), which holds the NVIDIA key. In testing, the small NVIDIA model could not fill Studio's nested data mapping through Studio's own configure tools (every attempt was rejected), so by default plain-words requests in the chat go through our view picker instead (an optional native mode, `RESCUE_STUDIO_MODEL` with `?studioTools=1`, uses Studio's own tools through a stronger NVIDIA-hosted model such as `deepseek-ai/deepseek-v4.1-flash`, same NVIDIA key; tested end to end): the dashboard model picks a view from a fixed menu, a second call checks it, and our code fills the mapping. The number of days is parsed by code. Asking again for the same view updates it in place; a new view is added at the top. Questions like "what data can you show?" are answered from the real catalog. The model sees only the question and the menu, never case data or amounts.
- **Not built:** a key-management UI.
