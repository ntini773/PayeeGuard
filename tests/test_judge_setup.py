import json
import os
import stat
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from rescue import judge_setup
from rescue.store import Store, Denied

PAYER = 'PAYERAAAAAAAAA1'


class JudgeSetupTests(unittest.TestCase):
    def run_setup(self, directory, env, **kw):
        with mock.patch.dict(os.environ, env, clear=False):
            return judge_setup.provision(directory, PAYER, 'Test Seller', 'US', **kw)

    def test_deployment_uses_given_passwords_and_never_regenerates(self):
        env = {'JUDGE_SELLER_PASSWORD': 'seller-password-123', 'JUDGE_OPERATOR_PASSWORD': 'operator-password-123'}
        with tempfile.TemporaryDirectory() as tmp:
            first = self.run_setup(tmp, env, require_passwords=True)
            self.assertEqual(first['users'], {'operator': 'CREATED', 'operator_stolen': 'CREATED', 'seller': 'CREATED', 'seller_stolen': 'CREATED'})
            self.assertEqual(set(first['sellers'].values()), {'CREATED'})
            self.assertNotIn('password', json.dumps(first).lower().replace('generated_passwords', ''))
            store = Store(Path(tmp) / 'app-sandbox.sqlite3')
            for user, password in (('seller', 'seller-password-123'), ('seller_stolen', 'seller-password-123'), ('operator', 'operator-password-123'), ('operator_stolen', 'operator-password-123')):
                self.assertTrue(store.login(user, password))
            # A restart with different environment values must not change anything.
            second = self.run_setup(tmp, {'JUDGE_SELLER_PASSWORD': 'something-else-1234', 'JUDGE_OPERATOR_PASSWORD': 'another-one-12345'}, require_passwords=True)
            self.assertEqual(set(second['users'].values()), {'EXISTS (unchanged)'})
            self.assertEqual(set(second['sellers'].values()), {'EXISTS (unchanged)'})
            self.assertTrue(store.login('seller', 'seller-password-123'))
            with self.assertRaises(Denied):
                store.login('seller', 'something-else-1234')
            self.assertFalse((Path(tmp) / 'judge-accounts.json').exists())

    def test_deployment_stops_when_a_password_is_missing(self):
        with tempfile.TemporaryDirectory() as tmp, mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop('JUDGE_SELLER_PASSWORD', None)
            os.environ.pop('JUDGE_OPERATOR_PASSWORD', None)
            with self.assertRaises(SystemExit):
                judge_setup.provision(tmp, PAYER, 'Test Seller', 'US', require_passwords=True)

    def test_local_run_generates_once_and_saves_privately(self):
        with tempfile.TemporaryDirectory() as tmp, mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop('JUDGE_SELLER_PASSWORD', None)
            os.environ.pop('JUDGE_OPERATOR_PASSWORD', None)
            result = judge_setup.provision(tmp, PAYER, 'Test Seller', 'US')
            target = Path(tmp) / 'judge-accounts.json'
            self.assertEqual(stat.S_IMODE(target.stat().st_mode), 0o600)
            accounts = json.loads(target.read_text())
            self.assertNotIn(accounts['seller'], json.dumps(result))
            store = Store(Path(tmp) / 'app-sandbox.sqlite3')
            self.assertTrue(store.login('seller', accounts['seller']))
            self.assertTrue(store.login('operator', accounts['operator']))
            judge_setup.provision(tmp, PAYER, 'Test Seller', 'US')
            self.assertEqual(json.loads(target.read_text()), accounts)

    def test_short_password_and_bad_payer_are_refused(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(SystemExit):
                self.run_setup(tmp, {'JUDGE_SELLER_PASSWORD': 'short', 'JUDGE_OPERATOR_PASSWORD': 'operator-password-123'})
            with self.assertRaises(SystemExit):
                judge_setup.provision(tmp, 'bad id!', 'x', 'US')


if __name__ == '__main__':
    unittest.main()
