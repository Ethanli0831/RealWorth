import importlib.util
from pathlib import Path
import unittest
from datetime import datetime,timezone
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('structure',Path(__file__).resolve().parents[1]/'scripts/build_structure.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class Structure(unittest.TestCase):
 def test_holdings_date_not_fetch_date_and_quantity_not_aum(self):
  csv='Fund Holdings as of,"Oct 23, 2026"\nTicker,Name,Market Value,Quantity\nBTC,BITCOIN,9999999,"1,234.50"\n'
  p=m.parse_holdings(csv,'BTC');self.assertEqual(p,{'date':'2026-10-23','value':1234.5})
  with self.assertRaises(StopIteration):m.parse_holdings('Ticker,Quantity\nBTC,42','BTC')
 def test_gld_tonnes_are_not_price_or_aum(self):
  rows=m.parse_gld('Date,GLD Close,Total Net Asset Value,Tonnes in Trust\n23-Oct-2026,300,9999999,1000\n22-Oct-2026,290,9999998,1001\n')
  self.assertEqual(rows[-1]['value'],1000)
  self.assertEqual(rows[0]['value'],1001)
 def test_insufficient_history_cannot_be_presented_as_year_percentile(self):
  self.assertIsNone(m.empirical_rank([{'date':'2026-10-23','value':100}]*260))
 def test_partial_source_failure_retains_dates_without_zero_or_new_success_time(self):
  now=datetime(2026,10,25,tzinfo=timezone.utc)
  previous={'indicators':[{'id':'ibit','unit':'BTC','history':[{'date':'2026-10-20','value':123}],'last_success':'2026-10-20'}]}
  with patch.object(m,'tasks',return_value=[(tuple(m.SOURCES),lambda: (_ for _ in ()).throw(RuntimeError('offline')))]):
   d=m.build(previous,now)
  r=d['indicators'][0];self.assertEqual(r['value'],123);self.assertEqual(r['period'],'2026-10-20');self.assertEqual(r['last_success'],'2026-10-20')
  self.assertIsNone(d['indicators'][1]['value'])

 def test_quoted_gld_header_and_fund_footer_are_not_data(self):
  rows=m.parse_gld('"Date","GLD Close","Tonnes in Trust"\n"23-Oct-2026","300","1000"\nCopyright,unrelated,fields,extra\n')
  self.assertEqual(rows[-1]['value'],1000)
  text='Fund Holdings as of,"Oct 23, 2026"\nTicker,Quantity\nBTC,"1,234"\nFooter,with,extra,fields\n'
  self.assertEqual(m.parse_holdings(text,'BTC')['value'],1234)
 def test_headerless_cftc_uses_managed_money_not_producer_positions(self):
  r=['']*60;r[0]='GOLD - COMMODITY EXCHANGE INC.';r[2]='2026-10-20';r[7]='1000';r[8]='800';r[9]='100';r[13]='300';r[14]='250'
  self.assertEqual(m.parse_cot(','.join(r))['value'],50)
  r[13]='2000'
  with self.assertRaises(ValueError):m.parse_cot(','.join(r))
