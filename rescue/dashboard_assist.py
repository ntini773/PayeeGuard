"""Dashboard assistant. Picks ONE pre-built view for a question. It never writes widgets, queries, numbers or code.

This is the DASHBOARD model: a separate instance from the core model that creates and reviews PayPal requests.
It has no tools and no access to cases, payer IDs, amounts or the investigator's context. Set RESCUE_DASHBOARD_MODEL
to run it on a different NVIDIA model than the core one. Inside it, two calls with no shared context keep it on track:
  A (router)   sees the question and a fixed menu, and returns a menu id.
  B (checker)  sees only the question and the chosen view's description, and answers YES or NO.
If B says NO the assistant offers the menu instead of showing a wrong chart.
The number of days is parsed from the question by code, never by a model. All numbers on a chart come from
our own records; the model never sees case data, payer IDs or amounts. A model failure falls back to keywords.
"""
import json
import re

MAX_QUESTION = 200
DAY_WINDOWS = (1, 2, 3, 5, 7, 14, 30)
FLAG_WINDOWS = (1, 2, 3, 4, 5, 6, 7)      # the flags feed holds 7 daily rows, so any 1 to 7 days works
FLAG_VIEWS = ('flags_by_type', 'escalations')
CARE = {
    'flags_by_type': 'Risk flags per day by type (new device, password reset, country change, destination change), last 7 days',
    'escalations': 'AI escalations per day, last 7 days',
    'requests_by_week': 'Account change requests per week over the past month, split into approved, auto-approved and rejected',
    'rejections_by_week': 'Rejected account change requests per week over the past month',
    'cases_by_status': 'Live cases grouped by status',
    'cases_by_policy': 'Live cases grouped by policy decision',
    'income_trend': 'Seller income per day over the last 14 days',
    'sales_count': 'Number of sales per day over the last 14 days',
}
SELLER = {
    'earnings_by_day': 'The seller\'s real recorded sales and income per day for a recent number of days',
    'earnings_by_status': 'The seller\'s real recorded sales grouped by payout status',
    'income_trend': 'Income per day over the last 14 days (simulated history)',
    'sales_count': 'Number of sales per day over the last 14 days (simulated history)',
}
CATALOGS = {'care': CARE, 'seller': SELLER}
# Views whose range can be narrowed to the last N days. Anything else has a fixed range.
WINDOWS = {
    'earnings_by_day': (1, 2, 3, 5, 7, 14, 30),
    'flags_by_type': (1, 2, 3, 4, 5, 6, 7),
    'escalations': (1, 2, 3, 4, 5, 6, 7),
    'income_trend': (1, 2, 3, 5, 7, 10, 14),
    'sales_count': (1, 2, 3, 5, 7, 10, 14),
}
_KEYWORDS = {
    'care': {
        'flags_by_type': ('flag', 'risk', 'device', 'password', 'country', 'signal'),
        'escalations': ('escalat', 'ai ', 'review'),
        'requests_by_week': ('request', 'change', 'month', 'week', 'account change'),
        'rejections_by_week': ('reject', 'denied', 'blocked', 'fraud'),
        'cases_by_status': ('status', 'state', 'open', 'queue', 'pending'),
        'cases_by_policy': ('policy', 'decision', 'rule'),
        'income_trend': ('income', 'revenue', 'earn', 'money', 'seller'),
        'sales_count': ('sales', 'orders', 'transactions', 'count'),
    },
    'seller': {
        'earnings_by_day': ('day', 'today', 'yesterday', 'recent', 'earn', 'income', 'revenue', 'sales', 'week', 'dashboard'),
        'earnings_by_status': ('status', 'paid', 'pending', 'payout', 'processing'),
        'income_trend': ('trend', 'history', 'over time', '14', 'fortnight'),
        'sales_count': ('how many', 'count', 'orders', 'transactions'),
    },
}


def validate_question(value):
    if not isinstance(value, str) or not 3 <= len(value.strip()) <= MAX_QUESTION:
        raise ValueError('bad question')
    return value.strip()


