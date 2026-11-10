"""Local marketplace prototype persistence. All authentication is server-side."""
import hashlib
import hmac
import json
import secrets
import sqlite3
import time
from contextlib import contextmanager


class Denied(ValueError):
    pass


def password_hash(password, salt):
    return hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1).hex()


class Store:
    def __init__(self, path):
        self.path = str(path)
        with self.connect() as db:
            db.executescript('''
            PRAGMA journal_mode=WAL;
            CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY, value TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, role TEXT NOT NULL, salt TEXT NOT NULL, password TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id TEXT NOT NULL, csrf TEXT NOT NULL, expires REAL NOT NULL);
            CREATE TABLE IF NOT EXISTS payees(id TEXT PRIMARY KEY, data TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS cases(id TEXT PRIMARY KEY, owner TEXT NOT NULL, data TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS oauth(state TEXT PRIMARY KEY, session TEXT NOT NULL, case_id TEXT NOT NULL, expires REAL NOT NULL);
            CREATE TABLE IF NOT EXISTS audit(seq INTEGER PRIMARY KEY, at REAL NOT NULL, case_id TEXT NOT NULL, actor TEXT NOT NULL, event TEXT NOT NULL, data TEXT NOT NULL);
            CREATE TRIGGER IF NOT EXISTS audit_no_update BEFORE UPDATE ON audit BEGIN SELECT RAISE(ABORT, 'audit is append-only'); END;
            CREATE TRIGGER IF NOT EXISTS audit_no_delete BEFORE DELETE ON audit BEGIN SELECT RAISE(ABORT, 'audit is append-only'); END;
            ''')

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=35)
        db.row_factory = sqlite3.Row
        try:
            with db:
                yield db
        finally:
            db.close()

    def metadata(self, key):
        with self.connect() as db:
            row = db.execute('SELECT value FROM metadata WHERE key=?', (key,)).fetchone()
        return row[0] if row else None

    def initialize(self, mode, expected_payer, item_id, amount='0.01', currency='USD'):
        if mode not in ('sandbox', 'demo'):
            raise Denied('Unknown mode')
        with self.connect() as db:
            if db.execute('SELECT 1 FROM metadata').fetchone():
                raise Denied('Database already initialized; existing cases are preserved')
            db.execute('INSERT INTO metadata VALUES (?,?)', ('mode', mode))
            payee = {'id': 'creator', 'name': 'Demo Creator', 'expected_payer_id': expected_payer,
                     'record_source': 'Operator-provided marketplace fixture; replace with your trusted marketplace record',
                     'amount': amount, 'currency': currency}
            db.execute('INSERT INTO payees VALUES (?,?)', ('creator', json.dumps(payee)))
            ids = ['case-001', 'case-002', 'case-003'] if mode == 'demo' else ['case-001']
            for case_id in ids:
                item = item_id if mode == 'sandbox' else 'SIM-' + case_id
                case = {'id': case_id, 'owner': 'creator', 'mode': mode, 'state': 'OPEN',
                        'original_item_id': item, 'amount': amount, 'currency': currency,
                        'paypal_status': 'UNKNOWN', 'reason': None, 'status_checked_at': None,
                        'identity': None, 'proposal': None, 'approval': None, 'replacement': None,
                        'cancellation_error': None, 'version': 0, 'messages': []}
                db.execute('INSERT INTO cases VALUES (?,?,?)', (case_id, 'creator', json.dumps(case)))
        credentials = {}
        for user, role in [('creator', 'recipient'), ('operator', 'operator')]:
            password = secrets.token_urlsafe(18)
            self.add_user(user, role, password)
            credentials[user] = password
        return credentials

    def add_user(self, user, role, password):
        salt = secrets.token_hex(16)
        with self.connect() as db:
            db.execute('INSERT INTO users VALUES (?,?,?,?)', (user, role, salt, password_hash(password, salt)))

    def login(self, user, password):
        with self.connect() as db:
            row = db.execute('SELECT * FROM users WHERE id=?', (user,)).fetchone()
            salt = row['salt'] if row else '00' * 16
            actual = password_hash(password, salt)
            if not row or not hmac.compare_digest(actual, row['password']):
                raise Denied('Invalid username or password')
            token, csrf = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
            db.execute('DELETE FROM sessions WHERE expires<?', (time.time(),))
            db.execute('INSERT INTO sessions VALUES (?,?,?,?)', (self.digest(token), user, csrf, time.time() + 3600 * 8))
        return token

    @staticmethod
    def digest(token):
        return hashlib.sha256(token.encode()).hexdigest()

    def session(self, token):
        with self.connect() as db:
            row = db.execute('SELECT s.*, u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE token=? AND expires>?',
                             (self.digest(token), time.time())).fetchone()
        if not row:
            raise Denied('Sign in to continue')
        return dict(row)

    def logout(self, token):
        with self.connect() as db:
            db.execute('DELETE FROM sessions WHERE token=?', (self.digest(token),))

    def case(self, case_id, actor):
        with self.connect() as db:
            row = db.execute('SELECT * FROM cases WHERE id=?', (case_id,)).fetchone()
        if not row or (actor['role'] != 'operator' and actor['user_id'] != row['owner']):
            raise Denied('Case is not available to this account')
        return json.loads(row['data'])

    def cases(self, actor):
        with self.connect() as db:
            rows = db.execute('SELECT id FROM cases ORDER BY id').fetchall()
        result = []
        for row in rows:
            try:
                result.append(self.case(row['id'], actor))
            except Denied:
                pass
        return result

    def payee(self, owner):
        with self.connect() as db:
            row = db.execute('SELECT data FROM payees WHERE id=?', (owner,)).fetchone()
        if not row:
            raise Denied('No established payee record')
        return json.loads(row[0])

    def save(self, case, actor, event, data):
        with self.connect() as db:
            old_version = case['version']
            case['version'] += 1
            updated = db.execute('UPDATE cases SET data=? WHERE id=? AND json_extract(data,\'$.version\')=?',
                                 (json.dumps(case), case['id'], old_version))
            if updated.rowcount != 1:
                raise Denied('Case changed; reload before continuing')
            db.execute('INSERT INTO audit(at,case_id,actor,event,data) VALUES (?,?,?,?,?)',
                       (time.time(), case['id'], actor['user_id'], event, json.dumps(data)))

    def log(self, case_id, actor, event, data):
        self.case(case_id, actor)
        with self.connect() as db:
            db.execute('INSERT INTO audit(at,case_id,actor,event,data) VALUES (?,?,?,?,?)',
                       (time.time(), case_id, actor['user_id'], event, json.dumps(data)))

    def audit(self, case_id, actor):
        self.case(case_id, actor)
        with self.connect() as db:
            rows = db.execute('SELECT * FROM audit WHERE case_id=? ORDER BY seq', (case_id,)).fetchall()
        return [dict(row) | {'data': json.loads(row['data'])} for row in rows]

    def begin_oauth(self, case_id, actor):
        case = self.case(case_id, actor)
        if actor['role'] != 'recipient' or actor['user_id'] != case['owner']:
            raise Denied('The intended recipient must authenticate the destination')
        state = secrets.token_urlsafe(32)
        with self.connect() as db:
            db.execute('DELETE FROM oauth WHERE expires<? OR (session=? AND case_id=?)',
                       (time.time(), actor['token'], case_id))
            db.execute('INSERT INTO oauth VALUES (?,?,?,?)', (self.digest(state), actor['token'], case_id, time.time() + 600))
        return state

    def consume_oauth(self, state, actor):
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            row = db.execute('SELECT * FROM oauth WHERE state=? AND session=? AND expires>?',
                             (self.digest(state), actor['token'], time.time())).fetchone()
            if not row:
                raise Denied('Invalid, expired or reused PayPal login state')
            db.execute('DELETE FROM oauth WHERE state=?', (self.digest(state),))
        self.case(row['case_id'], actor)
        return row['case_id']
