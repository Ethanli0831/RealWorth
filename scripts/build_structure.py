#!/usr/bin/env python3
"""Public market-structure observations. Source failures never become zeroes.

No keys. Publish selected observations/derived indices, not downloaded files.
Historical percentiles require >=250 points spanning >=330 days, explicitly
reported as empirical ranks, not next-return forecasts.
"""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from io import StringIO
import json
import csv
import re
import math
import os
from pathlib import Path
import tempfile
import requests
import pandas as pd

ROOT=Path(__file__).resolve().parents[1]
OUTPUT=ROOT/'docs/data/structure.json'
SOURCES={
 'ibit':('IBIT bitcoin holdings','ETF holdings','https://www.ishares.com/us/products/333011/ishares-bitcoin-trust-etf','Fund bitcoins are not net flows. AUM changes include price effects.'),
 'gld':('GLD gold holdings','ETF holdings','https://www.spdrgoldshares.com/usa/historical-data/','Tonnes held are a demand proxy; changes are not dollar net flows. Price and holdings can diverge.'),
 'funding':('BTC perpetual funding','Leverage','https://docs.deribit.com/#public-get_book_summary_by_currency','Deribit BTC-PERPETUAL only; 8-hour funding is not annualised. Positive funding is not a directional forecast.'),
 'oi':('BTC perpetual open interest','Leverage','https://docs.deribit.com/#public-get_book_summary_by_currency','USD notional can rise from price changes. One exchange does not measure all leverage.'),
 'dvol':('Bitcoin implied volatility','Options expectations','https://docs.deribit.com/#public-get_volatility_index_data','Deribit DVOL is annualised implied volatility, not a price direction or an observed future outcome.'),
 'addresses':('Bitcoin active addresses','On-chain activity','https://docs.coinmetrics.io/asset-metrics/addresses/adractcnt','Coin Metrics community coverage. Addresses are not distinct people.'),
 'transactions':('Bitcoin transactions','On-chain activity','https://docs.coinmetrics.io/asset-metrics/transactions/txcnt','Transactions include exchange and self transfers; not a direct adoption or valuation measure.'),
 'fees':('Bitcoin network fees','On-chain activity','https://docs.coinmetrics.io/asset-metrics/fees/feetotntv','BTC per day; fee changes can reflect congestion, not just demand.'),
 'hashrate':('Bitcoin estimated hash rate','On-chain activity','https://docs.coinmetrics.io/asset-metrics/mining/hashrate','Estimated network security input, not a price target.'),
 'm2':('US M2 growth','Money & dollar','https://fred.stlouisfed.org/series/M2SL','Year-over-year US money growth; publication lags and revisions apply. Correlation is not causation.'),
 'dollar':('Broad trade-weighted US dollar','Money & dollar','https://fred.stlouisfed.org/series/DTWEXBGS','20-observation percentage change, not a DXY futures quote.'),
 'cot':('Gold managed-money net futures','Institutional positioning','https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm','COMEX gold futures-only managed-money longs minus shorts. Weekly positions are released with a lag; categories are not one unified institution.'),
}
DIRECTORY=[
 {'name':'World Gold Council · Gold Demand Trends','url':'https://www.gold.org/goldhub/research/gold-demand-trends','status':'Source directory · manual research; no licensed automatic series connected','note':'Quarterly central-bank purchases, bars/coins, jewellery, mine supply and recycling. Do not substitute a gold-price move for physical demand.'},
 {'name':'Deribit option skew / term structure','url':'https://docs.deribit.com/','status':'Not connected','note':'DVOL is connected separately. A comparable 25-delta risk reversal needs matched expiries/deltas and historical quotes; DVOL is not skew.'},
 {'name':'Canada local purchasing power','url':'https://www.statcan.gc.ca/en/subjects-start/prices_and_price_indexes/consumer_price_indexes','status':'Not connected · current return tools remain USD / US CPI','note':'CAD returns require date-aligned USD/CAD and Canadian CPI. Currency conversion alone is not Canadian purchasing power.'},
]

def get(url):
 r=requests.get(url,timeout=(15,40));r.raise_for_status()
 if len(r.content)>8_000_000:raise ValueError('Response exceeds 8MB')
 return r

def num(v):
 x=float(str(v).replace(',','').replace('$','').strip())
 if not math.isfinite(x):raise ValueError('Non-finite observation')
 return x

def point(date,value):return {'date':str(date)[:10],'value':round(num(value),6)}

