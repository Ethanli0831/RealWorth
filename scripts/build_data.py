#!/usr/bin/env python3
"""Build the dashboard's derived JSON. Never publish raw Yahoo prices.

Run from any directory: python /path/to/RealWorth/scripts/build_data.py
See README.md for the independent project's explicit calculation conventions.
"""

from __future__ import annotations

import argparse
from datetime import date, datetime, timedelta, timezone
from io import StringIO
import json
import math
import os
from pathlib import Path
import sys
import tempfile
import time
from typing import Callable, TypeVar

import numpy as np
import pandas as pd
import requests
import yfinance as yf


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "data" / "data.json"
ASSETS = {
    "BTC-USD": "Bitcoin",
    "GLD": "Gold",
    "SPY": "S&P 500",
    "BIL": "T-Bills",
    "TLT": "LT Bonds",
}
FIRST_MONTH = pd.Period("2014-01", freq="M")
BTC_FIRST_MONTH = pd.Period("2014-09", freq="M")
CPI_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=CPIAUCSL"
T = TypeVar("T")


def retry(label: str, operation: Callable[[], T]) -> T:
    """Three total attempts, including validation, with short backoff."""
    for attempt in range(1, 4):
        try:
            return operation()
        except Exception as exc:
            print(f"{label}: attempt {attempt}/3 failed: {exc}", file=sys.stderr)
            if attempt == 3:
                raise RuntimeError(f"{label} failed after 3 attempts") from exc
            time.sleep(2 ** (attempt - 1))
    raise AssertionError("unreachable")


def completed_month(end: date) -> pd.Period:
    """A mid-month end date excludes that incomplete month."""
    month = pd.Period(end, freq="M")
    return month if end == month.end_time.date() else month - 1


def extract_monthly(frame: pd.DataFrame, ticker: str, last: pd.Period) -> pd.Series:
    """Convert adjusted daily closes to month-end levels without filling gaps."""
    if frame.empty:
        raise ValueError(f"{ticker}: empty Yahoo response")
    # Both single-ticker column layouts have existed in yfinance releases.
    close = frame["Close"]
    if isinstance(close, pd.DataFrame):
        if list(close.columns) != [ticker]:
            raise ValueError(f"{ticker}: unexpected Yahoo column layout")
        close = close[ticker]
    close = close.copy()
    close.index = pd.to_datetime(close.index).tz_localize(None)
    if close.index.has_duplicates:
        raise ValueError(f"{ticker}: duplicate daily dates")
    close = close.sort_index()
    close = close.loc[(close.index >= FIRST_MONTH.start_time) &
                      (close.index <= last.end_time)]
    if close.empty or not np.isfinite(close.to_numpy()).all() or (close <= 0).any():
        raise ValueError(f"{ticker}: missing, non-finite, or non-positive prices")
    periods = close.index.to_period("M")
    monthly = close.groupby(periods).last()
    first = BTC_FIRST_MONTH if ticker == "BTC-USD" else FIRST_MONTH
    expected = pd.period_range(first, last, freq="M")
    if not monthly.index.equals(expected):
        raise ValueError(f"{ticker}: incomplete monthly history (expected {first}–{last})")
    # Catch a response that stops near the beginning of its final month, or
    # misses a month's last week. Allow weekends and exchange holidays.
    observed = pd.Series(close.index, index=periods).groupby(level=0).last()
    for month, final_date in observed.items():
        tolerance = 0 if ticker == "BTC-USD" else 7
        if (month.end_time.normalize() - final_date.normalize()).days > tolerance:
            raise ValueError(f"{ticker}: missing month-end observations for {month}")
    monthly.name = ASSETS[ticker]
    return monthly


def download_prices(last: pd.Period) -> pd.DataFrame:
    # Yahoo's end date is exclusive; add a day to include the final month end.
    exclusive_end = (last.end_time.date() + timedelta(days=1)).isoformat()
    yf.set_tz_cache_location(str(Path(tempfile.gettempdir()) / "realworth-yfinance"))
    columns = []
    for ticker, asset in ASSETS.items():
        print(f"Downloading {asset} ({ticker})...", flush=True)

        def fetch() -> pd.Series:
            daily = yf.download(
                ticker, start="2014-01-01", end=exclusive_end,
                interval="1d", auto_adjust=True, back_adjust=False,
                actions=False, progress=False, threads=False,
                keepna=True, timeout=30, multi_level_index=False,
            )
            return extract_monthly(daily, ticker, last)

        columns.append(retry(ticker, fetch))
    return pd.concat(columns, axis=1).reindex(pd.period_range(FIRST_MONTH, last, freq="M"))


