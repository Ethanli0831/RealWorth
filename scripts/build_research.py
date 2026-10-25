#!/usr/bin/env python3
"""Refresh public macro signals and attributed RSS headlines. No API keys or LLM.

Only research.json is replaced, atomically. The original monthly return builder
and its data.json remain independent. Mechanism templates are hypotheses,
not article summaries, causal estimates, trading recommendations or forecasts.
"""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser
from io import StringIO
import json
import math
import os
from pathlib import Path
import re
import sys
import tempfile
import time
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode
import xml.etree.ElementTree as ET

import pandas as pd
import requests

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'docs/data/research.json'
SERIES = {
    'GDPC1': ('Real GDP growth, year over year', '%', 'Q'),
    'CPIAUCSL': ('CPI inflation, year over year', '%', 'M'),
    'FEDFUNDS': ('Federal funds rate', '%', 'M'),
    'UNRATE': ('Unemployment rate', '%', 'M'),
    'TDSP': ('Household debt service / disposable income', '%', 'Q'),
    'QUSPAM770A': ('Private non-financial credit / GDP', '%', 'Q'),
    'GFDEGDQ188S': ('Federal debt / GDP', '%', 'Q'),
    'BAMLH0A0HYM2': ('US high-yield credit spread', 'percentage points', 'D'),
    'DFII10': ('10-year Treasury real yield', '%', 'D'),
    'T10Y3M': ('10-year minus 3-month Treasury yield', 'percentage points', 'D'),
}


def stamp(now):
    return now.astimezone(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')


def number(value):
    return round(float(value), 3) if value is not None and math.isfinite(float(value)) else None


def safe_url(url):
    parts = urlsplit(url.strip())
    if parts.scheme not in ('https', 'http') or not parts.hostname or parts.username or parts.password:
        raise ValueError('Unsafe source URL')
    query = [(k, v) for k, v in parse_qsl(parts.query) if not k.lower().startswith('utm_') and k.lower() not in ('fbclid', 'gclid')]
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), ''))


def download(url):
    for attempt in range(3):
        try:
            # Use the already-tested FRED request shape from build_data.py.
            # Long CSV responses can exceed a 25-second read timeout on runners.
            r = requests.get(url, timeout=(15, 60))
            r.raise_for_status()
            if len(r.content) > 5_000_000:
                raise ValueError('Source response exceeds 5 MB')
            if not r.encoding or r.encoding.lower() in ('iso-8859-1', 'ascii'):
                r.encoding = 'utf-8'
            return r.text
        except (requests.RequestException, ValueError):
            if attempt == 2:
                raise
            time.sleep(0.5 * (attempt + 1))


def parse_fred(text, series, now):
    frame = pd.read_csv(StringIO(text), na_values=['.'])
    if list(frame.columns)[-1] != series or len(frame.columns) != 2:
        raise ValueError('Unexpected FRED CSV columns')
    dates = pd.to_datetime(frame.iloc[:, 0], errors='raise')
    values = pd.to_numeric(frame[series], errors='raise')
    result = pd.Series(values.to_numpy(), index=dates).sort_index()
    if result.index.has_duplicates or not result.dropna().map(math.isfinite).all():
        raise ValueError('Duplicate dates or invalid FRED values')
    result = result.loc[result.index <= pd.Timestamp(now.date())].dropna()
    if result.empty:
        raise ValueError('No usable FRED observations')
    return result


def periodic(series, freq):
    result = series.copy()
    result.index = result.index.to_period(freq)
    if result.index.has_duplicates:
        raise ValueError('Duplicate period observations')
    return result.reindex(pd.period_range(result.index.min(), result.index.max(), freq=freq))


