"""Server side of the AG Studio Agent Framework adapter.

The browser must never hold the NVIDIA key, so Studio's adapter posts each model turn here and this module forwards it.
It is a pass-through for chat messages and Studio's own dashboard tools (add_widget, execute_query, ...). It adds no
tools of its own, so the model has no way to touch a case, approve anything, or reach PayPal: the only things Studio's
tools can do are read the rows it was given and edit the view in the browser.
Sizes, roles and tool names are checked before anything is sent.
"""
import json
import re

# Native Studio mode (?studioTools=1) needs a stronger model than the small default. Same NVIDIA key. Override with RESCUE_STUDIO_MODEL.
# mistral-large gave valid tool calls in testing. deepseek-v4.1-flash did too, but its free endpoint timed out on 2026-11-12.
DEFAULT_STUDIO_MODEL = 'mistralai/mistral-large-4-1t-a52b'
from urllib import error, request

URL = 'https://integrate.api.nvidia.com/v1/chat/completions'
MAX_BYTES = 200_000
MAX_MESSAGES = 200
MAX_TOOLS = 60
ROLES = {'system', 'user', 'assistant', 'tool'}
TOOL_NAME = re.compile(r'[A-Za-z0-9_.-]{1,64}')


class LlmError(Exception):
    pass


def clean(body):
    """Validate and rebuild the request so only known fields are forwarded."""
    if not isinstance(body, dict) or set(body) - {'messages', 'tools', 'tool_choice'}:
        raise LlmError('bad request')
    messages = body.get('messages')
    if not isinstance(messages, list) or not 1 <= len(messages) <= MAX_MESSAGES:
        raise LlmError('bad messages')
    out = []
    for m in messages:
        if not isinstance(m, dict) or m.get('role') not in ROLES:
            raise LlmError('bad message')
        item = {'role': m['role'], 'content': m['content'] if isinstance(m.get('content'), str) else ''}
        if m['role'] == 'assistant' and isinstance(m.get('tool_calls'), list):
            calls = []
            for c in m['tool_calls'][:20]:
                fn = (c or {}).get('function') or {}
                if not isinstance(c.get('id'), str) or not TOOL_NAME.fullmatch(str(fn.get('name', ''))) or not isinstance(fn.get('arguments'), str):
                    raise LlmError('bad tool call')
                calls.append({'id': c['id'][:64], 'type': 'function', 'function': {'name': fn['name'], 'arguments': fn['arguments']}})
            item['tool_calls'] = calls
        if m['role'] == 'tool':
            if not isinstance(m.get('tool_call_id'), str):
                raise LlmError('bad tool result')
            item['tool_call_id'] = m['tool_call_id'][:64]
        out.append(item)
    payload = {'messages': out}
    tools = body.get('tools')
    if tools is not None:
        if not isinstance(tools, list) or len(tools) > MAX_TOOLS:
            raise LlmError('bad tools')
        clean_tools = []
        for t in tools:
            fn = (t or {}).get('function') or {}
            if not TOOL_NAME.fullmatch(str(fn.get('name', ''))) or not isinstance(fn.get('parameters', {}), dict):
                raise LlmError('bad tool')
            clean_tools.append({'type': 'function', 'function': {'name': fn['name'], 'description': str(fn.get('description', ''))[:2000], 'parameters': fn.get('parameters', {})}})
        payload['tools'] = clean_tools
    choice = body.get('tool_choice')
    if choice in ('auto', 'none', 'required'):
        payload['tool_choice'] = choice
    elif isinstance(choice, dict) and TOOL_NAME.fullmatch(str((choice.get('function') or {}).get('name', ''))):
        payload['tool_choice'] = {'type': 'function', 'function': {'name': choice['function']['name']}}
    if len(json.dumps(payload)) > MAX_BYTES:
        raise LlmError('too large')
    return payload


def forward(body, key, model, opener=request.urlopen):
    """Returns {'message': {'content', 'tool_calls'}}. The key and raw provider errors are never returned."""
    payload = dict(clean(body), model=model, temperature=0, max_tokens=2048)
    req = request.Request(URL, data=json.dumps(payload).encode(), method='POST',
                          headers={'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json', 'Accept': 'application/json'})
    try:
        with opener(req, timeout=60) as response:
            message = json.load(response)['choices'][0]['message']
    except (error.URLError, OSError, KeyError, IndexError, ValueError, TypeError):
        raise LlmError('model unavailable') from None
    calls = [{'id': str(c.get('id', ''))[:64], 'name': c['function']['name'], 'arguments': c['function'].get('arguments', '{}')}
             for c in (message.get('tool_calls') or []) if isinstance(c, dict) and isinstance(c.get('function'), dict) and c['function'].get('name')]
    return {'message': {'content': message.get('content') if isinstance(message.get('content'), str) else '', 'tool_calls': calls}}
