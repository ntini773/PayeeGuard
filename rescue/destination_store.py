"""Additive destination storage; no migration of legacy payees or privileges."""
import json
import re
import time
from dataclasses import dataclass
from .destination_errors import DestinationError
from .store import Denied


def encode(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False)


def name(value):
    if not isinstance(value, str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,100}', value):
        raise DestinationError('INVALID_REQUEST')
    return value


@dataclass(frozen=True)
class Principal:
    user: str
    tenant: str
    seller: str
    manage: bool
    review: bool
    channel: str
    session: str
    grant_seller: str | None = None


class DestinationStore:
    def __init__(self, identity_store):
        self.identity = identity_store
        self.connect = identity_store.connect
        with self.connect() as db:
            db.executescript('''
            CREATE TABLE IF NOT EXISTS pg_grants(
              user_id TEXT PRIMARY KEY, tenant TEXT NOT NULL, seller TEXT NOT NULL,
              manage INTEGER NOT NULL, review INTEGER NOT NULL, channel TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS pg_payees(
              tenant TEXT NOT NULL, seller TEXT NOT NULL, data TEXT NOT NULL,
              PRIMARY KEY(tenant,seller));
            CREATE TABLE IF NOT EXISTS pg_cases(
              id TEXT PRIMARY KEY, tenant TEXT NOT NULL, seller TEXT NOT NULL, data TEXT NOT NULL);
            CREATE INDEX IF NOT EXISTS pg_case_scope ON pg_cases(tenant,seller);
            CREATE TABLE IF NOT EXISTS pg_requests(
              tenant TEXT NOT NULL, seller TEXT NOT NULL, kind TEXT NOT NULL,
              key TEXT NOT NULL, payload TEXT NOT NULL, resource TEXT NOT NULL,
              PRIMARY KEY(tenant,seller,kind,key));
            CREATE TABLE IF NOT EXISTS pg_earnings(
              tenant TEXT NOT NULL, seller TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL,
              PRIMARY KEY(tenant,seller,id));
            CREATE TABLE IF NOT EXISTS pg_payouts(
              tenant TEXT NOT NULL, seller TEXT NOT NULL, operation_key TEXT NOT NULL,
              data TEXT NOT NULL, PRIMARY KEY(tenant,seller,operation_key));
            CREATE TABLE IF NOT EXISTS pg_oauth(
              digest TEXT PRIMARY KEY, tenant TEXT NOT NULL, seller TEXT NOT NULL,
              case_id TEXT NOT NULL, session TEXT NOT NULL, purpose TEXT NOT NULL,
              version INTEGER NOT NULL, expires REAL NOT NULL, consumed INTEGER NOT NULL DEFAULT 0);
            CREATE TABLE IF NOT EXISTS pg_signals(
              tenant TEXT NOT NULL, seller TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY(tenant, seller));
            CREATE TABLE IF NOT EXISTS pg_assessments(
              seq INTEGER PRIMARY KEY, case_id TEXT NOT NULL, tenant TEXT NOT NULL,
              seller TEXT NOT NULL, at REAL NOT NULL, case_version INTEGER NOT NULL,
              data TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS pg_events(
              seq INTEGER PRIMARY KEY, tenant TEXT NOT NULL, seller TEXT NOT NULL,
              case_id TEXT, actor TEXT NOT NULL, at REAL NOT NULL, event TEXT NOT NULL,
              data TEXT NOT NULL);
            CREATE TRIGGER IF NOT EXISTS pg_events_no_update BEFORE UPDATE ON pg_events
              BEGIN SELECT RAISE(ABORT, 'audit is append-only'); END;
            CREATE TRIGGER IF NOT EXISTS pg_events_no_delete BEFORE DELETE ON pg_events
              BEGIN SELECT RAISE(ABORT, 'audit is append-only'); END;
            CREATE TRIGGER IF NOT EXISTS pg_assessments_no_update BEFORE UPDATE ON pg_assessments
              BEGIN SELECT RAISE(ABORT, 'assessments are append-only'); END;
            CREATE TRIGGER IF NOT EXISTS pg_assessments_no_delete BEFORE DELETE ON pg_assessments
              BEGIN SELECT RAISE(ABORT, 'assessments are append-only'); END;
            ''')

    def provision_grant(self, user, tenant, seller, *, manage=False, review=False, channel='browser'):
        """Trusted provisioning only: never exposed as an HTTP or agent operation."""
        for value in (user, tenant, seller):
            name(value)
        if type(manage) is not bool or type(review) is not bool or channel not in ('browser', 'external'):
            raise DestinationError('INVALID_REQUEST')
        if channel == 'external' and review:
            raise DestinationError('INVALID_REQUEST')
        with self.connect() as db:
            if not db.execute('SELECT 1 FROM users WHERE id=?', (user,)).fetchone():
                raise DestinationError('AUTH_REQUIRED', 401)
            db.execute('INSERT INTO pg_grants VALUES (?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET '
                       'tenant=excluded.tenant,seller=excluded.seller,manage=excluded.manage,'
                       'review=excluded.review,channel=excluded.channel',
                       (user, tenant, seller, manage, review, channel))
            self.event(db, tenant, seller, None, 'backend-provisioning', 'GRANT_PROVISIONED',
                       {'subject': user, 'manage': manage, 'review': review, 'channel': channel})

    def provision_payee(self, tenant, seller, active_payer_id, *, currency='USD', cap='0.01', legal_name=None, country=None):
        """Insert an established marketplace entitlement; refuses to replace one."""
        for value in (tenant, seller, active_payer_id):
            name(value)
        from decimal import Decimal, InvalidOperation
        try:
            amount = Decimal(cap)
            if not amount.is_finite() or amount <= 0 or amount.as_tuple().exponent < -2:
                raise ValueError()
        except (ValueError, InvalidOperation, TypeError):
            raise DestinationError('INVALID_REQUEST') from None
        if not re.fullmatch('[A-Z]{3}', currency):
            raise DestinationError('INVALID_REQUEST')
        if legal_name is not None and (not isinstance(legal_name, str) or not 1 <= len(legal_name.strip()) <= 100):
            raise DestinationError('INVALID_REQUEST')
        if country is not None and not re.fullmatch('[A-Z]{2}', str(country)):
            raise DestinationError('INVALID_REQUEST')
        data = {'active_payer_id': active_payer_id, 'version': 1, 'paused': False,
                'compromised': False, 'currency': currency, 'cap': str(amount), 'simulation': False}
        # Marketplace-owned facts used to compare against PayPal: never from sellers or agents.
        if legal_name:
            data['legal_name'] = legal_name.strip()
        if country:
            data['country'] = country
        with self.connect() as db:
            db.execute('INSERT INTO pg_payees VALUES (?,?,?)', (tenant, seller, encode(data)))
            self.event(db, tenant, seller, None, 'backend-provisioning', 'PAYEE_PROVISIONED', {})

    SIGNAL_KEYS = ('new_device_at', 'password_reset_at', 'country_change_at', 'last_destination_change_at')

    def provision_signals(self, tenant, seller, *, source='SIMULATED_FEED', entitlement_confirmed=False, **times):
        """Trusted marketplace feed of security events (epoch seconds, or None for never). Replaces the previous row.
        There is no HTTP route to this method. In this prototype the feed is simulated and says so."""
        for value in (tenant, seller):
            name(value)
        if set(times) - set(self.SIGNAL_KEYS) or source not in ('SIMULATED_FEED', 'MARKETPLACE_FEED'):
            raise DestinationError('INVALID_REQUEST')
        for stamp in times.values():
            if stamp is not None and (isinstance(stamp, bool) or not isinstance(stamp, (int, float)) or stamp < 0):
                raise DestinationError('INVALID_REQUEST')
        if type(entitlement_confirmed) is not bool:
            raise DestinationError('INVALID_REQUEST')
        data = dict({key: None for key in self.SIGNAL_KEYS}, **times, source=source, entitlement_confirmed=entitlement_confirmed)
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            if not db.execute('SELECT 1 FROM pg_payees WHERE tenant=? AND seller=?', (tenant, seller)).fetchone():
                raise DestinationError('SELLER_SCOPE_DENIED', 403)
            db.execute('INSERT INTO pg_signals VALUES (?,?,?) ON CONFLICT(tenant, seller) DO UPDATE SET data=excluded.data',
                       (tenant, seller, encode(data)))
            self.event(db, tenant, seller, None, 'marketplace-feed', 'RISK_SIGNALS_IMPORTED', {'source': source})

    def signals(self, db, principal):
        row = db.execute('SELECT data FROM pg_signals WHERE tenant=? AND seller=?', (principal.tenant, principal.seller)).fetchone()
        return json.loads(row[0]) if row else None

    def principal(self, token, permission=None, correlation=None):
        try:
            actor = self.identity.session(token)
        except (Denied, TypeError, AttributeError):
            self.denied(None, 'AUTH_REQUIRED', correlation)
            raise DestinationError('AUTH_REQUIRED', 401) from None
        with self.connect() as db:
            grant = db.execute('SELECT * FROM pg_grants WHERE user_id=?', (actor['user_id'],)).fetchone()
        if not grant:
            self.denied(None, 'SELLER_SCOPE_DENIED', correlation, actor['user_id'])
            raise DestinationError('SELLER_SCOPE_DENIED', 403)
        if actor.get('api_key') and grant['channel'] != 'external':
            self.denied(None, 'SELLER_SCOPE_DENIED', correlation, actor['user_id'])
            raise DestinationError('SELLER_SCOPE_DENIED', 403)      # keys are for a marketplace's own backend only
        p = Principal(actor['user_id'], grant['tenant'], grant['seller'], bool(grant['manage']),
                      bool(grant['review']), grant['channel'], actor['token'])
        if (permission == 'manage' and not p.manage) or (permission == 'review' and
                (not p.review or p.channel != 'browser')):
            self.denied(p, 'AUTHORIZATION_DENIED', correlation)
            raise DestinationError('SELLER_SCOPE_DENIED', 403)
        return p

    def denied(self, principal, code, correlation=None, actor='anonymous'):
        with self.connect() as db:
            self.event(db, principal.tenant if principal else '', principal.seller if principal else '',
                       None, principal.user if principal else actor, 'AUTHORIZATION_DENIED',
                       {'reason_code': code, 'correlation_id': correlation})

    @staticmethod
    def event(db, tenant, seller, case_id, actor, event, data, now=None):
        db.execute('INSERT INTO pg_events(tenant,seller,case_id,actor,at,event,data) VALUES (?,?,?,?,?,?,?)',
                   (tenant, seller, case_id, actor, time.time() if now is None else now, event, encode(data)))

    @staticmethod
    def authorize(db, principal):
        if principal.grant_seller is not None and not (principal.review and principal.channel == 'browser'):
            raise DestinationError('SELLER_SCOPE_DENIED', 403)
        row = db.execute('SELECT g.*,s.user_id AS subject FROM pg_grants g JOIN sessions s ON g.user_id=s.user_id '
                         'WHERE s.token=? AND s.expires>?', (principal.session, time.time())).fetchone()
        if not row:   # not a browser session: a marketplace backend key, valid only for an external-channel grant
            row = db.execute('SELECT g.*,k.user_id AS subject FROM pg_grants g JOIN api_keys k ON g.user_id=k.user_id '
                             "WHERE k.digest=? AND k.revoked=0 AND g.channel='external'", (principal.session,)).fetchone()
        if not row or (row['subject'], row['tenant'], row['seller'], bool(row['manage']), bool(row['review']), row['channel']) != (
                principal.user, principal.tenant, principal.grant_seller or principal.seller, principal.manage, principal.review, principal.channel):
            raise DestinationError('AUTH_REQUIRED', 401)

    def case(self, db, principal, case_id):
        self.authorize(db, principal)
        row = db.execute('SELECT data FROM pg_cases WHERE id=? AND tenant=? AND seller=?',
                         (case_id, principal.tenant, principal.seller)).fetchone()
        if not row:
            raise DestinationError('CASE_NOT_FOUND', 404)
        return json.loads(row[0])

    def payee(self, db, principal):
        self.authorize(db, principal)
        row = db.execute('SELECT data FROM pg_payees WHERE tenant=? AND seller=?',
                         (principal.tenant, principal.seller)).fetchone()
        if not row:
            raise DestinationError('SELLER_SCOPE_DENIED', 403)
        return json.loads(row[0])

    def save(self, db, principal, case, expected_version):
        self.authorize(db, principal)
        case['version'] = expected_version + 1
        result = db.execute("UPDATE pg_cases SET data=? WHERE id=? AND tenant=? AND seller=? "
                            "AND json_extract(data,'$.version')=?", (encode(case), case['case_id'],
                            principal.tenant, principal.seller, expected_version))
        if result.rowcount != 1:
            raise DestinationError('CASE_VERSION_CONFLICT', 409)
