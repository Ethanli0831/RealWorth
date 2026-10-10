#!/usr/bin/env python3
"""Print a historical comparison without replacing the site's latest JSON.

Run: python scripts/compare_paper.py > PAPER_COMPARISON.md
This is diagnostic: the author approved an independent exact-return method,
so differences are reported honestly rather than tuned to force agreement.
"""

from contextlib import redirect_stdout
from datetime import datetime, timezone
import sys

import pandas as pd

from build_data import build_payload, download_cpi, download_prices


def main():
    end = pd.Period("2025-12", freq="M")
    with redirect_stdout(sys.stderr):
        cpi = download_cpi(end)
        prices = download_prices(end)
        payload = build_payload(prices, cpi, datetime.now(timezone.utc).date())
    references = {
        "Bitcoin": {"sharpe": 0.945, "max_drawdown": -76.07, "calmar": 0.925},
        "Gold": {"sharpe": 0.462, "max_drawdown": -29.08, "calmar": 0.288},
        "S&P 500": {"sharpe": 0.668, "max_drawdown": -28.09, "calmar": 0.406},
    }
    rows = []
    for asset, metrics in references.items():
        for metric, reference in metrics.items():
            rows.append((asset, metric, reference, payload["scorecard"][asset][metric]))
    for regime, reference in [("High", 2.629), ("Low", 9.413)]:
        rows.append(("Bitcoin", f"{regime} CPI nominal mean (%/month)", reference,
                     payload["regime"]["by_median"][regime]["Bitcoin"]))
    passed = sum(abs(actual - reference) <= 0.01 + 1e-12 for _, _, reference, actual in rows)
    print("# Paper comparison — historical cutoff 2025-12-31\n")
    print(f"Generated {datetime.now(timezone.utc).date().isoformat()} from actual Yahoo/FRED downloads. "
          "This command does not overwrite the site's latest dataset.\n")
    print(f"Original homework tolerance: absolute difference ≤ 0.01 (percentage points for percentages). "
          f"**{passed}/{len(rows)} comparisons meet that criterion.** "
          "This is not a claim of exact paper replication.\n")
    print("| Asset | Metric | Paper | Independent project | Difference | Within 0.01? |")
    print("|---|---|---:|---:|---:|:---:|")
    for asset, metric, reference, actual in rows:
        difference = actual - reference
        matches = abs(difference) <= 0.01 + 1e-12
        print(f"| {asset} | {metric} | {reference:.3f} | {actual:.3f} | {difference:+.3f} | {'Yes' if matches else 'No'} |")
    print("\n## Why results differ\n")
    print("- On 2026-10-09 the author approved exact real returns `(1 + nominal)/(1 + inflation) - 1`, "
          "rather than monthly nominal-minus-inflation approximation.")
    print("- Annual real return and Calmar use geometric calendar-time CAGR. Sharpe uses excess "
          "returns over BIL and the sample standard deviation of those excess returns. "
          "The supplied notebook does not contain the cited Sharpe/Calmar implementation, "
          "so equivalence to that implementation cannot be asserted.")
    print("- The independent project uses BIL consistently and each asset's own history. "
          "Different notebook sections use different cash proxies and sample alignments.")
    print("- October 2025 CPI is missing. It is not interpolated. Monthly real risk statistics "
          "exclude missing CPI pairs; regime averages exclude unavailable CPI YoY. "
          "CAGR uses all elapsed months and known real endpoints.")
    print("- Yahoo/FRED revisions can change historical observations.\n")
    print("The dashboard is validated against its declared formulas and real-data functional checks. "
          "The original exact-paper-match requirement is **not passed**; the approved independent "
          "method is the project's documented approach. No metric or data has been altered to force a match.")


if __name__ == "__main__":
    main()
