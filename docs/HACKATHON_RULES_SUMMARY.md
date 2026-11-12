# PayPal AI Hackathon — factual rules and submission check
Checked 2026-11-11. Only this file was created. No login, accounts, installs, code/config edits, secrets, or commits.
Sources: [home](https://paypalaihackathon.devpost.com/), [official rules](https://paypalaihackathon.devpost.com/rules), [resources](https://paypalaihackathon.devpost.com/resources). Q-labels refer to short verbatim locators in the final Quotes appendix.
Access: web-reader loaded the public pages; it does not expose successful HTTP status codes, so “loaded” does NOT assert 200. Errors below distinguish reported HTTP codes, reader errors and JS shells. Direct local HTTP fetching failed DNS; no proxy/block-bypass was used.
Scope limitation: content links exposed on roots/sponsor pages were attempted one level deep. Child-page navigation/footer/link inventories were NOT recursively resolved. Thus this is not a certified exhaustive inventory of every site's links or video transcripts. “NOT FOUND” means not confirmed in readable material, never permission by omission.

## 1. Dates and exact cut-off
[Schedule](https://paypalaihackathon.devpost.com/details/dates), Q-D: submissions open October 1, 2026, 09:15 PDT; close **November 12, 2026, 12:00 PST**.
Conversion (calculated): **November 12, 20:00 UTC = November 13, 01:30 IST**. Do not interpret November 12 as end-of-day.
Judging: December 1, 14:00 PST–December 15, 08:00 PST. Winners: around December 21; rules say 14:00 Pacific, schedule says 09:00 PST. This announcement-time conflict is unresolved; official rules take precedence over other materials.
The [PayPal blog](https://developer.paypal.com/community/blog/PayPal_AI_Hackathon/) confirms the build window and gives a broad prize overview, not the precise cut-off.

## 2. Eligibility and teams
Rules §3, Q-R: local legal adulthood; eligible individuals, teams, established organizations. Authorized representative required. Multiple teams/individual entries allowed; submissions must differ substantially.
Excluded: prohibited jurisdictions including Brazil, Quebec, Russia, Crimea, Cuba, Iran, North Korea; promotion entities/affiliates, involved staff/agents, judges/employers, specified family/household and conflicts. Maximum team size: **NOT FOUND**.

## 3. Submission deliverables
Home “What to Submit,” Q-H: PayPal sandbox plus meaningful AI; functional project, feature description, tool/model list explaining usage, public GitHub/GitLab/Bitbucket repo containing source/assets/run instructions and detectable open-source license.
Hosted demo **optional**: complete local setup/run instructions can satisfy judging access. Static-only mockups cannot.
Named accepted licenses/OSI list and exact mandatory license filename/path: **NOT FOUND**. Detectability at repository top/About is explicit; root LICENSE is a practical implementation choice, not a quoted mandatory pathname.
Rules §4 additionally requires free judging access through judging end, including necessary test/sandbox access instructions. Arrange dedicated test access privately; do not mistake this for a requirement to publish production secrets.

## 4. Demo video
Home/Rules §4, Q-H/Q-R: under three minutes; actual functioning-device footage; public YouTube URL on submission form; third-party trademarks/music/material need permission.
English or English translation required. Mandatory captions, human narration, voiceover, AI-voice disclosure, music, specific editing format: **NOT FOUND**.
Specific permission to use PayPal logos/brand assets: **NOT FOUND**. Rules §11 reserves sponsor IP and prohibits unauthorized copying; sponsor involvement is not blanket logo permission.
Specific list of forbidden on-screen credentials/account data: **NOT FOUND**. Rules address privacy/IP; use redacted screens (editorial precaution, not an invented hackathon clause). A montage must still demonstrate functioning behavior.

## 5. AI, prior work, third parties
Rules §4, Q-R: new or significantly updated work; explain pre-existing project's improvements. No numerical new-code threshold. Third-party terms/licenses and original ownership apply. Open-source reuse requires compliance and added functionality.
Home Q-H: sponsor tools optional; AI provider choice open. Mandatory AI coding-tool disclosure beyond the tool/model usage list: **NOT FOUND**.

## 6. Judging
Rules §6 Q-R: viability/theme/API pass first; then five equal criteria—technical implementation, design, impact, innovation, presentation. Equal weighting implies **20% each** (calculation). Tie-breaking follows listed criterion order, then judge vote.

## 7. Prizes
[Official table](https://paypalaihackathon.devpost.com/rules), [home](https://paypalaihackathon.devpost.com/), [blog](https://developer.paypal.com/community/blog/PayPal_AI_Hackathon/):
| Award | Amount / winners |
|---|---|
| Overall first / second / third | $12,000 / $8,000 / $5,000; one each |
| Creative; Impactful; Demo Delivery; PayPal + AI; Agentic Commerce | $5,000 each; one each |
| AG Grid | $5,000 first; $2,000 second; three $1,000 thirds |
| APIMatic | three $1,000 awards plus six months Business subscription |
| Bryntum | three $1,000 awards |
| Channel3 | one $1,500 award |
| Render | $1,000 / $750 / $500 Render credits; one each |
Cash sums to $67,500; Render credits add $2,250 ($69,750 combined, calculation). Render awards are not cash.
Separate cash prizes for Postman, Elastic, Kernel, Astropods, Zapier: **NOT FOUND** in §8.
Rules §8 permits one main award (grand OR honorable mention) plus one sponsor award, not stacking every sponsor. Winning identity/forms/tax verification still applies.

## 8. Sponsors: usage, qualification and proof
Formal §8 eligibility is use of the respective sponsor's tools (Q-R “any”). Sponsor-specific guidance below is additional context, not a replacement for §8. Unless specified, mandatory screenshots, separate proof format or sponsor write-up: **NOT FOUND**.
- **APIMatic** ([page](https://paypalaihackathon.devpost.com/details/apimatic), Q-A): use Context Plugin for PayPal integration. Participant offer: one month Basic; qualifying winners six months Business. [Claim form](https://docs.google.com/forms/d/e/1FAIpQLScc2oCgAFACm7d6H3R4mgzv-O34DdyVnLIBNiwmUNggr_-hhA/viewform), Q-AF: project/repo link demonstrating plugin usage AND usage description; verified email, manual approval, non-transferable subscription. Linked PDF unreadable: installer command **NOT CONFIRMED** from that PDF. An OpenAPI spec alone is not proof of plugin use.
- **AG Grid / AG Studio** ([page](https://paypalaihackathon.devpost.com/details/aggrid), Q-G): formal award covers AG Grid tools; sponsor encourages Studio polish, custom widgets/theming/layout and agent framework, beyond a standalone grid/chart. No exact minimum feature count found. Quickstart/custom-widgets/agents, trial and starter links are in the inventory. **Do not claim AG Studio merely because ag-grid-react is installed.**
- **Postman** ([page](https://paypalaihackathon.devpost.com/details/postman)): testing/documentation platform; free entry, PayPal collection and AI learning path linked. Separate prize/use threshold/proof rule: **NOT FOUND**. The learning path covers Agent Mode, MCP and editor integration; using the CLI alone must not be relabelled Agent Mode.
- **Render** ([page](https://paypalaihackathon.devpost.com/details/render), Q-Re): deploy project and use Workflows per sponsor guidance; $50 build-credit offer. §8 is broader tool-use eligibility. Specific proof format **NOT FOUND**. Blueprint alone is not deployment or Workflow use.
- **Elastic** ([page](https://paypalaihackathon.devpost.com/details/elastic)): suggests Elasticsearch/Jina agent, optionally Agent Builder, Workflows, Search/ES|QL, observability/security/A2A/MCP. Trial 14 days, form-based further 30; local Elasticsearch also offered. Separate prize/proof rule **NOT FOUND**.
- **Bryntum** ([page](https://paypalaihackathon.devpost.com/details/bryntum), Q-B): use Gantt/Scheduler/Calendar effectively; 45-day registered trial. Sponsor supplies `npm install @bryntum/scheduler@npm:@bryntum/scheduler-trial`. Download page distinguishes 14-day keyless trial from 45-day registered trial.
- **Channel3** ([page](https://paypalaihackathon.devpost.com/details/channel3), Q-C): meaningful API/MCP calls for product search/enrichment/recommendations; merely mentioning it is insufficient. Offer: 20,000 credits using PAYPAL-HACKATHON-2026; no card. Extra proof format **NOT FOUND**.
- **Kernel** ([page](https://paypalaihackathon.devpost.com/details/kernel)): cloud-browser infrastructure; $50 credit link; docs for browser automation. Separate prize/proof requirement **NOT FOUND**. No anti-detection/proxy feature was used in this research.
- **Astropods** ([page](https://paypalaihackathon.devpost.com/details/astropods)): declarative agents, CLI build/push, API/dashboard deployment and observability; free signup/docs/walkthroughs. Separate prize/proof requirement **NOT FOUND**.
- **Zapier** ([page](https://paypalaihackathon.devpost.com/details/zapier)): MCP actions with managed auth across apps; 14-day Professional trial, then Free. Separate prize/proof requirement **NOT FOUND**. Quickstart requires a Zapier account and compatible Streamable HTTP MCP client.

## 9. Traps / unconfirmed claims
- Verify the public repo's detectable license, not merely a locally written file. Existing PROJECT_STATUS says no license; current root LICENSE is MIT. Neither proves GitHub publication.
- Public YouTube is explicit; unlisted visibility is not confirmed as sufficient.
- Rules prevail over promotional guidance. Get written clarification for ambiguity; do not invent a sponsor-proof requirement or infer logo permission.
- Keep project/test access usable through judging. A video alone does not replace the requested working-build access.
- Describe simulated marketplace signals/entitlement and attack conditions as simulated. Deterministic blocking is not proof that the model detected fraud.
- No confirmation of required human voice, AI-voice disclosure or captions was found; third-party speech-service licensing still applies.

## 10. Fit check for docs/PROJECT_STATUS.md and docs/DEVPOST_DESCRIPTION.md
Both files were read, not edited. This is evidence alignment, not prize qualification or independent re-testing.
| Requirement / target | Fit | Evidence / gap |
|---|---|---|
| PayPal sandbox integration | MEETS (recorded) | Both drafts; docs/SANDBOX_RESULTS.md referenced by status. Login + Payouts central. |
| Meaningful AI | MEETS (recorded) | Both drafts describe NVIDIA seller chat/operator read-only review; do not credit AI with deterministic blocking. |
| Functional application / testing access | PARTLY | docs/LOCAL_DEMO.md, docs/BACKEND_SETUP.md; complete fresh-judge setup and private test access still need verification. |
| Public complete repository | NOT CONFIRMED | Drafts say commit/push pending; public submission URL not supplied. |
| Open-source license | PARTLY | Root LICENSE is MIT; status “none” is stale. Remote detection/publication not verified. |
| Feature/tool write-up | PARTLY | DEVPOST_DESCRIPTION.md lists PayPal/NVIDIA/AG Grid/Postman honestly; review final submission form separately. |
| Existing-project change disclosure | NOT CONFIRMED | Draft lacks a clearly dated before/after contribution section. |
| Video length / working footage | PARTLY | User reports montage under three minutes; file/YouTube visibility/English/rights not inspected. |
| AG Grid award | PARTLY | ui/package.json and drafts record AG Grid queue; AG Studio/framework usage not established. Broad §8 eligibility differs from sponsor's feature ambitions. |
| Postman | MEETS (recorded) | docs/postman-run-2026-11-11.txt, drafts: 46 requests/62 assertions. No separate Postman prize found. |
| APIMatic award / claim offer | DOES NOT currently demonstrate use | Drafts explicitly say plugin not installed/used. docs/openapi.yaml is not plugin-usage proof. |
| Render award | DOES NOT | Status says no deployment; blueprint only. Render unnecessary for main entry if runnable instructions suffice. |
| Other sponsor awards | DOES NOT demonstrate use | No Bryntum/Channel3 integrations recorded. Elastic/Kernel/Astropods/Zapier use not established. |
| Truthful security/impact pitch | PARTLY | Drafts label simulated signals and AI limits; video must preserve these distinctions and avoid implying proven attack prevalence. |
| Eligibility, ownership, third-party/brand permissions | NOT CONFIRMED | Individual/team facts and permission evidence absent from inspected files. |

## 11. Free TTS API check (additional user request)
Research only; no accounts, audio generation or installs.
**Recommendation (inference): Sarvam is the clearer free option for a promotional submission video**, because its published production-use terms explicitly include free credits.
- [Sarvam pricing](https://docs.sarvam.ai/api/getting-started/pricing): verified signup gets ₹100 credits; non-expiring, usage-based, not an unlimited recurring free tier. Bulbul v3 ₹3/1,000 characters; a 2,500-character generation is ₹7.50 before tax (calculation).
- [Sarvam commercial rights](https://docs.sarvam.ai/api/getting-started/commercial-licensing), Q-S: free-credit generations carry production rights, subject to terms and voice consent.
- How: create/verify account at [dashboard](https://indus.sarvam.ai/), create API key privately; install `sarvamai` in your own environment; use `SarvamAI(api_subscription_key=...)` and `client.text_to_speech.convert(text=..., language_code=...)`; base64-decode the returned audios and save audio. Select the supported language/voice from the docs; split Bulbul v3 text at 2,500 characters and edit narration under the video limit.
- [Sarvam quickstart](https://docs.sarvam.ai/api/getting-started/quickstart) and [TTS endpoint](https://docs.sarvam.ai/api-reference/text-to-speech/convert): POST /text-to-speech; api-subscription-key auth; WAV default. No voice cloning needed for a preset narrator.
- [ElevenLabs pricing](https://elevenlabs.io/pricing): Free 10,000 credits/month; API usage/model affects character budget. [Billing/license](https://elevenlabs.io/docs/overview/administration/billing), Q-E: free usage is non-commercial with attribution; paid generation carries commercial rights. Do not assume a prize/promotional video qualifies as non-commercial.
- [ElevenLabs API](https://elevenlabs.io/docs/api-reference/text-to-speech/convert): key in xi-api-key header; POST https://api.elevenlabs.io/v1/text-to-speech/VOICE_ID; text + model_id; returns audio. Use a voice available to the account. For publication choose appropriate licensed generation or obtain written permission.
- Whether hackathon rules explicitly permit or demand disclosure of synthetic narration: **NOT FOUND**. List the TTS tool honestly; use your own script and authorized voice.

## 12. Page access and one-level link register
Each root below loaded as public readable content; successful HTTP code not exposed. Outbound content links are grouped by root. Generic Devpost navigation/footer, tracking pixels, calendar provider footer and sponsor images are excluded. URL values below are tool-resolved destinations; where redirected, original HTML href was not independently recoverable.
Followed means attempted, not necessarily readable. Repeated URLs share the access record. Not followed: generic chrome/footer; child-page links beyond the requested depth. Exact inventories of child-page outbound links are **NOT CONFIRMED** by this reader; no claim of full recursive coverage.

### /: https://paypalaihackathon.devpost.com/
Loaded; Challenge, submission checklist and prize overview. Followed: [PayPal AI Hackathon](https://paypalaihackathon.devpost.com/); [Join hackathon](https://paypalaihackathon.devpost.com/register?flow%5Bdata%5D%5Bchallenge_id%5D=31302&flow%5Bname%5D=register_for_challenge); [View full rules](https://paypalaihackathon.devpost.com/rules); [View schedule](https://paypalaihackathon.devpost.com/details/dates); [Apple](https://paypalaihackathon.devpost.com/calendar); [Google](https://paypalaihackathon.devpost.com/calendar/google); [Outlook](https://paypalaihackathon.devpost.com/calendar/outlook); [$67,500 in cash](https://paypalaihackathon.devpost.com/); [PayPal](https://devpost.com/hackathons?organization=PayPal); [Managed by Devpost](https://devpost.com/hackathons?managed_by_devpost_badge=1); [Low/No Code](https://devpost.com/hackathons?themes%5B%5D=Low%2FNo+Code); [Machine Learning/AI](https://devpost.com/hackathons?themes%5B%5D=Machine+Learning%2FAI); [Web](https://devpost.com/hackathons?themes%5B%5D=Web); [PayPal Developer](https://developer.paypal.com/?utm_campaign=PayPalAIHackathon&utm_medium=LP&utm_source=Devpost); [Review example projects](https://paypalaihackathon.devpost.com/resources); [Oct 6th 9am PT - 9:45am PT ~ Start building with PayPal Recording](https://www.google.com/url?q=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DFFJfCW9z3Do&sa=D&source=docs&usg=AOvVaw1QmtU6wBI4IolP_DEXnkwB&ust=1791396304192764); [Oct 7th 9am PT - 9:30am PT ~ Power Your PayPal Hackathon Project with APIMatic Context Plugins](https://youtu.be/zRWixN68tDg); [Oct 12th 7am PT - 7:45am PT ~ Build a payments dashboard without building a dashboard](https://www.youtube.com/watch?feature=youtu.be&v=LGfG44i1Fj8); [Oct 13th 1am PT - 2am PT ~ Start building with PayPal](https://youtu.be/ck_zyB66p_Y); [AG Grid](https://paypalaihackathon.devpost.com/details/aggrid); [APIMatic](https://paypalaihackathon.devpost.com/details/apimatic); [Astropods](https://paypalaihackathon.devpost.com/details/astropods); [Bryntum](https://paypalaihackathon.devpost.com/details/bryntum); [Channel3](https://paypalaihackathon.devpost.com/details/channel3); [Elastic](https://paypalaihackathon.devpost.com/details/elastic); [KERNEL](https://paypalaihackathon.devpost.com/details/kernel); [Postman](https://paypalaihackathon.devpost.com/details/postman); [Render](https://paypalaihackathon.devpost.com/details/render); [Zapier](https://paypalaihackathon.devpost.com/details/zapier); [Email the hackathon manager](https://paypalaihackathon.devpost.com/cdn-cgi/l/email-protection). Not followed: generic chrome/footer; second-level outgoing links.

### rules: https://paypalaihackathon.devpost.com/rules
Loaded; Binding eligibility, submission, judging, ownership and prize conditions. Followed: [PayPal AI Hackathon](https://paypalaihackathon.devpost.com/); [Join hackathon](https://paypalaihackathon.devpost.com/register?flow%5Bdata%5D%5Bchallenge_id%5D=31302&flow%5Bname%5D=register_for_challenge); [https://developer.paypal.com/](https://developer.paypal.com/). Not followed: generic chrome/footer; second-level outgoing links.

### resources: https://paypalaihackathon.devpost.com/resources
Loaded; Ten sponsor pages, PayPal integration/AI docs and webinar links. Followed: [PayPal AI Hackathon](https://paypalaihackathon.devpost.com/); [Join hackathon](https://paypalaihackathon.devpost.com/register?flow%5Bdata%5D%5Bchallenge_id%5D=31302&flow%5Bname%5D=register_for_challenge); [PayPal Discord](https://discord.gg/sJ2G6DyvSK); [AG Grid](https://paypalaihackathon.devpost.com/details/aggrid); [APIMatic](https://paypalaihackathon.devpost.com/details/apimatic); [Astropods](https://paypalaihackathon.devpost.com/details/astropods); [Bryntum](https://paypalaihackathon.devpost.com/details/bryntum); [Channel3](https://paypalaihackathon.devpost.com/details/channel3); [Elastic](https://paypalaihackathon.devpost.com/details/elastic); [KERNEL](https://paypalaihackathon.devpost.com/details/kernel); [Postman](https://paypalaihackathon.devpost.com/details/postman); [Render](https://paypalaihackathon.devpost.com/details/render); [Zapier](https://paypalaihackathon.devpost.com/details/zapier); [Oct 6th 9am PT - 9:45am PT ~ Start building with PayPal Recording](https://www.google.com/url?q=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DFFJfCW9z3Do&sa=D&source=docs&usg=AOvVaw1QmtU6wBI4IolP_DEXnkwB&ust=1791396304192764); [Oct 7th 9am PT - 9:30am PT ~ Power Your PayPal Hackathon Project with APIMatic Context Plugins](https://youtu.be/zRWixN68tDg); [Oct 12th 7am PT - 7:45am PT ~ Build a payments dashboard without building a dashboard](https://www.youtube.com/watch?feature=youtu.be&v=LGfG44i1Fj8); [Oct 13th 1am PT - 2am PT ~ Start building with PayPal](https://youtu.be/ck_zyB66p_Y); [PayPal Developer docs](https://developer.paypal.com/?utm_campaign=PayPalAIHackathon&utm_medium=LP&utm_source=Devpost); [PayPal Payments](https://developer.paypal.com/payments/); [PayPal Checkout](https://developer.paypal.com/checkout/); [PayPal JavaScript SDK v6](https://developer.paypal.com/sdk/js/); [PayPal REST API](https://developer.paypal.com/api/rest/); [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/); [Getting Started with PayPal sandbox](https://github.com/paypaldev/getting-started-with-paypal-sandbox); [Low-Code/No-Code Solutions](https://developer.paypal.com/payment-links-buttons/overview); [Pay Later](https://developer.paypal.com/pay-later/overview); [Subscriptions](https://developer.paypal.com/platforms/subscriptions); [Invoicing](https://developer.paypal.com/invoicing/about); [Payouts](https://developer.paypal.com/docs/payouts/); [Disputes](https://developer.paypal.com/platforms/disputes/overview); [Donations](https://developer.paypal.com/sdk/donate/); [Webhooks](https://developer.paypal.com/api/webhooks/overview); [PayPal AI Toolkit on GitHub](https://github.com/paypal/AI-Toolkit); [PayPal AI docs](https://docs.paypal.ai/); [PayPal Agent Toolkit quickstart](https://docs.paypal.ai/developer/tools/ai/agent-toolkit-quickstart); [PayPal MCP server quickstart](https://docs.paypal.ai/developer/tools/ai/mcp-quickstart); [Agent tools reference](https://docs.paypal.ai/developer/tools/ai/agent-tools-ref). Not followed: generic chrome/footer; second-level outgoing links.

### apimatic: https://paypalaihackathon.devpost.com/details/apimatic
Loaded; Context Plugin usage and subscription-claim resources. Followed: [PayPal AI Hackathon](https://paypalaihackathon.devpost.com/); [Join hackathon](https://paypalaihackathon.devpost.com/register?flow%5Bdata%5D%5Bchallenge_id%5D=31302&flow%5Bname%5D=register_for_challenge); [Learn more about APIMatic](https://www.apimatic.io/about); [Claim your APIMatic Free Subscriptions here](https://docs.google.com/forms/d/e/1FAIpQLScc2oCgAFACm7d6H3R4mgzv-O34DdyVnLIBNiwmUNggr_-hhA/viewform); [RESOURCE INFO PAGE](https://drive.google.com/file/d/1qa7Xkjt3PGJllHQVCP1IuE-XxlRNz4mN/view); [PayPal Discord](https://discord.com/invite/sJ2G6DyvSK). Not followed: generic chrome/footer; second-level outgoing links.

### aggrid: https://paypalaihackathon.devpost.com/details/aggrid
Loaded; AG Studio/dashboard/agent guidance and developer resources. Followed: [PayPal AI Hackathon](https://paypalaihackathon.devpost.com/); [Join hackathon](https://paypalaihackathon.devpost.com/register?flow%5Bdata%5D%5Bchallenge_id%5D=31302&flow%5Bname%5D=register_for_challenge); [AG Grid](https://ag-grid.com/); [AG Studio](https://www.ag-grid.com/studio/); [Studio Agent Framework](https://www.ag-grid.com/blog/introducing-the-ag-studio-agent-framework/); [free 45-day trial license](https://www.ag-grid.com/studio/license-pricing/); [boilerplate](https://github.com/paypaldev/hackathon-paypal-ag-grid-boilerplate); [https://www.ag-grid.com/studio/react/quick-start/](https://www.ag-grid.com/studio/react/quick-start/); [https://www.ag-grid.com/studio/react/custom-widgets/](https://www.ag-grid.com/studio/react/custom-widgets/); [https://www.ag-grid.com/studio/react/ai-agents/](https://www.ag-grid.com/studio/react/ai-agents/); [https://app.livestorm.co/ag-grid/self-service-dashboards-30-lines-of-code](https://app.livestorm.co/ag-grid/self-service-dashboards-30-lines-of-code); [www.ag-grid.com/blog/1-prompt-88-seconds-i-added-a-new-chart-type-to-ag-studio-dashboard/](https://www.ag-grid.com/blog/1-prompt-88-seconds-i-added-a-new-chart-type-to-ag-studio-dashboard/); [PayPal Discord](https://discord.com/invite/sJ2G6DyvSK). Not followed: generic chrome/footer; second-level outgoing links.

### postman: https://paypalaihackathon.devpost.com/details/postman
Loaded; API design/testing resources and PayPal collection. Followed: [PayPal AI Hackathon](https://paypalaihackathon.devpost.com/); [Join hackathon](https://paypalaihackathon.devpost.com/register?flow%5Bdata%5D%5Bchallenge_id%5D=31302&flow%5Bname%5D=register_for_challenge); [Get Started with Postman for Free ](https://www.postman.com/); [Explore PayPal's API collection on Postman](https://www.postman.com/paypal); [Learn API by doing](https://www.postman.com/liftoff/learning-paths/building-with-ai/?utm_source=paypal-hackathon); [PayPal Discord](https://discord.com/invite/sJ2G6DyvSK). Not followed: generic chrome/footer; second-level outgoing links.

### render: https://paypalaihackathon.devpost.com/details/render
Loaded; Deployment/Workflows guidance and credits. Followed: [PayPal AI Hackathon](https://paypalaihackathon.devpost.com/); [Join hackathon](https://paypalaihackathon.devpost.com/register?flow%5Bdata%5D%5Bchallenge_id%5D=31302&flow%5Bname%5D=register_for_challenge); [Start building with $50 of Render credits here!](https://credits-portal-mmdm.onrender.com/claim/paypal-ai-hackathon); [Render Workflows](https://render.com/docs/workflows); [Follow these instructions](https://render.com/docs/credits); [Render Discord](https://render.com/discord); [PayPal Discord](https://discord.gg/sJ2G6DyvSK); [PayPal Discord](https://discord.com/invite/sJ2G6DyvSK). Not followed: generic chrome/footer; second-level outgoing links.

### astropods: https://paypalaihackathon.devpost.com/details/astropods
Loaded; Agent platform, deployment walkthroughs and free signup. Followed: [PayPal AI Hackathon](https://paypalaihackathon.devpost.com/); [Join hackathon](https://paypalaihackathon.devpost.com/register?flow%5Bdata%5D%5Bchallenge_id%5D=31302&flow%5Bname%5D=register_for_challenge); [Astropods](https://nam11.safelinks.protection.outlook.com/?data=05%7C02%7Cnikchen%40paypal.com%7C8de25cfd3ef2408bd06608df24834985%7Cfb00791460204374977e21bac5f3f4c8%7C0%7C0%7C639269820533386530%7CUnknown%7CTWFpbGZsb3d8eyJFbXB0eU1hcGkiOnRydWUsIlYiOiIwLjAuMDAwMCIsIlAiOiJXaW4zMiIsIkFOIjoiTWFpbCIsIldUIjoyfQ%3D%3D%7C0%7C%7C%7C&reserved=0&sdata=2x9ngdVd7AiYL7Ofk%2F1f7K4JUuNggqg8gP4ZFCHVT0I%3D&url=https%3A%2F%2Fastropods.com%2F%3Futm_source%3Dblogs%26utm_medium%3Dblog%26utm_campaign%3Donboarding-to-astro); [Sign up for a free Astropods account here](https://astropods.com/); [docs.astropods.com](https://docs.astropods.com/); [How to Build, Deploy & Monitor AI Agents with Astropods](https://blog.postman.com/build-ai-agents-with-astropods/); [What is Astropods](https://www.youtube.com/watch?v=5pIqjeyIKAc); [Build Your First Local Project](https://www.youtube.com/watch?v=rIeP9YADEZM); [Deploy Your Blueprints](https://www.youtube.com/watch?v=WlKHRIdc3fs); [Connect the Agent to Slack](https://www.youtube.com/watch?v=P9DamZDrrFU); [PayPal Discord](https://developer.paypal.com/discord). Not followed: generic chrome/footer; second-level outgoing links.

### bryntum: https://paypalaihackathon.devpost.com/details/bryntum
Loaded; Scheduling components, trial and best-use award guidance. Followed: [PayPal AI Hackathon](https://paypalaihackathon.devpost.com/); [Join hackathon](https://paypalaihackathon.devpost.com/register?flow%5Bdata%5D%5Bchallenge_id%5D=31302&flow%5Bname%5D=register_for_challenge); [Bryntum](https://bryntum.com/); [https://bryntum.com/download](https://bryntum.com/download/); [Gantt](https://bryntum.com/products/gantt/); [Scheduler](https://bryntum.com/products/scheduler/); [Calendar ](https://bryntum.com/products/calendar/); [Intro to Bryntum](https://app.livestorm.co/ag-grid/intro-to-bryntum?s=8d4683b4-11bb-4512-b2cb-ffd17cdc536a); [Examples](https://bryntum.com/examples/); [PayPal Discord](https://discord.com/invite/sJ2G6DyvSK). Not followed: generic chrome/footer; second-level outgoing links.

### channel3: https://paypalaihackathon.devpost.com/details/channel3
Loaded; Meaningful API/MCP product-search use and credits. Followed: [PayPal AI Hackathon](https://paypalaihackathon.devpost.com/); [Join hackathon](https://paypalaihackathon.devpost.com/register?flow%5Bdata%5D%5Bchallenge_id%5D=31302&flow%5Bname%5D=register_for_challenge); [https://trychannel3.com/developers](https://trychannel3.com/developers); [#channel3 hackathon Discord channel](https://discord.gg/sJ2G6DyvSK); [Channel3 docs](https://docs.trychannel3.com/); [Penny Shop](https://penny.shop/); [Zamana](https://signup.zamana.com/); [Folk](https://www.folk.com/); [MCP server setup](https://trychannel3.com/mcp); [Discord](https://discord.com/invite/6J6MjctXrH). Not followed: generic chrome/footer; second-level outgoing links.

### elastic: https://paypalaihackathon.devpost.com/details/elastic
Loaded; Search/agent capabilities, trial extension and docs. Followed: [PayPal AI Hackathon](https://paypalaihackathon.devpost.com/); [Join hackathon](https://paypalaihackathon.devpost.com/register?flow%5Bdata%5D%5Bchallenge_id%5D=31302&flow%5Bname%5D=register_for_challenge); [Elastic](https://www.elastic.co/); [Elasticsearch](https://www.elastic.co/elasticsearch); [this form.](https://www.elastic.co/trialextension); [https://www.elastic.co/downloads/elasticsearch](https://www.elastic.co/downloads/elasticsearch); [https://ela.st/elastic-paypal-hackathon](https://ela.st/elastic-paypal-hackathon); [Elastic Getting Started Guides](https://www.elastic.co/getting-started); [Elastic Docs](https://www.elastic.co/docs); [Elastic Free Training](https://www.elastic.co/training); [Elastic Community](https://www.elastic.co/community); [PayPal Discord](https://discord.gg/sJ2G6DyvSK). Not followed: generic chrome/footer; second-level outgoing links.

### kernel: https://paypalaihackathon.devpost.com/details/kernel
Loaded; Browser infrastructure and credits. Followed: [PayPal AI Hackathon](https://paypalaihackathon.devpost.com/); [Join hackathon](https://paypalaihackathon.devpost.com/register?flow%5Bdata%5D%5Bchallenge_id%5D=31302&flow%5Bname%5D=register_for_challenge); [Follow this link to get $50 in KERNEL credits to use during this hackathon.](https://dashboard.onkernel.com/hackathon?code=KERNELDEVPOST2026); [https://www.kernel.sh/docs](https://www.kernel.sh/docs); [PayPal Discord](https://discord.com/invite/sJ2G6DyvSK). Not followed: generic chrome/footer; second-level outgoing links.

### zapier: https://paypalaihackathon.devpost.com/details/zapier
Loaded; Managed-auth MCP and account trial. Followed: [PayPal AI Hackathon](https://paypalaihackathon.devpost.com/); [Join hackathon](https://paypalaihackathon.devpost.com/register?flow%5Bdata%5D%5Bchallenge_id%5D=31302&flow%5Bname%5D=register_for_challenge); [Free access:](https://zapier.com/sign-up); [Zapier MCP quickstart](https://docs.zapier.com/mcp/get-started/quickstart); [Zapier MCP documentation](https://docs.zapier.com/mcp/home); [Zapier MCP overview](https://zapier.com/mcp); [PayPal Discord](https://discord.com/invite/sJ2G6DyvSK). Not followed: generic chrome/footer; second-level outgoing links.

### PayPal blog: https://developer.paypal.com/community/blog/PayPal_AI_Hackathon
Loaded (redirect to trailing-slash URL). Summary: challenge, sponsor overview, dates and prizes. Followed: [Get started](https://paypalaihackathon.devpost.com/) (already read). Not followed: generic related blog recommendations/footer; exact recommendation hrefs NOT CONFIRMED.

### Followed-page access register (unique destinations)
The linked root sections above identify every referring page. Each line below is a short page summary plus access result. No new hackathon terms are inferred from general product documentation. Video pages are metadata-only; recordings were not watched/transcribed.
- [PayPal AI Hackathon](https://paypalaihackathon.devpost.com/) — LOADED (HTTP status not exposed). Hackathon overview.
- [Join hackathon](https://paypalaihackathon.devpost.com/register?flow%5Bdata%5D%5Bchallenge_id%5D=31302&flow%5Bname%5D=register_for_challenge) — COULD NOT READ. Linked resource; additional requirements NOT CONFIRMED. (500) Redirected to https://secure.devpost.com/users/register?return_to=https://paypalaihackathon.devpost.com/register?flow%255Bdata%255D%255Bchallenge_id%255D%3D31302%26
- [View full rules](https://paypalaihackathon.devpost.com/rules) — LOADED (HTTP status not exposed). Linked resource; additional requirements NOT CONFIRMED.
- [View schedule](https://paypalaihackathon.devpost.com/details/dates) — LOADED (HTTP status not exposed). Hackathon detail/sponsor/schedule page; summary above.
- [Apple](https://paypalaihackathon.devpost.com/calendar) — COULD NOT READ. Linked resource; additional requirements NOT CONFIRMED. (400) Unsupported content-type: text/calendar
- [Google](https://paypalaihackathon.devpost.com/calendar/google) — COULD NOT READ. Linked resource; additional requirements NOT CONFIRMED. (500) Redirected to https://calendar.google.com/calendar/render?action=TEMPLATE&dates=20261112T200000Z/20261112T200000Z&details=https://paypalaihackathon.devpost.com/&loc
- [Outlook](https://paypalaihackathon.devpost.com/calendar/outlook) — COULD NOT READ. Linked resource; additional requirements NOT CONFIRMED. (500) Redirected to https://outlook.live.com/owa?body=https://paypalaihackathon.devpost.com/&enddt=20261112T200000Z&location&path=/calendar/action/compose&startdt=2026111
- [PayPal](https://devpost.com/hackathons?organization=PayPal) — LOADED (HTTP status not exposed). General hackathon directory filter; no event-specific terms.
- [Managed by Devpost](https://devpost.com/hackathons?managed_by_devpost_badge=1) — LOADED (HTTP status not exposed). General hackathon directory filter; no event-specific terms.
- [Low/No Code](https://devpost.com/hackathons?themes%5B%5D=Low%2FNo+Code) — LOADED (HTTP status not exposed). General hackathon directory filter; no event-specific terms.
- [Machine Learning/AI](https://devpost.com/hackathons?themes%5B%5D=Machine+Learning%2FAI) — LOADED (HTTP status not exposed). General hackathon directory filter; no event-specific terms.
- [Web](https://devpost.com/hackathons?themes%5B%5D=Web) — LOADED (HTTP status not exposed). General hackathon directory filter; no event-specific terms.
- [PayPal Developer](https://developer.paypal.com/?utm_campaign=PayPalAIHackathon&utm_medium=LP&utm_source=Devpost) — COULD NOT READ (inaccessible or JS shell). PayPal integration/API reference. No readable page/document content
- [Review example projects](https://paypalaihackathon.devpost.com/resources) — LOADED (HTTP status not exposed). Resources index.
- [Oct 6th 9am PT - 9:45am PT ~ Start building with PayPal Recording](https://www.google.com/url?q=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DFFJfCW9z3Do&sa=D&source=docs&usg=AOvVaw1QmtU6wBI4IolP_DEXnkwB&ust=1791396304192764) — PARTIAL (metadata only). Recording metadata only; video/transcript COULD NOT READ.
- [Oct 7th 9am PT - 9:30am PT ~ Power Your PayPal Hackathon Project with APIMatic Context Plugins](https://youtu.be/zRWixN68tDg) — PARTIAL (metadata only). Recording metadata only; video/transcript COULD NOT READ.
- [Oct 12th 7am PT - 7:45am PT ~ Build a payments dashboard without building a dashboard](https://www.youtube.com/watch?feature=youtu.be&v=LGfG44i1Fj8) — COULD NOT READ. Recording metadata only; video/transcript COULD NOT READ. Cache miss
- [Oct 13th 1am PT - 2am PT ~ Start building with PayPal](https://youtu.be/ck_zyB66p_Y) — PARTIAL (metadata only). Recording metadata only; video/transcript COULD NOT READ.
- [AG Grid](https://paypalaihackathon.devpost.com/details/aggrid) — LOADED (HTTP status not exposed). Hackathon detail/sponsor/schedule page; summary above.
- [APIMatic](https://paypalaihackathon.devpost.com/details/apimatic) — LOADED (HTTP status not exposed). Hackathon detail/sponsor/schedule page; summary above.
- [Astropods](https://paypalaihackathon.devpost.com/details/astropods) — LOADED (HTTP status not exposed). Hackathon detail/sponsor/schedule page; summary above.
- [Bryntum](https://paypalaihackathon.devpost.com/details/bryntum) — LOADED (HTTP status not exposed). Hackathon detail/sponsor/schedule page; summary above.
- [Channel3](https://paypalaihackathon.devpost.com/details/channel3) — LOADED (HTTP status not exposed). Hackathon detail/sponsor/schedule page; summary above.
- [Elastic](https://paypalaihackathon.devpost.com/details/elastic) — LOADED (HTTP status not exposed). Hackathon detail/sponsor/schedule page; summary above.
- [KERNEL](https://paypalaihackathon.devpost.com/details/kernel) — LOADED (HTTP status not exposed). Hackathon detail/sponsor/schedule page; summary above.
- [Postman](https://paypalaihackathon.devpost.com/details/postman) — LOADED (HTTP status not exposed). Hackathon detail/sponsor/schedule page; summary above.
- [Render](https://paypalaihackathon.devpost.com/details/render) — LOADED (HTTP status not exposed). Hackathon detail/sponsor/schedule page; summary above.
- [Zapier](https://paypalaihackathon.devpost.com/details/zapier) — LOADED (HTTP status not exposed). Hackathon detail/sponsor/schedule page; summary above.
- [Email the hackathon manager](https://paypalaihackathon.devpost.com/cdn-cgi/l/email-protection) — COULD NOT READ. Linked resource; additional requirements NOT CONFIRMED. (404) Not Found
- [https://developer.paypal.com/](https://developer.paypal.com/) — LOADED (HTTP status not exposed). PayPal integration/API reference.
- [PayPal Discord](https://discord.gg/sJ2G6DyvSK) — COULD NOT READ. Invite/community entry; discussions and updates unavailable. (500) Redirected to https://discord.com/invite/sJ2G6DyvSK which is not accessible via this tool. (non-retryable error)
- [PayPal Payments](https://developer.paypal.com/payments/) — LOADED (HTTP status not exposed). PayPal integration/API reference.
- [PayPal Checkout](https://developer.paypal.com/checkout/) — LOADED (HTTP status not exposed). PayPal integration/API reference.
- [PayPal JavaScript SDK v6](https://developer.paypal.com/sdk/js/) — LOADED (HTTP status not exposed). PayPal integration/API reference.
- [PayPal REST API](https://developer.paypal.com/api/rest/) — LOADED (HTTP status not exposed). PayPal integration/API reference.
- [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/) — COULD NOT READ (inaccessible or JS shell). Account/credit/signup shell; offer or account details unavailable. No readable page/document content
- [Getting Started with PayPal sandbox](https://github.com/paypaldev/getting-started-with-paypal-sandbox) — LOADED (HTTP status not exposed). Source/example repository landing and README.
- [Low-Code/No-Code Solutions](https://developer.paypal.com/payment-links-buttons/overview) — LOADED (HTTP status not exposed). PayPal integration/API reference.
- [Pay Later](https://developer.paypal.com/pay-later/overview) — LOADED (HTTP status not exposed). PayPal integration/API reference.
- [Subscriptions](https://developer.paypal.com/platforms/subscriptions) — LOADED (HTTP status not exposed). PayPal integration/API reference.
- [Invoicing](https://developer.paypal.com/invoicing/about) — LOADED (HTTP status not exposed). PayPal integration/API reference.
- [Payouts](https://developer.paypal.com/docs/payouts/) — LOADED (HTTP status not exposed). PayPal integration/API reference.
- [Disputes](https://developer.paypal.com/platforms/disputes/overview) — LOADED (HTTP status not exposed). PayPal integration/API reference.
- [Donations](https://developer.paypal.com/sdk/donate/) — LOADED (HTTP status not exposed). PayPal integration/API reference.
- [Webhooks](https://developer.paypal.com/api/webhooks/overview) — LOADED (HTTP status not exposed). PayPal integration/API reference.
- [PayPal AI Toolkit on GitHub](https://github.com/paypal/AI-Toolkit) — LOADED (HTTP status not exposed). Source/example repository landing and README.
- [PayPal AI docs](https://docs.paypal.ai/) — COULD NOT READ. Linked resource; additional requirements NOT CONFIRMED. (404) Not Found
- [PayPal Agent Toolkit quickstart](https://docs.paypal.ai/developer/tools/ai/agent-toolkit-quickstart) — COULD NOT READ. Linked resource; additional requirements NOT CONFIRMED. (404) Not Found
- [PayPal MCP server quickstart](https://docs.paypal.ai/developer/tools/ai/mcp-quickstart) — COULD NOT READ. Linked resource; additional requirements NOT CONFIRMED. (500) Redirected to https://developer.paypal.com/docsai/developer/tools/ai/mcp-quickstart which is not accessible via this tool. (non-retryable error)
- [Agent tools reference](https://docs.paypal.ai/developer/tools/ai/agent-tools-ref) — COULD NOT READ. Linked resource; additional requirements NOT CONFIRMED. (500) Redirected to https://developer.paypal.com/docsai/developer/tools/ai/agent-tools-ref which is not accessible via this tool. (non-retryable error)
- [Learn more about APIMatic](https://www.apimatic.io/about) — LOADED (HTTP status not exposed). Linked resource; additional requirements NOT CONFIRMED.
- [Claim your APIMatic Free Subscriptions here](https://docs.google.com/forms/d/e/1FAIpQLScc2oCgAFACm7d6H3R4mgzv-O34DdyVnLIBNiwmUNggr_-hhA/viewform) — LOADED (HTTP status not exposed). Plugin-usage claim form and manually verified subscription conditions (Q-AF).
- [RESOURCE INFO PAGE](https://drive.google.com/file/d/1qa7Xkjt3PGJllHQVCP1IuE-XxlRNz4mN/view) — COULD NOT READ (Drive viewer shell; document inaccessible). Only Drive viewer/title available; PDF contents COULD NOT READ. No readable page/document content
- [PayPal Discord](https://discord.com/invite/sJ2G6DyvSK) — COULD NOT READ (empty/JavaScript/login shell). Invite/community entry; discussions and updates unavailable. No readable page/document content
- [AG Grid](https://ag-grid.com/) — LOADED (HTTP status not exposed). Grid/Studio component, agent, trial or tutorial reference.
- [AG Studio](https://www.ag-grid.com/studio/) — LOADED (HTTP status not exposed). Grid/Studio component, agent, trial or tutorial reference.
- [Studio Agent Framework](https://www.ag-grid.com/blog/introducing-the-ag-studio-agent-framework/) — LOADED (HTTP status not exposed). Grid/Studio component, agent, trial or tutorial reference.
- [free 45-day trial license](https://www.ag-grid.com/studio/license-pricing/) — LOADED (HTTP status not exposed). Grid/Studio component, agent, trial or tutorial reference.
- [boilerplate](https://github.com/paypaldev/hackathon-paypal-ag-grid-boilerplate) — LOADED (HTTP status not exposed). Source/example repository landing and README.
- [https://www.ag-grid.com/studio/react/quick-start/](https://www.ag-grid.com/studio/react/quick-start/) — LOADED (HTTP status not exposed). Grid/Studio component, agent, trial or tutorial reference.
- [https://www.ag-grid.com/studio/react/custom-widgets/](https://www.ag-grid.com/studio/react/custom-widgets/) — LOADED (HTTP status not exposed). Grid/Studio component, agent, trial or tutorial reference.
- [https://www.ag-grid.com/studio/react/ai-agents/](https://www.ag-grid.com/studio/react/ai-agents/) — LOADED (HTTP status not exposed). Grid/Studio component, agent, trial or tutorial reference.
- [https://app.livestorm.co/ag-grid/self-service-dashboards-30-lines-of-code](https://app.livestorm.co/ag-grid/self-service-dashboards-30-lines-of-code) — COULD NOT READ (inaccessible or JS shell). Linked resource; additional requirements NOT CONFIRMED. No readable page/document content
- [www.ag-grid.com/blog/1-prompt-88-seconds-i-added-a-new-chart-type-to-ag-studio-dashboard/](https://www.ag-grid.com/blog/1-prompt-88-seconds-i-added-a-new-chart-type-to-ag-studio-dashboard/) — LOADED (HTTP status not exposed). Grid/Studio component, agent, trial or tutorial reference.
- [Get Started with Postman for Free ](https://www.postman.com/) — LOADED (HTTP status not exposed). API platform, learning or agent-platform walkthrough.
- [Explore PayPal's API collection on Postman](https://www.postman.com/paypal) — LOADED (HTTP status not exposed). API platform, learning or agent-platform walkthrough.
- [Learn API by doing](https://www.postman.com/liftoff/learning-paths/building-with-ai/?utm_source=paypal-hackathon) — LOADED (HTTP status not exposed). API platform, learning or agent-platform walkthrough.
- [Start building with $50 of Render credits here!](https://credits-portal-mmdm.onrender.com/claim/paypal-ai-hackathon) — COULD NOT READ (empty/JavaScript/login shell). Account/credit/signup shell; offer or account details unavailable. No readable page/document content
- [Render Workflows](https://render.com/docs/workflows) — LOADED (HTTP status not exposed). Workflow or credit administration reference.
- [Follow these instructions](https://render.com/docs/credits) — LOADED (HTTP status not exposed). Workflow or credit administration reference.
- [Render Discord](https://render.com/discord) — COULD NOT READ (inaccessible or JS shell). Invite/community entry; discussions and updates unavailable. No readable page/document content
- [Astropods](https://nam11.safelinks.protection.outlook.com/?data=05%7C02%7Cnikchen%40paypal.com%7C8de25cfd3ef2408bd06608df24834985%7Cfb00791460204374977e21bac5f3f4c8%7C0%7C0%7C639269820533386530%7CUnknown%7CTWFpbGZsb3d8eyJFbXB0eU1hcGkiOnRydWUsIlYiOiIwLjAuMDAwMCIsIlAiOiJXaW4zMiIsIkFOIjoiTWFpbCIsIldUIjoyfQ%3D%3D%7C0%7C%7C%7C&reserved=0&sdata=2x9ngdVd7AiYL7Ofk%2F1f7K4JUuNggqg8gP4ZFCHVT0I%3D&url=https%3A%2F%2Fastropods.com%2F%3Futm_source%3Dblogs%26utm_medium%3Dblog%26utm_campaign%3Donboarding-to-astro) — COULD NOT READ. Agent deployment/operation documentation or landing. (400) Bad Request
- [Sign up for a free Astropods account here](https://astropods.com/) — LOADED (HTTP status not exposed). Agent deployment/operation documentation or landing.
- [docs.astropods.com](https://docs.astropods.com/) — LOADED (HTTP status not exposed). Agent deployment/operation documentation or landing.
- [How to Build, Deploy & Monitor AI Agents with Astropods](https://blog.postman.com/build-ai-agents-with-astropods/) — LOADED (HTTP status not exposed). API platform, learning or agent-platform walkthrough.
- [What is Astropods](https://www.youtube.com/watch?v=5pIqjeyIKAc) — COULD NOT READ. Recording metadata only; video/transcript COULD NOT READ. Cache miss
- [Build Your First Local Project](https://www.youtube.com/watch?v=rIeP9YADEZM) — COULD NOT READ. Recording metadata only; video/transcript COULD NOT READ. Cache miss
- [Deploy Your Blueprints](https://www.youtube.com/watch?v=WlKHRIdc3fs) — COULD NOT READ. Recording metadata only; video/transcript COULD NOT READ. Cache miss
- [Connect the Agent to Slack](https://www.youtube.com/watch?v=P9DamZDrrFU) — COULD NOT READ. Recording metadata only; video/transcript COULD NOT READ. Cache miss
- [PayPal Discord](https://developer.paypal.com/discord) — COULD NOT READ. Invite/community entry; discussions and updates unavailable. (500) Redirected to https://discord.gg/sJ2G6DyvSK which is not accessible via this tool. (non-retryable error)
- [Bryntum](https://bryntum.com/) — LOADED (HTTP status not exposed). Scheduling component/product/trial reference.
- [https://bryntum.com/download](https://bryntum.com/download/) — LOADED (HTTP status not exposed). Scheduling component/product/trial reference.
- [Gantt](https://bryntum.com/products/gantt/) — LOADED (HTTP status not exposed). Scheduling component/product/trial reference.
- [Scheduler](https://bryntum.com/products/scheduler/) — LOADED (HTTP status not exposed). Scheduling component/product/trial reference.
- [Calendar ](https://bryntum.com/products/calendar/) — LOADED (HTTP status not exposed). Scheduling component/product/trial reference.
- [Intro to Bryntum](https://app.livestorm.co/ag-grid/intro-to-bryntum?s=8d4683b4-11bb-4512-b2cb-ffd17cdc536a) — COULD NOT READ. Linked resource; additional requirements NOT CONFIRMED. (404) Not Found
- [Examples](https://bryntum.com/examples/) — LOADED (HTTP status not exposed). Scheduling component/product/trial reference.
- [https://trychannel3.com/developers](https://trychannel3.com/developers) — LOADED (HTTP status not exposed). Product search/API/MCP reference or example.
- [Channel3 docs](https://docs.trychannel3.com/) — COULD NOT READ. Product search/API/MCP reference or example. (500) Redirected to https://channel3.ai/docs/ which is not accessible via this tool. (non-retryable error)
- [Penny Shop](https://penny.shop/) — LOADED (HTTP status not exposed). Product search/API/MCP reference or example.
- [Zamana](https://signup.zamana.com/) — COULD NOT READ (empty/JavaScript/login shell). Account/credit/signup shell; offer or account details unavailable. No readable page/document content
- [Folk](https://www.folk.com/) — LOADED (HTTP status not exposed). Product search/API/MCP reference or example.
- [MCP server setup](https://trychannel3.com/mcp) — LOADED (HTTP status not exposed). Product search/API/MCP reference or example.
- [Discord](https://discord.com/invite/6J6MjctXrH) — COULD NOT READ (inaccessible or JS shell). Invite/community entry; discussions and updates unavailable. No readable page/document content
- [Elastic](https://www.elastic.co/) — LOADED (HTTP status not exposed). Search/download/trial/training reference.
- [Elasticsearch](https://www.elastic.co/elasticsearch) — LOADED (HTTP status not exposed). Search/download/trial/training reference.
- [this form.](https://www.elastic.co/trialextension) — LOADED (HTTP status not exposed). Search/download/trial/training reference.
- [https://www.elastic.co/downloads/elasticsearch](https://www.elastic.co/downloads/elasticsearch) — LOADED (HTTP status not exposed). Search/download/trial/training reference.
- [https://ela.st/elastic-paypal-hackathon](https://ela.st/elastic-paypal-hackathon) — COULD NOT READ. Linked resource; additional requirements NOT CONFIRMED. (500) Redirected to https://cloud.elastic.co/serverless-registration?utm_source=github&utm_medium=event&utm_campaign=2026-10-paypal-global-hackathon&utm_content=link whic
- [Elastic Getting Started Guides](https://www.elastic.co/getting-started) — LOADED (HTTP status not exposed). Search/download/trial/training reference.
- [Elastic Docs](https://www.elastic.co/docs) — LOADED (HTTP status not exposed). Search/download/trial/training reference.
- [Elastic Free Training](https://www.elastic.co/training) — LOADED (HTTP status not exposed). Search/download/trial/training reference.
- [Elastic Community](https://www.elastic.co/community) — LOADED (HTTP status not exposed). Search/download/trial/training reference.
- [Follow this link to get $50 in KERNEL credits to use during this hackathon.](https://dashboard.onkernel.com/hackathon?code=KERNELDEVPOST2026) — COULD NOT READ (empty/JavaScript/login shell). Account/credit/signup shell; offer or account details unavailable. No readable page/document content
- [https://www.kernel.sh/docs](https://www.kernel.sh/docs) — LOADED (HTTP status not exposed). Linked resource; additional requirements NOT CONFIRMED.
- [Free access:](https://zapier.com/sign-up) — PARTIAL/JS or login. MCP setup/platform reference.
- [Zapier MCP quickstart](https://docs.zapier.com/mcp/get-started/quickstart) — LOADED (HTTP status not exposed). MCP setup/platform reference.
- [Zapier MCP documentation](https://docs.zapier.com/mcp/home) — LOADED (HTTP status not exposed). MCP setup/platform reference.
- [Zapier MCP overview](https://zapier.com/mcp) — LOADED (HTTP status not exposed). MCP setup/platform reference.

## Quotes appendix
Short verbatim locators; section references above carry the factual summaries. These excerpts deliberately do not reproduce the full contract. Follow the source links for complete conditions.
- **Q-D**, [schedule](https://paypalaihackathon.devpost.com/details/dates): “November 12 at 12:00pm PST”.
- **Q-H**, [home](https://paypalaihackathon.devpost.com/): “PayPal and AI”; “Tools”; “Public code repository”; “license file”; “Under 3 minutes”; “functioning”; “Text description”; “setup and run instructions”; “open source”; “permission”.
- **Q-R**, [rules §§3–11](https://paypalaihackathon.devpost.com/rules): “age of majority”; “significantly updated”; “unique and substantially different”; “English translation”; “publicly visible on YouTube”; “third party trademarks”; “equally weighted”; “express written consent”; “any”.
- **Q-A**, [APIMatic](https://paypalaihackathon.devpost.com/details/apimatic): “used the Context Plugin to build their PayPal integration”.
- **Q-AF**, [claim form](https://docs.google.com/forms/d/e/1FAIpQLScc2oCgAFACm7d6H3R4mgzv-O34DdyVnLIBNiwmUNggr_-hhA/viewform): “Must Show APIMatic Context Plugin Usage”; “Description of Context Plugin usage”; “manual verification”; “non-transferable”.
- **Q-G**, [AG Grid](https://paypalaihackathon.devpost.com/details/aggrid): “not just AG Grid or AG Charts on their own”; “Take Studio Agent Framework for a spin”.
- **Q-Re**, [Render](https://paypalaihackathon.devpost.com/details/render): “Deploy your project on Render and use”; “Render Workflows”.
- **Q-B**, [Bryntum](https://paypalaihackathon.devpost.com/details/bryntum): “puts Gantt, Scheduler, and/or Calendar to the best use”.
- **Q-C**, [Channel3](https://paypalaihackathon.devpost.com/details/channel3): “Projects that only reference Channel3 without calling it will not meet this requirement.”
- **Q-S**, [Sarvam licensing](https://docs.sarvam.ai/api/getting-started/commercial-licensing): “Free credits count.”; “No minimum purchase is required beyond normal credit usage.”
- **Q-E**, [ElevenLabs billing](https://elevenlabs.io/docs/overview/administration/billing): “If you are on the free plan, you can use the content non-commercially with attribution.”