def macro_signals(raw, now, failures):
    indicators = []
    derived = {}
    for key, (label, unit, freq) in SERIES.items():
        if key not in raw:
            indicators.append({'id': key, 'name': label, 'value': None, 'unit': unit, 'period': None, 'stale': True, 'change': None, 'source': f'https://fred.stlouisfed.org/series/{key}'})
            continue
        series = raw[key]
        period = series.index[-1].to_period(freq) if freq != 'D' else None
        end = period.end_time.date() if period is not None else series.index[-1].date()
        stale = (now.date() - end).days > {'D': 10, 'M': 75, 'Q': 200}[freq]
        value, change = series.iloc[-1], None
        if key in ('GDPC1', 'CPIAUCSL'):
            s = periodic(series, freq)
            yoy = s.pct_change(4 if freq == 'Q' else 12, fill_method=None) * 100
            value = yoy.iloc[-1]
            lag = 1 if freq == 'Q' else 6
            change = value - yoy.iloc[-1-lag] if len(yoy) > lag else None
        elif key == 'FEDFUNDS':
            s = periodic(series, 'M')
            change = s.iloc[-1] - s.iloc[-4] if len(s) > 3 else None
        elif key == 'UNRATE':
            s = periodic(series, 'M')
            avg = s.rolling(3, min_periods=3).mean()
            change = avg.iloc[-1] - avg.iloc[-12:].min() if len(avg) >= 14 and avg.iloc[-12:].notna().all() else None
        elif freq == 'Q':
            s = periodic(series, 'Q')
            change = s.iloc[-1] - s.iloc[-5] if len(s) > 4 else None
        else:
            previous = series.loc[series.index <= series.index[-1] - pd.DateOffset(months=6)]
            change = value - previous.iloc[-1] if not previous.empty else None
        item = {'id': key, 'name': label, 'value': number(value), 'unit': unit,
                'period': str(period) if period is not None else series.index[-1].date().isoformat(),
                'stale': stale, 'change': number(change), 'source': f'https://fred.stlouisfed.org/series/{key}'}
        indicators.append(item)
        derived[key] = item
    def usable(key, field='value'):
        item = derived.get(key, {})
        return item.get(field) if not item.get('stale', True) else None
    g, i = usable('GDPC1', 'change'), usable('CPIAUCSL', 'change')
    def direction(value, deadband=0.1):
        return 'Unknown' if value is None else 'Rising' if value > deadband else 'Falling' if value < -deadband else 'Broadly flat'
    growth, inflation = direction(g), direction(i)
    weather = {('Rising','Rising'): 'Growth improving · inflation rising', ('Rising','Falling'): 'Growth improving · inflation easing', ('Falling','Rising'): 'Growth slowing · inflation rising', ('Falling','Falling'): 'Growth slowing · inflation easing'}.get((growth, inflation), 'Mixed or incomplete readings')
    rate = usable('FEDFUNDS', 'change')
    spread, labour = usable('BAMLH0A0HYM2'), usable('UNRATE', 'change')
    pressure = []
    if spread is not None and spread >= 5:
        pressure.append('High-yield credit spread is at least 5 percentage points.')
    if labour is not None and labour >= 0.5:
        pressure.append('The unemployment three-month average is at least 0.5 percentage points above its trailing 12-month minimum.')
    if g is None or i is None or rate is None or any(usable(k) is None for k in ('GDPC1', 'CPIAUCSL', 'UNRATE', 'BAMLH0A0HYM2')):
        cycle = 'Incomplete short-cycle evidence'
    elif pressure:
        cycle = 'Debt-stress signals require investigation'
    elif labour is None:
        cycle = 'Partial short-cycle signals · labour baseline unavailable'
    elif growth == 'Falling' and rate <= -0.25:
        cycle = 'Slower growth with policy easing'
    elif growth == 'Falling' and rate >= 0.25:
        cycle = 'Slower growth with tighter policy'
    elif growth == 'Rising' and rate >= 0.25:
        cycle = 'Improving growth with tighter policy'
    elif growth == 'Rising' and rate <= -0.25:
        cycle = 'Improving growth with policy easing'
    else:
        cycle = 'Mixed short-cycle signals'
    return {'checked_at': stamp(now), 'stale': False, 'failures': failures, 'indicators': indicators,
            'weather': weather, 'growth_direction': growth, 'inflation_direction': inflation,
            'short_cycle': cycle, 'pressure_flags': pressure,
            'long_cycle': 'Not identified: these US indicators do not establish a complete long-term debt-cycle phase.',
            'outlook': 'If growth keeps slowing while inflation rises, watch for a policy trade-off. If inflation eases without worsening credit or employment, a softer adjustment is more plausible. These are conditional scenarios, not probability forecasts.'}


