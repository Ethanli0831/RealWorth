# RealWorth User Guide

Website: https://ethanli0831.github.io/RealWorth/

RealWorth is an independent educational dashboard for comparing purchasing
power, historical risk and market evidence. Amounts and historical real-return
research use US dollars and US CPI. No account or API key is required to use the
website.

## Choose a starting point

| Page | What it helps you do |
| --- | --- |
| [Purchasing Power](https://ethanli0831.github.io/RealWorth/purchasing-power.html) | Compare the same investment across five assets after inflation. |
| [Research](https://ethanli0831.github.io/RealWorth/research.html) | Examine comparable histories, rolling holding periods and inflation groups. |
| [Market Monitor](https://ethanli0831.github.io/RealWorth/monitor.html) | Match money purpose to risks, inspect current observations and check published forecasts. |
| [Methodology](https://ethanli0831.github.io/RealWorth/methodology.html) | Read formulas, data handling, policy assumptions and limitations. |
| [About](https://ethanli0831.github.io/RealWorth/about.html) | Learn how the project is maintained and how to report errors. |

The **Explore** menu links directly to each tool. The money-purpose questionnaire
and new asset-card explanations support English and simplified Chinese.

## 1. Match an investment to the money's purpose

Open **Market Monitor → What fits my money?** Answer the six questions about
purpose, earliest spending date, loss capacity, financial readiness, goal and
spending currency. Enter the total amount being considered for this plan.

The result distinguishes further research, reduced-exposure comparisons,
disposable-money experiments, conditional USD evidence, observation-only
short-term strategies and unsuitable uses. Essential or borrowed money,
zero-loss requirements and missing financial basics remain priority constraints.
A missing short-term timing edge is not a blanket rejection of long-term
investing.

Open each asset's evidence to inspect the actual common sample dates, nominal
and real drawdowns, matching holding-window counts and historical outcomes.
Policy stress levels and minimum horizons are assumptions, not calibrated
future loss limits.

A reduced-exposure illustration assumes one asset plus unchanged cash. For
example, a $1,000 plan with a 15% loss budget and an assumed 40% asset decline
would illustrate $375 exposed and $625 unchanged, producing a $150 assumed loss.
This is not a recommended allocation or guaranteed loss cap. Each card is an
independent alternative; do not add its amounts to those on other cards.

Non-USD users can inspect conditional USD evidence, but the site does not invent
local purchasing-power results or amount-based risk budgets without currency
analysis. Answers remain in page memory and are not saved or sent to AI.

## 2. Calculate one investment's real return

Open **Purchasing Power**. Select an asset, buy month, holding period and amount.
For a first comparison, try Bitcoin, November 2021, one year and $1,000.

- **Nominal value:** the ending amount before inflation adjustment.
- **Value after inflation:** purchasing power expressed in buy-month dollars.
- **Worst drop:** the largest observed real peak-to-trough decline during the hold.

Buys and sells are measured at month end. **Until latest data** means the latest
released research month, not necessarily today. Terms beyond the data range are
disabled. Missing CPI leaves gaps rather than interpolated observations.

The comparison below uses the same amount and dates for Bitcoin, GLD, SPY, BIL
and TLT. Recovery is the first observed return to purchase purchasing power after
a loss, measured from purchase; a later decline remains possible.

## 3. Compare histories and holding periods

On **Research**, the scorecard defaults to **Common period**, giving all five
assets the same endpoints. **Full history** uses unequal starting dates.

Annualised real return describes compound purchasing-power growth. Volatility
measures variability, not maximum possible loss. Sharpe compares excess returns
with excess-return variability; Calmar compares real growth with the largest
observed drawdown. A high ratio does not eliminate deep losses.

In **How often did holding work?**, choose a one-, three- or five-year hold.
Inspect the number of windows, missing endpoints, fraction beating inflation,
worst final real return, median and P10–P90 range. These are cumulative holding
returns. Windows overlap and are not independent; their historical fraction is
not a future success probability.

## 4. Inspect inflation evidence and economic weather

Use the inflation buttons to compare high/low levels, top/bottom quartiles or
rising versus falling/flat inflation. Level and direction are separate tests.
Switch between real and nominal monthly returns, then compare sample sizes,
means, medians and distribution ranges.

Economic Weather is a transparent heuristic inspired by Dalio's framework,
not an official Bridgewater cycle call or a calibrated forecast. Each indicator
has its own date. Open its source before interpreting stale or mixed readings.
The source directory labels public, subscription and client-only access.

## 5. Read price scenarios and their checks

Each Market Monitor asset card explains what the asset represents, what its
historical model-error comparison means and how its risk relates to your answers.
Open the evidence details for the exact numbers. The technical table remains
available below the cards.

Distinguish **Observed**, **Issued** and **Target** times. A refreshed quote does
not revise a frozen forecast. Dollar examples scale the frozen starting quote,
not a purchase at today's price. Gold is GLD per share, not gold per ounce.

A smaller historical price error does not demonstrate profitable trading after
costs. Outer-range coverage is not direction accuracy. Published checks are
separated by asset, show distinct target dates and score the earliest issue for
each asset/date. The ledger retains all issues and labels pending, verified,
missed and invalidated records.

## 6. Read news and market-structure observations

Filter news by channel or search headline/publisher text. Read the original
article, then inspect the conditional mechanism and any separately labelled AI
interpretation. **No clear macro impact** is a valid result. Grouped reports keep
their original links; neither grouping nor an AI explanation establishes a
verified causal effect.

Market-structure cards show their own units, observation dates, source status
and interpretation limits. Holdings/AUM are not dollar net flows, addresses are
not people, and funding/open interest/volatility do not mechanically predict
price direction. Missing sources remain explicit. A custodian bar-list subtotal
is not substituted for GLD full-fund holdings.

WGC physical-demand breakdowns, comparable option skew and local Canadian
purchasing-power calculations are not automatically connected. Short histories
do not receive a fabricated annual percentile.

## Updates and limitations

Monthly research, scheduled news/quote scans, hourly selected article-AI batches
and four-hour market-structure refreshes run through GitHub Actions. Publisher
and runner delays apply. A refresh button reads the latest published snapshot;
it does not force a provider to release new data.

Check dates before drawing a conclusion. Historical observations can understate
future losses, monthly data misses intra-month moves, and US CPI does not measure
every user's local purchasing power. The independent exact-return implementation
does not claim to pass the original paper's numerical replication tolerance.
The methodology includes a five-question self-check with reference answers.

For setup, development and maintenance, see [README.md](README.md).
For indexing steps, see [SEARCH_CONSOLE.md](SEARCH_CONSOLE.md).
An optional [simplified Chinese user guide](USER_GUIDE.zh-CN.md) is also available.
