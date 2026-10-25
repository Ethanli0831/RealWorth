/* Calculations use derived indices only. No prices, API keys or model guesses. */
(function (root) {
  "use strict";
  const finite = Number.isFinite;
  const mean = (a) =>
    a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
  const sd = (a) =>
    a.length > 1
      ? Math.sqrt(
          a.reduce((s, x) => s + (x - mean(a)) ** 2, 0) / (a.length - 1),
        )
      : null;
  const quantile = (a, q) => {
    if (!a.length) return null;
    const s = [...a].sort((x, y) => x - y),
      k = (s.length - 1) * q,
      i = Math.floor(k);
    return s[i] + (s[Math.ceil(k)] - s[i]) * (k - i);
  };
  function bounds(data, common = true, asset = null) {
    const assets = common ? data.meta.assets : [asset];
    const valid = (i) =>
      assets.every(
        (a) =>
          finite(data.growth.real[a][i]) && finite(data.growth.nominal[a][i]),
      );
    const start = data.growth.dates.findIndex((_, i) => valid(i));
    let end = data.growth.dates.length - 1;
    while (end >= 0 && !valid(end)) end--;
    return { start, end };
  }
  function score(data, asset, start, end) {
    const path = data.growth.real[asset],
      cash = data.growth.real["T-Bills"];
    const returns = [],
      excess = [];
    let peak = path[start],
      dd = 0;
    for (let i = start + 1; i <= end; i++) {
      if (finite(path[i])) {
        peak = Math.max(peak, path[i]);
        dd = Math.min(dd, path[i] / peak - 1);
      }
      if (
        finite(path[i]) &&
        finite(path[i - 1]) &&
        finite(cash[i]) &&
        finite(cash[i - 1])
      ) {
        const r = path[i] / path[i - 1] - 1;
        returns.push(r);
        excess.push(r - (cash[i] / cash[i - 1] - 1));
      }
    }
    const ann = (path[end] / path[start]) ** (12 / (end - start)) - 1;
    const safe = (n, d) => (finite(d) && Math.abs(d) > 1e-12 ? n / d : null);
    return {
      ann_real_return: ann * 100,
      ann_volatility:
        sd(returns) === null ? null : sd(returns) * Math.sqrt(12) * 100,
      sharpe: safe(mean(excess) * Math.sqrt(12), sd(excess)),
      max_drawdown: dd * 100,
      calmar: safe(ann, Math.abs(dd)),
      current_drawdown: (path[end] / peak - 1) * 100,
    };
  }
  function rolling(data, asset, months, common = true) {
    const { start, end } = bounds(data, common, asset),
      path = data.growth.real[asset],
      values = [];
    let skipped = 0;
    for (let i = start; i + months <= end; i++) {
      if (finite(path[i]) && finite(path[i + months]))
        values.push((path[i + months] / path[i] - 1) * 100);
      else skipped++;
    }
    return {
      n: values.length,
      skipped,
      beat: values.length
        ? (100 * values.filter((x) => x > 0).length) / values.length
        : null,
      min: values.length ? Math.min(...values) : null,
      q10: quantile(values, 0.1),
      q25: quantile(values, 0.25),
      median: quantile(values, 0.5),
      q75: quantile(values, 0.75),
      q90: quantile(values, 0.9),
      max: values.length ? Math.max(...values) : null,
    };
  }
  function recovery(values) {
    if (!finite(values[0])) return { months: null, status: "No starting CPI" };
    let underwater = false;
    for (let i = 1; i < values.length; i++) {
      if (!finite(values[i])) continue;
      if (values[i] < values[0] * (1 - 1e-9)) underwater = true;
      else if (underwater)
        return { months: i, status: "First observed recovery after a loss" };
    }
    return {
      months: null,
      status: underwater
        ? "Not recovered within this hold"
        : "Never observed below buy purchasing power",
    };
  }
  function regimeStats(data, mode = "median", kind = "real") {
    const labels =
      mode === "quartile"
        ? ["Top 25%", "Bottom 25%"]
        : mode === "trend"
          ? ["Rising", "Falling / flat"]
          : ["High", "Low"];
    const field =
      mode === "quartile" ? "quartile" : mode === "trend" ? "trend" : "level";
    const observations = data.regime.observations || [];
    return labels.map((label) => ({
      label,
      assets: Object.fromEntries(
        data.meta.assets.map((asset) => {
          const a = observations
            .filter((o) => o[field] === label)
            .map((o) => o[kind][asset])
            .filter(finite);
          return [
            asset,
            {
              n: a.length,
              mean: mean(a),
              median: quantile(a, 0.5),
              q10: quantile(a, 0.1),
              q90: quantile(a, 0.9),
              min: a.length ? Math.min(...a) : null,
              max: a.length ? Math.max(...a) : null,
            },
          ];
        }),
      ),
    }));
  }
  const api = {
    mean,
    sd,
    quantile,
    bounds,
    score,
    rolling,
    recovery,
    regimeStats,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.RealWorthAnalytics = api;
})(globalThis);
