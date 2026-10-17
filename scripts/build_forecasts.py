#!/usr/bin/env python3
"""Observed quotes, frozen next-period scenarios and prospective verification.

No historical Yahoo close arrays leave this script. Numerical scenarios are
empirical log-return quantiles, not LLM-generated prices or guaranteed odds.
"""
from __future__ import annotations
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
import hashlib
import json
import math
from pathlib import Path
import sys
import tempfile
from zoneinfo import ZoneInfo

import exchange_calendars as xcals
import numpy as np
import pandas as pd
import yfinance as yf
from build_research import ROOT, stamp, parse_date, write_atomic

OUTPUT = ROOT/'docs/data/forecasts.json'
LEDGER = ROOT/'docs/data/forecast-ledger.json'
ASSETS = {'BTC-USD':'Bitcoin / USD','GLD':'Gold ETF (GLD)','SPY':'S&P 500 ETF (SPY)','BIL':'T-Bill ETF (BIL)','TLT':'Long-bond ETF (TLT)'}
TZ = ZoneInfo('America/Toronto')
VERSION = 'empirical-log-return-quantiles-v1'
QUANTILES = [0.1,0.3,0.4,0.5,0.6,0.7,0.9]


def digest(record):
    keys=('id','ticker','issued_at','target_at','anchor_at','anchor_price','levels','model','training_observations')
    frozen={k:record[k] for k in keys if k in record}
    return hashlib.sha256(json.dumps(frozen,sort_keys=True,separators=(',',':')).encode()).hexdigest()


def distribution(closes):
    values=np.asarray(closes,dtype=float)
    if len(values)<344 or not np.isfinite(values).all() or (values<=0).any():
        raise ValueError('At least 344 valid daily closes are required')
    returns=np.diff(np.log(values))
    if (np.abs(returns)>0.5).any():
        raise ValueError('Extreme return or split requires manual data validation')
    quantiles=np.quantile(returns[-252:],QUANTILES)
    errors,naive_errors,covered=[],[],[]
    for index in range(max(252,len(returns)-90),len(returns)):
        q=np.quantile(returns[index-252:index],[0.1,0.5,0.9])
        actual=returns[index]
        errors.append(abs(math.expm1(q[1]-actual))*100)
        naive_errors.append(abs(math.expm1(-actual))*100)
        covered.append(bool(q[0]<=actual<=q[2]))
    return quantiles,{'observations':len(errors),'coverage_percent':round(100*np.mean(covered),2),'mean_abs_price_error_percent':round(float(np.mean(errors)),3),'random_walk_error_percent':round(float(np.mean(naive_errors)),3),'method':'Walk-forward: each daily-close prediction uses only the previous 252 log returns. Daily-close proxy for Bitcoin intraday 24h forecasts, not prospective accuracy.'}


def create_forecast(ticker,anchor_price,anchor_at,target_at,issued_at,closes,identifier):
    if not math.isfinite(anchor_price) or anchor_price<=0 or target_at<=issued_at:
        raise ValueError('Forecast needs a positive anchor and a future target')
    q,backtest=distribution(closes)
    levels={f'q{int(p*100)}':round(anchor_price*math.exp(float(v)),4) for p,v in zip(QUANTILES,q)}
    record={'id':identifier,'ticker':ticker,'issued_at':stamp(issued_at),'target_at':stamp(target_at),'anchor_at':stamp(anchor_at),'anchor_price':round(anchor_price,8),'levels':levels,'model':VERSION,'training_observations':252,'status':'Pending future observation','backtest':backtest}
    record['issued_digest']=digest(record)
    return record


