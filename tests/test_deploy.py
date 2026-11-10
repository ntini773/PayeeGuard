import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from deploy.start import main


class DeployTest(unittest.TestCase):
    def test_existing_storage_is_not_reinitialized(self):
        with tempfile.TemporaryDirectory() as directory:
            database = Path(directory) / 'app-sandbox.sqlite3'
            database.write_bytes(b'existing-state')
            with patch.dict(os.environ, {'RESCUE_RUNTIME_DIR':directory,
                    'RESCUE_PUBLIC_ORIGIN':'https://claimpal.example'}, clear=True), \
                    patch('deploy.start.subprocess.run') as run, patch('deploy.start.os.execv') as execute:
                main()
                run.assert_not_called()
                self.assertEqual(database.read_bytes(), b'existing-state')
                self.assertEqual(execute.call_args.args[1][-4:], ['--mode','sandbox','--ai','nvidia'])

    def test_fresh_sandbox_requires_explicit_trusted_fixture(self):
        with tempfile.TemporaryDirectory() as directory:
            config = {'RESCUE_RUNTIME_DIR':directory, 'RESCUE_PUBLIC_ORIGIN':'https://claimpal.example'}
            with patch.dict(os.environ, config, clear=True), \
                    patch('deploy.start.subprocess.run') as run, patch('deploy.start.os.execv'):
                with self.assertRaises(SystemExit):
                    main()
                run.assert_not_called()
                os.environ.update(RESCUE_ITEM_ID='TEST-ITEM', RESCUE_EXPECTED_PAYER_ID='TEST-PAYER',
                                  RESCUE_AMOUNT='0.01', RESCUE_CURRENCY='USD')
                main()
                self.assertIn('TEST-ITEM', run.call_args.args[0])
                self.assertIn('TEST-PAYER', run.call_args.args[0])
