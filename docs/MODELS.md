# Models and API keys

**One NVIDIA API key is enough for every AI feature.** Judges who run locally need a single free key from [build.nvidia.com](https://build.nvidia.com). There is no per-model key and no second AI provider.

## The key (the only NVIDIA key you need)

1. Sign in at build.nvidia.com (free).
2. Open any model page, for example `nvidia/nemotron-3.5-bolt-e4b`, and choose **Get API Key** (it starts with `nvapi-`).
3. Put it in `.env` as `NVIDIA_API_KEY=nvapi-...`. Never commit it.

The same key works for both models below. Both are NVIDIA-hosted free endpoints (`https://integrate.api.nvidia.com/v1`), so they have rate limits and can be slow at busy times.

## Which model does what

| Feature | Model | Setting | Used by default? |
|---|---|---|---|
| AI investigator (reads a case with 5 read-only tools and recommends) | `nvidia/nemotron-3.5-bolt-e4b` | built in | Yes |
| Guardy, the seller help chat | `nvidia/nemotron-3.5-bolt-e4b` | built in | Yes |
| Dashboard Ask box and the AG Studio AI Assistant chat (picks a view from a fixed menu; our code builds the chart) | `nvidia/nemotron-3.5-bolt-e4b` | `RESCUE_DASHBOARD_MODEL` (optional override) | Yes |
| **Native AG Studio mode** (Studio's own tools drive the dashboard) | `mistralai/mistral-large-4-1t-a52b` | `RESCUE_STUDIO_MODEL`, and add `?studioTools=1` to a dashboard URL | **No, opt-in** |

Native mode is optional. It shows Studio's own agent tools working, but it depends on a larger free model, which is slower. Judges do not need it for any test case.

## Measured behaviour (2026-11-12, free endpoints)

| Model | Result |
|---|---|
| `nemotron-3.5-bolt-e4b` | Answers in about 0.3 to 1 s on every request. Works for tool calls. |
| `mistral-large-4-1t-a52b` | Valid tool calls. The first request after idle took up to 60 s, later requests 2 to 10 s. |
| `deepseek-ai/deepseek-v4.1-flash` and `z-ai/glm-5.3-flash` | Timed out on every request that day. Not used. |

Free endpoints change. If a model is slow or unavailable, nothing is lost: the dashboard picker falls back to keyword rules, and the investigator reports the AI as unavailable so the case stays on hold for a person to review.

## Other keys, and which ones judges do not need

| Key | Needed? | Where from |
|---|---|---|
| `NVIDIA_API_KEY` | For live AI. Without it use demo mode with `--ai fixture` (canned answers). | build.nvidia.com |
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` | For the real PayPal sandbox only. Demo mode simulates PayPal. This is a PayPal key, not an NVIDIA key. | developer.paypal.com, Apps & Credentials, Sandbox |
| `VITE_AG_STUDIO_LICENSE` | Optional. Without it the AG Studio dashboards may not render. | ag-grid.com (free 45-day trial) |
| ElevenLabs, Postman, APIMatic | **No.** ElevenLabs made the demo video voice only. Postman is a CLI check. APIMatic was a development aid. | not needed |

## Change a model

Set the variable in `.env` (local) or in the Render environment, then restart. For example `RESCUE_STUDIO_MODEL=<another NVIDIA model id>`. The code defaults are in `rescue/dashboard_llm.py` (`DEFAULT_STUDIO_MODEL`) and `rescue/investigator.py` (`MODEL_ID`).
