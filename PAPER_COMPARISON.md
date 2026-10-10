# Paper comparison — historical cutoff 2025-12-31

Generated 2026-10-10 from actual Yahoo/FRED downloads. This command does not overwrite the site's latest dataset.

Original homework tolerance: absolute difference ≤ 0.01 (percentage points for percentages). **0/11 comparisons meet that criterion.** This is not a claim of exact paper replication.

| Asset | Metric | Paper | Independent project | Difference | Within 0.01? |
|---|---|---:|---:|---:|:---:|
| Bitcoin | sharpe | 0.945 | 1.025 | +0.080 | No |
| Bitcoin | max_drawdown | -76.070 | -76.030 | +0.040 | No |
| Bitcoin | calmar | 0.925 | 0.755 | -0.170 | No |
| Gold | sharpe | 0.462 | 0.617 | +0.155 | No |
| Gold | max_drawdown | -29.080 | -28.980 | +0.100 | No |
| Gold | calmar | 0.288 | 0.261 | -0.027 | No |
| S&P 500 | sharpe | 0.668 | 0.851 | +0.183 | No |
| S&P 500 | max_drawdown | -28.090 | -27.910 | +0.180 | No |
| S&P 500 | calmar | 0.406 | 0.387 | -0.019 | No |
| Bitcoin | High CPI nominal mean (%/month) | 2.629 | 2.680 | +0.051 | No |
| Bitcoin | Low CPI nominal mean (%/month) | 9.413 | 9.650 | +0.237 | No |

## Why results differ

- On 2026-10-09 the author approved exact real returns `(1 + nominal)/(1 + inflation) - 1`, rather than monthly nominal-minus-inflation approximation.
- Annual real return and Calmar use geometric calendar-time CAGR. Sharpe uses excess returns over BIL and the sample standard deviation of those excess returns. The supplied notebook does not contain the cited Sharpe/Calmar implementation, so equivalence to that implementation cannot be asserted.
- The independent project uses BIL consistently and each asset's own history. Different notebook sections use different cash proxies and sample alignments.
- October 2025 CPI is missing. It is not interpolated. Monthly real risk statistics exclude missing CPI pairs; regime averages exclude unavailable CPI YoY. CAGR uses all elapsed months and known real endpoints.
- Yahoo/FRED revisions can change historical observations.

The dashboard is validated against its declared formulas and real-data functional checks. The original exact-paper-match requirement is **not passed**; the approved independent method is the project's documented approach. No metric or data has been altered to force a match.