def parse_cpi(text: str, last: pd.Period) -> pd.Series:
    frame = pd.read_csv(StringIO(text), na_values=["."])
    date_column = next((name for name in ("observation_date", "DATE")
                        if name in frame.columns), None)
    if date_column is None or "CPIAUCSL" not in frame.columns:
        raise ValueError("FRED response is not a CPIAUCSL CSV")
    dates = pd.to_datetime(frame[date_column], errors="raise").dt.to_period("M")
    values = pd.to_numeric(frame["CPIAUCSL"], errors="raise")
    cpi = pd.Series(values.to_numpy(), index=pd.PeriodIndex(dates), name="CPI")
    if cpi.index.has_duplicates:
        raise ValueError("FRED returned duplicate CPI months")
    # Keep a full prior year for YoY inflation at the beginning of 2014.
    cpi = cpi.sort_index().loc[pd.Period("2013-01", freq="M"):last]
    # FRED may include trailing unreleased observations denoted by '.'.
    final = cpi.last_valid_index()
    if final is None:
        raise ValueError("FRED returned no usable CPI observations")
    cpi = cpi.loc[:final]
    expected = pd.period_range("2013-01", final, freq="M")
    observed = cpi.dropna()
    if not cpi.index.equals(expected) or not np.isfinite(observed.to_numpy()).all() or (observed <= 0).any():
        raise ValueError("CPI history contains missing calendar rows or invalid observations")
    # Preserve explicitly missing observations as NaN. Never interpolate or
    # forward-fill them: exact growth can resume at the next known CPI level.
    return cpi


def download_cpi(last: pd.Period) -> pd.Series:
    print("Downloading US CPI (CPIAUCSL)...", flush=True)

    def fetch() -> pd.Series:
        response = requests.get(CPI_URL, timeout=(15, 60))
        response.raise_for_status()
        return parse_cpi(response.text, last)

    return retry("FRED CPI", fetch)


def percentage(value: float) -> float:
    if not math.isfinite(float(value)):
        raise ValueError("A percentage is non-finite")
    return round(float(value) * 100, 2)


def ratio(numerator: float, denominator: float) -> float | None:
    # Undefined ratios are JSON null, never NaN or Infinity.
    if abs(denominator) < 1e-12:
        return None
    result = float(numerator / denominator)
    if not math.isfinite(result):
        raise ValueError("A risk ratio is non-finite")
    return round(result, 3)


def growth_path(returns: pd.Series, baseline: pd.Period) -> pd.Series:
    if not np.isfinite(returns.to_numpy()).all() or (returns <= -1).any():
        raise ValueError("Invalid monthly returns; cannot compound growth")
    start = pd.Series([1.0], index=pd.PeriodIndex([baseline]))
    return pd.concat([start, (1 + returns).cumprod()])


def score(real: pd.Series, cash_real: pd.Series, path: pd.Series) -> dict:
    # Only genuine one-month returns enter monthly volatility and Sharpe.
    # A CPI gap makes that month AND the following month unavailable.
    real = real.dropna()
    if len(real) < 2:
        raise ValueError("At least two monthly returns are required per asset")
    elapsed = path.index[-1].ordinal - path.index[0].ordinal
    if elapsed <= 0 or path.iloc[0] != 1.0 or pd.isna(path.iloc[-1]):
        raise ValueError("Real growth must have a known baseline and endpoint")
    # CAGR uses elapsed calendar time, including months with missing CPI.
    # Counting only observed returns would overstate the annual growth rate.
    annual_return = float(path.iloc[-1] ** (12 / elapsed) - 1)
    excess = real - cash_real.reindex(real.index)
    if excess.isna().any():
        raise ValueError("Missing BIL return for the Sharpe calculation")
    observed_path = path.dropna()
    drawdown = observed_path / observed_path.cummax() - 1
    worst = float(drawdown.min())
    return {
        "ann_real_return": percentage(annual_return),
        "ann_volatility": percentage(real.std(ddof=1) * math.sqrt(12)),
        "sharpe": ratio(excess.mean() * math.sqrt(12), excess.std(ddof=1)),
        "max_drawdown": percentage(worst),
        "calmar": ratio(annual_return, abs(worst)),
        "current_drawdown": percentage(drawdown.iloc[-1]),
    }


