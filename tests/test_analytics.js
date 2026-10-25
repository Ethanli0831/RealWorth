"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const A = require("../docs/assets/analytics.js");
const data = require("../docs/data/data.json");
test("common comparison starts when all five real and nominal indices exist", () => {
  const b = A.bounds(data);
  assert.equal(data.growth.dates[b.start], "2014-09");
  for (const asset of data.meta.assets) {
    const s = A.score(data, asset, b.start, b.end);
    assert.ok(Number.isFinite(s.ann_real_return));
    assert.ok(s.max_drawdown <= 0);
  }
  assert.equal(A.score(data, "T-Bills", b.start, b.end).sharpe, null);
});
test("rolling windows count calendar endpoints, omit missing CPI, and include no fabricated returns", () => {
  const d = {
    meta: { assets: ["A"] },
    growth: {
      dates: ["a", "b", "c", "d", "e"],
      real: { A: [1, 2, null, 1, 3] },
      nominal: { A: [1, 2, 3, 1, 3] },
    },
  };
  const r = A.rolling(d, "A", 2);
  assert.equal(r.n, 1);
  assert.equal(r.skipped, 2);
  assert.equal(r.min, -50);
  assert.equal(r.beat, 0);
});
test("recovery distinguishes no loss, unrecovered, first observed crossing and missing starting CPI", () => {
  assert.equal(A.recovery([100, 80, null, 100, 70]).months, 3);
  assert.equal(
    A.recovery([100, 80, 90]).status,
    "Not recovered within this hold",
  );
  assert.match(A.recovery([100, 110, 120]).status, /Never observed/);
  assert.equal(A.recovery([null, 100]).months, null);
});
test("regime distributions use real observed samples, not nominal substitutes across CPI gaps", () => {
  const d = {
    meta: { assets: ["A"] },
    regime: {
      observations: [
        { level: "High", real: { A: -10 }, nominal: { A: 10 } },
        { level: "High", real: { A: 10 }, nominal: { A: 30 } },
        { level: "High", real: { A: null }, nominal: { A: 99 } },
      ],
    },
  };
  const r = A.regimeStats(d)[0].assets.A;
  assert.equal(r.n, 2);
  assert.equal(r.mean, 0);
  assert.equal(r.median, 0);
  assert.equal(A.regimeStats(d, "median", "nominal")[0].assets.A.n, 3);
});

test('scorecard annualises calendar-time growth and keeps genuine one-month excess returns', () => {
  const d={growth:{real:{A:[1,2,1,2], 'T-Bills':[1,1,1,1]}}};
  const r=A.score(d,'A',0,3);
  assert.equal(r.ann_real_return,1500);
  assert.equal(r.max_drawdown,-50);
  assert.equal(r.current_drawdown,0);
  assert.ok(Math.abs(r.sharpe-2)<1e-10);
  const gap={growth:{real:{A:[1,2,null,2], 'T-Bills':[1,1,null,1]}}};
  const g=A.score(gap,'A',0,3);
  assert.equal(g.ann_real_return,1500);
  assert.equal(g.ann_volatility,null);
});