def parse_holdings(text,symbol):
 lines=text.lstrip('\ufeff').splitlines()
 header=next(i for i,line in enumerate(lines) if 'Ticker' in line and 'Quantity' in line)
 rows=list(csv.reader(lines[header:]))
 columns=[c.strip() for c in rows[0]]
 frame=pd.DataFrame([r for r in rows[1:] if len(r)==len(columns)],columns=columns)
 row=frame.loc[frame['Ticker'].astype(str).str.upper().isin([symbol,'XBT'] if symbol=='BTC' else [symbol])].iloc[0]
 quantity=num(row['Quantity'])
 if quantity<=0:raise ValueError('Invalid fund holdings')
 # An actual holdings date is mandatory; never label the request date as the data date.
 import re
 raw=next(line for line in lines[:header] if re.search('as of|holdings date',line,re.I))
 values=next(__import__('csv').reader([raw]))
 when=pd.to_datetime(' '.join(values[1:]).strip('" ')).date().isoformat()
 return point(when,quantity)

def parse_gld(text):
 lines=text.lstrip('\ufeff').splitlines()
 rows=list(csv.reader(lines))
 start=next((i for i,row in enumerate(rows) if row and row[0].strip().lower()=='date' and any('tonne' in c.lower() for c in row)),None)
 if start is None:raise ValueError('GLD header missing: '+repr(rows[:2])[:300])
 columns=[c.strip() for c in rows[start]]
 df=pd.DataFrame([r for r in rows[start+1:] if len(r)==len(columns)],columns=columns)
 key=next(c for c in df.columns if 'tonne' in c.lower())
 price=next((c for c in df.columns if 'gld' in c.lower() and 'close' in c.lower()),None)
 out=[]
 for _,r in df.iterrows():
  try:
   when=pd.to_datetime(r.iloc[0]).date().isoformat();v=num(r[key])
   if v>0:
    p=point(when,v)
    if price:
     try:p['price']=num(r[price])
     except (ValueError,TypeError):pass
    out.append(p)
  except (ValueError,TypeError):continue
 return sorted(out,key=lambda p:p['date'])

def parse_cot(text):
 # CFTC's current disaggregated futures-only text file is headerless.
 # Published column order: market, YYMMDD, ISO date, codes, OI,
 # producer L/S, swap L/S/spread, managed-money L/S/spread, ...
 rows=list(csv.reader(StringIO(text)))
 r=next(r for r in rows if r and r[0].strip()=='GOLD - COMMODITY EXCHANGE INC.')
 if len(r)<50 or not re.fullmatch(r"\d{4}-\d{2}-\d{2}",r[2]):raise ValueError('CFTC schema changed')
 oi,long,short=num(r[7]),num(r[13]),num(r[14])
 if not (oi>0 and 0<=long<=oi and 0<=short<=oi):raise ValueError('CFTC position bounds failed')
 return point(r[2],long-short)


def tasks(now):
 start=(now-timedelta(days=380)).date().isoformat()
 def ibit():return {'ibit':([parse_holdings(get('https://www.ishares.com/us/products/333011/ishares-bitcoin-trust-etf/1467271812596.ajax?fileType=csv&fileName=IBIT_holdings&dataType=fund').text,'BTC')],'BTC')}
 def gold():return {'gld':(parse_gld(get('https://www.spdrgoldshares.com/assets/dynamic/GLD/GLD_US_archive_EN.csv').text),'tonnes')}
 def derivatives():
  rows=get('https://www.deribit.com/api/v2/public/get_book_summary_by_currency?currency=BTC&kind=future').json()['result']
  r=next(x for x in rows if x['instrument_name']=='BTC-PERPETUAL')
  when=datetime.fromtimestamp(r['creation_timestamp']/1000,timezone.utc).isoformat()
  return {'funding':([point(when,num(r['funding_8h'])*100)],'% / 8 hours'),'oi':([point(when,r['open_interest'])],'USD notional')}
 def vol():
  end=int(now.timestamp()*1000);begin=int((now-timedelta(days=380)).timestamp()*1000)
  d=get(f'https://www.deribit.com/api/v2/public/get_volatility_index_data?currency=BTC&start_timestamp={begin}&end_timestamp={end}&resolution=86400').json()['result']
  return {'dvol':([point(datetime.fromtimestamp(r[0]/1000,timezone.utc).date(),r[4]) for r in d['data'] if datetime.fromtimestamp(r[0]/1000,timezone.utc).date()<now.date()],'% annualised IV')}
 def chain():
  data=get('https://community-api.coinmetrics.io/v4/timeseries/asset-metrics?assets=btc&metrics=AdrActCnt,TxCnt,FeeTotNtv,HashRate&frequency=1d&page_size=400&start_time='+start).json()['data']
  return {key:([point(r['time'],r[field]) for r in data if r.get(field) is not None and r['time'][:10]<now.date().isoformat()],unit) for key,field,unit in [('addresses','AdrActCnt','addresses / day'),('transactions','TxCnt','transactions / day'),('fees','FeeTotNtv','BTC / day'),('hashrate','HashRate','TH/s')]}
 def fred(series,key,unit):
  df=pd.read_csv(StringIO(get('https://fred.stlouisfed.org/graph/fredgraph.csv?id='+series).text),na_values=['.'])
  dates=pd.to_datetime(df.iloc[:,0]);values=pd.Series(pd.to_numeric(df.iloc[:,1]).to_numpy(),index=dates)
  if key=='m2':values=values.asfreq('MS').pct_change(12,fill_method=None)*100
  else:values=values.dropna().pct_change(20,fill_method=None)*100
  return {key:([point(d.date(),v) for d,v in values.dropna().items()],unit)}
 def cot():
  return {'cot':([parse_cot(get('https://www.cftc.gov/dea/newcot/f_disagg.txt').text)],'contracts net long')}
 return [(('ibit',),ibit),(('gld',),gold),(('funding','oi'),derivatives),(('dvol',),vol),(('addresses','transactions','fees','hashrate'),chain),(('m2',),lambda:fred('M2SL','m2','% YoY')),(('dollar',),lambda:fred('DTWEXBGS','dollar','% / 20 observations')),(('cot',),cot)]

