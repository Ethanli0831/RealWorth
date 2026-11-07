#!/usr/bin/env python3
"""Build attributed event-risk watches and an append-only, tamper-evident ledger.

Headline routing is a disclosed research heuristic, not verified legal analysis,
causal attribution, an AI price target, or a complete inventory of risks.
"""
from __future__ import annotations
import argparse
import concurrent.futures
from datetime import datetime, timedelta, timezone
import hashlib
import json
from pathlib import Path
import re
import sys
from zoneinfo import ZoneInfo

from bs4 import BeautifulSoup
import requests
from build_research import ROOT, parse_date, safe_url, stamp, write_atomic, political_finance_context

FRAMEWORK = ROOT / 'research/risk-framework.json'
OUTPUT = ROOT / 'docs/data/risk.json'
LEDGER = ROOT / 'docs/data/risk-ledger.json'
CALENDARS = {
    'fomc': 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm',
    'bls': 'https://www.bls.gov/schedule/news_release/bls.ics',
}


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()).hexdigest()


def validate_ledger(previous):
    records = previous.get('records', [])
    if not isinstance(records, list):
        raise ValueError('Risk ledger records are malformed')
    ids = set()
    for record in records:
        if not isinstance(record, dict) or record.get('id') in ids:
            raise ValueError('Duplicate or malformed risk ledger record')
        if record.get('digest') != digest({k: v for k, v in record.items() if k != 'digest'}):
            raise ValueError('Existing frozen risk record failed its integrity check')
        parse_date(record['first_observed_at'])
        ids.add(record['id'])
    return records


def stage(title):
    # This is only a description of headline wording, never legal verification.
    if re.search(r'\b(propos\w*|plans? to|pledge\w*|calls? for|would|could|may|seeks?)\b', title, re.I):
        return 'Proposal or possibility reported; not enacted law'
    if re.search(r'\b(enact\w*|signed into law|takes? effect|approved|passes?|passed)\b', title, re.I):
        return 'Decision or implementation reported; primary legal text not verified'
    return 'Reported development; implementation and legal status unverified'


def topics(title, framework):
    if re.search(r'job search|job hunt|jobseeker|career advice|five jobs|gold medal|golden globe', title, re.I) or re.search(r'''^["'“‘]?(?:i['’](?:ve|m)|i was|my |we (?:bought|paid))''', title, re.I):
        return []
    found = [c for c in framework['categories'] if re.search(c['pattern'], title, re.I)]
    # An election headline needs a public-policy/economic context, not a club vote.
    if not political_finance_context(title):
        found = [c for c in found if c['id'] != 'elections']
    return found


def parse_bls(text):
    """Read only explicit CPI/employment releases from the official iCalendar."""
    if not text.lstrip().startswith('BEGIN:VCALENDAR'):
        raise ValueError('BLS did not return an iCalendar')
    text = re.sub(r'\r?\n[ \t]', '', text)
    events = []
    for block in text.split('BEGIN:VEVENT')[1:]:
        block = block.split('END:VEVENT')[0]
        summary = re.search(r'^SUMMARY:(.+)$', block, re.M)
        start = re.search(r'^DTSTART([^:]*):([^\r\n]+)', block, re.M)
        if not summary or not start or not re.search(r'consumer price index|\bcpi\b|employment situation', summary[1], re.I):
            continue
        params, value = start.groups()
        if value.endswith('Z'):
            at = datetime.strptime(value, '%Y%m%dT%H%M%SZ').replace(tzinfo=timezone.utc)
        elif params in (';TZID=US-Eastern', ';TZID=America/New_York'):
            at = datetime.strptime(value, '%Y%m%dT%H%M%S').replace(tzinfo=ZoneInfo('America/New_York'))
        elif params == ';VALUE=DATE':
            at = datetime.strptime(value, '%Y%m%d').replace(tzinfo=ZoneInfo('America/New_York'))
        else:
            raise ValueError('Unknown BLS release timezone; no date assumed')
        events.append({'title': summary[1].strip().replace('\\,', ','), 'at': stamp(at.astimezone(timezone.utc)), 'precision': 'Release time' if 'T' in value else 'Date only'})
    if not events:
        raise ValueError('No recognized BLS release entries')
    return events


