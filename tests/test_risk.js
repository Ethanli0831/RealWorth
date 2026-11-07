"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const R = require("../docs/assets/risk.js"),
  G = require("../docs/assets/guidance.js");
const data = require("../docs/data/data.json"),
  forecasts = require("../docs/data/forecasts.json");
const now = Date.parse(data.meta.last_updated + "T12:00:00Z") + 864e5;
const stamp = (x) => new Date(x).toISOString();
function fixture() {
  return {
    meta: {
      built_at: stamp(now),
      source_checked_at: stamp(now),
      tracking_started_at: stamp(now),
      news_stale: false,
    },
    events: [
      {
        id: "a".repeat(24),
        title: "Synthetic test: US lawmakers propose AI restrictions",
        url: "https://example.org/policy",
        first_observed_at: stamp(now),
        published_at: stamp(now - 36e5),
        scheduled_at: null,
        categories: ["ai_regulation"],
        tickers: ["BTC-USD", "SPY"],
        regions: ["All"],
        stage: "Proposal reported; not enacted",
      },
    ],
    categories: [
      {
        id: "ai_regulation",
        name: "AI regulation",
        chain: ["Verify proposal"],
        checks: ["Read legal text"],
      },
    ],
    regions: [
      {
        id: "China",
        name: "China",
        channel: "Exports and funding could transmit a shock.",
        caveat: "No immunity assumed.",
      },
    ],
    gaps: [],
    calendar_health: [],
    source_directory: [],
  };
}
const base = {
  purpose: "surplus",
  horizon: "60",
  loss: "50",
  readiness: "ready",
  goal: "growth",
  currency: "USD",
  amount: "1000",
};
const evaluate = (profile, risk) =>
  G.evaluate({ ...base, ...profile }, data, forecasts, now, null, risk);
test("missing, stale, malformed or future-clock risk evidence never produces an all-clear", () => {
  for (const value of [
    null,
    {},
    { ...fixture(), meta: { ...fixture().meta, news_stale: true } },
    { ...fixture(), meta: { ...fixture().meta, built_at: stamp(now + 864e5) } },
  ]) {
    const r = R.assess(base, value, now);
    assert.ok(["unavailable", "stale"].includes(r.status));
    assert.equal(r.review, false);
    assert.match(r.message, /unavailable|stale/);
  }
});
test("a headline needs event review for concentrated money, not an automatic ban for every investor", () => {
  assert.equal(
    R.assess({ ...base, concentration: "ai" }, fixture(), now).review,
    true,
  );
  assert.equal(
    R.assess({ ...base, concentration: "diversified" }, fixture(), now).review,
    false,
  );
  const r = evaluate({ concentration: "ai" }, fixture());
  assert.equal(r.action, "eventReview");
  assert.equal(r.rows.find((x) => x.asset === "S&P 500").status, "review");
  assert.equal(r.rows.find((x) => x.asset === "Bitcoin").scenario, null);
  assert.equal(r.rows.find((x) => x.asset === "T-Bills").status, "research");
  const diversified = evaluate({ concentration: "diversified" }, fixture());
  assert.equal(
    diversified.rows.find((x) => x.asset === "S&P 500").status,
    "research",
  );
});
test("event headlines never override essential money, debt or zero-loss safeguards", () => {
  for (const p of [
    { purpose: "essential" },
    { purpose: "borrowed" },
    { loss: "0" },
    { readiness: "no-reserve" },
  ]) {
    const r = evaluate({ ...p, concentration: "ai" }, fixture());
    assert.ok(r.rows.every((x) => x.status === "avoid"));
    assert.notEqual(r.action, "eventReview");
  }
});
test("unknown concentration and absent watches do not establish a safe entry", () => {
  const f = fixture();
  f.events = [];
  const r = R.assess(base, f, now);
  assert.match(r.message, /does not mean.*safe/);
  assert.equal(r.review, false);
  const state = evaluate({}, null);
  assert.equal(state.eventRisk.status, "unavailable");
  assert.equal(
    state.rows.find((x) => x.asset === "S&P 500").status,
    "research",
  );
});
test("region selection does not manufacture an Asian loss range or immunity", () => {
  const r = R.assess(
    { ...base, concentration: "regional", region: "China" },
    fixture(),
    now,
  );
  assert.equal(r.review, true);
  assert.equal(r.region, "China");
  assert.equal(r.events.length, 1);
  assert.equal(r.probability, undefined);
});
test("unsafe sources and unrecognized categories reject an event snapshot", () => {
  const f = fixture();
  f.events[0].url = "javascript:alert(1)";
  assert.throws(() => R.validateRisk(f));
  f.events[0].url = "https://example.org/x";
  f.events[0].categories = ["unknown"];
  assert.throws(() => R.validateRisk(f));
});
test("near official schedules are considered without predicting their outcomes", () => {
  const f = fixture();
  f.events[0] = {
    ...f.events[0],
    published_at: null,
    scheduled_at: stamp(now + 36e5),
    kind: "Official scheduled release",
  };
  assert.equal(R.assess({ ...base, horizon: "3" }, f, now).review, true);
  f.events[0].scheduled_at = stamp(now + 10 * 864e5);
  assert.equal(R.assess({ ...base, horizon: "3" }, f, now).events.length, 0);
});
test("a specific Treasury credit watch can require review of BIL as well", () => {
  const f = fixture();
  f.categories[0].id = "credit";
  f.events[0].categories = ["credit"];
  f.events[0].tickers = ["BIL", "TLT"];
  f.events[0].title = "Synthetic test: Treasury default risk";
  const r = evaluate({ horizon: "3" }, f);
  assert.equal(r.rows.find((x) => x.asset === "T-Bills").status, "review");
});
test("the published risk snapshot validates without inventing comprehensive coverage", () => {
  const actual = require("../docs/data/risk.json");
  assert.equal(R.validateRisk(actual), actual);
  assert.ok(actual.gaps.length > 0);
});
test("zero successfully retrieved feeds remains unknown even with a fresh build timestamp", () => {
  const f = fixture();
  f.meta.news_unavailable = true;
  const r = R.assess(base, f, now);
  assert.equal(r.status, "unavailable");
  assert.match(r.message, /coverage is unknown/);
});
