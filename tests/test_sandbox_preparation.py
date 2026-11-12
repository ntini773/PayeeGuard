import contextlib
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from destination_fixtures import DestinationFixture
from rescue.destination_admin import main
from rescue.destination_errors import DestinationError
from rescue.app import Application
from rescue.destination_demo import seed_six
from rescue.store import Store
from rescue.workflow import DemoPayPal
from test_app import AppTest
request_handler = AppTest.request
del AppTest
import test_workflow as fixture


class EarningCLITest(DestinationFixture, unittest.TestCase):
    def test_cli_idempotent_masked_and_unknown_payee_rejected(self):
        with self.ds.connect() as db:
            db.execute('INSERT INTO metadata VALUES (?,?)', ('mode', 'sandbox'))
        args = ['admin', '--database', self.identity.path, '--mode', 'sandbox', 'earning',
                '--tenant', 't1', '--seller', 's1', '--earning-id', 'private-earning-1234']
        output = io.StringIO()
        with patch('sys.argv', args), contextlib.redirect_stdout(output):
            main()
            main()
        self.assertNotIn('private-earning', output.getvalue())
        self.assertIn('***1234', output.getvalue())
        with self.ds.connect() as db:
            self.assertEqual(db.execute('SELECT count(*) FROM pg_earnings').fetchone()[0], 1)
        args[args.index('s1')] = 'missing'
        with patch('sys.argv', args), self.assertRaises(DestinationError):
            main()

    def test_sandbox_earning_amount_is_usd_within_the_ceiling(self):
        with self.ds.connect() as db:
            db.execute('INSERT INTO metadata VALUES (?,?)', ('mode', 'sandbox'))
        base = ['admin', '--database', self.identity.path, '--mode', 'sandbox', 'earning', '--tenant', 't1', '--seller', 's1']
        for index, (amount, currency, allowed) in enumerate([('100.00', 'USD', True), ('1000.00', 'USD', True), ('0.01', 'USD', True),
                ('1000.01', 'USD', False), ('0', 'USD', False), ('-5', 'USD', False), ('10.005', 'USD', False),
                ('abc', 'USD', False), ('100.00', 'EUR', False)]):
            args = base + ['--earning-id', 'amount-test-%d' % index, '--amount', amount, '--currency', currency]
            with patch('sys.argv', args), contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                if allowed:
                    main()
                else:
                    with self.assertRaises(SystemExit, msg=amount + currency):
                        main()
        with self.ds.connect() as db:
            self.assertEqual(db.execute('SELECT count(*) FROM pg_earnings').fetchone()[0], 3)

    def test_dotenv_one_second_cooling_honoured_by_sandbox_application(self):
        with self.ds.connect() as db:
            db.execute('INSERT INTO metadata VALUES (?,?)', ('mode', 'sandbox'))
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / '.env').write_text('RESCUE_COOLING_SECONDS=1\n')
            with patch('rescue.config.ROOT', root), patch.dict('os.environ', {}, clear=True):
                app = Application(self.identity, object(), model=object())
            self.assertEqual(app.destinations.policy.mode, 'sandbox')
            self.assertEqual(app.destinations.policy.cooling_seconds, 1)


class SeedRegressionTest(unittest.TestCase):
    def test_configured_seed_cooling_survives_first_read_and_summary_handles_missing_at(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / 'runtime'
            cfg = {'RESCUE_COOLING_SECONDS': '600'}
            with patch('rescue.destination_demo.settings', return_value=cfg), patch('rescue.app.settings', return_value=cfg):
                seed_six(root)
                identity = Store(root / 'app-demo.sqlite3')
                credentials = json.loads((root / 'demo-accounts.json').read_text())
                token = identity.login('operator', credentials['operator'])
                app = Application(identity, DemoPayPal(), fixture=True)
                cases = app.destinations.operator_cases(token)
                cooling = next(c for c in cases if c['state'] == 'APPROVED_COOLING_OFF')
                status, summary = app.destination_api.handle('GET', '/api/v1/destination-change-requests/' + cooling['case_id'] + '/summary', token)
                self.assertEqual(status, 200)
                evidence = summary['marketplace_evidence'][0]
                self.assertIsNotNone(evidence['at'])
                self.assertEqual(evidence['verifier'], 'operator')
                with identity.connect() as db:
                    p = app.destinations.store.principal(token)
                    case = app.destinations.store.case(db, p, cooling['case_id'])
                    case['recovery_evidence'][0].pop('at')
                    app.destinations.store.save(db, p, case, case['version'])
                status, summary = app.destination_api.handle('GET', '/api/v1/destination-change-requests/' + cooling['case_id'] + '/summary', token)
                self.assertEqual(status, 200)
                self.assertIsNone(summary['marketplace_evidence'][0]['at'])


class SPARegressionTest(unittest.TestCase):
    setUp = fixture.WorkflowTest.setUp
    tearDown = fixture.WorkflowTest.tearDown
    request = request_handler

    def test_built_spa_assets_fallback_api_boundary_and_csp(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'index.html').write_text('<html>Built UI</html>')
            (root / 'assets').mkdir()
            (root / 'assets/app.js').write_text('export const built = true;')
            with patch('rescue.app.UI_DIST', root):
                for route in ('/', '/cases/example'):
                    code, headers, body = self.request('GET', route)
                    self.assertEqual(code, 200)
                    self.assertIn(b'Built UI', body)
                    self.assertIn('https://fonts.googleapis.com', headers['Content-Security-Policy'])
                    self.assertIn('https://fonts.gstatic.com', headers['Content-Security-Policy'])
                    self.assertIn("script-src 'self'", headers['Content-Security-Policy'])
                code, headers, _ = self.request('GET', '/assets/app.js')
                self.assertEqual(code, 200)
                self.assertEqual(headers['Content-Type'], 'text/javascript')
                self.assertEqual(self.request('GET', '/assets/missing.js')[0], 404)
                self.assertEqual(self.request('GET', '/%2e%2e/.env')[0], 404)
                self.assertEqual(self.request('GET', '/api/v1/cases')[0], 401)
                self.assertEqual(self.request('GET', '/callback')[0], 403)
            with patch('rescue.app.UI_DIST', root / 'missing'):
                self.assertEqual(self.request('GET', '/')[0], 200)
