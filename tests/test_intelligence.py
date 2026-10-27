import importlib.util
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
spec = importlib.util.spec_from_file_location(
    "intelligence", ROOT / "scripts/build_intelligence.py"
)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class ArticleEvidence(unittest.TestCase):
    def test_private_and_unapproved_article_urls_are_rejected(self):
        for url in [
            "http://bbc.com/news/x",
            "https://bbc.com.attacker.org/x",
            "https://127.0.0.1/",
            "https://user:secret@bbc.com/",
        ]:
            with self.assertRaises(ValueError):
                m.allowed_url(url, check_dns=False)
        self.assertEqual(
            m.allowed_url("https://www.bbc.com/news/x", check_dns=False),
            "https://www.bbc.com/news/x",
        )

    def test_article_reader_ignores_navigation_and_rejects_paywall(self):
        paragraph = "Inflation and interest rates can influence borrowing and household spending. "
        html = (
            "<html><nav>Navigation junk</nav><main><p>"
            + paragraph * 12
            + "</p></main></html>"
        )
        text = m.extract_article(html)
        self.assertNotIn("Navigation junk", text)
        self.assertIn("Inflation", text)
        with self.assertRaises(ValueError):
            m.extract_article(
                '<main><div id="paywall">Subscribe</div><p>'
                + paragraph * 12
                + "</p></main>"
            )

    def test_model_must_cite_actual_evidence_and_include_conditions(self):
        evidence = {"E1": "Inflation increased in the latest release."}
        good = {
            "summary": "The release reports higher inflation.",
            "evidence_ids": ["E1"],
            "chain": [
                "Reported inflation increase",
                "Potentially tighter monetary conditions",
            ],
            "gold": {
                "direction": "mixed",
                "condition": "Depends on real yields and hedge demand.",
            },
            "bitcoin": {
                "direction": "unclear",
                "condition": "Depends on risk appetite and liquidity.",
            },
            "uncertainty": "The release may be revised and the move may be priced.",
        }
        self.assertEqual(
            m.validate_analysis(good, evidence)["gold"]["direction"], "mixed"
        )
        good["bitcoin"]["condition"] += " \u907f\u98ce\u6e2f"
        with self.assertRaisesRegex(ValueError, "must use English"):
            m.validate_analysis(good, evidence)
        good["bitcoin"]["condition"] = "Depends on risk appetite and liquidity."
        good["evidence_ids"] = ["E99"]
        with self.assertRaises(ValueError):
            m.validate_analysis(good, evidence)
        good["evidence_ids"] = ["E1"]
        good["summary"] = "Bitcoin will rise 20% tomorrow."
        with self.assertRaises(ValueError):
            m.validate_analysis(good, evidence)

    def test_quoted_evidence_is_short_and_from_the_actual_body(self):
        body = "The central bank indicated that interest rates depend on incoming inflation data. Gold market participants consider real yields and the dollar when assessing demand."
        evidence = m.evidence_blocks(body)
        for text in evidence.values():
            self.assertLessEqual(len(text.split()), 12)
            self.assertIn(text, body)

    def test_schema_placeholders_and_repeated_events_are_not_ai_analysis(self):
        evidence = {"E1": "The central bank reported higher inflation."}
        value = {
            "summary": "The release describes higher inflation.",
            "evidence_ids": ["E1"],
            "chain": [
                "Reported inflation increase",
                "Potentially tighter monetary conditions",
            ],
            "gold": {
                "direction": "mixed",
                "condition": "Depends on real yields and demand.",
            },
            "bitcoin": {
                "direction": "unclear",
                "condition": "Depends on liquidity and risk appetite.",
            },
            "uncertainty": "What could invalidate this analysis",
        }
        with self.assertRaises(ValueError):
            m.validate_analysis(value, evidence)
        value["uncertainty"] = (
            "Revisions or prior market pricing could weaken the effect."
        )
        value["chain"] = [
            "event: Higher inflation; channel: reported event",
            "event: Higher inflation; channel: conditional channel",
        ]
        with self.assertRaises(ValueError):
            m.validate_analysis(value, evidence)

    def test_named_risk_company_is_not_a_financial_transmission_channel(self):
        value = {
            "summary": "The article reports increased attacks on ships.",
            "evidence_ids": ["E1"],
            "chain": [
                "A report described attacks on shipping.",
                "A Risk Intelligence executive commented on the attacks.",
                "The number of ship attacks increased.",
            ],
            "gold": {"direction": "up", "condition": "If safe-haven demand increases."},
            "bitcoin": {"direction": "down", "condition": "If risk appetite weakens."},
            "uncertainty": "A rapid resolution could limit the effect.",
        }
        with self.assertRaisesRegex(ValueError, "financial transmission"):
            m.validate_analysis(value, {"E1": "The article reports increased attacks."})

    def test_an_unrelated_policy_example_cannot_become_a_shipping_news_summary(self):
        copied = {
            "summary": "The central bank signalled possible tightening.",
            "evidence_ids": ["E1"],
            "chain": [
                "The bank signalled tighter policy.",
                "If real yields rise, non-yielding assets face higher costs.",
                "Gold may weaken if yields rise.",
            ],
            "gold": {
                "direction": "mixed",
                "condition": "Depends on real yields and demand.",
            },
            "bitcoin": {"direction": "down", "condition": "If liquidity tightens."},
            "uncertainty": "Prior market pricing could limit the reaction.",
        }
        with self.assertRaisesRegex(ValueError, "article topic"):
            m.validate_analysis(
                copied,
                {"E1": "Ship attacks near Hormuz have increased."},
                "Ship attack reports near Hormuz reach record high as oil exports slow",
            )

    def test_direction_labels_need_conditions_and_uncertainty_cannot_repeat_events(
        self,
    ):
        value = {
            "summary": "The article reports ship attacks near Hormuz.",
            "evidence_ids": ["E1"],
            "chain": [
                "Ship attacks increased.",
                "Oil supply disruption could raise transport costs.",
                "Risk aversion could increase safe-haven gold demand.",
            ],
            "gold": {"direction": "up", "condition": "mixed, unclear, and high risk"},
            "bitcoin": {"direction": "down", "condition": "unclear, high volatility"},
            "uncertainty": "The number of attacks has increased significantly.",
        }
        evidence = {"E1": "Ship attacks increased near Hormuz."}
        with self.assertRaisesRegex(ValueError, "conditional"):
            m.validate_analysis(value, evidence)
        for asset in ("gold", "bitcoin"):
            value[asset][
                "condition"
            ] = "If risk appetite weakens, asset demand could change."
        with self.assertRaisesRegex(ValueError, "countercase"):
            m.validate_analysis(value, evidence)
        value["uncertainty"] = "If shipping stabilizes, the risk premium could fade."
        value["summary"] = "The article reports ship attacks near Hormuz. " + "a" * 255
        with self.assertRaisesRegex(ValueError, "truncated"):
            m.validate_analysis(value, evidence)

    def test_reported_headline_numbers_are_evidence_but_not_price_targets(self):
        value = {
            "summary": "The U.S. budget deficit increased 12%.",
            "evidence_ids": ["E1"],
            "chain": [
                "The budget deficit increased.",
                "Higher borrowing could raise bond supply and yields.",
                "Gold could face yield pressure if real yields rise.",
            ],
            "gold": {
                "direction": "mixed",
                "condition": "If real yields rise, demand could weaken.",
            },
            "bitcoin": {
                "direction": "unclear",
                "condition": "If funding tightens, speculative demand could weaken.",
            },
            "uncertainty": "If buyers absorb the issuance, yields may not rise.",
        }
        title = "U.S. budget deficit increases 12%"
        evidence = {"E1": "The U.S. finished the fiscal year with a budget deficit."}
        self.assertEqual(
            m.validate_analysis(value, evidence, title)["summary"], value["summary"]
        )
        value["gold"]["condition"] = "If funding improves gold could rise 12%."
        with self.assertRaises(ValueError):
            m.validate_analysis(value, evidence, title)

    def test_rejected_articles_cannot_starve_later_model_slots(self):
        from datetime import datetime, timedelta, timezone

        start = datetime(2026, 10, 18, tzinfo=timezone.utc)
        items = list(range(10))
        attempted = set()
        for hour in range(5):
            queue = m.rotate_candidate_queue(items, start + timedelta(hours=hour), 2)
            self.assertEqual(set(queue), set(items))
            attempted.update(queue[:2])
        self.assertEqual(attempted, set(items))
        self.assertEqual(m.rotate_candidate_queue([], start, 2), [])


if __name__ == "__main__":
    unittest.main()
