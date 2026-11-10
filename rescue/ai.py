"""One inference connectivity check. No payment tools or recipient data."""
import json
from .config import settings


def main():
    from langchain_nvidia_ai_endpoints import ChatNVIDIA, Model, register_model
    cfg = settings()
    model = 'nvidia/nemotron-3.5-bolt-e4b'
    base = 'https://integrate.api.nvidia.com/v1'
    register_model(Model(id=model, model_type='chat', client='ChatNVIDIA',
                         endpoint=base + '/chat/completions', supports_tools=True))
    try:
        client = ChatNVIDIA(model=model, base_url=base,
            api_key=cfg.get('NVIDIA_API_KEY') or cfg['AI_API_KEY'], temperature=1,
            top_p=0.95, max_completion_tokens=4096, timeout=25)
        parts = []
        for chunk in client.stream([{'role': 'user', 'content':
                'Return only this JSON object: {"connection":"ok"}'}],
                seed=42, parallel_tool_calls=True,
                chat_template_kwargs={'enable_thinking': True}):
            if chunk.response_metadata.get('finish_reason') == 'length' or chunk.tool_call_chunks:
                raise ValueError('Incomplete or unexpected tool output')
            if isinstance(chunk.content, str):
                parts.append(chunk.content)
        if json.loads(''.join(parts)) != {'connection': 'ok'}:
            raise ValueError('Unexpected response')
        print('AI inference and JSON validation: PASS')
    except Exception as exc:
        print(f'AI check failed ({type(exc).__name__}); credentials and response omitted.')
        raise SystemExit(1)


if __name__ == '__main__':
    main()