def settle_record(record,observations,now):
    if record['status']!='Pending future observation' or parse_date(record['target_at'])>now:
        return record
    target=parse_date(record['target_at'])
    matches=[(time,price) for time,price in observations if target<=time<=min(now,target+timedelta(minutes=5))]
    if not matches:
        if now-target>timedelta(days=5):
            result={**record,'status':'Unverified: target observation unavailable'}
            result.pop('anchor_price',None)
            return result
        return record
    when,actual=min(matches,key=lambda p:p[0])
    if not math.isfinite(actual) or actual<=0:
        raise ValueError('Invalid verification price')
    anchor=record['anchor_price'];levels=record['levels']
    result={**record,'status':'Verified against later observation','verified_at':stamp(now),'realized_at':stamp(when),'actual_return_percent':round((actual/anchor-1)*100,4),'median_error_percent':round((levels['q50']/actual-1)*100,4),'inside_outer_band':levels['q10']<=actual<=levels['q90'],'observation_lag_seconds':int((when-target).total_seconds())}
    # Archive derived outcomes, not a historical raw Yahoo close series.
    result.pop('anchor_price',None)
    return result


def fetch_asset(ticker,now,needs_intraday):
    inst=yf.Ticker(ticker)
    frame=inst.history(period='2y',interval='1d',auto_adjust=False,actions=True,raise_errors=True,timeout=30)
    if frame.empty: raise ValueError('Empty price history')
    if 'Stock Splits' in frame and (frame['Stock Splits'].fillna(0)!=0).any():
        raise ValueError('Split requires validated handling before forecasting')
    meta=inst.get_history_metadata()
    quote=float(meta['regularMarketPrice']);quote_at=datetime.fromtimestamp(int(meta['regularMarketTime']),timezone.utc)
    if not math.isfinite(quote) or quote<=0 or quote_at>now+timedelta(minutes=5):
        raise ValueError('Invalid or future quote')
    calendar=xcals.get_calendar('XNYS')
    observations=[]
    for time,row in frame.iterrows():
        if ticker=='BTC-USD':
            closing=time.tz_convert('UTC').to_pydatetime()+timedelta(days=1)
        else:
            session=pd.Timestamp(time.date())
            if not calendar.is_session(session):continue
            closing=calendar.session_close(session).to_pydatetime()
        if closing<=now and pd.notna(row['Close']): observations.append((closing,float(row['Close'])))
    observations.sort()
    if len(observations)<344:raise ValueError('Insufficient completed daily bars')
    if ticker=='BTC-USD':
        ceiling=pd.Timestamp(quote_at).ceil('5min').to_pydatetime()
        target=ceiling+timedelta(days=1)
        anchor,anchor_at=quote,quote_at
        identifier=f'{ticker}|{now.astimezone(TZ).date().isoformat()}'
        tomorrow_open=True
        phase='Continuous trading; quote may be delayed by provider'
    else:
        anchor_at,anchor=observations[-1]
        last_session=pd.Timestamp(anchor_at.astimezone(TZ).date())
        next_session=calendar.next_session(last_session)
        target=calendar.session_close(next_session).to_pydatetime()
        if target<=now:raise ValueError('Latest completed session has not arrived from source')
        tomorrow=now.astimezone(TZ).date()+timedelta(days=1)
        tomorrow_open=bool(calendar.is_session(pd.Timestamp(tomorrow)))
        phase='Market open · delayed quote' if calendar.is_open_on_minute(pd.Timestamp(now).floor('min')) else 'Market closed · last reported quote'
        identifier=f'{ticker}|{stamp(target)}'
    verification=observations
    if ticker=='BTC-USD' and needs_intraday:
        short=inst.history(period='5d',interval='5m',auto_adjust=False,actions=False,raise_errors=True,timeout=30)
        verification=[(t.tz_convert('UTC').to_pydatetime()+timedelta(minutes=5),float(r['Close'])) for t,r in short.iterrows() if pd.notna(r['Close']) and t.tz_convert('UTC').to_pydatetime()+timedelta(minutes=5)<=now]
    stale=(now-quote_at)>timedelta(minutes=90 if ticker=='BTC-USD' else 30) and (ticker=='BTC-USD' or phase.startswith('Market open'))
    return {'ticker':ticker,'asset':ASSETS[ticker],'quote':round(quote,4),'quote_at':stamp(quote_at),'quote_stale':stale,'market_status':phase,'tomorrow_has_session':tomorrow_open,'source':f'https://finance.yahoo.com/quote/{ticker}/','anchor':anchor,'anchor_at':anchor_at,'target':target,'identifier':identifier,'closes':[p for _,p in observations],'verification':verification}


