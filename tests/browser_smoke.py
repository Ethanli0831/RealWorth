"""Real Chromium functional checks. Optional dev dependency: playwright.

Run: python tests/browser_smoke.py [--base-url https://host/project/]
The default starts an ephemeral local static server. CDN JavaScript is fetched
with system TLS verification and its pinned SHA-384 checked before routing it
to Chromium, whose cloud proxy trust store can differ from system Python.
No HTTPS verification is disabled. Data requests use the actual site. For
cloud browsers without the system proxy CA, --system-tls-transport fetches
the public site through Python's verified HTTPS transport before fulfillment.
"""

import argparse
import base64
import functools
import hashlib
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import shutil
import threading
from urllib.parse import urlsplit
from urllib.request import urlopen
from urllib.error import HTTPError

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
CDN = "https://cdn.jsdelivr.net/npm/chart.js@4.4.8/dist/chart.umd.js"
EXPECTED = "sitkSLEO56SJYRloHWybrHos3JVvByQSlOZYJ1HiExytjxUlVOernDbpQcOgwtW8"


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url")
    parser.add_argument("--system-tls-transport", action="store_true",
                        help="Fetch the HTTPS test site with system TLS verification for cloud Chromium proxy trust differences")
    parser.add_argument("--screenshot", type=Path)
    parser.add_argument("--mobile-screenshot", type=Path)
    args = parser.parse_args()
    server = None
    if args.base_url:
        base = args.base_url.rstrip("/") + "/"
    else:
        server = ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(ROOT / "docs")))
        threading.Thread(target=server.serve_forever, daemon=True).start()
        base = f"http://127.0.0.1:{server.server_port}/"
    if args.system_tls_transport and urlsplit(base).scheme != "https":
        parser.error("--system-tls-transport requires an HTTPS --base-url")
    with urlopen(CDN, timeout=30) as response:
        chart_js = response.read()
        chart_type = response.headers.get("Content-Type", "application/javascript")
        cors = response.headers.get("Access-Control-Allow-Origin")
    assert base64.b64encode(hashlib.sha384(chart_js).digest()).decode() == EXPECTED, "CDN integrity mismatch"
    assert cors == "*", "CDN must support the site's anonymous CORS/SRI request"
    with urlopen(base + "data/data.json", timeout=30) as response:
        data = json.load(response)
    with urlopen(base + "data/research.json", timeout=30) as response:
        research = json.load(response)
    with urlopen(base + "data/forecasts.json", timeout=30) as response:
        forecast_data = json.load(response)
    with urlopen(base + "data/intelligence.json", timeout=30) as response:
        ai_data = json.load(response)
    assert ai_data["meta"]["ai_interpretations"] > 0, "Real model output is required for end-to-end validation"
    options = {"headless": True, "args": ["--no-sandbox"]}
    if shutil.which("chromium"):
        options["executable_path"] = shutil.which("chromium")
    proxy_url = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")
    if proxy_url:
        proxy_parts = urlsplit(proxy_url)
        proxy = {"server": f"{proxy_parts.scheme}://{proxy_parts.hostname}:{proxy_parts.port}", "bypass": "127.0.0.1,localhost"}
        if proxy_parts.username:
            proxy["username"] = proxy_parts.username
        if proxy_parts.password:
            proxy["password"] = proxy_parts.password
        options["proxy"] = proxy
    checks = 0
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(**options)
            context = browser.new_context(viewport={"width": 1440, "height": 1000}, reduced_motion="reduce")
            if args.system_tls_transport:
                def fetch_verified_site(route):
                    assert route.request.method == "GET", "Smoke checks only support read-only site requests"
                    try:
                        response = urlopen(route.request.url, timeout=30)
                    except HTTPError as error:
                        response = error
                    with response:
                        route.fulfill(status=response.code,
                                      content_type=response.headers.get("Content-Type", "application/octet-stream"),
                                      body=response.read())
                context.route(base + "**", fetch_verified_site)
            context.route(CDN, lambda route: route.fulfill(status=200, headers={"content-type": chart_type, "access-control-allow-origin": cors}, body=chart_js))
            page = context.new_page()
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            def visit(path):
                page.goto(base + path, wait_until="networkidle")

            visit("")
            assert page.locator(".path-card").count() == 3
            assert page.locator("#calculator").count() == 0
            page.locator(".site-directory").evaluate("e=>e.open=true")
            assert page.get_by_role("link", name="News & analysis", exact=True).is_visible()
            assert page.get_by_role("link", name="Today → Tomorrow", exact=True).is_visible()
            checks += 1

            visit("#calculator")
            page.wait_for_url("**/purchasing-power.html#calculator")
            assert page.locator("#calculator-results").is_visible()
            assert float(page.locator("#hold-drawdown").inner_text().replace("%", "")) < -60
            assert page.locator("#comparison-body tr").count() == 5
            assert page.evaluate("Chart.getChart(document.getElementById('comparison-chart')).data.datasets.length") == 5
            assert "Bitcoin" in page.locator("#comparison-body").inner_text()
            checks += 1

            page.locator("#buy-month").fill("2021-11")
            page.wait_for_function("document.querySelector(\"#holding-period option[value=\'60\']\").disabled")
            assert "Unavailable terms" in page.locator("#period-help").inner_text()
            page.locator("#holding-period").select_option("36")
            assert "36 months" in page.locator("#result-period").inner_text()
            checks += 1

            page.locator("#buy-month").fill("2025-09")
            page.locator("#holding-period").select_option("latest")
            assert page.locator("#gap-warning").is_visible()
            assert page.evaluate("Chart.getChart(document.getElementById('comparison-chart')).data.datasets.every(d=>d.data[1]===null)")
            page.locator("#buy-month").fill("2025-10")
            assert page.locator("#real-value").inner_text() == "No data"
            assert "No starting CPI" in page.locator("#comparison-body").inner_text()
            checks += 1

            visit("research.html")
            assert page.locator("#history-scope").input_value() == "common"
            assert "Sep 2014" in page.locator("#scorecard-period").inner_text()
            assert page.locator("#scorecard-body tr").count() == 5
            common_gold=page.locator("#scorecard-body tr[data-asset='Gold'] [data-metric='ann_real_return']").evaluate("e=>e.childNodes[0].textContent")
            page.locator("#history-scope").select_option("full")
            for asset in data["meta"]["assets"]:
                row=page.locator("#scorecard-body tr").filter(has=page.get_by_role("rowheader",name=asset,exact=False))
                for key,value in data['scorecard'][asset].items():
                    actual=row.locator(f'[data-metric="{key}"]').evaluate("e=>e.childNodes[0].textContent")
                    expected="Not defined" if value is None else f"{value:.3f}" if key in ['sharpe','calmar'] else f"{value:.2f}%"
                    assert actual==expected,(asset,key,actual,expected)
            assert common_gold != page.locator("#scorecard-body tr[data-asset='Gold'] [data-metric='ann_real_return']").evaluate("e=>e.childNodes[0].textContent")
            checks += 1

            assert page.locator("#rolling-period").input_value() == "36"
            assert page.locator("#rolling-body tr").count() == 5
            old_rolling=page.locator("#rolling-body").inner_text()
            page.locator("#rolling-period").select_option("60")
            assert old_rolling != page.locator("#rolling-body").inner_text()
            assert "not independent" in page.locator("#rolling").inner_text()
            checks += 1

            october=data['growth']['dates'].index('2025-10')
            assert page.evaluate("i=>Chart.getChart(document.getElementById('cpi-chart')).data.datasets[0].data[i]",october) is None
            assert page.locator("#regime-return-kind").input_value()=="real"
            assert page.locator("#regime-table-body tr").count()==10
            assert page.locator("#regime-table-body").is_visible()
            before=page.locator("#regime-table-body").inner_text()
            page.locator("#regime-return-kind").select_option("nominal")
            assert before != page.locator("#regime-table-body").inner_text()
            page.locator("#trend-toggle").click()
            assert page.locator("#trend-toggle").get_attribute("aria-pressed")=="true"
            assert "Rising" in page.locator("#regime-table-body").inner_text()
            page.locator("#quartile-toggle").click()
            assert "Top 25%" in page.locator("#regime-table-body").inner_text()
            checks += 1

            assert page.locator('#research-content').is_visible()
            assert page.locator('#macro-body tr').count()==10
            page.locator('#source-directory-details').evaluate('e=>e.open=true')
            page.locator('#source-category').select_option('Bank research')
            assert page.locator('.source-card').count()==8
            page.locator('#source-category').select_option('Journalism')
            assert page.locator('.source-card').count()==3
            checks += 1

            visit('monitor.html')
            assert page.locator('#forecast-content').is_visible()
            assert page.locator('.forecast-card').count()==5
            assert not page.locator('#baseline-finding').is_visible()
            assert page.locator('.card-explanation').count()==5
            assert page.locator('.asset-plain-description').count()==5
            page.locator('.baseline-methods').evaluate('e=>e.open=true')
            assert page.locator('#forecast-backtest-body').is_visible()
            page.locator('.baseline-methods').evaluate('e=>e.open=false')
            assert page.locator('#verification-by-asset tr').count()==5
            assert 'not direction' in page.locator('#forecast-verification').inner_text()
            for row in forecast_data['assets']:
                card=page.locator('.forecast-card').filter(has=page.get_by_role('heading',name=row['asset'],exact=True))
                if row.get('forecast'):
                    expected=f"${row['forecast']['levels']['q50']:,.2f}"
                    assert expected in card.inner_text(),(row['asset'],expected)
            checks += 1

            # The money-purpose screen uses real research, not fabricated model answers.
            assert page.locator('#money-purpose').evaluate('e=>e.selectedOptions[0].textContent')=='Choose an answer'
            def answer_money(**changes):
                values={'purpose':'surplus','horizon':'60','loss':'50','readiness':'ready','goal':'growth','currency':'USD'}
                values.update(changes)
                for key,value in values.items():page.locator('#money-'+key).select_option(value)
                page.locator('#money-form button[type=submit]').click()
                page.wait_for_function("!document.querySelector('#money-form button').disabled")
                assert page.locator('#money-result').is_visible()

            answer_money(purpose='essential',loss='100',goal='quick')
            assert 'Keep this money out' in page.locator('#money-result h3').inner_text()
            assert page.locator('.money-asset[data-status=avoid]').count()==5
            assert 'quick profit is not established' in page.locator('#money-result').inner_text()
            assert all('Not suitable' in n.inner_text() for n in page.locator('.card-fit').all())
            checks += 1

            answer_money()
            assert page.locator('.money-asset[data-asset="S&P 500"]').get_attribute('data-status')=='research'
            assert page.locator('.money-asset[data-asset="Bitcoin"]').get_attribute('data-status')=='partial'
            assert page.locator('.budget-illustration').count()>0
            page.locator('.money-asset details').first.evaluate('e=>e.open=true')
            assert data['meta']['data_through'] in page.locator('.money-asset details[open]').first.inner_text()
            assert 'not predictions' in page.locator('.money-asset details[open]').first.inner_text()
            page.locator('#money-goal').select_option('quick')
            assert page.locator('#money-result').is_hidden()
            assert 'Answers changed' in page.locator('#money-status').inner_text()
            checks += 1

            answer_money(goal='quick',loss='100',horizon='0')
            assert 'quick-profit' in page.locator('#money-result h3').inner_text()
            assert page.locator('.money-asset[data-status=observe]').count()==5
            assert page.locator('[data-guide-language]').count()==0
            assert 'What is this money for?' in page.locator('#money-title').inner_text()
            assert 'What this means' in page.locator('.card-explanation').first.inner_text()
            checks += 1

            answer_money(currency='CAD')
            assert 'USD comparisons' in page.locator('#money-result h3').inner_text()
            assert page.locator('.money-asset[data-status=conditional]').count()>0
            assert page.locator('.budget-illustration').count()==0
            answer_money(readiness='no-reserve')
            assert 'emergency reserve' in page.locator('#money-result h3').inner_text()
            assert page.locator('.money-asset[data-status=avoid]').count()==5
            checks += 1

            assert page.locator('#news-content').is_visible()
            relevant=next(n for n in research['news'] if n['topics'])
            page.locator('#news-topic').select_option(relevant['topics'][0])
            assert page.locator('.news-card .chain-detail').count()>0
            page.locator('.news-card .chain-detail').first.evaluate('e=>e.open=true')
            page.locator('#research-refresh').click()
            page.wait_for_function("!document.getElementById('research-refresh').disabled")
            assert page.locator('.news-card .chain-detail').first.get_attribute('open') is not None
            page.locator('#news-search').fill('NO_MATCH_739450')
            assert page.locator('.news-card').count()==0
            page.locator('#news-search').fill('')
            page.locator('#news-topic').select_option('unclassified')
            for card in page.locator('.news-card').all():
                assert card.locator('.chain-detail').count()==0
                assert card.locator('.article-ai details').count()==0
                assert 'No clear macro impact' in card.inner_text()
            page.locator('#news-topic').select_option('')
            page.locator('#news-more').click() if page.locator('#news-more').is_visible() else None
            assert page.locator('.article-ai details').count()>0
            page.locator('.article-ai details').first.evaluate('e=>e.open=true')
            assert 'Qwen/' in page.locator('.article-ai details[open]').first.inner_text()
            checks += 1

            assert page.locator('.structure-card').count()==12
            assert 'percentile' in page.locator('#market-structure').inner_text()
            checks += 1

            for path in ['', 'purchasing-power.html','research.html','monitor.html','methodology.html','about.html','learn.html','bitcoin-inflation.html','compare-purchasing-power.html','forecast-evidence.html']:
                page.set_viewport_size({'width':390,'height':844})
                visit(path)
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),path
                assert page.locator('.disclaimer').bounding_box()['y']<360,path
            if args.mobile_screenshot:
                page.goto(base+'monitor.html',wait_until='networkidle')
                page.screenshot(path=str(args.mobile_screenshot),full_page=True)
            checks += 1
            page.set_viewport_size({'width':1440,'height':1000})
            if args.screenshot:
                visit('monitor.html'); page.screenshot(path=str(args.screenshot),full_page=True)

            visit('methodology.html')
            for i in range(5):
                assert page.locator('#quiz-progress').inner_text()==f'Question {i+1} of 5'
                page.locator('#quiz-response').fill('My explanation');page.locator('#quiz-show').click()
                assert page.locator('#quiz-answer').is_visible();page.locator('#quiz-next').click()
            checks += 1

            missing=context.new_page()
            missing.route('**/data/data.json',lambda r:r.fulfill(status=404,content_type='text/plain',body='Not found'))
            missing.goto(base+'purchasing-power.html',wait_until='networkidle')
            assert 'HTTP 404' in missing.locator('#load-status').inner_text()
            assert missing.locator('#asset').is_disabled()
            checks += 1

            degraded=context.new_page();degraded.route(CDN,lambda r:r.abort())
            degraded.goto(base+'research.html',wait_until='networkidle')
            assert degraded.locator('#chart-warning').is_visible()
            assert degraded.locator('#scorecard-body tr').count()==5
            checks += 1

            no_ai=context.new_page();no_ai.route('**/data/intelligence.json',lambda r:r.fulfill(status=503,body='Unavailable'))
            no_ai.goto(base+'monitor.html',wait_until='networkidle')
            assert no_ai.locator('.forecast-card').count()==5
            assert 'not available' in no_ai.locator('#article-ai-status').inner_text()
            checks += 1

            no_news=context.new_page();no_news.route('**/data/research.json',lambda r:r.fulfill(status=503,body='Unavailable'))
            no_news.goto(base+'monitor.html',wait_until='networkidle')
            assert 'HTTP 503' in no_news.locator('#research-load-status').inner_text()
            assert no_news.locator('.forecast-card').count()==5
            checks += 1

            no_structure=context.new_page();no_structure.route('**/data/structure.json',lambda r:r.fulfill(status=503,body='Unavailable'))
            no_structure.goto(base+'monitor.html',wait_until='networkidle')
            assert 'unavailable' in no_structure.locator('#structure-status').inner_text()
            assert no_structure.locator('.forecast-card').count()==5
            checks += 1
            no_evidence=context.new_page()
            no_evidence.route('**/data/data.json',lambda r:r.fulfill(status=503,body='Unavailable'))
            no_evidence.goto(base+'monitor.html',wait_until='networkidle')
            for key,value in {'purpose':'surplus','horizon':'60','loss':'100','readiness':'ready','goal':'growth','currency':'USD'}.items():no_evidence.locator('#money-'+key).select_option(value)
            no_evidence.locator('#money-form button').click()
            no_evidence.wait_for_function("!document.querySelector('#money-form button').disabled")
            assert 'No asset is being cleared' in no_evidence.locator('#money-result').inner_text()
            assert no_evidence.locator('.money-asset').count()==0
            assert no_evidence.locator('.forecast-card').count()==5
            checks += 1
            # English-only output must not depend on the browser's preferred locale.
            locale_context=browser.new_context(locale='zh-CN')
            locale_context.route(CDN, lambda route: route.fulfill(status=200, headers={'content-type': chart_type, 'access-control-allow-origin': cors}, body=chart_js))
            if args.system_tls_transport:
                locale_context.route(base + '**', fetch_verified_site)
            locale_page=locale_context.new_page()
            locale_page.goto(base+'monitor.html',wait_until='networkidle')
            assert locale_page.locator('#money-title').inner_text()=='What is this money for?'
            assert locale_page.locator('[data-guide-language]').count()==0
            assert locale_page.locator('.card-explanation').count()==5
            locale_context.close()
            checks += 1
            visit('about.html')
            assert 'GitHub repository' in page.locator('main').inner_text()
            assert page.locator('script[type="application/ld+json"]').count()==1
            checks += 1
            assert not errors,errors
            browser.close()
        print(f'PASS: {checks} real-browser functional scenarios; ten pages, English-only guidance, comparisons, evidence and source failures.')
    finally:
        if server:server.shutdown()

if __name__ == '__main__':
    main()
