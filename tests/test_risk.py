import copy
from datetime import datetime, timedelta, timezone
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
spec=importlib.util.spec_from_file_location('risk_builder',ROOT/'scripts/build_risk.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
NOW=datetime(2026,11,7,12,tzinfo=timezone.utc)
FRAME=json.loads((ROOT/'research/risk-framework.json').read_text())
HEALTH=[{'id':'fomc','url':m.CALENDARS['fomc'],'status':'Unavailable; dates not assumed','last_success':None,'attempted_at':m.stamp(NOW),'events':[],'stale':True}]


def research(title='US lawmakers propose restrictions on AI data centers'):
 return {'meta':{'checked_at':m.stamp(NOW)},'feed_health':[], 'news':[{'title':title,'url':'https://www.theguardian.com/technology/example','publisher':'Example publisher','published_at':m.stamp(NOW-timedelta(hours=3))}]}


class EventRisk(unittest.TestCase):
 def test_sensitive_headlines_are_routed_without_metaphorical_war(self):
  for title in ["Is an AI war complicating your job search?",'A football player wins a gold medal',"'I've taken an extra job to pay for heating oil'"]:
   self.assertEqual(m.topics(title,FRAME),[])
  self.assertIn('elections',[c['id'] for c in m.topics('US midterm elections may change tax policy',FRAME)])
  self.assertIn('ai_economics',[c['id'] for c in m.topics('AI capital spending rises but revenue growth slows',FRAME)])
  self.assertIn('trade',[c['id'] for c in m.topics('Chip export controls threaten supplier orders',FRAME)])

 def test_proposals_and_party_labels_do_not_become_verified_law(self):
  p,_=m.build(research(),{}, {},FRAME,HEALTH,NOW)
  e=p['events'][0]
  self.assertIn('Proposal',e['stage']);self.assertIsNone(e['legal_effective_at'])
  self.assertIn('not independently verified',e['evidence'])
  self.assertNotIn('probability',e)
  self.assertEqual(m.stage('Democrats win US midterm elections'),'Reported development; implementation and legal status unverified')
  self.assertEqual(m.stage('Republicans win US midterm elections'),'Reported development; implementation and legal status unverified')

 def test_treasury_bill_proxy_is_not_assumed_immune_to_specific_default_risk(self):
  p,_=m.build(research('US Treasury default risk rises in debt ceiling dispute'),{}, {},FRAME,HEALTH,NOW)
  self.assertIn('BIL',p['events'][0]['tickers'])

 def test_first_observation_is_not_backdated_and_old_records_stay_frozen(self):
  p,l=m.build(research(),{}, {},FRAME,HEALTH,NOW)
  first=copy.deepcopy(l['records'])
  self.assertEqual(first[0]['first_observed_at'],m.stamp(NOW))
  self.assertNotEqual(first[0]['first_observed_at'],p['events'][0]['published_at'])
  p2,l2=m.build(research(),p,l,FRAME,HEALTH,NOW+timedelta(hours=1))
  self.assertEqual(l2['records'],first)
  _,l3=m.build(research('US lawmakers pass AI data-center restrictions'),p2,l2,FRAME,HEALTH,NOW+timedelta(hours=2))
  self.assertEqual(l3['records'][:len(first)],first)
  self.assertEqual(len(l3['records']),len(first)+1)

 def test_corrupt_ledger_fails_before_any_cli_write(self):
  _,l=m.build(research(),{}, {},FRAME,HEALTH,NOW)
  l['records'][0]['snapshot']['title']='Tampered'
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);old=root/'risk.json';old.write_text('{"keep":"old"}')
   ledger=root/'risk-ledger.json';ledger.write_text(json.dumps(l));before=ledger.read_bytes()
   with patch.object(sys,'argv',['build_risk.py','--output',str(old),'--ledger',str(ledger),'--no-calendar-fetch']):
    self.assertEqual(m.main(),1)
   self.assertEqual(old.read_text(),'{"keep":"old"}')
   self.assertEqual(ledger.read_bytes(),before)

 def test_stale_or_missing_inputs_are_not_safe_and_future_news_is_ignored(self):
  source=research();source['meta']['checked_at']=m.stamp(NOW-timedelta(days=3))
  source['news'][0]['published_at']=m.stamp(NOW+timedelta(days=1))
  p,_=m.build(source,{}, {},FRAME,HEALTH,NOW)
  self.assertTrue(p['meta']['news_stale']);self.assertEqual(p['events'],[])
  self.assertTrue(all('Stale' in c['coverage'] for c in p['categories']))
  self.assertFalse(any(e.get('scheduled_at') for e in p['events']))

 def test_newly_configured_feed_is_disclosed_as_not_retrieved(self):
  f=copy.deepcopy(FRAME);f['configured_feeds']=[{'id':'new','name':'New feed','url':'https://example.org/rss'}]
  p,_=m.build(research(),{}, {},f,HEALTH,NOW)
  self.assertEqual(p['meta']['feeds_total'],1);self.assertEqual(p['meta']['feeds_fetched'],0)
  self.assertEqual(p['feed_health'][0]['status'],'Not yet retrieved')

 def test_bls_calendar_timezone_and_subject_are_explicit(self):
  text='BEGIN:VCALENDAR\nBEGIN:VEVENT\nSUMMARY:Consumer Price Index\nDTSTART;TZID=US-Eastern:20261110T083000\nEND:VEVENT\nBEGIN:VEVENT\nSUMMARY:Unrelated release\nDTSTART;TZID=US-Eastern:20261111T083000\nEND:VEVENT\nEND:VCALENDAR'
  events=m.parse_bls(text);self.assertEqual(len(events),1)
  self.assertEqual(events[0]['at'],'2026-11-10T13:30:00Z')
  with self.assertRaises(ValueError):m.parse_bls(text.replace('US-Eastern','Unknown'))
  with self.assertRaises(ValueError):m.parse_bls('<html>Access denied</html>')

 def test_fomc_year_scope_and_final_day_are_required(self):
  text='<section><h2>2026 FOMC Meetings</h2><div class="fomc-meeting"><div class="fomc-meeting__month">December</div><div class="fomc-meeting__date">8-9*</div></div></section>'
  events=m.parse_fomc(text);self.assertEqual(events[0]['at'],'2026-12-09T05:00:00Z')
  self.assertTrue(events[0]['precision'].startswith('Date only'))
  with self.assertRaises(ValueError):m.parse_fomc(text.replace('2026 FOMC Meetings','Meeting dates'))

 def test_cross_month_historical_fomc_rows_do_not_break_current_calendar(self):
  text='<section><h4>2026 FOMC Meetings</h4><div class="fomc-meeting"><div class="fomc-meeting__month">December</div><div class="fomc-meeting__date">8-9*</div></div></section><section><h4>2023 FOMC Meetings</h4><div class="fomc-meeting"><div class="fomc-meeting__month">Jan/Feb</div><div class="fomc-meeting__date">31-1</div></div></section>'
  rows=m.parse_fomc(text)
  self.assertEqual([r['at'] for r in rows],['2026-12-09T05:00:00Z','2023-02-01T05:00:00Z'])

 def test_political_commentary_without_financial_context_can_abstain(self):
  for title in ['Israel took a beating in the US midterms','The most diverse Congress in history is cause for optimism','The content creator election: midterms coverage','US Congress calls police after a protest']:
   self.assertNotIn('elections',[c['id'] for c in m.topics(title,FRAME)])
  self.assertIn('ai_economics',[c['id'] for c in m.topics('Global stocks fall amid worries over AI after US midterms',FRAME)])

 def test_date_only_calendar_stays_visible_during_the_scheduled_day(self):
  at=m.stamp(NOW.replace(hour=5))
  health=[{'id':'fomc','url':m.CALENDARS['fomc'],'status':'Fetched official schedule','last_success':m.stamp(NOW),'stale':False,'events':[{'title':'Scheduled FOMC meeting final day','at':at,'precision':'Date only; decision time not inferred'}]}]
  p,_=m.build({'meta':{'checked_at':m.stamp(NOW)},'news':[]}, {}, {}, FRAME,health,NOW)
  self.assertEqual(len(p['events']),1);self.assertEqual(p['events'][0]['kind'],'Official scheduled release')

if __name__=='__main__':unittest.main()
