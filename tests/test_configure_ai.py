from pathlib import Path
import tempfile
import unittest
from rescue.configure_ai import save_key


class ConfigureAITest(unittest.TestCase):
    def test_preserves_paypal_values_and_replaces_only_nvidia_key_privately(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / '.env'
            path.write_text('# private settings\nPAYPAL_CLIENT_ID=fixture-app\nPAYPAL_CLIENT_SECRET=fixture-secret\nNVIDIA_API_KEY=old-fixture\n')
            save_key(path, 'new-fixture-key')
            self.assertEqual(path.read_text(), '# private settings\nPAYPAL_CLIENT_ID=fixture-app\nPAYPAL_CLIENT_SECRET=fixture-secret\nNVIDIA_API_KEY=new-fixture-key\n')
            self.assertEqual(path.stat().st_mode & 0o777, 0o600)

    def test_invalid_key_does_not_modify_existing_config(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / '.env'
            path.write_text('PAYPAL_CLIENT_ID=fixture\n')
            for key in ('', 'two lines\n', 'quoted"value'):
                with self.assertRaises(ValueError):
                    save_key(path, key)
            self.assertEqual(path.read_text(), 'PAYPAL_CLIENT_ID=fixture\n')