def parse_date(text):
    try:
        value = parsedate_to_datetime(text)
    except (ValueError, TypeError):
        value = datetime.fromisoformat(text.replace('Z', '+00:00'))
    if value.tzinfo is None:
        raise ValueError('Publication date lacks timezone')
    return value.astimezone(timezone.utc)


def classify(title, mechanisms):
    """Conservative headline routing, not a claim to understand an article.

    Require context for ambiguous words before allowing a mechanism template.
    Abstention is preferable to inventing a macro event from a personal story.
    """
    if re.search(r'job search|job hunt|jobseeker|career advice|five jobs|fraud|scam|gold medal|golden globe', title, re.I):
        return []
    tags = [m['id'] for m in mechanisms if re.search(m['pattern'], title, re.I)]
    if 'energy' in tags and not re.search(
            r'\boil\b|\bcrude\b|energy (?:price|suppl)|geopolit|shipping|hormuz|military|missile|invasion|armed conflict|sanctions? (?:on|against)|war in (?:ukraine|gaza|iran)', title, re.I):
        tags.remove('energy')
    if 'growth' in tags and not re.search(
            r'\bgdp\b|recession|economic (?:growth|slowdown)|nonfarm|payrolls?|unemployment|(?:labour|labor) market|jobless|jobs report|(?:economy|us|u\.s\.|uk|britain) (?:adds?|loses?|created) [\d,]+ jobs', title, re.I):
        tags.remove('growth')
    return tags[:3]


def relevance(title, topics):
    return {'status': 'Relevant' if topics else 'No clear macro impact',
            'reason': 'Specific asset or macro context in the headline; article verification still required.' if topics
            else 'Personal, career or company-level story without an established economy-wide or asset transmission channel. No impact chain generated.'}


def group_events(items):
    """Merge high-confidence same-entity/action stories within three days.

    Avoid generic topic clustering: two banks or two employment releases are
    different events. Links and individual publication times are retained.
    """
    groups = []
    for original in sorted(items, key=lambda n: n['published_at'], reverse=True):
        item = {**original}
        item['topics'] = classify(item['title'], json.loads((ROOT / 'research/mechanisms.json').read_text()))
        item['relevance'] = relevance(item['title'], item['topics'])
        words = set(re.findall(r'[a-z0-9]+', item['title'].lower())) - set('the a an to of in on as and for with is are says said'.split())
        layoffs = bool(re.search(r'cuts?|cutting|shed|ax[es]|layoffs?|lay off', item['title'], re.I))
        # A named employer plus a layoff action is stronger than "jobs" alone.
        employer = next((name for name in ('barclays', 'netflix', 'amazon', 'hsbc', 'meta', 'microsoft', 'intel') if name in words), None)
        key = (employer, 'layoffs') if employer and layoffs else None
        match = None
        for group in groups:
            within = abs((parse_date(group['published_at']) - parse_date(item['published_at'])).total_seconds()) <= 3 * 86400
            same = key is not None and key == group['_event_key']
            similar = len(words & group['_words']) / max(1, len(words | group['_words'])) >= .8
            if within and (item['url'] == group['url'] or same or similar):
                match = group
                break
        report = {k: item[k] for k in ('title', 'url', 'publisher', 'published_at')}
        if match:
            if report['url'] not in {r['url'] for r in match['related_reports']}:
                match['related_reports'].append(report)
        else:
            item.update(_event_key=key, _words=words, related_reports=original.get('related_reports', [report]))
            groups.append(item)
    for item in groups:
        item.pop('_event_key'); item.pop('_words')
    return groups[:60]


