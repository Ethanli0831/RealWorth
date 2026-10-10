"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const {
  validateData,
  calculateHolding,
  risk,
  verdict,
} = require("../docs/assets/app.js");
const data = JSON.parse(
  fs.readFileSync(
    new URL("../docs/data/data.json", `file://${__filename}`),
    "utf8",
  ),
);

test("the actual derived dataset passes schema validation", () => {
  assert.equal(validateData(data), data);
});
test("Bitcoin's Nov 2021 one-year hold loses over 60% from its real peak", () => {
  const result = calculateHolding(data, "Bitcoin", "2021-11", "12", 1000);
  assert.equal(result.dates.at(-1), "2022-11");
  assert.ok(result.drawdown < -0.6);
  assert.ok(result.realValue > 0 && result.realValue < 400);
  const gold = calculateHolding(data, "Gold", "2021-11", "12", 1000);
  assert.ok(gold.drawdown > -0.3 && gold.drawdown < 0);
});
test("periods beyond available data are rejected rather than shortened", () => {
  assert.throws(
    () => calculateHolding(data, "Gold", data.meta.data_through, "12", 1000),
    /ends after/,
  );
});
test("Bitcoin before its history gets an informative error", () => {
  assert.throws(
    () => calculateHolding(data, "Bitcoin", "2014-01", "12", 1000),
    /begins/,
  );
});
test("CPI gaps preserve nominal results without fabricating real endpoints", () => {
  const result = calculateHolding(data, "Gold", "2025-10", "latest", 1000);
  assert.ok(result.nominalValue > 0);
  assert.equal(result.realValue, null);
  assert.equal(result.drawdown, null);
  assert.ok(result.values.every((v) => v === null));
});
test("an interior missing month preserves known real endpoint returns", () => {
  const result = calculateHolding(data, "Gold", "2025-09", "latest", 1000);
  assert.ok(Number.isFinite(result.realValue));
  assert.equal(result.values[1], null);
  assert.ok(Number.isFinite(result.values[2]));
  assert.deepEqual(result.missingMonths, ["2025-10"]);
});
test("a later drawdown is measured from its peak, not the purchase amount", () => {
  const fake = structuredClone(data);
  fake.growth.real.Gold = fake.growth.dates.map(() => 1);
  fake.growth.real.Gold[1] = 2;
  fake.growth.real.Gold[2] = null;
  fake.growth.real.Gold[3] = 0.5;
  const result = calculateHolding(
    fake,
    "Gold",
    fake.growth.dates[0],
    "12",
    1000,
  );
  assert.equal(result.drawdown, -0.75);
  assert.equal(result.minimum, 500);
});
test("zero, negative and non-finite investments are rejected", () => {
  for (const amount of [0, -1, NaN, Infinity])
    assert.throws(
      () => calculateHolding(data, "Gold", "2021-11", "12", amount),
      /amount/,
    );
});
test("drawdown severity includes meaningful boundary cases", () => {
  assert.equal(risk(-14.99).label, "Mild");
  assert.equal(risk(-15).label, "Significant");
  assert.equal(risk(-40).label, "Significant");
  assert.equal(risk(-40.01).label, "Severe");
});
test("verdicts prioritize loss of purchasing power and distinguish deep drawdowns", () => {
  assert.equal(
    verdict({ ann_real_return: -1, max_drawdown: -5 }),
    "Loses to inflation",
  );
  assert.equal(
    verdict({ ann_real_return: 20, max_drawdown: -70 }),
    "Positive return, deep drawdowns",
  );
  assert.equal(
    verdict({ ann_real_return: 5, max_drawdown: -20 }),
    "Grows, with drawdown risk",
  );
  assert.equal(
    verdict({ ann_real_return: 5, max_drawdown: -5 }),
    "Preserved purchasing power",
  );
});
