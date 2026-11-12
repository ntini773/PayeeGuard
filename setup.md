# Payout Rescue: Pixi and NVIDIA setup

Pixi was already installed at `~/.pixi/bin/pixi`. This project pins Python 3.11,
Node.js 22 and `langchain-nvidia-ai-endpoints==1.4.3` in `pixi.toml`.

```bash
pixi install --locked
pixi run python --version
pixi run test
```

Pixi installs dependencies into `.pixi/envs/default`. Run commands with
`pixi run`; no separate virtualenv activation is needed. Keep `pixi.toml` and
`pixi.lock` together when reusing the environment. Ignore `.pixi/`, `.env`,
`__pycache__/` and `.runtime/` in source control.

## Private configuration

Set `NVIDIA_API_KEY` (or `AI_API_KEY`) in this project's `.env` or shell
environment. Sandbox PayPal uses `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET`.
Protect `.env` with `chmod 600 .env`. Never include actual keys in documentation.

`rescue.config.settings()` explicitly loads the project-local `.env`, then applies
shell overrides. Pixi does not load `.env` automatically. No other project's
configuration is read.

## NVIDIA client

The current integration uses:

- Base URL: `https://integrate.api.nvidia.com/v1`
- Model: `nvidia/nemotron-3.5-bolt-e4b`
- Package: `langchain_nvidia_ai_endpoints`, using `ChatNVIDIA`
- Connectivity check: streaming, `temperature=1`, `top_p=0.95`,
  `max_completion_tokens=4096`, `timeout=25`, thinking enabled.

See `rescue/ai.py` for the standalone connectivity example. Register the model
with `Model(..., model_type="chat", client="ChatNVIDIA", supports_tools=True)`
before constructing the client: package 1.4.3 lacks the model's chat metadata.
Do not pass `usage_telemetry_enabled` or `stream_options=None` to this version.
Collect final content separately from reasoning, check for truncation, and
validate structured output before using it. AI output is advisory only.

```bash
pixi run diagnose-ai          # Actual NVIDIA request; no PayPal call
pixi run evaluate-investigator --rules-only  # Offline evaluation
pixi run demo                # Local demo with fixture AI
```

For another project, copy the dependency declarations and adapt the task commands
and configuration loader. Check model availability again before relying on it.

For a project-local hidden NVIDIA key prompt, run
`pixi run python -m rescue.configure_ai`, then `pixi run diagnose-ai`.
The helper preserves other `.env` settings. A missing key produces unavailable
assessments; a successful safety check alone does not prove live inference worked.