def parse_feed(text, feed, mechanisms, now):
    if '<!DOCTYPE' in text.upper() or '<!ENTITY' in text.upper():
        raise ValueError('RSS declarations with entities are not accepted')
    root = ET.fromstring(text)
    entries = root.findall('.//item') or root.findall('{http://www.w3.org/2005/Atom}entry')
    if not entries and root.tag.split('}')[-1] not in ('rss', 'feed', 'RDF'):
        raise ValueError('Response is not a supported feed')
    result = []
    for entry in entries[:100]:
        def field(names):
            for name in names:
                node = entry.find(name)
                if node is not None:
                    return ''.join(node.itertext()).strip()
            return ''
        title = re.sub(r'\s+', ' ', field(['title', '{http://www.w3.org/2005/Atom}title']))[:300]
        tags = classify(title, mechanisms)
        if not tags and not re.search(r'jobs?|employment|fraud|scam|bank|econom', title, re.I):
            continue
        try:
            published = parse_date(field(['pubDate', '{http://www.w3.org/2005/Atom}published', '{http://www.w3.org/2005/Atom}updated']))
            if published < now - timedelta(days=14) or published > now + timedelta(hours=2):
                continue
            link = field(['link'])
            if not link:
                link = next((n.get('href') for n in entry.findall('{http://www.w3.org/2005/Atom}link') if n.get('rel', 'alternate') == 'alternate'), '')
            link = safe_url(link)
        except (ValueError, TypeError):
            continue
        result.append({'title': title, 'url': link, 'published_at': stamp(published), 'source_id': feed['id'], 'publisher': feed['name'], 'source_kind': feed['kind'], 'topics': tags, 'cached': False,
                       'evidence': 'Attributed publisher headline; article claims and causal effects have not been independently verified.'})
    return result


class Paragraphs(HTMLParser):
    def __init__(self):
        super().__init__()
        self.depth = 0
        self.parts, self.paragraphs = [], []
    def handle_starttag(self, tag, attrs):
        if tag == 'p':
            self.depth += 1
    def handle_endtag(self, tag):
        if tag == 'p' and self.depth:
            self.depth -= 1
            if not self.depth:
                self.paragraphs.append(' '.join(''.join(self.parts).split()))
                self.parts = []
    def handle_data(self, data):
        if self.depth:
            self.parts.append(data)


def check_case(url, now, previous):
    if previous.get('excerpt'):
        previous = {**previous, 'excerpt': ' '.join(previous['excerpt'].split()[:45])}
    if previous.get('excerpt'):
        try:
            previous = {**previous, 'excerpt': previous['excerpt'].encode('latin1').decode('utf-8')}
        except (UnicodeEncodeError, UnicodeDecodeError):
            pass
    if previous.get('checked_at') and previous.get('status') == 'Primary page retrieved' and now - parse_date(previous['checked_at']) < timedelta(days=7):
        return previous
    try:
        page = download(url)
        parser = Paragraphs()
        parser.feed(page)
        relevant = [p for p in parser.paragraphs if re.search(r'gold', p, re.I) and re.search(r'lead|transmut', p, re.I)]
        if not relevant:
            raise ValueError('Primary page did not contain expected subject')
        return {'url': url, 'checked_at': stamp(now), 'status': 'Primary page retrieved', 'excerpt': ' '.join(' '.join(relevant[:2]).split()[:45]), 'note': 'CERN is a European laboratory on the French–Swiss border. This historical case is a possible match for the user-described story, not confirmation of a separate French announcement.'}
    except Exception as exc:
        return {**previous, 'url': url, 'attempted_at': stamp(now), 'status': 'Primary page unavailable; verify the link manually', 'error': type(exc).__name__}


