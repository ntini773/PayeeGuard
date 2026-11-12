import io
import json
import unittest
from rescue.dashboard_llm import LlmError, clean, forward


class FakeResponse(io.BytesIO):
    def __enter__(self): return self
    def __exit__(self, *a): return False


class DashboardLlmTest(unittest.TestCase):
    base = {'messages': [{'role': 'user', 'content': 'add a chart'}],
            'tools': [{'type': 'function', 'function': {'name': 'add_widget', 'description': 'd', 'parameters': {'type': 'object'}}}], 'tool_choice': 'auto'}

    def test_rebuilds_only_known_fields_and_forwards(self):
        seen = {}
        def opener(req, timeout=0):
            seen['body'] = json.loads(req.data); seen['auth'] = req.get_header('Authorization')
            return FakeResponse(json.dumps({'choices': [{'message': {'content': 'ok', 'tool_calls': [
                {'id': 'c1', 'function': {'name': 'add_widget', 'arguments': '{"a":1}'}}]}}]}).encode())
        out = forward(self.base, 'nvapi-secret', 'model-x', opener)
        self.assertEqual(out['message']['tool_calls'][0]['name'], 'add_widget')
        self.assertEqual(seen['body']['model'], 'model-x')
        self.assertEqual(seen['body']['temperature'], 0)
        self.assertNotIn('nvapi-secret', json.dumps(out))

    def test_bad_input_is_refused(self):
        for bad in ({'messages': []}, {'messages': [{'role': 'root', 'content': 'x'}]}, {'messages': self.base['messages'], 'extra': 1},
                    {'messages': self.base['messages'], 'tools': [{'function': {'name': 'rm -rf /', 'parameters': {}}}]},
                    {'messages': [{'role': 'user', 'content': 'x' * 250_000}]}, 'nope', None):
            with self.assertRaises(LlmError):
                clean(bad)

    def test_provider_failure_does_not_leak_details(self):
        def boom(req, timeout=0): raise OSError('secret host detail')
        with self.assertRaises(LlmError) as ctx:
            forward(self.base, 'k', 'm', boom)
        self.assertNotIn('secret', str(ctx.exception))


if __name__ == '__main__':
    unittest.main()