def parse_fomc(text):
    soup = BeautifulSoup(text, 'html.parser')
    events = []
    for month in soup.select('.fomc-meeting__month'):
        row = month.parent
        date = row.select_one('.fomc-meeting__date')
        if date is None:
            continue
        year = None
        for ancestor in month.parents:
            years = set(re.findall(r'(20\d{2})\s+FOMC\s+Meetings', ancestor.get_text(' ', strip=True)))
            if len(years) == 1:
                year = int(next(iter(years)))
                break
        days = re.fullmatch(r'\s*(\d{1,2})(?:\s*[-–]\s*(\d{1,2}))?\s*\*?\s*', date.get_text(' ', strip=True))
        if year is None or days is None:
            continue
        # Use the final meeting day, explicitly date-only; do not invent a time.
        # The official page also contains Jan/Feb and Apr/May meetings in
        # historical years. Their last day belongs to the final named month.
        months = month.get_text(' ', strip=True).split('/')
        final_month = months[-1].strip()
        parsed = None
        for fmt in ('%Y %B %d', '%Y %b %d'):
            try:
                parsed = datetime.strptime(f'{year} {final_month} {days[2] or days[1]}', fmt)
                break
            except ValueError:
                pass
        if parsed is None:
            continue
        if len(months) > 1 and months[0].strip().lower() in ('dec', 'december') and final_month.lower() in ('jan', 'january'):
            parsed = parsed.replace(year=year + 1)
        at = parsed.replace(tzinfo=ZoneInfo('America/New_York'))
        events.append({'title': 'Scheduled FOMC meeting final day', 'at': stamp(at.astimezone(timezone.utc)), 'precision': 'Date only; decision time not inferred'})
    if not events:
        raise ValueError('Federal Reserve calendar markup not recognized')
    return events


def calendars(now, previous, fetch=True):
    prior = {h['id']: h for h in previous.get('calendar_health', [])}
    def read(item):
        key, url = item
        try:
            if not fetch:
                raise ValueError('Calendar network retrieval not requested')
            response = requests.get(url, timeout=(8, 15), headers={'User-Agent': 'RealWorthResearch/1.0'})
            response.raise_for_status()
            rows = parse_fomc(response.text) if key == 'fomc' else parse_bls(response.text)
            return {'id': key, 'url': url, 'status': 'Fetched official schedule', 'last_success': stamp(now), 'attempted_at': stamp(now), 'events': rows, 'stale': False}
        except Exception as exc:
            old = prior.get(key, {})
            return {'id': key, 'url': url, 'status': 'Unavailable; dates not assumed', 'last_success': old.get('last_success'), 'attempted_at': stamp(now), 'events': old.get('events', []), 'stale': True, 'error': type(exc).__name__, 'detail': str(exc)[:160]}
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        return list(pool.map(read, CALENDARS.items()))


