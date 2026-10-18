# RealWorth — Store-of-Value Dashboard

An independent educational project comparing Bitcoin (`BTC-USD`), gold (`GLD`),
the S&P 500 (`SPY`), Treasury bills (`BIL`), and long-term Treasury bonds (`TLT`).
Three investment tools show returns after inflation, a risk
scorecard, and historical returns in inflation regimes. Research sections add
US economic-weather signals, attributed news impact chains, evidence-linked
article AI and frozen next-period price scenarios. The website uses
plain HTML, CSS, vanilla JavaScript and Chart.js from a pinned CDN; there is no
frontend build or API server. Educational research, not financial advice.

**Live website:** https://ethanli0831.github.io/RealWorth/

GitHub Pages serves `main /docs`. The public site and all three tools were
verified after deployment; see [VALIDATION.md](VALIDATION.md).

**Source:** https://github.com/Ethanli0831/RealWorth

**中文网站说明书：** [操作方法、指标解读与维护说明](USER_GUIDE.zh-CN.md)

![RealWorth's calculator, five-asset scorecard and inflation charts](docs/assets/screenshot.png)

## Use the website locally

From the repository root, run:

```sh
python -m http.server 8000 --directory docs
```

Open `http://localhost:8000` in a browser. Opening `index.html` directly with
`file://` will not load the JSON. You can serve the existing dataset without
installing the financial-data dependencies. Chart.js needs Internet access;
if its CDN is unavailable, calculations and tables still work with a clear
chart warning.

The calculator buys and sells at month end. Try Bitcoin, November 2021, one
year, $1,000; then select Gold for comparison. Choose “Until latest data” to
use the most recent released CPI month. Missing CPI produces No data and
chart gaps, not an invented inflation rate.

## Run the data pipeline

Use Python 3.11 or newer. From the repository root:

```sh
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python scripts/build_data.py
```

On Windows, activate with `.venv\Scripts\Activate.ps1` in PowerShell instead.
No API keys are needed. Internet access to FRED and Yahoo Finance is required.
Restricted cloud environments need these destinations allowed:
`fred.stlouisfed.org`, `query1.finance.yahoo.com`,
`query2.finance.yahoo.com`, and `fc.yahoo.com`.

The script writes **only** `docs/data/data.json` as a project data output.
Yahoo's authentication/timezone cache lives in the operating system's temporary
directory, outside the repository. Raw prices and CPI levels are never written
to the public site. Do not fabricate data.json if a download fails.

For a historical cutoff:

```sh
python scripts/build_data.py --end 2025-12-31
```

`--end` is inclusive; mid-month dates exclude that unfinished month. Yahoo's
exclusive download end is advanced one day so December 31 is included. Default
runs use completed months through the latest available CPI observation.
Historical cutoffs deliberately replace the output, so rerun without `--end`
before publishing the latest data.

Run the calculation and failure-safety tests:

```sh
python -m unittest discover -s tests -v
node --test tests/test_dashboard.js
```

Node 22 or newer is used only for these dependency-free JavaScript tests.
It is not needed to serve the site. For optional real-browser checks:

```sh
python -m pip install -r requirements-dev.txt
python -m playwright install chromium
python tests/browser_smoke.py
```

The browser test starts an ephemeral local server and checks all tools,
desktop/mobile layouts, the self-check quiz, and failure states. In cloud
machines where Chromium and Python have different HTTPS proxy trust stores,
the test downloads official Chart.js with system TLS verification, verifies
the same pinned SHA-384 checksum used in the page, then routes those bytes
to the browser. TLS verification and SRI remain enabled. Production pages
continue to use the CDN directly.

To check the live site from a cloud browser that does not trust the system's
HTTPS proxy certificate, run:

```sh
python tests/browser_smoke.py --base-url https://ethanli0831.github.io/RealWorth/ --system-tls-transport
```

This option fetches actual public pages, assets and data with Python's verified
HTTPS transport before the browser executes them. It does not replace remote
content with local files or disable certificate checks. Normal browsers can
omit the option.

To compare the paper without replacing the live dataset:

```sh
python scripts/compare_paper.py > PAPER_COMPARISON.md
```

See [PAPER_COMPARISON.md](PAPER_COMPARISON.md) for actual differences. The
original within-0.01 paper criterion is not passed: this independent project
uses the explicitly approved exact-return method. It does not force numbers
to match the paper.

## Monthly automatic update

[update-data.yml](.github/workflows/update-data.yml) runs on the **18th of every
month at 06:00 UTC**, can be run manually, and validates changes pushed to main.
It uses Ubuntu and Python 3.11, caches pip downloads, installs pinned packages,
runs the tests and rebuilds derived JSON. It commits **only** a changed
`docs/data/data.json` as `github-actions[bot]`, with the message
`Monthly data update YYYY-MM`. An unchanged repeat run makes no data commit.
No custom API keys or secrets are required: GitHub supplies its own scoped
workflow token.

The workflow explicitly requests a Pages rebuild with `pages: write` after
an automated data commit. A push using `GITHUB_TOKEN` alone does not trigger
Pages reliably. The monthly and quote/news writers share a concurrency lock;
the slower article-AI job runs separately. Each writer rebases its isolated
data commit before pushing. A source failure preserves its previous dated
JSON; the Actions tab reports failures and partial-refresh warnings.

## GitHub Pages setup and checks

1. Open the repository → **Settings → Pages**. Under Build and deployment,
   select **Deploy from a branch**, choose **main** and **/docs**, then **Save**.
2. Open **Settings → Actions → General → Workflow permissions**. The workflow
   explicitly requests `contents: write` and `pages: write`. If your repository
   or organisation restricts those requests, permit the required writes; use
   **Read and write permissions** if that is the available setting. No permission
   to approve pull requests is needed.
3. Open **Actions → Monthly data update → Run workflow**, select **main**, and
   click **Run workflow**. Open the run and check every step has a green tick.
4. Run it again on the same UTC date. “Commit only changed derived data” should
   say **Data unchanged; no commit**. Genuine vendor revisions can still change
   metrics and produce a legitimate update.
5. In **Settings → Pages**, follow **Visit site**. The expected address is
   `https://ethanli0831.github.io/RealWorth/`. Confirm all three sections and
   the methodology page load. Test on your own phone as well.

The optional **Publish website** workflow requests a fresh build from the
Actions tab and does not require a personal token. If Pages is disabled, it
also attempts to enable the same `main /docs` source. GitHub denied this
creation request during setup even with `pages: write`, so the owner enabled
Pages in Settings instead. Do not rely on the workflow to bypass that
permission requirement. It is manually triggered only.

## What the files do

| File | Main ideas to understand |
|---|---|
| `requirements.txt` | yfinance fetches assets; pandas aligns months; numpy supports calculations; requests fetches CPI. Versions are pinned. |
| `scripts/build_data.py` | Downloads with retries; validates dates and values; computes exact indices and metrics; atomically replaces one JSON file. |
| `docs/index.html` | Accessible page structure; labelled inputs; three anchored tools; visible disclaimer and source links. |
| `docs/assets/style.css` | Shared colours and typography; single-column layout below 700px; contained table scrolling; large tap targets and focus styles. |
| `docs/assets/app.js` | Validates one dataset; computes endpoint ratios and observed drawdowns; renders tables and charts; handles missing data and errors. |
| `docs/methodology.html` | Defines formulas; explains sources and missing CPI; describes limitations; offers a five-question self-check. |
| `.github/workflows/update-data.yml` | Defines triggers and permissions; runs tests and refresh; commits JSON only; requests Pages rebuild. |
| `tests/` | Synthetic arithmetic/failure cases; real-data JavaScript checks; real Chromium functional and mobile checks. |

See [LEARNING.md](LEARNING.md) for a short guide and two actual mistakes caught
during development. The self-check is not automatically graded: being able to
explain the files remains a student task.

## Calculation conventions

These are explicitly chosen conventions for this independent project, not a
claim that it exactly reproduces every number in the research paper.

- **Prices:** daily adjusted closes, explicitly `auto_adjust=True`, resampled
  to the final available closing price in each calendar month. ETF distributions
  are included via Yahoo's adjustments. Each asset uses its own available
  history: January 2014 for the ETFs, September 2014 for Yahoo's Bitcoin series.
- **Monthly nominal return:** `P[t] / P[t-1] - 1`. Monthly inflation is
  `CPI[t] / CPI[t-1] - 1` using seasonally adjusted US `CPIAUCSL`.
- **Monthly real return:** the exact formula
  `(1 + nominal) / (1 + inflation) - 1`, rather than the paper's approximation
  `nominal - inflation`. The independent project uses the exact formula by
  the author's decision on 2026-10-09.
- **Nominal growth:** start at 1 at each asset's first month-end, then compound
  `product(1 + monthly nominal return)`.
- **Real growth:** `nominal_growth[t] * CPI[baseline] / CPI[t]`. This measures
  purchasing power in **baseline-month dollars**. A calculator taking the
  ratio between two real indices measures purchasing power in buy-month
  dollars. It should not label that result as dollars of today's purchasing
  power. Earlier Bitcoin dates and months with missing CPI are JSON `null`.
  A buy month means buying at that **month's end**, not its beginning.
- **Annualised real return:** geometric CAGR,
  `final_real_growth ** (12 / elapsed_calendar_months) - 1`. Elapsed time
  includes missing months; it is not the count of observed monthly returns.
- **Annualised volatility:** sample standard deviation of monthly real returns
  (`ddof=1`) times `sqrt(12)`.
- **Sharpe:** `sqrt(12) * mean(excess) / sample_std(excess)`, where excess is
  the asset's real return minus BIL's real return in the same month. BIL is a
  short Treasury bill ETF used as a risk-free proxy, not a guarantee of zero
  risk or a bank deposit. Its own excess return is identically zero, so its
  Sharpe ratio is **undefined** and represented by JSON `null`.
- **Drawdown:** real growth divided by its running peak minus 1, including
  the initial value of 1. Max drawdown is its minimum; current drawdown uses
  its last observation. These are monthly observations and miss crashes
  within a month.
- **Calmar:** real CAGR divided by the absolute max real drawdown. No drawdown
  means an undefined ratio (`null`), rather than infinity.
- **Regimes:** US CPI year-over-year change (`CPI[t] / CPI[t-12] - 1`).
  Thresholds and group means use months with returns for **all five assets**
  and known CPI YoY (normally October 2014 onward, excluding CPI gaps).
  High means strictly above the sample median;
  ties are Low. Bottom quartile means at or below Q25; Top means at or above
  Q75. Quartiles use pandas' default linear interpolation.
- **Regime averages:** arithmetic mean of **nominal** monthly returns in each
  group, matching the reference notebook's regime table. They do not measure
  real purchasing-power preservation or prove an inflation hedge.
- **CPI chart:** YoY inflation from January 2014 onward, with the latest CPI
  determining the current regime. FRED's earlier history supplies the prior
  twelve months. A missing current or prior-year CPI level produces JSON
  `null`, not zero inflation. If the latest month has no YoY observation,
  `current_yoy`, `current_regime`, and `current_quartile` are also `null`.
  All comparisons use unrounded data. Percentages are rounded to two decimals,
  risk ratios to three, growth indices to eight.

### Missing CPI observations

The FRED series has a missing observation for **October 2025**. Missing CPI
is never interpolated, forward-filled, or replaced with zero inflation.

- Nominal growth remains available if the asset price is known. Real growth
  and CPI YoY for a missing CPI month are JSON `null` (the website must show
  **No data** and leave a gap in charts).
- Real growth resumes when CPI is observed again, using the exact ratio to
  the baseline CPI. A return between two known endpoints is calculable even
  if intermediate CPI observations are missing. Buying or selling in a month
  with unknown CPI cannot produce a real-return result.
- Monthly real returns require CPI at **both** consecutive endpoints. Thus
  October **and November 2025** are excluded from volatility and Sharpe.
  The multi-month change across the gap is not treated as a monthly return.
- CAGR uses known endpoint growth and full elapsed calendar time. It therefore
  includes the gain or loss across the gap without shortening the holding time.
- Drawdowns use only observed real growth levels. They may miss an unknown
  peak or trough in a CPI gap and understate the worst fall; the calculator
  must disclose gaps during the selected holding period.
- Regime averages exclude months with unknown CPI YoY. They do not label
  missing inflation as Low. A missing CPI observation also prevents computing
  YoY for the corresponding month one year later.
- Missing CPI at an asset's initial baseline is an error. The script never
  invents a purchasing-power baseline.

## Failure safety and limitations

Each source gets three attempts. Empty responses, incomplete asset histories,
invalid CPI values, missing calendar rows in the FRED CSV, invalid prices,
or invalid calculations cause a nonzero
exit **before** replacement of an existing data file. Output is serialized
with strict JSON and replaced atomically only after all calculations succeed.
Default runs refuse to replace the output with an older data-through month.
An identical rerun on the same UTC date leaves the file unchanged.
Yahoo's adjusted ETF values sometimes vary by about one part per million
between identical downloads. When all metadata, scorecard, regime values,
dates and missing-data positions are unchanged, growth-index differences
within `1e-5` relative tolerance are treated as unchanged (about one cent per
$1,000). Larger changes or any other field changes replace the file. This
avoids commits caused only by data-source precision noise.

Historical data may be revised by Yahoo or FRED. Delisted tickers, changing
Yahoo endpoints/column layouts, and restricted networks can break downloads;
the script reports the failing source and exits with an error. An old output
is retained, so check its `meta.last_updated` and `meta.data_through` for
staleness. Regime thresholds change as the sample expands. The sample covers
US inflation and a period dominated by Bitcoin's bull markets; past returns
do not predict future returns.

### Validation status (2026-10-10)

- All **20** calculation and failure-safety tests pass.
- All **10** JavaScript tests and **11** real Chromium functional scenarios pass.
- GitHub Actions successfully installs dependencies, runs the calculation and
  JavaScript tests, and refreshes the real dataset using Python 3.11.
- The historical run with `--end 2025-12-31` succeeds, leaves October 2025
  real growth/CPI YoY as `null`, and resumes real growth in November.
- The default run succeeds and the generated data file currently covers
  **August 2026**, the latest CPI month returned during setup.
- The repeated default run reports `Unchanged` and leaves the file intact.
- For a November 2021–November 2022 hold, observed max real drawdown is about
  **−71.89%** for Bitcoin and **−18.82%** for gold under the exact formula.

Website and deployment results are recorded in [VALIDATION.md](VALIDATION.md).

The supplied paper and notebook are references, not runtime dependencies.
They are not copied into this public repository. Their cash proxy and real
return conventions vary between sections, and the supplied notebook does not
include the cited Sharpe/Calmar implementation. Matching the published table
was checked: **0/11** values meet the original within-0.01 tolerance. The
approved independent exact-return method does not reproduce those tables.
See [PAPER_COMPARISON.md](PAPER_COMPARISON.md) for values and differences.
No formula is tuned to force a match.

## Licence

Software is licensed under the [MIT License](LICENSE).

## Economic weather and news research

Open [Economic Weather](https://ethanli0831.github.io/RealWorth/#weather) or
[News & Impact Chains](https://ethanli0831.github.io/RealWorth/#news). The weather
panel separates growth/inflation direction from short-cycle credit and policy
signals. It never assigns an unsupported full long-term debt-cycle phase.
Each macro row links to FRED and shows its own period and change baseline.

The reading directory has 18 sources: Dalio, Bridgewater, eight bank research
outlets, three journalism outlets and five primary institutions. Access labels
identify subscription/client restrictions. These reports are reading links,
not a claim that a model has read proprietary research.

`research/sources.json` configures reading sources and RSS feeds;
`research/mechanisms.json` contains transparent hypothesis templates.
`scripts/build_research.py` writes `docs/data/research.json` independently of
the original monthly return pipeline. It uses the same pinned Python packages.
Run it with `python scripts/build_research.py`.

**Economic weather and news update** runs at minutes 7, 22, 37 and 52 UTC and supports
manual dispatch. A visible browser page checks for published snapshots every
five minutes. Real publisher and GitHub queue delays apply. It commits only
research.json, forecasts.json and forecast-ledger.json and requests a Pages rebuild. Headlines are dated, attributed,
keyword-matched, deduplicated and limited to 14 days/60 items. Some sources may
be unavailable; the panel reports coverage and cached items explicitly.
A total source failure retains the previous file and fails the workflow.

Headline-matched impact chains remain labelled conditional rule templates.
Separate **AI-assisted article reading** panels contain actual model output
when public-body reading and content checks succeed. Neither is independent
factual verification or a numerical price forecast. The historical CERN
lead-to-gold example is separate from current news; an independently described
French announcement has not been verified. No automatic gold-to-Bitcoin
substitution is asserted. See the methodology for thresholds and limitations.

Research checks: `python -m unittest discover -s tests -p test_research.py -v`
and `node --test tests/test_research.js`.

## Article AI, quotes and tomorrow's scenarios

Open [Today → Tomorrow](https://ethanli0831.github.io/RealWorth/#outlook).
Current reported quotes cover BTC-USD, GLD, SPY, BIL and TLT. Gold means a GLD
share, not a physical ounce. Quotes refresh on an approximately 15-minute
workflow schedule; the page checks price snapshots each minute. This is
automated polling with provider/queue delays, not a licensed tick feed.

`scripts/build_forecasts.py` freezes a numerical empirical-quantile forecast
for each Bitcoin Eastern-calendar issue day or ETF target/anchor combination, and writes
forecasts.json plus forecast-ledger.json. Scenarios use 252 completed matching-horizon
price log returns. ETFs target the first actual close on/after tomorrow; intraday issues use two-session returns from the previous completed close, and after-close issues use one session. Bitcoin targets
roughly 24h after its anchor. Prior issues are never revised. Historical
walk-forward results and the random-walk baseline are separate from prospective
verification. Actual future observations are needed before any prospective
accuracy can be reported. No historical Yahoo close arrays are published.

`scripts/build_intelligence.py` reads selected allowed public article bodies,
respecting robots and paywalls. It supplies at most the first 4,500 extracted
characters plus short source fragments to the model; context truncation is
reported. The hourly **Article reading and AI analysis**
workflow uses GitHub Models with the job's `models: read` token permission,
with real CPU Qwen open-weight inference as a fallback. No user API key is
required. Selected articles may remain unread or queued; every AI label
requires model provenance and actual source evidence. Output validation is not
a factual guarantee, and numerical scenarios do not use AI price targets.

Install `requirements-intelligence.txt` for article extraction and calendars.
Local open-weight inference additionally needs CPU `torch==2.8.0` and
`requirements-local-ai.txt`; the hosted workflow installs those only for the
fallback. Model weights use their own licence and are not part of this MIT
source release. Full publisher bodies are processed transiently, not published.

Run `python scripts/build_forecasts.py`, or, with model dependencies installed,
`python scripts/build_intelligence.py --provider local`. A genuine model must
successfully generate supported output; failed inference is not a rule-based
substitute.