def build(previous,ledger,now):
    all_records={r['id']:r for r in ledger.get('records',[])}
    rows=[];failures=[]
    yf.set_tz_cache_location(str(Path(tempfile.gettempdir())/'realworth-yfinance'))
    for ticker in ASSETS:
        try:
            needs=any(r['ticker']==ticker and r['status']=='Pending future observation' and parse_date(r['target_at'])<=now for r in all_records.values())
            value=fetch_asset(ticker,now,needs)
            for key,record in list(all_records.items()):
                if record['ticker']==ticker:
                    all_records[key]=settle_record(record,value['verification'],now)
            identifier=value['identifier']
            if identifier not in all_records:
                all_records[identifier]=create_forecast(ticker,value['anchor'],value['anchor_at'],value['target'],now,value['closes'],identifier)
            row={k:value[k] for k in ('ticker','asset','quote','quote_at','quote_stale','market_status','tomorrow_has_session','source')}
            row['forecast']=all_records[identifier];row['error']=None;rows.append(row)
        except Exception as exc:
            failures.append({'ticker':ticker,'error':type(exc).__name__})
            old=next((r for r in previous.get('assets',[]) if r['ticker']==ticker),None)
            if old:rows.append({**old,'quote_stale':True,'error':'Latest refresh failed; retained previous snapshot'})
            else:rows.append({'ticker':ticker,'asset':ASSETS[ticker],'quote':None,'quote_at':None,'quote_stale':True,'source':f'https://finance.yahoo.com/quote/{ticker}/','market_status':'Unavailable','tomorrow_has_session':None,'forecast':None,'error':'Quote or required history unavailable'})
    if len(failures)==len(ASSETS):raise RuntimeError('All quote downloads failed; previous forecasts retained')
    records=sorted([r for r in all_records.values() if parse_date(r['issued_at'])>=now-timedelta(days=120)],key=lambda r:r['issued_at'],reverse=True)
    verified=[r for r in records if r['status']=='Verified against later observation']
    report={'verified_forecasts':len(verified),'outer_band_coverage_percent':round(100*np.mean([r['inside_outer_band'] for r in verified]),2) if verified else None,'mean_abs_median_error_percent':round(float(np.mean([abs(r['median_error_percent']) for r in verified])),3) if verified else None,'pending':sum(r['status']=='Pending future observation' for r in records),'missed':sum(r['status'].startswith('Unverified:') for r in records)}
    meta={'checked_at':stamp(now),'model':VERSION,'timezone':'America/Toronto','today':now.astimezone(TZ).date().isoformat(),'tomorrow':(now.astimezone(TZ).date()+timedelta(days=1)).isoformat(),'quote_refresh':'Scheduled about every 15 minutes; provider and GitHub queue delays apply.','disclosure':'Price-only empirical daily log-return scenarios, not AI price targets. Lower/central/upper bands are historical quantile ranges, not guaranteed probabilities. Bitcoin uses a frozen quote-to-24h target; ETFs use the last completed close to the next scheduled close. No forecasts are revised after issue.','failures':failures}
    return {'meta':meta,'assets':rows,'verification':report},{'meta':{'updated_at':stamp(now),'retention_days':120,'verification':'Bitcoin: first completed 5-minute bar at/after target, at most 5 minutes late. ETFs: scheduled session close. Missing target data never becomes a fabricated outcome.'},'records':records}


def main():
    previous=json.loads(OUTPUT.read_text()) if OUTPUT.exists() else {}
    ledger=json.loads(LEDGER.read_text()) if LEDGER.exists() else {'records':[]}
    try:
        payload,new_ledger=build(previous,ledger,datetime.now(timezone.utc))
        # Ledger first: a failed publication can retry without replacing issued forecasts.
        write_atomic(new_ledger,LEDGER);write_atomic(payload,OUTPUT)
    except Exception as exc:
        print(f'Forecast refresh failed; prior snapshot retained: {type(exc).__name__}: {exc}',file=sys.stderr);return 1
    print(json.dumps({'assets':len(payload['assets']),'failures':payload['meta']['failures'],'verification':payload['verification']}));return 0

if __name__=='__main__':raise SystemExit(main())
