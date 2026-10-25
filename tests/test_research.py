import importlib.util
import json
from datetime import datetime, timezone
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('research_builder', ROOT / 'scripts/build_research.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
NOW = datetime(2026, 10, 17, 12, tzinfo=timezone.utc)
MECHANISMS = json.loads((ROOT / 'research/mechanisms.json').read_text())
FEED = {'id': 'test', 'name': 'Test Publisher', 'kind': 'Publisher headline'}


class NewsEvidence(unittest.TestCase):
    def test_publisher_title_dates_and_safe_links_are_required(self):
        xml = '''<rss><channel>
        <item><title>Fed interest rate decision</title><link>https://example.org/a?utm_source=x</link><pubDate>Sat, 17 Oct 2026 10:00:00 GMT</pubDate></item>
        <item><title>Bitcoin scam</title><link>javascript:alert(1)</link><pubDate>Sat, 17 Oct 2026 10:00:00 GMT</pubDate></item>
        <item><title>Gold ancient story</title><link>https://example.org/old</link><pubDate>Tue, 01 Sep 2026 10:00:00 GMT</pubDate></item>
        <item><title>Inflation later</title><link>https://example.org/future</link><pubDate>Sun, 18 Oct 2026 10:00:00 GMT</pubDate></item>
        <item><title>Ordinary arts review</title><link>https://example.org/arts</link><pubDate>Sat, 17 Oct 2026 10:00:00 GMT</pubDate></item>
        </channel></rss>'''
        items = m.parse_feed(xml, FEED, MECHANISMS, NOW)
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]['url'], 'https://example.org/a')
        self.assertEqual(items[0]['topics'], ['policy'])
        self.assertIn('not been independently verified', items[0]['evidence'])

    def test_nuclear_gold_and_bitcoin_are_separate_mechanisms(self):
        tags = m.classify('CERN turns lead to gold by nuclear transmutation: Bitcoin debate', MECHANISMS)
        self.assertIn('transmutation', tags)
        self.assertIn('crypto', tags)
        self.assertNotIn('transmutation', m.classify('Goldman invests in artificial intelligence', MECHANISMS))

    def test_atom_supported_and_entities_rejected(self):
        atom = '<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Gold demand</title><link href="https://example.org/gold"/><updated>2026-10-17T10:00:00Z</updated></entry></feed>'
        self.assertEqual(m.parse_feed(atom, FEED, MECHANISMS, NOW)[0]['url'], 'https://example.org/gold')
        with self.assertRaises(ValueError):
            m.parse_feed('<!DOCTYPE rss><rss/>', FEED, MECHANISMS, NOW)
        with self.assertRaises(ValueError):
            m.parse_feed('<html>not a feed</html>', FEED, MECHANISMS, NOW)

    def test_ambiguous_jobs_and_war_can_abstain(self):
        for title in ["Civil servant worked five jobs and is charged with fraud", "Is an 'AI war' complicating your job search?", "A football star wins a gold medal"]:
            self.assertEqual(m.classify(title, MECHANISMS), [])
        self.assertIn('growth',m.classify('US payrolls fall as unemployment climbs',MECHANISMS))
        self.assertIn('energy',m.classify('Oil supplies disrupted by attacks in Hormuz',MECHANISMS))
        self.assertEqual(m.relevance('Barclays cuts 200 jobs',[])['status'],'No clear macro impact')

    def test_same_employer_layoff_reports_merge_without_merging_other_banks(self):
        def item(title,url):
            return {'title':title,'url':url,'published_at':'2026-10-17T10:00:00Z','publisher':'Outlet','topics':['growth']}
        result=m.group_events([item('Barclays to cut 200 jobs','https://a.org/1'),item('Barclays cuts investment banking jobs','https://b.org/2'),item('HSBC cuts jobs','https://c.org/3')])
        self.assertEqual(len(result),2)
        self.assertEqual(len(result[0]['related_reports']),2)
        self.assertEqual(result[0]['topics'],[])
        # Cached clusters retain all attribution links when processed again.
        self.assertEqual(len(m.group_events(result)[0]['related_reports']),2)