def raw_days(question):
    """The number of days named in the question, or None."""
    q = question.lower()
    m = re.search(r'\b(\d{1,3})\s*(?:-|\s)?days?\b', q)
    if m:
        return int(m.group(1))
    if 'yesterday' in q:
        return 2
    if 'today' in q:
        return 1
    if 'week' in q:
        return 7
    if 'month' in q:
        return 30
    return None


def window_for(view, n):
    """Round n up to a window the view has data for; None means the full range."""
    windows = WINDOWS.get(view)
    if not windows:
        return None
    if n is None:
        return windows[-1]
    return next((w for w in windows if w >= max(n, 1)), windows[-1])


def parse_days(question, windows=DAY_WINDOWS):
    """Days come from the words of the question, by code. Rounded up to a window we have data for."""
    q = question.lower()
    m = re.search(r'\b(\d{1,3})\s*(?:-|\s)?days?\b', q)
    if m:
        n = int(m.group(1))
    elif 'yesterday' in q:
        n = 2
    elif 'today' in q:
        n = 1
    elif 'week' in q:
        n = 7
    elif 'month' in q:
        n = 30
    else:
        n = 7
    return next((w for w in windows if w >= max(n, 1)), windows[-1])


def keyword_pick(question, scope='care'):
    q = question.lower()
    words = _KEYWORDS[scope]
    scores = {view: sum(k in q for k in ks) for view, ks in words.items()}
    best = max(scores, key=scores.get)
    return best if scores[best] else ('earnings_by_day' if scope == 'seller' else 'requests_by_week')


def _router_prompt(catalog):
    return ('You pick one dashboard view. Reply with ONLY the id of the best match from this list, nothing else.\n'
            + '\n'.join(f'{k}: {v}' for k, v in catalog.items()))


CHECKER_PROMPT = ('You check a dashboard choice. You are given a question and the description of the view that was chosen. '
                  'Reply with exactly one word: YES if that view would answer the question, otherwise NO.')


def dashboard_model(max_tokens):
    """A dedicated NVIDIA client for dashboards only: no tools, its own optional model id."""
    from .config import settings
    from .investigator import nvidia_chat_model
    return nvidia_chat_model(bind_tools=False, max_tokens=max_tokens, model_id=settings().get('RESCUE_DASHBOARD_MODEL') or None)


def _call(model, system, human):
    from langchain_core.messages import HumanMessage, SystemMessage
    return str(model.invoke([SystemMessage(content=system), HumanMessage(content=human)]).content)


TOOL_SYSTEM = ('You choose a dashboard view for the user by calling show_view once. view must be one of the listed ids. '
               'days is how many recent days the user asked for (leave it out if they did not say). '
               'If the message only gives a time range such as "last 2 days", use the previous view shown below. '
               'If nothing fits, call show_view with view "none".\n')


def tool_pick(question, scope, previous, caller):
    """One tool call to the dashboard model. Returns (view, days) with both validated in code, or raises."""
    catalog = CATALOGS[scope]
    body = {'messages': [{'role': 'system', 'content': TOOL_SYSTEM + 'Views:\n' + '\n'.join(f'{k}: {v}' for k, v in catalog.items())
                                                       + (f'\nPrevious view: {previous}' if previous else '')},
                         {'role': 'user', 'content': question}],
            'tools': [{'type': 'function', 'function': {'name': 'show_view', 'description': 'Show one dashboard view',
                       'parameters': {'type': 'object', 'properties': {'view': {'type': 'string', 'enum': list(catalog) + ['none']},
                                                                       'days': {'type': 'integer', 'minimum': 1, 'maximum': 30}}, 'required': ['view']}}}],
            'tool_choice': 'required'}
    calls = caller(body)['message']['tool_calls']
    if not calls or calls[0]['name'] != 'show_view':
        raise ValueError('no tool call')
    args = json.loads(calls[0]['arguments'])
    view = args.get('view')
    if view == 'none':
        return None, None
    if view not in catalog:
        raise ValueError('off menu')
    days = args.get('days') if isinstance(args.get('days'), int) and not isinstance(args.get('days'), bool) else None
    return view, days


