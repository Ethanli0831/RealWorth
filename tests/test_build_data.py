"""Synthetic fixtures test mathematics and safety; they are not market data."""

from contextlib import redirect_stderr, redirect_stdout
from datetime import date
from io import StringIO
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import numpy as np
import pandas as pd

from scripts import build_data as pipeline


def fixture():
    months = pd.period_range("2013-01", "2015-02", freq="M")
    cpi = pd.Series(100 * np.cumprod(1 + np.linspace(0.0001, 0.004, len(months))), index=months)
    dates = pd.period_range("2014-01", "2015-02", freq="M")
    prices = pd.DataFrame(index=dates)
    for i, asset in enumerate(pipeline.ASSETS.values()):
        change = np.array([0.02 + 0.003 * i if k % 2 else -0.008 for k in range(len(dates))])
        prices[asset] = 100 * np.cumprod(1 + change)
    prices.loc[:"2014-08", "Bitcoin"] = np.nan
    return prices, cpi


class Calculations(unittest.TestCase):
    def test_baseline_loss_and_recovery_drawdowns(self):
        dates = pd.period_range("2014-02", periods=3, freq="M")
        returns = pd.Series([-0.5, 1.0, -0.25], index=dates)
        path = pipeline.growth_path(returns, dates[0] - 1)
        self.assertEqual(list(path), [1.0, 0.5, 1.0, 0.75])
        result = pipeline.score(returns, pd.Series(0.0, index=dates), path)
        self.assertEqual(result["max_drawdown"], -50.0)
        self.assertEqual(result["current_drawdown"], -25.0)
        # Three months ending at 0.75 imply 0.75**4 annual growth.
        self.assertEqual(result["ann_real_return"], -68.36)
        self.assertEqual(result["calmar"], -1.367)

    def test_output_schema_late_bitcoin_and_exact_real_return(self):
        prices, cpi = fixture()
        result = pipeline.build_payload(prices, cpi, date(2026, 10, 9))
        self.assertEqual(set(result), {"meta", "growth", "scorecard", "regime"})
        self.assertEqual(result["meta"]["data_through"], "2015-02")
        for kind in ["nominal", "real"]:
            values = result["growth"][kind]["Bitcoin"]
            self.assertEqual(values[:8], [None] * 8)
            self.assertEqual(values[8], 1.0)
            self.assertEqual(len(values), 14)
        inflation = cpi.loc["2014-02"] / cpi.loc["2014-01"] - 1
        # January is the baseline; February nominal return is 2.3% for gold.
        expected = (1 + 0.023) / (1 + inflation)
        self.assertAlmostEqual(result["growth"]["real"]["Gold"][1], expected, places=7)
        self.assertIsNone(result["scorecard"]["T-Bills"]["sharpe"])
        self.assertNotIn("prices", result)
        self.assertNotIn("CPIAUCSL", result)
        json.dumps(result, allow_nan=False)

    def test_cpi_gap_is_null_and_known_endpoint_growth_resumes(self):
        prices, cpi = fixture()
        cpi.loc["2014-11"] = np.nan
        result = pipeline.build_payload(prices, cpi, date(2026, 10, 9))
        dates = result["growth"]["dates"]
        november = dates.index("2014-11")
        december = dates.index("2014-12")
        self.assertEqual(result["meta"]["data_through"], "2015-02")
        self.assertIsNotNone(result["growth"]["nominal"]["Gold"][november])
        for asset in pipeline.ASSETS.values():
            self.assertIsNone(result["growth"]["real"][asset][november])
            self.assertIsNotNone(result["growth"]["real"][asset][december])
        self.assertIsNone(result["regime"]["cpi_yoy"][november])
        # Purchasing power between known endpoints is identifiable even when
        # one of the intermediate CPI levels is unknown.
        expected = (prices.loc["2014-12", "Gold"] / prices.loc["2014-01", "Gold"] *
                    cpi.loc["2014-01"] / cpi.loc["2014-12"])
        self.assertAlmostEqual(result["growth"]["real"]["Gold"][december], expected, places=7)
        # Dropping November changes the Low group's nominal mean to 2%.
        # A missing YoY observation must not be misclassified as Low.
        self.assertEqual(result["regime"]["by_median"]["Low"]["Bitcoin"], 2.0)
        json.dumps(result, allow_nan=False)

    def test_cagr_uses_calendar_time_and_volatility_excludes_gap_pairs(self):
        prices, cpi = fixture()
        cpi.loc["2014-11"] = np.nan
        result = pipeline.build_payload(prices, cpi, date(2026, 10, 9))
        # Thirteen elapsed months, although only eleven one-month returns
        # have two known CPI endpoints (November and December are excluded).
        endpoint = (prices.loc["2015-02", "Gold"] / prices.loc["2014-01", "Gold"] *
                    cpi.loc["2014-01"] / cpi.loc["2015-02"])
        expected_cagr = round((endpoint ** (12 / 13) - 1) * 100, 2)
        self.assertEqual(result["scorecard"]["Gold"]["ann_real_return"], expected_cagr)
        monthly = []
        for month in pd.period_range("2014-02", "2015-02", freq="M"):
            if month in pd.period_range("2014-11", "2014-12", freq="M"):
                continue
            monthly.append(prices.loc[month, "Gold"] / prices.loc[month - 1, "Gold"] *
                           cpi.loc[month - 1] / cpi.loc[month] - 1)
        self.assertEqual(len(monthly), 11)
        expected_vol = round(np.std(monthly, ddof=1) * np.sqrt(12) * 100, 2)
        self.assertEqual(result["scorecard"]["Gold"]["ann_volatility"], expected_vol)

    def test_missing_prior_year_cpi_does_not_invent_current_regime(self):
        prices, cpi = fixture()
        cpi.loc["2014-02"] = np.nan
        result = pipeline.build_payload(prices, cpi, date(2026, 10, 9))
        self.assertEqual(result["meta"]["data_through"], "2015-02")
        self.assertIsNotNone(result["growth"]["real"]["Gold"][-1])
        self.assertIsNone(result["regime"]["current_yoy"])
        self.assertIsNone(result["regime"]["current_regime"])
        self.assertIsNone(result["regime"]["current_quartile"])

    def test_missing_baseline_cpi_is_an_error(self):
        prices, cpi = fixture()
        cpi.loc["2014-09"] = np.nan
        with self.assertRaisesRegex(ValueError, "Bitcoin: baseline CPI"):
            pipeline.build_payload(prices, cpi, date(2026, 10, 9))

    def test_drawdown_ignores_missing_level_without_losing_known_peak(self):
        dates = pd.period_range("2014-01", "2014-05", freq="M")
        path = pd.Series([1.0, 2.0, np.nan, 0.5, 1.0], index=dates)
        real = pd.Series([1.0, np.nan, np.nan, 1.0], index=dates[1:])
        result = pipeline.score(real, pd.Series(0.0, index=dates[1:]), path)
        self.assertEqual(result["max_drawdown"], -75.0)
        self.assertEqual(result["current_drawdown"], -50.0)

    def test_cpi_release_lag_excludes_unreleased_month(self):
        prices, cpi = fixture()
        result = pipeline.build_payload(prices, cpi.loc[:"2015-01"], date(2026, 10, 9))
        self.assertEqual(result["meta"]["data_through"], "2015-01")
        self.assertEqual(result["growth"]["dates"][-1], "2015-01")
        self.assertEqual(result["regime"]["cpi_dates"][-1], "2015-01")

    def test_regimes_use_common_months_and_nominal_returns(self):
        prices, cpi = fixture()
        result = pipeline.build_payload(prices, cpi, date(2026, 10, 9))
        regime = result["regime"]
        # YoY inflation increases in this fixture. Five common months are
        # Oct–Feb, so December is the median; its tie belongs to Low.
        self.assertEqual(regime["current_regime"], "High")
        self.assertEqual(regime["current_quartile"], "Top 25%")
        self.assertEqual(regime["by_median"]["High"]["Bitcoin"], 0.6)
        self.assertEqual(regime["by_median"]["Low"]["Bitcoin"], 1.07)
        yoy_december = cpi.loc["2014-12"] / cpi.loc["2013-12"] - 1
        self.assertEqual(regime["median_threshold"], round(yoy_december * 100, 2))

    def test_missing_asset_month_is_not_forward_filled(self):
        prices, cpi = fixture()
        prices.loc["2014-11", "Gold"] = np.nan
        with self.assertRaisesRegex(ValueError, "incomplete"):
            pipeline.build_payload(prices, cpi, date(2026, 10, 9))

    def test_end_is_inclusive_and_partial_months_are_excluded(self):
        self.assertEqual(str(pipeline.completed_month(date(2025, 12, 31))), "2025-12")
        self.assertEqual(str(pipeline.completed_month(date(2025, 12, 30))), "2025-11")


