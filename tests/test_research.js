"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const {
  safeLink,
  validateResearch,
  filterNews,
} = require("../docs/assets/research.js");
const mechanism = {
  id: "gold",
  name: "Gold supply",
  chain: ["Check evidence"],
  gold: "Conditional",
  bitcoin: "Ambiguous",
  counter: "Verify scale",
};
function fixture() {
  return {
    meta: { checked_at: "2026-10-17T12:00:00Z" },
    macro: {
      indicators: [
        {
          name: "CPI",
          value: null,
          change: null,
          source: "https://fred.stlouisfed.org/series/CPIAUCSL",
        },
      ],
    },
    sources: [
      {
        name: "Bridgewater",
        category: "Fund research",
        url: "https://www.bridgewater.com/research-and-insights",
      },
    ],
    mechanisms: [mechanism],
    feed_health: [],
    news: [
      {
        title: "Gold supply claim",
        publisher: "CERN",
        url: "https://home.cern/news/example",
        published_at: "2026-10-17T10:00:00Z",
        topics: ["gold"],
      },
    ],
  };
}
test("unknown macro readings remain null and valid", () =>
  assert.equal(validateResearch(fixture()).macro.indicators[0].value, null));
test("links reject script protocols, credentials and malformed addresses", () => {
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,bad",
    "https://user:secret@example.org/",
    "//example.org",
  ])
    assert.equal(safeLink(url), false);
  assert.equal(safeLink("https://home.cern/news/"), true);
});
test("unsafe headlines and undefined mechanism IDs reject the snapshot", () => {
  const data = fixture();
  data.news[0].url = "javascript:alert(1)";
  assert.throws(() => validateResearch(data), /Invalid news/);
  data.news[0].url = "https://example.org";
  data.news[0].topics = ["made-up"];
  assert.throws(() => validateResearch(data), /Invalid news/);
});
test("topic and publisher search combine and preserve source evidence", () => {
  const data = fixture();
  assert.equal(filterNews(data, "gold", "CERN").length, 1);
  assert.equal(filterNews(data, "policy", "CERN").length, 0);
  assert.equal(filterNews(data, "gold", "Bitcoin").length, 0);
  assert.equal(filterNews(data, "", " gold ").at(0).publisher, "CERN");
});
test("actual generated research validates", () => {
  const path = new URL("../docs/data/research.json", `file://${__filename}`);
  assert.equal(
    validateResearch(JSON.parse(fs.readFileSync(path, "utf8"))).sources.length,
    18,
  );
});
