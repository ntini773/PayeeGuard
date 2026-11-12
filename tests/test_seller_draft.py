import unittest
from rescue.seller_guide import CATEGORIES, draft_request


class Fake:
    def __init__(self, text=None, boom=False):
        self.text, self.boom = text, boom

    def invoke(self, messages):
        if self.boom:
            raise RuntimeError('down')
        return type('R', (), {'content': self.text})()


HISTORY = [{'role': 'assistant', 'text': 'What is the main reason?'}, {'role': 'user', 'text': 'I opened a new PayPal account for my shop'},
           {'role': 'assistant', 'text': 'Thanks.'}, {'role': 'user', 'text': 'I want my payouts to go there'}]


class SellerDraftTest(unittest.TestCase):
    def test_model_draft_is_validated_and_used(self):
        r = draft_request(HISTORY, Fake('{"reason_text": "I opened a new PayPal account for my shop and want payouts there.", "reason_category": "new_paypal_account"}'))
        self.assertEqual((r['source'], r['reason_category']), ('ai', 'new_paypal_account'))

    def test_bad_model_output_falls_back_to_the_sellers_own_words(self):
        for bad in ('not json', '{"reason_text": "x", "reason_category": "hack"}', '{"reason_text": "long enough text here", "reason_category": "admin"}'):
            r = draft_request(HISTORY, Fake(bad))
            self.assertEqual(r['source'], 'scripted')
            self.assertIn('new PayPal account', r['reason_text'])
            self.assertIn(r['reason_category'], CATEGORIES)

    def test_model_down_and_ids_are_removed(self):
        r = draft_request([{'role': 'user', 'text': 'my payer id is ABCDEFGH12345 and I lost access'}], Fake(boom=True))
        self.assertNotIn('ABCDEFGH12345', r['reason_text'])
        self.assertEqual(r['reason_category'], 'lost_access')

    def test_bad_history_is_refused(self):
        for bad in ([], [{'role': 'assistant', 'text': 'hi'}], 'x'):
            with self.assertRaises(ValueError):
                draft_request(bad, Fake('{}'))


if __name__ == '__main__':
    unittest.main()