class SourceValidation(unittest.TestCase):
    def test_month_end_adjusted_close_resampling(self):
        frame = pd.DataFrame({"Close": [100.0, 110.0, 90.0]},
                             index=pd.to_datetime(["2014-01-02", "2014-01-31", "2014-02-28"]))
        series = pipeline.extract_monthly(frame, "GLD", pd.Period("2014-02", freq="M"))
        self.assertEqual(list(series), [110.0, 90.0])

    def test_truncated_final_month_fails_validation(self):
        frame = pd.DataFrame({"Close": [110.0, 90.0]},
                             index=pd.to_datetime(["2014-01-31", "2014-02-04"]))
        with self.assertRaisesRegex(ValueError, "month-end"):
            pipeline.extract_monthly(frame, "GLD", pd.Period("2014-02", freq="M"))

    def test_cpi_trailing_unreleased_and_missing_internal_month(self):
        months = pd.period_range("2013-01", "2014-02", freq="M")
        lines = ["observation_date,CPIAUCSL"]
        lines += [f"{m.start_time.date()},{100 + i}" for i, m in enumerate(months)]
        lines[-1] = "2014-02-01,."
        cpi = pipeline.parse_cpi("\n".join(lines), pd.Period("2014-02", freq="M"))
        self.assertEqual(str(cpi.index[-1]), "2014-01")
        lines[5] = "2013-05-01,."
        cpi = pipeline.parse_cpi("\n".join(lines), pd.Period("2014-02", freq="M"))
        self.assertTrue(pd.isna(cpi.loc["2013-05"]))

    def test_invalid_cpi_and_missing_calendar_row_still_fail(self):
        months = pd.period_range("2013-01", "2014-02", freq="M")
        lines = ["DATE,CPIAUCSL"]
        lines += [f"{m.start_time.date()},{100 + i}" for i, m in enumerate(months)]
        for bad in ["0", "-1", "inf", "not-a-number"]:
            with self.subTest(value=bad):
                corrupted = lines.copy()
                corrupted[5] = f"2013-05-01,{bad}"
                with self.assertRaises(ValueError):
                    pipeline.parse_cpi("\n".join(corrupted), pd.Period("2014-02", freq="M"))
        del lines[5]
        with self.assertRaisesRegex(ValueError, "missing calendar rows"):
            pipeline.parse_cpi("\n".join(lines), pd.Period("2014-02", freq="M"))


