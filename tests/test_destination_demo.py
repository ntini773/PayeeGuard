import json
from pathlib import Path
import tempfile
import unittest
from rescue.destination_demo import seed
from rescue.app import Application
from rescue.store import Store
from rescue.workflow import DemoPayPal


class DemoTest(unittest.TestCase):
    def test_seed_real_application_wires_durable_gate_and_does_not_overwrite(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / 'new-demo'
            result = seed(root)
            credentials = json.loads((root / 'demo-accounts.json').read_text())
            store = Store(root / 'app-demo.sqlite3')
            app = Application(store, DemoPayPal(), fixture=True)
            token = store.login('operator', credentials['operator'])
            case = app.destinations.list_cases(token)[0]
            self.assertEqual(case['case_id'], result['case_id'])
            self.assertTrue(case['simulation'])
            self.assertEqual(case['authentication']['new_account']['verified_by'], 'DEMO_SIMULATION')
            self.assertFalse(case['payout_control']['proposed_destination_usable'])
            status, response = app.destination_api.handle('POST', '/api/v1/marketplace-payouts/demo-earning-1/execute', token, {})
            self.assertEqual(status, 200)
            self.assertEqual(response['operation']['provider_status'], 'SUCCESS')
            self.assertTrue(response['operation']['simulation'])
            # Restart the application with the same storage: never dispatch twice.
            restarted = Application(Store(root / 'app-demo.sqlite3'), DemoPayPal(), fixture=True)
            repeated = restarted.payouts.execute(token, 'demo-earning-1')
            self.assertEqual(repeated['sender_batch_id'], response['operation']['sender_batch_id'])
            with self.assertRaises(FileExistsError):
                seed(root)
            self.assertEqual(json.loads((root / 'demo-accounts.json').read_text()), credentials)