def build_payload(prices: pd.DataFrame, cpi: pd.Series, updated: date) -> dict:
    """Pure calculations, kept separate from downloads and file writes."""
    assets = list(ASSETS.values())
    observed_cpi = cpi.dropna()
    if observed_cpi.empty or not np.isfinite(observed_cpi.to_numpy()).all() or (observed_cpi <= 0).any():
        raise ValueError("CPI observations must be finite and positive")
    if cpi.index.has_duplicates:
        raise ValueError("Duplicate CPI months")
    # Reindex before pct_change so missing calendar rows cannot accidentally
    # turn a two-month price change into a monthly inflation observation.
    cpi = cpi.reindex(pd.period_range(cpi.index[0], observed_cpi.index[-1], freq="M"))
    last = min(prices.index[-1], observed_cpi.index[-1])
    dates = pd.period_range(FIRST_MONTH, last, freq="M")
    prices = prices.reindex(index=dates, columns=assets)
    inflation = cpi.pct_change(fill_method=None).reindex(dates)
    yoy = cpi.pct_change(12, fill_method=None).reindex(dates)
    nominal = prices.pct_change(fill_method=None)
    real = (1 + nominal).div(1 + inflation, axis=0) - 1
    growth = {"dates": [str(month) for month in dates], "nominal": {}, "real": {}}
    scorecard = {}

    for asset in assets:
        levels = prices[asset].dropna()
        if levels.empty or levels.index[-1] != last:
            raise ValueError(f"{asset}: missing prices at the end of the sample")
        expected = pd.period_range(levels.index[0], last, freq="M")
        if not levels.index.equals(expected) or not np.isfinite(levels.to_numpy()).all() or (levels <= 0).any():
            raise ValueError(f"{asset}: incomplete or invalid price history")
        baseline = levels.index[0]
        if baseline not in cpi.index or pd.isna(cpi.loc[baseline]):
            raise ValueError(f"{asset}: baseline CPI is unavailable")
        monthly_real = real.loc[baseline + 1:, asset]
        nominal_path = growth_path(nominal.loc[baseline + 1:, asset], baseline)
        # Exact purchasing power uses known endpoints directly. It resumes
        # after a CPI gap without inventing the missing month's inflation.
        real_path = nominal_path * (cpi.loc[baseline] / cpi.reindex(nominal_path.index))
        for kind, path in (("nominal", nominal_path), ("real", real_path)):
            observed_path = path.dropna()
            if not np.isfinite(observed_path.to_numpy()).all() or (observed_path <= 0).any():
                raise ValueError(f"{asset}: non-finite growth path")
            # Leading unavailable history and internal CPI gaps become null.
            # This contains derived indices, not dollar prices.
            growth[kind][asset] = [None if pd.isna(v) else round(float(v), 8)
                                  for v in path.reindex(dates)]
        scorecard[asset] = score(monthly_real, real["T-Bills"], real_path)

    # Shared return months ensure every regime comparison has the same sample.
    # The means are NOMINAL monthly returns, as in the notebook's regime table.
    common = nominal.loc[yoy.notna()].dropna(how="any")
    if len(common) < 2:
        raise ValueError("Insufficient common history for inflation regimes")
    regime_yoy = yoy.reindex(common.index)
    median = float(regime_yoy.median())
    q25 = float(regime_yoy.quantile(0.25))
    q75 = float(regime_yoy.quantile(0.75))

    def means(mask: pd.Series) -> dict:
        subset = common.loc[mask]
        if subset.empty:
            raise ValueError("An inflation regime contains no observations")
        return {asset: percentage(subset[asset].mean()) for asset in assets}

    current = None if pd.isna(yoy.iloc[-1]) else float(yoy.iloc[-1])
    quartile = None if current is None else (
        "Bottom 25%" if current <= q25 else "Top 25%" if current >= q75 else "Middle 50%"
    )
    return {
        "meta": {
            "last_updated": updated.isoformat(), "data_through": str(last),
            "assets": assets, "sources": ["Yahoo Finance", "FRED (CPIAUCSL)"],
        },
        "growth": growth,
        "scorecard": scorecard,
        "regime": {
            "cpi_dates": [str(month) for month in dates],
            "cpi_yoy": [None if pd.isna(value) else percentage(value) for value in yoy],
            "current_yoy": None if current is None else percentage(current),
            "median_threshold": percentage(median),
            "q25": percentage(q25), "q75": percentage(q75),
            "current_regime": None if current is None else "High" if current > median else "Low",
            "current_quartile": quartile,
            "by_median": {"High": means(regime_yoy > median), "Low": means(regime_yoy <= median)},
            "by_quartile": {"Bottom 25%": means(regime_yoy <= q25), "Top 25%": means(regime_yoy >= q75)},
        },
    }