class FailureSafety(unittest.TestCase):
    def test_retry_three_attempts(self):
        with patch.object(pipeline.time, "sleep"), redirect_stderr(StringIO()):
            calls = []

            def fail():
                calls.append(1)
                raise ValueError("unavailable")

            with self.assertRaisesRegex(RuntimeError, "3 attempts"):
                pipeline.retry("test", fail)
            self.assertEqual(len(calls), 3)

    def test_failed_download_preserves_existing_json_and_exit_status(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "data.json"
            target.write_text('{"old":"data"}\n', encoding="utf-8")
            before = target.read_bytes()
            with patch.object(pipeline, "OUTPUT", target), \
                 patch.object(pipeline, "download_cpi", side_effect=RuntimeError("network denied")), \
                 redirect_stderr(StringIO()), redirect_stdout(StringIO()):
                self.assertEqual(pipeline.main(["--end", "2025-12-31"]), 1)
            self.assertEqual(target.read_bytes(), before)

    def test_identical_rerun_does_not_replace_file(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "data.json"
            self.assertTrue(pipeline.atomic_write({"value": 1.0}, target))
            modified = target.stat().st_mtime_ns
            self.assertFalse(pipeline.atomic_write({"value": 1.0}, target))
            self.assertEqual(target.stat().st_mtime_ns, modified)

    def test_invalid_json_or_failed_replace_preserves_old_file(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "data.json"
            pipeline.atomic_write({"old": True}, target)
            before = target.read_bytes()
            with self.assertRaises(ValueError):
                pipeline.atomic_write({"bad": float("nan")}, target)
            with patch.object(pipeline.os, "replace", side_effect=OSError("interrupted")):
                with self.assertRaises(OSError):
                    pipeline.atomic_write({"new": True}, target)
            self.assertEqual(target.read_bytes(), before)
            self.assertEqual(list(Path(directory).glob(".data-*.tmp")), [])

    def test_growth_precision_noise_does_not_hide_meaningful_revisions(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "data.json"
            original = {"growth": {"nominal": {"Gold": [None, 1.0, 2.0]}},
                        "scorecard": {"Gold": {"sharpe": 0.5}}}
            pipeline.atomic_write(original, target)
            before = target.read_bytes()
            tiny_change = {"growth": {"nominal": {"Gold": [None, 1.0, 2.000002]}},
                           "scorecard": {"Gold": {"sharpe": 0.5}}}
            self.assertFalse(pipeline.atomic_write(tiny_change, target))
            self.assertEqual(target.read_bytes(), before)
            tiny_change["growth"]["nominal"]["Gold"][-1] = 2.01
            self.assertTrue(pipeline.atomic_write(tiny_change, target))
            tiny_change["scorecard"]["Gold"]["sharpe"] = 0.501
            self.assertTrue(pipeline.atomic_write(tiny_change, target))
            tiny_change["growth"]["nominal"]["Gold"][0] = 1.0
            self.assertTrue(pipeline.atomic_write(tiny_change, target))


if __name__ == "__main__":
    unittest.main()
