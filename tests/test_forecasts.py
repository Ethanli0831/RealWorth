import importlib.util
from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys
import unittest
from unittest.mock import patch, MagicMock
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
spec = importlib.util.spec_from_file_location(
    "forecasts", ROOT / "scripts/build_forecasts.py"
)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
NOW = datetime(2026, 10, 17, 18, tzinfo=timezone.utc)
CLOSES = 100 * np.exp(np.cumsum(np.tile([0.002, -0.003, 0.001, 0.004, -0.001], 90)))


class ForecastIntegrity(unittest.TestCase):
    def test_future_target_and_real_data_requirements(self):
        with self.assertRaises(ValueError):
            m.create_forecast("GLD", 100, NOW, NOW, NOW, CLOSES, "x")
        with self.assertRaises(ValueError):
            m.create_forecast(
                "BTC-USD",
                100,
                NOW + timedelta(minutes=1),
                NOW + timedelta(days=1),
                NOW,
                CLOSES,
                "future-anchor",
            )
        with self.assertRaises(ValueError):
            m.distribution([100] * 50)
        q, backtest = m.distribution(CLOSES)
        self.assertTrue(np.all(np.diff(q) >= 0))
        self.assertEqual(backtest["observations"], 90)
        self.assertTrue(0 <= backtest["coverage_percent"] <= 100)

    def test_issue_is_frozen_while_the_observed_quote_can_change(self):
        target = NOW + timedelta(days=2)
        value = {
            "ticker": "GLD",
            "asset": "Gold ETF",
            "quote": 100,
            "quote_at": m.stamp(NOW),
            "quote_stale": False,
            "market_status": "Closed",
            "tomorrow_has_session": False,
            "source": "https://finance.yahoo.com/quote/GLD/",
            "anchor": 100,
            "anchor_at": NOW,
            "target": target,
            "identifier": "GLD|target",
            "closes": CLOSES,
            "verification": [],
        }
        with patch.object(m, "ASSETS", {"GLD": "Gold ETF"}), patch.object(
            m, "fetch_asset", return_value=value
        ):
            first, ledger = m.build({}, {"records": []}, NOW)
            value["quote"] = 120
            value["anchor"] = 120
            value["closes"] = CLOSES * 2
            second, _ = m.build(first, ledger, NOW + timedelta(hours=1))
        self.assertEqual(second["assets"][0]["quote"], 120)
        self.assertEqual(
            first["assets"][0]["forecast"], second["assets"][0]["forecast"]
        )

    def test_future_observation_not_used_early_and_realization_is_derived(self):
        r = m.create_forecast(
            "BTC-USD", 100, NOW, NOW + timedelta(days=1), NOW, CLOSES, "f"
        )
        target = NOW + timedelta(days=1)
        observed = [(target, 110)]
        self.assertEqual(
            m.settle_record(r, observed, NOW)["status"], "Pending future observation"
        )
        self.assertEqual(
            m.settle_record(
                r, [(target + timedelta(minutes=4), 110)], target + timedelta(minutes=1)
            )["status"],
            "Pending future observation",
        )
        settled = m.settle_record(r, observed, target + timedelta(minutes=1))
        self.assertEqual(settled["actual_return_percent"], 10)
        self.assertNotIn("anchor_price", settled)
        self.assertEqual(settled["issued_digest"], r["issued_digest"])
        late = m.settle_record(
            r, [(target + timedelta(minutes=6), 110)], target + timedelta(days=6)
        )
        self.assertTrue(late["status"].startswith("Unverified:"))
        self.assertNotIn("actual_return_percent", late)

    def test_invalid_draft_is_preserved_and_reissued_not_silently_overwritten(self):
        target = NOW + timedelta(days=1)
        old = m.create_forecast("BTC-USD", 100, NOW, target, NOW, CLOSES, "BTC-USD|day")
        old["anchor_at"] = m.stamp(NOW + timedelta(seconds=5))
        value = {
            "ticker": "BTC-USD",
            "asset": "Bitcoin",
            "quote": 101,
            "quote_at": m.stamp(NOW + timedelta(hours=1)),
            "quote_stale": False,
            "market_status": "Continuous",
            "tomorrow_has_session": True,
            "source": "https://finance.yahoo.com/quote/BTC-USD/",
            "anchor": 101,
            "anchor_at": NOW + timedelta(hours=1),
            "target": target + timedelta(hours=1),
            "identifier": "BTC-USD|day",
            "closes": CLOSES,
            "verification": [],
        }
        with patch.object(m, "ASSETS", {"BTC-USD": "Bitcoin"}), patch.object(
            m, "fetch_asset", return_value=value
        ):
            output, ledger = m.build({}, {"records": [old]}, NOW + timedelta(hours=1))
        self.assertTrue(output["assets"][0]["forecast"]["id"].endswith("revision-2"))
        original = next(r for r in ledger["records"] if r["id"] == old["id"])
        self.assertTrue(original["status"].startswith("Invalidated:"))
        self.assertEqual(original["levels"], old["levels"])
        self.assertNotIn("median_error_percent", original)

    def test_etf_weekend_has_no_invented_sunday_session(self):
        index = pd.bdate_range("2025-01-01", "2026-10-16", tz="America/New_York")
        frame = pd.DataFrame(
            {"Close": 100 + np.arange(len(index)) * 0.01, "Stock Splits": 0},
            index=index,
        )
        instance = MagicMock()
        instance.history.return_value = frame
        instance.get_history_metadata.return_value = {
            "regularMarketPrice": 104,
            "regularMarketTime": int(
                datetime(2026, 10, 16, 20, tzinfo=timezone.utc).timestamp()
            ),
        }
        with patch.object(m.yf, "Ticker", return_value=instance):
            value = m.fetch_asset("GLD", NOW, False)
        self.assertFalse(value["tomorrow_has_session"])
        self.assertEqual(
            value["target"], datetime(2026, 10, 19, 20, tzinfo=timezone.utc)
        )


if __name__ == "__main__":
    unittest.main()
