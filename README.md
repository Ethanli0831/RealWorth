# RealWorth — Store-of-Value Dashboard

An independent educational project comparing Bitcoin (`BTC-USD`), gold (`GLD`),
the S&P 500 (`SPY`), Treasury bills (`BIL`), and long-term Treasury bonds (`TLT`).
The first step is the data pipeline; the three web tools and monthly GitHub
Actions workflow will be added in later steps. Educational research, not
financial advice.

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
```

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

### Validation status (2026-10-09)

- All **20** calculation and failure-safety tests pass.
- The historical run with `--end 2025-12-31` succeeds, leaves October 2025
  real growth/CPI YoY as `null`, and resumes real growth in November.
- The default run succeeds and the generated data file currently covers
  **August 2026**, the latest CPI month returned during setup.
- The repeated default run reports `Unchanged` and leaves the file intact.
- For a November 2021–November 2022 hold, observed max real drawdown is about
  **−71.89%** for Bitcoin and **−18.82%** for gold under the exact formula.

These are pipeline checks. The website, GitHub Actions and GitHub Pages
deployment have not yet been implemented or validated.

The supplied paper and notebook are references, not runtime dependencies.
They are not copied into this public repository. Their cash proxy and real
return conventions vary between sections, and the supplied notebook does not
include the cited Sharpe/Calmar implementation. Matching the published table
has therefore **not** been verified. No formula is tuned to force a match.
