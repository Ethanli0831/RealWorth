"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const {
  validateForecasts,
  validateIntelligence,
} = require("../docs/assets/intelligence.js");
const data = JSON.parse(
  fs.readFileSync(
    new URL("../docs/data/forecasts.json", `file://${__filename}`),
    "utf8",
  ),
);
test("all actual quote rows carry future-at-issue ordered scenarios", () =>
  assert.equal(validateForecasts(data).assets.length, 5));
test("invalid numerical prices and reversed intervals are rejected", () => {
  const bad = structuredClone(data);
  bad.assets[0].forecast.levels.q10 = -5;
  assert.throws(() => validateForecasts(bad), /bands/);
  const second = structuredClone(data);
  second.assets[0].forecast.target_at = second.assets[0].forecast.issued_at;
  assert.throws(() => validateForecasts(second), /target/);
});
test("AI labels require model, source body and evidence provenance", () => {
  const a = {
    meta: { checked_at: "2026-10-17T22:00:00Z" },
    articles: [
      {
        analysis: { chain: ["Actual generated channel"], evidence_ids: ["E1"] },
        model: "Test model",
        provider: "Local inference",
        analyzed_at: "2026-10-17T22:00:00Z",
        body_characters: 1000,
        evidence: { E1: "Actual source fragment" },
      },
    ],
  };
  assert.equal(validateIntelligence(a), a);
  delete a.articles[0].evidence.E1;
  assert.throws(() => validateIntelligence(a), /provenance/);
});

test("prospective scoring gives one earliest issue per asset target date, keeping issue counts separate", () => {
  const { verificationByAsset } = require("../docs/assets/intelligence.js");
  const record = (ticker, date, issue, error) => ({
    ticker,
    target_at: date,
    issued_at: issue,
    status: "Verified against later observation",
    actual_return_percent: 10,
    median_error_percent: error,
    inside_outer_band: true,
  });
  const rows = [
    record("GLD", "2026-10-23T20:00:00Z", "2026-10-22T12:00:00Z", 2),
    record("GLD", "2026-10-23T20:00:00Z", "2026-10-22T13:00:00Z", 99),
    record("SPY", "2026-10-23T20:00:00Z", "2026-10-22T12:00:00Z", 1),
  ];
  rows.push({
    ...rows[0],
    status: "Invalidated draft",
    median_error_percent: 999,
  });
  const g = verificationByAsset(rows).find((r) => r.ticker === "GLD");
  assert.equal(g.issues, 2);
  assert.equal(g.dates, 1);
  assert.equal(g.mae, 2);
  assert.equal(g.coverage, 100);
  assert.ok(Math.abs(g.baseline - 1000 / 110) < 1e-8);
});
