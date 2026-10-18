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
