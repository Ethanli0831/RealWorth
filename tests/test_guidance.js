"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const G = require("../docs/assets/guidance.js");
const data = require("../docs/data/data.json");
const forecasts = require("../docs/data/forecasts.json");
const now = Date.parse(data.meta.last_updated + "T14:00:00Z") + 864e5;
const base = {
  purpose: "surplus",
  horizon: "60",
  loss: "50",
  readiness: "ready",
  goal: "growth",
  currency: "USD",
  amount: "1000",
};
const assess = (p) => G.evaluate({ ...base, ...p }, data, forecasts, now);
test("essential money overrides even maximum stated appetite and an optimistic long horizon", () => {
  const r = assess({ purpose: "essential", loss: "100", horizon: "120" });
  assert.equal(r.action, "protected");
  assert.ok(r.rows.every((a) => a.status === "avoid"));
});
test("zero-loss, borrowed money and missing financial basics do not get risky approvals", () => {
  for (const p of [
    { loss: "0" },
    { purpose: "borrowed" },
    { readiness: "no-reserve" },
    { readiness: "debt" },
    { readiness: "unknown" },
  ])
    assert.ok(assess(p).rows.every((r) => r.status === "avoid"));
  assert.equal(assess({ purpose: "borrowed" }).action, "debt");
});
test("quick-profit demand is refused even for genuinely spare money and favourable model error", () => {
  const r = assess({ goal: "quick", loss: "100" });
  assert.equal(r.action, "quick");
  assert.ok(r.rows.every((a) => a.status === "avoid"));
  assert.ok(r.rows.every((a) => a.market.entrySignal === false));
});
test("a short deadline is not described by one-year window outcomes", () => {
  const r = assess({ horizon: "0", loss: "100" });
  assert.equal(r.action, "short");
  assert.ok(
    r.rows
      .filter((a) => a.asset !== "T-Bills")
      .every((a) => a.status === "avoid"),
  );
  assert.ok(r.rows.every((a) => !a.matchedToDeadline && a.matching === 12));
});
test("long-term spare money can compare diversified equities while Bitcoin fails a 50-percent limit", () => {
  const r = assess({});
  assert.equal(r.action, "growth");
  assert.equal(r.rows.find((a) => a.asset === "S&P 500").status, "research");
  assert.equal(r.rows.find((a) => a.asset === "Bitcoin").status, "avoid");
  const spare = assess({ loss: "100" });
  assert.equal(
    spare.rows.find((a) => a.asset === "Bitcoin").status,
    "experiment",
  );
  const savings = assess({ purpose: "reserve", loss: "100" });
  assert.equal(savings.rows.find((a) => a.asset === "Bitcoin").status, "avoid");
});
test("capital-preservation and stable-income goals do not turn gold, Bitcoin or TLT into fixed-income promises", () => {
  const protect = assess({ goal: "protect", loss: "100" });
  assert.equal(protect.action, "cautious");
  assert.ok(
    protect.rows
      .filter((a) => a.asset !== "T-Bills")
      .every((a) => a.status === "avoid"),
  );
  const income = assess({ goal: "income", loss: "100" });
  assert.equal(income.action, "income");
  assert.ok(
    income.rows
      .filter((a) => a.asset !== "T-Bills")
      .every((a) => a.status === "avoid"),
  );
});
test("non-USD spending is not assessed as local purchasing power", () => {
  for (const currency of ["CAD", "other"]) {
    const r = assess({ currency });
    assert.equal(r.action, "currencyTitle");
    assert.ok(r.rows.every((a) => a.status === "unknown"));
  }
});
test("evidence uses shared endpoints and actual historical metrics with transparent stress floors", () => {
  const r = assess({});
  assert.equal(r.start, "2014-09");
  assert.equal(r.end, data.meta.data_through);
  for (const a of r.rows) {
    assert.ok(a.rolling.n > 0);
    assert.ok(a.stress >= Math.abs(a.nominalDD));
    assert.ok(a.stress >= a.policy.stress);
    assert.ok(a.realDD <= 0);
    assert.ok(a.rolling.beat >= 0 && a.rolling.beat <= 100);
  }
});
test("missing, malformed, future-dated or stale core evidence cannot clear assets", () => {
  for (const bad of [
    null,
    { ...data, meta: { ...data.meta, last_updated: "2020-01-01" } },
    { ...data, meta: { ...data.meta, last_updated: "2099-01-01" } },
  ]) {
    const r = G.evaluate(base, bad, forecasts, now);
    assert.ok(r.unavailable);
    assert.equal(r.rows.length, 0);
  }
  const bad = structuredClone(data);
  bad.growth.real.Bitcoin[15] = -1;
  assert.ok(G.evaluate(base, bad, forecasts, now).unavailable);
});
test("missing forecasts do not fabricate a timely entry signal", () => {
  const r = G.evaluate(base, data, null, now);
  assert.ok(r.forecastsStale);
  assert.ok(
    r.rows.every(
      (a) => a.market.comparison === "unknown" && !a.market.entrySignal,
    ),
  );
});
test("a lower prediction error is not relabelled a verified trading profit", () => {
  const row = {
    quote: 100,
    quote_at: new Date(now - 36e5).toISOString(),
    forecast: {
      target_at: new Date(now + 23 * 36e5).toISOString(),
      backtest: {
        observations: 90,
        coverage_percent: 90,
        mean_abs_price_error_percent: 0.1,
        random_walk_error_percent: 1,
      },
    },
  };
  const r = G.assessForecast(row, now);
  assert.equal(r.comparison, "lower");
  assert.equal(r.entrySignal, false);
  assert.equal(r.stale, false);
  row.forecast.target_at = new Date(now - 36e5).toISOString();
  assert.ok(G.assessForecast(row, now).stale);
});
test("unanswered questions and invalid amounts cannot silently create an aggressive profile", () => {
  for (const patch of [
    { purpose: "" },
    { loss: "500" },
    { horizon: "18" },
    { amount: "-1" },
    { amount: "NaN" },
  ])
    assert.throws(() => assess(patch));
});

test("amount illustration uses the frozen anchor, never a refreshed current quote", () => {
  const row = {
    quote: 999,
    forecast: { anchor_price: 100, levels: { q10: 90, q90: 110 } },
  };
  const r = G.investmentIllustration(row, 1000);
  assert.equal(r.lower, 900);
  assert.equal(r.upper, 1100);
  row.quote = 10;
  assert.deepEqual(G.investmentIllustration(row, 1000), r);
  delete row.forecast.anchor_price;
  assert.equal(G.investmentIllustration(row, 1000), null);
});
test("stale macro context cannot be presented as a current market assessment", () => {
  const macro = {
    macro: {
      checked_at: "2020-01-01T00:00:00Z",
      growth_direction: "Falling",
      inflation_direction: "Rising",
      pressure_flags: ["Credit pressure"],
    },
  };
  const r = G.evaluate(base, data, forecasts, now, macro);
  assert.equal(r.macro.fresh, false);
  assert.ok(r.rows.every((a) => !a.market.entrySignal));
  const fresh = structuredClone(macro);
  fresh.macro.checked_at = new Date(now - 36e5).toISOString();
  assert.equal(G.evaluate(base, data, forecasts, now, fresh).macro.fresh, true);
});