class MacroEvidence(unittest.TestCase):
    def test_growth_inflation_weather_and_credit_stress_are_distinct(self):
        raw = {
            'GDPC1': pd.Series([100, 101, 102, 103, 104, 108], index=pd.date_range('2025-01-01', periods=6, freq='QS')),
            'CPIAUCSL': pd.Series([100 * 1.001 ** n * (1.008 ** max(0, n - 29)) for n in range(36)], index=pd.date_range('2023-10-01', periods=36, freq='MS')),
            'FEDFUNDS': pd.Series([3, 3, 3.25, 3.5], index=pd.date_range('2026-06-01', periods=4, freq='MS')),
            'UNRATE': pd.Series([4.] * 24, index=pd.date_range('2024-10-01', periods=24, freq='MS')),
            'BAMLH0A0HYM2': pd.Series([3.], index=pd.to_datetime(['2026-10-15'])),
        }
        result = m.macro_signals(raw, NOW, [])
        self.assertEqual(result['weather'], 'Growth improving · inflation rising')
        self.assertEqual(result['short_cycle'], 'Improving growth with tighter policy')
        raw['UNRATE'].loc['2025-10-01'] = float('nan')
        partial = m.macro_signals(raw, NOW, [])
        self.assertIn('labour baseline unavailable', partial['short_cycle'])
        raw['BAMLH0A0HYM2'].iloc[-1] = 5
        stressed = m.macro_signals(raw, NOW, [])
        self.assertEqual(stressed['weather'], result['weather'])
        self.assertEqual(stressed['short_cycle'], 'Debt-stress signals require investigation')
        self.assertEqual(len(stressed['pressure_flags']), 1)

    def test_missing_current_prior_year_cpi_remains_unknown(self):
        cpi = pd.Series(range(100, 124), index=pd.date_range('2024-11-01', periods=24, freq='MS'), dtype=float)
        cpi.loc['2025-10-01'] = float('nan')
        result = m.macro_signals({'CPIAUCSL': cpi.dropna()}, datetime(2026, 11, 10, tzinfo=timezone.utc), [])
        self.assertIsNone(result['indicators'][1]['value'])
        self.assertEqual(result['inflation_direction'], 'Unknown')
        self.assertEqual(result['short_cycle'], 'Incomplete short-cycle evidence')

    def test_stale_series_cannot_assign_current_weather(self):
        gdp = pd.Series([100, 101, 102, 103, 104, 106], index=pd.date_range('2022-01-01', periods=6, freq='QS'))
        result = m.macro_signals({'GDPC1': gdp}, NOW, [])
        self.assertTrue(result['indicators'][0]['stale'])
        self.assertEqual(result['growth_direction'], 'Unknown')
        self.assertIn('Not identified', result['long_cycle'])

    def test_no_fred_forward_fill_and_duplicate_dates_rejected(self):
        text = 'observation_date,CPIAUCSL\n2026-08-01,100\n2026-09-01,.\n'
        result = m.parse_fred(text, 'CPIAUCSL', NOW)
        self.assertEqual(str(result.index[-1].date()), '2026-08-01')
        with self.assertRaises(ValueError):
            m.parse_fred(text + '2026-08-01,101\n', 'CPIAUCSL', NOW)

    def test_atomic_writer_retains_existing_file_on_invalid_payload(self):
        with tempfile.TemporaryDirectory() as d:
            target = Path(d) / 'research.json'
            target.write_text('{"old":true}')
            with self.assertRaises(ValueError):
                m.write_atomic({'bad': float('nan')}, target)
            self.assertEqual(target.read_text(), '{"old":true}')

    def test_all_source_failure_keeps_previous_payload(self):
        with patch.object(m, 'download', side_effect=RuntimeError('offline')):
            with self.assertRaisesRegex(RuntimeError, 'All macro and news sources failed'):
                m.build({}, NOW)


if __name__ == '__main__':
    unittest.main()