def build(research, previous, ledger, framework, calendar_health, now):
    records = list(validate_ledger(ledger))
    if any(parse_date(r['first_observed_at']) > now for r in records):
        raise ValueError('Clock precedes an existing frozen risk record')
    checked = parse_date(research['meta']['checked_at'])
    if checked > now + timedelta(minutes=10):
        raise ValueError('News source clock is in the future')
    news_stale = now - checked > timedelta(hours=48)
    news_unavailable = not any(h.get('status') == 'Fetched' for h in research.get('feed_health', []))
    if len({c['id'] for c in framework['categories']}) != len(framework['categories']):
        raise ValueError('Duplicate risk category')
    by_id = {r['id']: r for r in records}
    events = []
    now_text = stamp(now)
    def freeze(snapshot):
        event_id = digest(snapshot)[:24]
        record = by_id.get(event_id)
        if record is None:
            record = {'id': event_id, 'first_observed_at': now_text, 'snapshot': snapshot}
            record['digest'] = digest(record)
            records.append(record)
            by_id[event_id] = record
        return {**snapshot, 'id': event_id, 'first_observed_at': record['first_observed_at'], 'digest': record['digest']}
    for item in research.get('news', []):
        title = item.get('title', '')
        if not isinstance(title, str) or not title.strip():
            continue
        published = parse_date(item['published_at'])
        if published < now - timedelta(days=14) or published > now + timedelta(minutes=10):
            continue
        selected = topics(title, framework)
        if not selected:
            continue
        url = safe_url(item['url'])
        if not url.startswith('https://'):
            continue
        exposed = {t for c in selected for t in c['tickers']}
        if re.search(r'debt ceiling|treasury.*default|(?:us|u\.s\.).*sovereign.*default', title, re.I):
            exposed.add('BIL')
        snapshot = {'title': title, 'url': url, 'publisher': item.get('publisher', 'Attributed publisher'), 'published_at': stamp(published), 'categories': [c['id'] for c in selected], 'tickers': sorted(exposed), 'regions': ['All'], 'kind': 'Headline watch', 'stage': stage(title), 'legal_effective_at': None, 'scheduled_at': None, 'framework_version': framework['version'], 'framework_digest': digest(selected), 'evidence': 'Attributed headline only; article facts, legal effect and market causation are not independently verified.'}
        events.append(freeze(snapshot))
    for health in calendar_health:
        if health['stale']:
            continue
        for row in health['events']:
            at = parse_date(row['at'])
            expires = at + timedelta(days=1) if row['precision'].startswith('Date only') else at
            if not now <= expires or at > now + timedelta(days=45):
                continue
            events.append(freeze({'title': row['title'], 'url': health['url'], 'publisher': 'Federal Reserve' if health['id'] == 'fomc' else 'US Bureau of Labor Statistics', 'published_at': None, 'categories': ['rates'], 'tickers': ['BTC-USD', 'GLD', 'SPY', 'TLT'], 'regions': ['All'], 'kind': 'Official scheduled release', 'stage': 'Schedule retrieved from issuer; timing may change', 'legal_effective_at': None, 'scheduled_at': row['at'], 'date_precision': row['precision'], 'framework_version': framework['version'], 'evidence': 'Official schedule, not a prediction of the outcome or market direction.'}))
    # Put policy/AI/trade watches before routine rate releases. Keep all matches
    # in the ledger, even when the current page limits its displayed cards.
    priority = {'elections', 'ai_regulation', 'ai_economics', 'trade', 'credit', 'geopolitics'}
    events.sort(key=lambda e: (not bool(set(e['categories']) & priority), -(parse_date(e['published_at'] or e['scheduled_at']).timestamp())))
    categories = []
    for c in framework['categories']:
        matched = [e for e in events if c['id'] in e['categories']]
        categories.append({k: v for k, v in c.items() if k != 'pattern'} | {'event_count': len(matched), 'coverage': 'Stale headline input; no current assessment' if news_stale else 'No headline feed retrieved successfully; current coverage unknown' if news_unavailable else 'Limited selected-headline coverage' if matched else 'No matching evidence in selected feeds; risk not ruled out'})
    health = list(research.get('feed_health', []))
    observed_ids = {h.get('id') for h in health}
    for feed in framework.get('configured_feeds', []):
        if feed['id'] not in observed_ids:
            health.append({'id': feed['id'], 'name': feed['name'], 'url': feed['url'], 'status': 'Not yet retrieved', 'last_success': None})
    payload = {
        'meta': {'built_at': now_text, 'source_checked_at': stamp(checked), 'tracking_started_at': min([r['first_observed_at'] for r in records], default=ledger.get('meta', {}).get('tracking_started_at', now_text)), 'framework': framework['version'], 'news_stale': news_stale, 'news_unavailable': news_unavailable, 'coverage': 'Partial evidence, not all risks. No event found does not mean safe.', 'disclosure': 'Risk chains are transparent scenarios, not verified causal effects, probability forecasts or AI price targets. No warnings are backdated.', 'feeds_fetched': sum(h.get('status') == 'Fetched' for h in health), 'feeds_total': len(health), 'ledger_records': len(records)},
        'events': events, 'categories': categories, 'regions': framework['regions'], 'source_directory': framework['source_directory'], 'calendar_health': calendar_health, 'feed_health': health,
        'gaps': ['Election results and legal enactments are not independently verified automatically.', 'Selected RSS feeds can miss important stories; broad coverage is not comprehensive.', 'No live Japan, Korea, Taiwan, China or European equity-index impact model is connected.', 'Regional channels are qualitative exposures, not numerical loss estimates.', 'Company valuations, earnings consensus and portfolio holdings are not imported.', 'No local-currency purchasing-power, tax, multi-asset correlation or liquidity stress engine is provided.', 'Missing, stale or inaccessible sources cannot establish a safe entry.'],
    }
    frozen = ledger if ledger.get('meta') and records == ledger.get('records') else {'meta': {'framework': framework['version'], 'tracking_started_at': payload['meta']['tracking_started_at'], 'updated_at': now_text, 'record_count': len(records), 'disclosure': 'Append-only first-observed records. Digests detect changes relative to retained versions, not trusted third-party timestamp certification.'}, 'records': records}
    return payload, frozen


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--research', type=Path, default=ROOT / 'docs/data/research.json')
    parser.add_argument('--output', type=Path, default=OUTPUT)
    parser.add_argument('--ledger', type=Path, default=LEDGER)
    parser.add_argument('--no-calendar-fetch', action='store_true')
    args = parser.parse_args()
    try:
        if args.output.resolve() == args.ledger.resolve():
            raise ValueError('Current risk data and frozen ledger require separate paths')
        research = json.loads(args.research.read_text())
        previous = json.loads(args.output.read_text()) if args.output.exists() else {}
        ledger = json.loads(args.ledger.read_text()) if args.ledger.exists() else {}
        # Check the old ledger before network calls or publishing either output.
        validate_ledger(ledger)
        now = datetime.now(timezone.utc)
        framework = json.loads(FRAMEWORK.read_text())
        framework['configured_feeds'] = json.loads((ROOT / 'research/sources.json').read_text())['feeds']
        health = calendars(now, previous, not args.no_calendar_fetch)
        payload, frozen = build(research, previous, ledger, framework, health, now)
        write_atomic(frozen, args.ledger)
        write_atomic(payload, args.output)
    except Exception as exc:
        print(f'Event-risk build failed: {exc}', file=sys.stderr)
        return 1
    print(f"Risk watch: {len(payload['events'])} current records; {len(frozen['records'])} frozen records; {payload['meta']['feeds_fetched']}/{payload['meta']['feeds_total']} feeds reported fetched.")
    for h in health:
        print(h['id'], h['status'])
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
