"""Real Chromium functional checks. Optional dev dependency: playwright.

Run: python tests/browser_smoke.py [--base-url https://host/project/]
The default starts an ephemeral local static server. CDN JavaScript is fetched
with system TLS verification and its pinned SHA-384 checked before routing it
to Chromium, whose cloud proxy trust store can differ from system Python.
No HTTPS verification is disabled. Data requests use the actual site.
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
    with urlopen(CDN, timeout=30) as response:
        chart_js = response.read()
        chart_type = response.headers.get("Content-Type", "application/javascript")
        cors = response.headers.get("Access-Control-Allow-Origin")
    assert base64.b64encode(hashlib.sha384(chart_js).digest()).decode() == EXPECTED, "CDN integrity mismatch"
    assert cors == "*", "CDN must support the site's anonymous CORS/SRI request"
    with urlopen(base + "data/data.json", timeout=30) as response:
        data = json.load(response)
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
            context.route(CDN, lambda route: route.fulfill(status=200, headers={"content-type": chart_type, "access-control-allow-origin": cors}, body=chart_js))
            page = context.new_page()
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.goto(base, wait_until="networkidle")
            assert page.locator("#calculator-results").is_visible()
            assert page.evaluate("typeof Chart === 'function'")
            assert page.evaluate("['investment-chart','drawdown-chart','cpi-chart','regime-chart'].every(id=>!!Chart.getChart(document.getElementById(id)))")
            assert float(page.locator("#hold-drawdown").inner_text().replace("%", "")) < -60
            checks += 1

            for asset in data["meta"]["assets"]:
                row = page.locator("#scorecard-body tr").filter(has=page.get_by_role("rowheader", name=asset, exact=False))
                assert row.count() == 1
                for key, value in data["scorecard"][asset].items():
                    actual = row.locator(f'[data-metric="{key}"]').evaluate("e=>e.childNodes[0].textContent")
                    expected = "Not defined" if value is None else f"{value:.3f}" if key in ["sharpe", "calmar"] else f"{value:.2f}%"
                    assert actual == expected, (asset, key, actual, expected)
            checks += 1

            assert page.locator("#current-inflation").inner_text() == f'{data["regime"]["current_yoy"]:.2f}%'
            assert data["regime"]["current_regime"] in page.locator("#regime-badge").inner_text()
            october = data["growth"]["dates"].index("2025-10")
            assert page.evaluate("i=>Chart.getChart(document.getElementById('cpi-chart')).data.datasets[0].data[i]", october) is None
            assert page.evaluate("Chart.getChart(document.getElementById('cpi-chart')).data.datasets[0].spanGaps") is False
            checks += 1

            page.get_by_role("button", name="Top vs Bottom 25%", exact=True).click()
            assert page.locator("#quartile-toggle").get_attribute("aria-pressed") == "true"
            plotted = page.evaluate("Chart.getChart(document.getElementById('regime-chart')).data.datasets[0].data")
            assert plotted == [data["regime"]["by_quartile"]["Top 25%"][asset] for asset in data["meta"]["assets"]]
            page.get_by_role("button", name="High vs Low", exact=True).click()
            checks += 1

            page.locator("#asset").select_option("Gold")
            assert float(page.locator("#hold-drawdown").inner_text().replace("%", "")) > -30
            page.locator("#holding-period").select_option("120")
            assert page.locator("#calculator-error").is_visible()
            assert "last available month" in page.locator("#calculator-error").inner_text()
            checks += 1

            page.locator("#holding-period").select_option("latest")
            page.locator("#buy-month").fill("2025-10")
            assert page.locator("#real-value").inner_text() == "No data"
            assert page.locator("#nominal-value").inner_text().startswith("$")
            page.locator("#buy-month").fill("2025-09")
            assert page.locator("#real-value").inner_text() != "No data"
            assert page.locator("#gap-warning").is_visible()
            assert page.evaluate("Chart.getChart(document.getElementById('investment-chart')).data.datasets[0].data[1]") is None
            checks += 1

            page.reload(wait_until="networkidle")
            if args.screenshot:
                args.screenshot.parent.mkdir(parents=True, exist_ok=True)
                page.screenshot(path=str(args.screenshot), full_page=True)
            page.set_viewport_size({"width": 390, "height": 844})
            page.wait_for_function("document.documentElement.scrollWidth <= innerWidth", timeout=5000)
            assert page.locator(".disclaimer").bounding_box()["y"] < 350
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
            score_scroll = page.locator(".table-wrap").first
            assert score_scroll.evaluate("e=>e.scrollWidth > e.clientWidth")
            assert page.locator("#amount").bounding_box()["height"] >= 44
            if args.mobile_screenshot:
                args.mobile_screenshot.parent.mkdir(parents=True, exist_ok=True)
                page.screenshot(path=str(args.mobile_screenshot), full_page=True)
            checks += 1

            page.goto(base + "methodology.html", wait_until="networkidle")
            assert page.locator("#quiz-progress").inner_text() == "Question 1 of 5"
            for i in range(5):
                assert page.locator("#quiz-progress").inner_text() == f"Question {i + 1} of 5"
                page.locator("#quiz-response").fill("My explanation")
                page.locator("#quiz-show").click()
                assert page.locator("#quiz-answer").is_visible()
                page.locator("#quiz-next").click()
            assert page.locator("#quiz-progress").inner_text() == "Question 1 of 5"
            checks += 1
            assert not errors, errors

            # Source failures remain visible, without fabricated zero returns.
            missing = context.new_page()
            missing.route("**/data/data.json", lambda route: route.fulfill(status=404, content_type="text/plain", body="Not found"))
            missing.goto(base, wait_until="networkidle")
            assert "HTTP 404" in missing.locator("#load-status").inner_text()
            assert missing.locator("#calculator-inputs").get_attribute("disabled") is not None
            assert missing.locator("#asset").is_disabled()
            checks += 1

            # A missing CDN is a graceful degraded mode, not a blank page.
            degraded = context.new_page()
            degraded.route(CDN, lambda route: route.abort())
            degraded.goto(base, wait_until="networkidle")
            assert degraded.locator("#chart-warning").is_visible()
            assert degraded.locator("#calculator-results").is_visible()
            assert degraded.locator("#scorecard-body tr").count() == 5
            checks += 1

            unknown_data = json.loads(json.dumps(data))
            unknown_data["regime"]["cpi_yoy"][-1] = None
            for key in ["current_yoy", "current_regime", "current_quartile"]:
                unknown_data["regime"][key] = None
            unknown = context.new_page()
            unknown.route("**/data/data.json", lambda route: route.fulfill(status=200, content_type="application/json", body=json.dumps(unknown_data)))
            unknown.goto(base, wait_until="networkidle")
            assert unknown.locator("#current-inflation").inner_text() == "No data"
            assert unknown.locator("#regime-badge").inner_text() == "Current regime: no data"
            assert "do not assign" in unknown.locator("#regime-summary").inner_text()
            checks += 1
            browser.close()
    finally:
        if server:
            server.shutdown()
            server.server_close()
    print(f"PASS: {checks} real-browser functional scenarios; desktop, mobile, charts, quiz and failure states.")


if __name__ == "__main__":
    main()