def build(previous, now, macro_only=False):
    config = json.loads((ROOT / 'research/sources.json').read_text())
    mechanisms = json.loads((ROOT / 'research/mechanisms.json').read_text())
    jobs = [('macro', key, f'https://fred.stlouisfed.org/graph/fredgraph.csv?id={key}') for key in SERIES]
    if not macro_only:
        jobs += [('news', f['id'], f['url']) for f in config['feeds']]
    def fetch(job):
        kind, key, url = job
        try:
            text = download(url)
            value = parse_fred(text, key, now) if kind == 'macro' else parse_feed(text, next(f for f in config['feeds'] if f['id'] == key), mechanisms, now)
            return kind, key, value, None
        except Exception as exc:
            return kind, key, None, type(exc).__name__
    with ThreadPoolExecutor(max_workers=3) as pool:
        results = list(pool.map(fetch, jobs))
    raw, failures, news, health = {}, [], [], []
    for kind, key, value, error in results:
        if kind == 'macro':
            if error:
                failures.append({'series': key, 'error': error})
            else:
                raw[key] = value
        else:
            feed = next(f for f in config['feeds'] if f['id'] == key)
            cached = []
            if error:
                for item in previous.get('news', []):
                    if item['source_id'] == key and parse_date(item['published_at']) >= now - timedelta(days=14):
                        cached.append({**item, 'cached': True})
                news.extend(cached)
            else:
                news.extend(value)
            old = next((h for h in previous.get('feed_health', []) if h['id'] == key), {})
            health.append({'id': key, 'name': feed['name'], 'url': feed['url'], 'checked_at': stamp(now), 'status': 'Unavailable; retained dated headlines' if error else 'Fetched', 'error': error, 'last_success': old.get('last_success') if error else stamp(now), 'matched': len(cached if error else value)})
    if not raw and all(h['error'] for h in health):
        raise RuntimeError('All macro and news sources failed; retaining existing research.json')
    macro = macro_signals(raw, now, failures)
    if macro_only:
        previous_case = previous.get('gold_case', {})
        if previous_case.get('excerpt'):
            try:
                previous = {**previous, 'gold_case': {**previous_case, 'excerpt': previous_case['excerpt'].encode('latin1').decode('utf-8')}}
            except (UnicodeEncodeError, UnicodeDecodeError):
                pass
    if ('GDPC1' not in raw or 'CPIAUCSL' not in raw) and previous.get('macro'):
        macro = {**previous['macro'], 'stale': True, 'attempted_at': stamp(now), 'failures': failures}
    if macro_only:
        if not previous:
            raise ValueError('A macro-only refresh requires an existing research snapshot')
        # Do not claim that headlines were rechecked when only FRED was read.
        return {**previous, 'macro': macro}
    unique, titles = {}, set()
    for item in sorted(news, key=lambda x: (x['cached'], -parse_date(x['published_at']).timestamp())):
        normalized = re.sub(r'\W+', '', item['title'].lower())
        if item['url'] not in unique and normalized not in titles:
            unique[item['url']] = item
            titles.add(normalized)
    news = group_events(unique.values())
    return {'meta': {'checked_at': stamp(now), 'region': 'United States', 'refresh': '15-minute scheduled scan; GitHub queue and publisher delays apply.', 'model': 'Transparent heuristic signals inspired by Dalio; not a Bridgewater model or official cycle call.', 'news_window_days': 14, 'analysis': 'Headline-matched mechanism templates, not full-article reading, AI reporting or verified causal effects.'},
            'macro': macro, 'news': news, 'feed_health': health, 'sources': config['sources'], 'mechanisms': mechanisms,
            'gold_case': check_case(config['case_source'], now, previous.get('gold_case', {}))}


def write_atomic(payload, output):
    content = json.dumps(payload, ensure_ascii=False, indent=2, allow_nan=False) + '\n'
    output.parent.mkdir(parents=True, exist_ok=True)
    path = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=output.parent, delete=False) as stream:
            path = Path(stream.name)
            stream.write(content)
        os.replace(path, output)
    finally:
        if path is not None:
            path.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=OUTPUT)
    parser.add_argument('--macro-only', action='store_true', help='Refresh only FRED in an existing snapshot; retain news scan dates')
    args = parser.parse_args()
    previous = json.loads(args.output.read_text()) if args.output.exists() else {}
    try:
        payload = build(previous, datetime.now(timezone.utc), args.macro_only)
        write_atomic(payload, args.output)
    except Exception as exc:
        print(f'Research refresh failed; previous data retained: {exc}', file=sys.stderr)
        return 1
    print(f"Research refreshed: {len(payload['news'])} matched headlines; "
          f"{sum(h['status'] == 'Fetched' for h in payload['feed_health'])}/{len(payload['feed_health'])} feeds fetched.")
    print(f"Weather: {payload['macro']['weather']}; short cycle: {payload['macro']['short_cycle']}")
    print(json.dumps(payload['gold_case'], ensure_ascii=False))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
