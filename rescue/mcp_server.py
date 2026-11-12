"""PayeeGuard MCP server: a thin adapter over the same HTTPS/JSON API, for a marketplace's own agent or backend.

Run:  PAYEEGUARD_API_KEY=pgk_... python -m rescue.mcp_server   (stdio transport, newline-delimited JSON-RPC)
Optional: PAYEEGUARD_URL (default http://127.0.0.1:8765).

Tools: list, read, create and cancel the seller's own change requests, and start a PayPal verification link.
There is deliberately NO tool to approve, reject, record evidence, run payouts or read other sellers' data.
Every call goes through the API, so the backend's rules, grants and audit trail apply exactly as for a browser.
The key is read from the environment, sent only as a Bearer header, and never printed or returned.
"""
import json
import os
import re
import sys
import uuid
from urllib import error, request

PROTOCOL = '2024-11-05'
CASE_ID = re.compile(r'chg_[a-f0-9]{32}')
BASE = '/api/v1/destination-change-requests'
MAX_OUT = 8000

TOOLS = [
    {'name': 'list_change_requests', 'description': 'List this seller\'s payout account change requests (newest first).',
     'inputSchema': {'type': 'object', 'properties': {}, 'additionalProperties': False}},
    {'name': 'get_change_request', 'description': 'Read one change request: its state, evidence status and audit-safe summary.',
     'inputSchema': {'type': 'object', 'properties': {'case_id': {'type': 'string', 'pattern': '^chg_[a-f0-9]{32}$'}}, 'required': ['case_id'], 'additionalProperties': False}},
    {'name': 'create_change_request', 'description': 'Ask to change where this seller\'s earnings are paid. Nothing changes until the seller verifies both PayPal accounts and the marketplace care team approves.',
     'inputSchema': {'type': 'object', 'properties': {'reason_text': {'type': 'string', 'minLength': 3, 'maxLength': 1000}, 'reason_category': {'type': 'string', 'maxLength': 80}},
                     'required': ['reason_text'], 'additionalProperties': False}},
    {'name': 'cancel_change_request', 'description': 'Cancel an open or waiting request. Payouts stay on the current account.',
     'inputSchema': {'type': 'object', 'properties': {'case_id': {'type': 'string', 'pattern': '^chg_[a-f0-9]{32}$'}}, 'required': ['case_id'], 'additionalProperties': False}},
    {'name': 'start_paypal_verification', 'description': 'Get the PayPal sign-in link the seller must open to prove an account (NEW or OLD). A person completes it in a browser.',
     'inputSchema': {'type': 'object', 'properties': {'case_id': {'type': 'string', 'pattern': '^chg_[a-f0-9]{32}$'}, 'purpose': {'type': 'string', 'enum': ['NEW', 'OLD']}},
                     'required': ['case_id', 'purpose'], 'additionalProperties': False}},
]


class ToolError(Exception):
    pass


def api(method, path, body=None):
    base = os.environ.get('PAYEEGUARD_URL', 'http://127.0.0.1:8765').rstrip('/')
    key = os.environ.get('PAYEEGUARD_API_KEY', '')
    if not key.startswith('pgk_'):
        raise ToolError('PAYEEGUARD_API_KEY is not set')
    data = None if body is None else json.dumps(body).encode()
    headers = {'Authorization': 'Bearer ' + key, 'Idempotency-Key': uuid.uuid4().hex}
    if data is not None:
        headers['Content-Type'] = 'application/json'
    req = request.Request(base + path, data=data, headers=headers, method=method)
    try:
        with request.urlopen(req, timeout=30) as response:
            return json.load(response)
    except error.HTTPError as exc:
        try:
            code = json.load(exc).get('error', {}).get('code', 'ERROR')
        except Exception:
            code = 'ERROR'
        raise ToolError(f'PayeeGuard refused the request ({exc.code} {code})') from None
    except (error.URLError, OSError, ValueError):
        raise ToolError('PayeeGuard is not reachable') from None


def case_id(args):
    value = args.get('case_id')
    if not isinstance(value, str) or not CASE_ID.fullmatch(value):
        raise ToolError('case_id must look like chg_ followed by 32 hex characters')
    return value


def call_tool(name, args):
    if not isinstance(args, dict):
        raise ToolError('arguments must be an object')
    if name == 'list_change_requests':
        return api('GET', BASE)
    if name == 'get_change_request':
        return api('GET', f'{BASE}/{case_id(args)}')
    if name == 'create_change_request':
        text = args.get('reason_text')
        if not isinstance(text, str) or not 3 <= len(text.strip()) <= 1000:
            raise ToolError('reason_text must be 3 to 1000 characters')
        body = {'reason_text': text.strip()}
        if isinstance(args.get('reason_category'), str):
            body['reason_category'] = args['reason_category'][:80]
        return api('POST', BASE, body)
    if name == 'cancel_change_request':
        return api('POST', f'{BASE}/{case_id(args)}/cancel', {})
    if name == 'start_paypal_verification':
        if args.get('purpose') not in ('NEW', 'OLD'):
            raise ToolError('purpose must be NEW or OLD')
        return api('POST', f'{BASE}/{case_id(args)}/auth/{args["purpose"]}', {})
    raise ToolError('unknown tool')


def handle(message):
    """One JSON-RPC message in, a response dict (or None for notifications) out."""
    method, mid = message.get('method'), message.get('id')
    if method is None:
        return None
    if mid is None:      # notification
        return None
    if method == 'initialize':
        client = (message.get('params') or {}).get('protocolVersion')
        return {'jsonrpc': '2.0', 'id': mid, 'result': {'protocolVersion': client if isinstance(client, str) else PROTOCOL,
                'capabilities': {'tools': {}}, 'serverInfo': {'name': 'payeeguard', 'version': '0.1.0'}}}
    if method == 'ping':
        return {'jsonrpc': '2.0', 'id': mid, 'result': {}}
    if method == 'tools/list':
        return {'jsonrpc': '2.0', 'id': mid, 'result': {'tools': TOOLS}}
    if method == 'tools/call':
        params = message.get('params') or {}
        try:
            text = json.dumps(call_tool(params.get('name'), params.get('arguments') or {}), indent=1)
            return {'jsonrpc': '2.0', 'id': mid, 'result': {'content': [{'type': 'text', 'text': text[:MAX_OUT]}], 'isError': False}}
        except ToolError as exc:
            return {'jsonrpc': '2.0', 'id': mid, 'result': {'content': [{'type': 'text', 'text': str(exc)}], 'isError': True}}
    return {'jsonrpc': '2.0', 'id': mid, 'error': {'code': -32601, 'message': 'Method not found'}}


def main():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            message = json.loads(line)
            reply = handle(message) if isinstance(message, dict) else None
        except json.JSONDecodeError:
            reply = {'jsonrpc': '2.0', 'id': None, 'error': {'code': -32700, 'message': 'Parse error'}}
        if reply is not None:
            sys.stdout.write(json.dumps(reply) + '\n')
            sys.stdout.flush()


if __name__ == '__main__':
    main()