def _default_caller(body):
    from .config import settings
    from .dashboard_llm import forward
    from .investigator import MODEL_ID
    cfg = settings()
    key = cfg.get('NVIDIA_API_KEY') or cfg.get('AI_API_KEY')
    if not key:
        raise RuntimeError('no key')
    return forward(body, key, cfg.get('RESCUE_DASHBOARD_MODEL') or MODEL_ID)


def _finish(view, source, verified, question, model_days, previous_days=None):
    catalog_title = None
    days = None
    if view in WINDOWS:
        n = model_days if model_days is not None else raw_days(question)
        days = window_for(view, n)
    return view, days


def pick_view(question, scope='care', router=None, checker=None, previous=None, caller=None):
    """Returns {'view', 'title', 'days', 'source': 'ai'|'rules', 'verified': bool} or {'view': None, 'message', 'suggestions'}.
    Production path: ONE tool call (show_view) to the dashboard model. Tests inject router/checker fakes for the older prompt path."""
    question = validate_question(question)
    if scope not in CATALOGS:
        raise ValueError('bad scope')
    catalog = CATALOGS[scope]
    if previous not in catalog:
        previous = None
    if router is None:
        view = days = None
        source, ok = 'rules', False
        try:
            view, days = tool_pick(question, scope, previous, caller or _default_caller)
            source, ok = 'ai', True
            if view is None:
                return {'view': None, 'message': 'I cannot chart that from the data I have. Try one of these:', 'suggestions': list(catalog.values())[:4]}
        except Exception:   # model down or confused: keywords, then the previous view for a bare time range
            view = None
        if view is None:
            q = question.lower()
            has_subject = any(any(k in q for k in ks) for v, ks in _KEYWORDS[scope].items() if v not in ('earnings_by_day',) or 'day' not in q)
            if previous and raw_days(question) is not None and previous in WINDOWS and not has_subject:
                view = previous
            else:
                view = keyword_pick(question, scope)
            source = 'rules'
        n = days if days is not None else None
        window = window_for(view, n if n is not None else raw_days(question)) if view in WINDOWS else None
        title = catalog[view] if window is None else (f'Your real recorded sales, last {window} day{"s" if window > 1 else ""}' if view == 'earnings_by_day'
                                                     else f'{catalog[view].split(", last")[0].split(" over the last")[0].split(" over")[0].strip()}, last {window} day{"s" if window > 1 else ""}')
        return {'view': view, 'title': title, 'days': window, 'source': source, 'verified': ok}
    # legacy prompt path (kept for tests and for models that cannot tool-call)
    view, source = None, 'rules'
    try:
        if router is None:
            router = dashboard_model(20)
        found = re.findall(r'[a-z_]+', _call(router, _router_prompt(catalog), question).lower())
        view = next((w for w in found if w in catalog), None)
        if view:
            source = 'ai'
    except Exception:  # model unavailable or confused: the keyword match still answers
        view = None
    if view is None:
        view = keyword_pick(question, scope)
    verified = False
    if source == 'ai':
        try:
            if checker is None:
                checker = dashboard_model(5)   # a separate call with its own prompt and no shared context
            answer = _call(checker, CHECKER_PROMPT, f'Question: {question}\nChosen view: {catalog[view]}').strip().upper()
            # A small model can say NO to a fair question, so NO only vetoes when the words of the question also match nothing.
            if answer.startswith('NO') and not any(k in question.lower() for k in _KEYWORDS[scope][view]):
                return {'view': None, 'message': 'I cannot chart that from the data I have. Try one of these:',
                        'suggestions': list(catalog.values())[:4]}
            verified = answer.startswith('YES')
        except Exception:
            verified = False
    days = parse_days(question) if view == 'earnings_by_day' else parse_days(question, FLAG_WINDOWS) if view in FLAG_VIEWS else None
    if view == 'earnings_by_day':
        title = f'Your real recorded sales, last {days} day{"s" if days > 1 else ""}'
    elif view in FLAG_VIEWS:
        title = ('Risk flags per day by type' if view == 'flags_by_type' else 'AI escalations per day') + f', last {days} day{"s" if days > 1 else ""} (simulated)'
    else:
        title = catalog[view]
    return {'view': view, 'title': title, 'days': days, 'source': source, 'verified': verified}
