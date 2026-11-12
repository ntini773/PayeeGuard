import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from deploy.start import main

BASE = {'RESCUE_PUBLIC_ORIGIN': 'https://payeeguard.example', 'NVIDIA_API_KEY': 'k', 'PAYPAL_CLIENT_ID': 'i', 'PAYPAL_CLIENT_SECRET': 's'}


class DeployTest(unittest.TestCase):
    def test_existing_storage_is_never_touched_or_reprovisioned(self):
        with tempfile.TemporaryDirectory() as directory:
            database = Path(directory) / 'app-sandbox.sqlite3'
            database.write_bytes(b'existing-state')
            with patch.dict(os.environ, dict(BASE, RESCUE_RUNTIME_DIR=directory), clear=True), \
                    patch('rescue.judge_setup.provision') as provision, patch('deploy.start.os.execv') as execute:
                main()
                provision.assert_not_called()
                self.assertEqual(database.read_bytes(), b'existing-state')
                self.assertEqual(execute.call_args.args[1][-6:-2], ['--mode', 'sandbox', '--ai', 'nvidia'])

    def test_first_start_needs_judge_variables_and_never_generates_passwords(self):
        with tempfile.TemporaryDirectory() as directory:
            config = dict(BASE, RESCUE_RUNTIME_DIR=directory)
            with patch.dict(os.environ, config, clear=True), patch('deploy.start.os.execv'):
                with self.assertRaises(SystemExit):   # no payer ID, no passwords
                    main()
            self.assertFalse((Path(directory) / 'judge-accounts.json').exists())
            config.update(JUDGE_ACTIVE_PAYER_ID='PAYERAAAAAAAAA1', JUDGE_SELLER_PASSWORD='seller-password-123',
                          JUDGE_OPERATOR_PASSWORD='operator-password-123', JUDGE_SELLER_LEGAL_NAME='Test Seller', JUDGE_SELLER_COUNTRY='US')
            with patch.dict(os.environ, config, clear=True), patch('deploy.start.os.execv') as execute:
                main()
                self.assertTrue((Path(directory) / 'app-sandbox.sqlite3').exists())
                execute.assert_called_once()
                self.assertFalse((Path(directory) / 'judge-accounts.json').exists())

    def test_requires_https_origin_and_keys(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.dict(os.environ, {'RESCUE_RUNTIME_DIR': directory, 'RESCUE_PUBLIC_ORIGIN': 'http://x'}, clear=True):
                with self.assertRaises(SystemExit):
                    main()
            with patch.dict(os.environ, {'RESCUE_RUNTIME_DIR': directory, 'RESCUE_PUBLIC_ORIGIN': 'https://x'}, clear=True):
                with self.assertRaises(SystemExit):
                    main()