def empirical_rank(points):
 if len(points)<250 or (pd.Timestamp(points[-1]['date'])-pd.Timestamp(points[0]['date'])).days<330:return None
 return round(100*sum(p['value']<=points[-1]['value'] for p in points)/len(points),1)

def build(previous,now):
 old={r['id']:r for r in previous.get('indicators',[])};results={}
 def fetch(job):
  ids,fn=job
  try:return ids,fn(),None
  except Exception as e:return ids,{},type(e).__name__+': '+str(e)[:400]
 with ThreadPoolExecutor(max_workers=4) as pool:
  for ids,readings,error in pool.map(fetch,tasks(now)):
   for key in ids:results[key]=(readings.get(key),error)
 indicators=[];cut=(now-timedelta(days=366)).date().isoformat()
 for key,(name,category,url,caveat) in SOURCES.items():
  result,error=results[key];last=old.get(key,{})
  series={p['date']:p for p in last.get('history',[]) if p['date']>=cut}
  if result:
   values,unit=result
   for p in values:
    if cut<=p['date']<=now.date().isoformat():series[p['date']]=p
  else:unit=last.get('unit','')
  history=sorted(series.values(),key=lambda p:p['date'])
  priced=[p for p in history if 'price' in p]
  if priced:
   base=priced[0]['price']
   for p in priced:p['price_index']=round(p.pop('price')/base*100,6)
  latest=history[-1] if history else None
  limit=65 if key=='m2' else 14 if key=='cot' else 7 if key in ('gld','ibit') else 3
  stale=not latest or (now.date()-pd.Timestamp(latest['date']).date()).days>limit
  # Retain history for ranks and charts, but never imply it was downloaded afresh.
  indicators.append({'id':key,'name':name,'category':category,'source':url,'note':caveat,'unit':unit,'value':latest['value'] if latest else None,'period':latest['date'] if latest else None,'status':'Source unavailable; dated history retained' if error else 'Fetched' if history else 'No usable observations','error':error,'stale':stale,'last_success':last.get('last_success') if error or not history else now.isoformat(),'history':history,'percentile':empirical_rank(history),'observations':len(history)})
 return {'meta':{'checked_at':now.isoformat(),'refresh':'Every four hours requested; source publication and GitHub delays apply.','scope':'Selected free public sources. Missing/paid sources are not substituted with estimates.'},'indicators':indicators,'directory':DIRECTORY}

def main():
 previous=json.loads(OUTPUT.read_text()) if OUTPUT.exists() else {}
 payload=build(previous,datetime.now(timezone.utc))
 # A fully failed refresh never erases an existing snapshot or relabels it fresh.
 if all(r['status']!='Fetched' for r in payload['indicators']):raise RuntimeError('All structure sources failed; old snapshot retained')
 content=json.dumps(payload,ensure_ascii=False,indent=2,allow_nan=False)+'\n';OUTPUT.parent.mkdir(exist_ok=True)
 with tempfile.NamedTemporaryFile(mode='w',encoding='utf-8',dir=OUTPUT.parent,delete=False) as f:f.write(content);name=f.name
 try:os.replace(name,OUTPUT)
 finally:Path(name).unlink(missing_ok=True)
 print('Market structure:',sum(r['status']=='Fetched' for r in payload['indicators']),'/',len(payload['indicators']),'readings fetched')
 for r in payload['indicators']:print(r['id'],r['status'],r['period'],r['value'],r['unit'],r['error'])
if __name__=='__main__':main()
