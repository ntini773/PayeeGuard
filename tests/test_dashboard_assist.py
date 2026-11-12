import unittest
from rescue.dashboard_assist import CATALOGS, DAY_WINDOWS, keyword_pick, parse_days, pick_view


class Fake:
    def __init__(self, text=None, boom=False):
        self.text, self.boom = text, boom

    def invoke(self, messages):
        if self.boom:
            raise RuntimeError('down')
        return type('R', (), {'content': self.text})()


class DashboardAssistTest(unittest.TestCase):
    def test_router_choice_is_used_when_checker_agrees(self):
        r = pick_view('how many rejections this month?', 'care', Fake('rejections_by_week'), Fake('YES'))
        self.assertEqual((r['view'], r['source'], r['verified']), ('rejections_by_week', 'ai', True))

    def test_checker_no_refuses_instead_of_showing_a_wrong_chart(self):
        r = pick_view('what is the weather', 'care', Fake('cases_by_status'), Fake('NO'))
        self.assertIsNone(r['view'])
        self.assertTrue(r['suggestions'])

    def test_checker_no_does_not_veto_a_question_whose_words_match_the_view(self):
        r = pick_view('how many requests were rejected this month?', 'care', Fake('rejections_by_week'), Fake('NO'))
        self.assertEqual((r['view'], r['verified']), ('rejections_by_week', False))

    def test_off_menu_router_output_falls_back_to_keywords(self):
        for text in ('DROP TABLE cases', 'I think you want a pie chart of everything'):
            r = pick_view('show risk flags by device', 'care', Fake(text), Fake('YES'))
            self.assertEqual((r['view'], r['source'], r['verified']), ('flags_by_type', 'rules', False))

    def test_models_down_still_answers(self):
        r = pick_view('seller income please', 'care', Fake(boom=True), Fake(boom=True))
        self.assertEqual((r['view'], r['source']), ('income_trend', 'rules'))

    def test_checker_down_keeps_the_pick_but_unverified(self):
        r = pick_view('rejections', 'care', Fake('rejections_by_week'), Fake(boom=True))
        self.assertEqual((r['view'], r['verified']), ('rejections_by_week', False))

    def test_days_are_parsed_by_code_not_by_the_model(self):
        self.assertEqual(parse_days('show earnings only last 2 days'), 2)
        self.assertEqual(parse_days('earnings yesterday'), 2)
        self.assertEqual(parse_days('last 4 days'), 5)       # rounded up to a window we have
        self.assertEqual(parse_days('last 400 days'), DAY_WINDOWS[-1])
        self.assertEqual(parse_days('my earnings'), 7)
        r = pick_view('Show me new dashboards in my earnings with only last 2 days', 'seller', Fake('earnings_by_day'), Fake('YES'))
        self.assertEqual((r['view'], r['days']), ('earnings_by_day', 2))
        self.assertIn('last 2 days', r['title'])

    def test_flag_views_take_one_to_seven_days(self):
        r = pick_view('flags in last 4 days', 'care', Fake('flags_by_type'), Fake('YES'))
        self.assertEqual((r['view'], r['days']), ('flags_by_type', 4))
        self.assertIn('last 4 days', r['title'])
        self.assertEqual(pick_view('escalations last 30 days', 'care', Fake('escalations'), Fake('YES'))['days'], 7)

    def test_scopes_do_not_leak_views(self):
        r = pick_view('anything', 'seller', Fake('flags_by_type'), Fake('YES'))   # a care-only id from the seller scope
        self.assertIn(r['view'], CATALOGS['seller'])

    def test_bad_input_is_refused(self):
        self.assertIn(keyword_pick('zzz', 'care'), CATALOGS['care'])
        for bad in ('', 'ab', 'x' * 201, 5, None):
            with self.assertRaises(ValueError):
                pick_view(bad, 'care', Fake('escalations'), Fake('YES'))
        with self.assertRaises(ValueError):
            pick_view('hello there', 'admin', Fake('x'), Fake('YES'))


if __name__ == '__main__':
    unittest.main()
