"""Static discoverability checks; not a claim that Google has indexed the site."""

import json
import re
from pathlib import Path
import unittest
from urllib.parse import urljoin, urlsplit
import xml.etree.ElementTree as ET
from bs4 import BeautifulSoup

DOCS = Path(__file__).resolve().parents[1] / "docs"
BASE = "https://ethanli0831.github.io/RealWorth/"


def pages():
    return [
        p
        for p in DOCS.glob("*.html")
        if not (
            re.fullmatch(r"google[A-Za-z0-9_-]+\.html", p.name)
            and p.read_text().strip() == "google-site-verification: " + p.name
        )
    ]


class SearchDiscoverability(unittest.TestCase):
    def test_each_page_has_a_unique_project_canonical_and_description(self):
        urls = set()
        for p in pages():
            s = BeautifulSoup(p.read_text(), "html.parser")
            expected = BASE + ("" if p.name == "index.html" else p.name)
            self.assertEqual(
                [n["href"] for n in s.select("link[rel=canonical]")], [expected]
            )
            self.assertTrue(s.title.get_text().strip())
            self.assertGreater(
                len(s.find("meta", attrs={"name": "description"})["content"]), 30
            )
            self.assertNotIn(
                "noindex", s.find("meta", attrs={"name": "robots"})["content"]
            )
            self.assertNotIn(expected, urls)
            urls.add(expected)

    def test_sitemap_lists_every_public_html_page_and_no_data_assets(self):
        tree = ET.parse(DOCS / "sitemap.xml")
        urls = [
            n.text
            for n in tree.findall(".//{http://www.sitemaps.org/schemas/sitemap/0.9}loc")
        ]
        expected = {BASE + ("" if p.name == "index.html" else p.name) for p in pages()}
        self.assertEqual(set(urls), expected)
        self.assertEqual(len(urls), len(set(urls)))

    def test_structured_metadata_matches_visible_identity_and_page_url(self):
        for p in pages():
            s = BeautifulSoup(p.read_text(), "html.parser")
            data = json.loads(s.select_one('script[type="application/ld+json"]').string)
            self.assertEqual(data["@type"], "WebPage")
            self.assertEqual(data["name"], s.title.get_text(strip=True))
            self.assertEqual(data["url"], s.select_one("link[rel=canonical]")["href"])
            self.assertEqual(data["isPartOf"]["name"], "RealWorth")
            self.assertNotIn("aggregateRating", data)
            self.assertEqual(
                s.find("meta", attrs={"property": "og:url"})["content"], data["url"]
            )

    def test_public_pages_use_english_without_retired_translation_links(self):
        self.assertFalse((DOCS / "zh.html").exists())
        for p in pages():
            s = BeautifulSoup(p.read_text(), "html.parser")
            self.assertEqual(s.html["lang"], "en")
            self.assertFalse(s.select("link[hreflang], [data-guide-language]"))
            self.assertNotRegex(s.get_text(), r"[\u3400-\u4dbf\u4e00-\u9fff]")
            self.assertFalse(s.select('a[href="zh.html"]'))

    def test_local_html_links_resolve_without_javascript(self):
        for p in pages():
            s = BeautifulSoup(p.read_text(), "html.parser")
            for a in s.select("a[href]"):
                url = urlsplit(urljoin(BASE + p.name, a["href"]))
                if url.netloc != "ethanli0831.github.io" or not url.path.startswith(
                    "/RealWorth/"
                ):
                    continue
                relative = url.path.removeprefix("/RealWorth/") or "index.html"
                self.assertTrue((DOCS / relative).is_file(), (p.name, a["href"]))