def equivalent_data(previous, current, path: tuple[str, ...] = ()) -> bool:
    """Ignore sub-cent growth-index noise, but retain real data revisions."""
    if isinstance(current, dict):
        return (isinstance(previous, dict) and previous.keys() == current.keys() and
                all(equivalent_data(previous[k], current[k], path + (k,)) for k in current))
    if isinstance(current, list):
        return (isinstance(previous, list) and len(previous) == len(current) and
                all(equivalent_data(a, b, path) for a, b in zip(previous, current)))
    if path[:2] in (("growth", "nominal"), ("growth", "real")):
        if current is None or previous is None:
            return current is previous
        if isinstance(previous, (int, float)) and isinstance(current, (int, float)):
            # Yahoo adjusted ETF levels can vary ~1 part per million between
            # identical requests. 1e-5 relative means at most $0.01 per $1,000.
            return math.isclose(previous, current, rel_tol=1e-5, abs_tol=1e-8)
    return previous == current


def atomic_write(payload: dict, destination: Path) -> bool:
    """Serialize before touching the old file, then atomically replace it."""
    content = json.dumps(payload, indent=2, allow_nan=False) + "\n"
    if destination.exists():
        existing = destination.read_text(encoding="utf-8")
        if existing == content or equivalent_data(json.loads(existing), payload):
            return False
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=destination.parent,
                                         prefix=".data-", suffix=".tmp", delete=False) as handle:
            temporary = Path(handle.name)
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, destination)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
    return True


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--end", type=date.fromisoformat, metavar="YYYY-MM-DD",
                        help="Inclusive historical cutoff; incomplete months are excluded")
    args = parser.parse_args(argv)
    today = datetime.now(timezone.utc).date()
    if args.end and args.end > today:
        parser.error("--end cannot be in the future")
    last = completed_month(args.end or today)
    if last < pd.Period("2014-11", freq="M"):
        parser.error("Choose an end date with at least two Bitcoin monthly returns (Nov 2014 or later)")
    try:
        # Fetch CPI first, so we do not request asset months we cannot use yet.
        cpi = download_cpi(last)
        last = min(last, cpi.index[-1])
        prices = download_prices(last)
        payload = build_payload(prices, cpi, today)
        if not args.end and OUTPUT.exists():
            previous = json.loads(OUTPUT.read_text(encoding="utf-8"))
            if previous["meta"]["data_through"] > payload["meta"]["data_through"]:
                raise ValueError("New data is older than the existing file; refusing to move backward")
        changed = atomic_write(payload, OUTPUT)
        print(f"{'Wrote' if changed else 'Unchanged:'} {OUTPUT}")
        print(f"Data through {last}; {len(payload['growth']['dates'])} month-end levels.")
        print("Real return: (1 + nominal) / (1 + inflation) - 1. Annual return: calendar-time CAGR.")
        print("Sharpe: excess over BIL / excess volatility. Regime means: nominal returns, common months.")
        missing = cpi.reindex(prices.index)
        missing_months = [str(month) for month in missing.index[missing.isna()]]
        if missing_months:
            print(f"Missing CPI months: {', '.join(missing_months)}. Real growth and CPI YoY are null there.")
            print("Monthly risk statistics exclude missing CPI pairs; drawdowns use observed real levels only.")
        if payload["regime"]["current_yoy"] is None:
            print("Current CPI YoY and regime are unavailable: the prior-year CPI observation is missing.")
        print("Paper comparison is not assumed: its exact risk-ratio implementation was not supplied.")
        return 0
    except Exception as exc:
        print(f"ERROR: {exc}. Existing data.json was not overwritten.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
