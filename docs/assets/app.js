(function (global) {
  "use strict";

  const TICKERS = {
    Bitcoin: "BTC-USD",
    Gold: "GLD",
    "S&P 500": "SPY",
    "T-Bills": "BIL",
    "LT Bonds": "TLT",
  };
  const colors = {
    ink: "#172c2c",
    green: "#256657",
    gold: "#c18954",
    red: "#9d3539",
    grid: "#e5e8df",
    muted: "#5e6d69",
  };
  const percent = (value) =>
    Number.isFinite(value) ? `${value.toFixed(2)}%` : "No data";
  const money = (value) =>
    Number.isFinite(value)
      ? new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        }).format(value)
      : "No data";
  function monthLabel(month) {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      timeZone: "UTC",
    }).format(new Date(`${month}-01T00:00:00Z`));
  }
  function validateData(data) {
    if (
      !data?.meta ||
      !Array.isArray(data.meta.assets) ||
      data.meta.assets.length !== 5 ||
      !data.meta.assets.every((asset) => Object.hasOwn(TICKERS, asset)) ||
      new Set(data.meta.assets).size !== 5
    )
      throw new Error("The asset list is invalid.");
    const dates = data.growth?.dates;
    if (
      !Array.isArray(dates) ||
      dates.length < 2 ||
      dates.at(-1) !== data.meta.data_through
    )
      throw new Error("The monthly date range is invalid.");
    dates.forEach((month, i) => {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
        throw new Error("Invalid month in the dataset.");
      if (i && monthOrdinal(month) !== monthOrdinal(dates[i - 1]) + 1)
        throw new Error("The date grid has missing or duplicate months.");
    });
    for (const asset of data.meta.assets) {
      for (const kind of ["nominal", "real"]) {
        const values = data.growth[kind]?.[asset];
        if (
          !Array.isArray(values) ||
          values.length !== dates.length ||
          values.some((v) => v !== null && (!Number.isFinite(v) || v <= 0))
        )
          throw new Error(`Invalid ${kind} growth for ${asset}.`);
      }
      for (const key of [
        "ann_real_return",
        "ann_volatility",
        "sharpe",
        "max_drawdown",
        "calmar",
        "current_drawdown",
      ]) {
        const value = data.scorecard?.[asset]?.[key];
        if (value !== null && !Number.isFinite(value))
          throw new Error(`Invalid scorecard for ${asset}.`);
      }
    }
    if (
      !Array.isArray(data.regime?.cpi_dates) ||
      data.regime.cpi_dates.length !== dates.length ||
      data.regime.cpi_dates.some((v, i) => v !== dates[i]) ||
      !Array.isArray(data.regime.cpi_yoy) ||
      data.regime.cpi_yoy.length !== dates.length ||
      data.regime.cpi_yoy.some((v) => v !== null && !Number.isFinite(v))
    )
      throw new Error("The inflation series is invalid.");
    if (
      !["High", "Low", null].includes(data.regime.current_regime) ||
      !["Top 25%", "Middle 50%", "Bottom 25%", null].includes(
        data.regime.current_quartile,
      ) ||
      (data.regime.current_yoy !== null &&
        !Number.isFinite(data.regime.current_yoy)) ||
      data.regime.current_yoy !== data.regime.cpi_yoy.at(-1) ||
      !["q25", "q75", "median_threshold"].every((key) =>
        Number.isFinite(data.regime[key]),
      ) ||
      !(
        data.regime.q25 <= data.regime.median_threshold &&
        data.regime.median_threshold <= data.regime.q75
      )
    )
      throw new Error("Invalid current inflation or thresholds.");
    if (
      !Object.hasOwn(data.regime.by_median ?? {}, "High") ||
      !Object.hasOwn(data.regime.by_median ?? {}, "Low") ||
      !Object.hasOwn(data.regime.by_quartile ?? {}, "Top 25%") ||
      !Object.hasOwn(data.regime.by_quartile ?? {}, "Bottom 25%")
    )
      throw new Error("Invalid inflation group names.");
    for (const groups of [data.regime.by_median, data.regime.by_quartile]) {
      if (
        !groups ||
        Object.keys(groups).length !== 2 ||
        Object.values(groups).some((group) =>
          data.meta.assets.some((asset) => !Number.isFinite(group[asset])),
        )
      )
        throw new Error("Invalid inflation group averages.");
    }
    return data;
  }
  function monthOrdinal(month) {
    const [year, m] = month.split("-").map(Number);
    return year * 12 + m - 1;
  }
  function calculateHolding(data, asset, buyMonth, holding, amount) {
    if (!data.meta.assets.includes(asset))
      throw new Error("Please choose an asset in this study.");
    if (!Number.isFinite(amount) || amount < 1 || amount > 1e9)
      throw new Error("Enter an investment amount between $1 and $1 billion.");
    const dates = data.growth.dates;
    const start = dates.indexOf(buyMonth);
    if (start < 0)
      throw new Error("Choose a buy month within the available data range.");
    const nominal = data.growth.nominal[asset];
    const real = data.growth.real[asset];
    if (!Number.isFinite(nominal[start])) {
      const first = nominal.findIndex((v) => Number.isFinite(v));
      throw new Error(
        `${asset} data begins in ${monthLabel(dates[first])}. Please choose that month or later.`,
      );
    }
    if (
      holding !== "latest" &&
      !["12", "36", "60", "120"].includes(String(holding))
    )
      throw new Error("Please choose a listed holding period.");
    const end =
      holding === "latest" ? dates.length - 1 : start + Number(holding);
    if (end >= dates.length)
      throw new Error(
        `That holding period ends after ${monthLabel(dates.at(-1))}, our last available month. Choose a shorter period or “Until latest data”.`,
      );
    if (end === start)
      throw new Error(
        "Choose an earlier buy month to observe a holding period.",
      );
    const nominalValue = (amount * nominal[end]) / nominal[start];
    const nominalReturn = nominal[end] / nominal[start] - 1;
    const available =
      Number.isFinite(real[start]) && Number.isFinite(real[end]);
    const values = real
      .slice(start, end + 1)
      .map((v) =>
        available && Number.isFinite(v) ? (amount * v) / real[start] : null,
      );
    const missingMonths = dates
      .slice(start, end + 1)
      .filter((_, i) => !Number.isFinite(real[start + i]));
    let peak = amount,
      drawdown = 0,
      minimum = amount;
    if (available)
      for (const v of values) {
        if (v === null) continue;
        peak = Math.max(peak, v);
        minimum = Math.min(minimum, v);
        drawdown = Math.min(drawdown, v / peak - 1);
      }
    if (
      !Number.isFinite(nominalValue) ||
      values.some((v) => v !== null && !Number.isFinite(v))
    )
      throw new Error(
        "This amount produces a value too large to calculate safely.",
      );
    return {
      asset,
      amount,
      start,
      end,
      dates: dates.slice(start, end + 1),
      values,
      missingMonths,
      nominalValue,
      nominalReturn,
      realValue: available ? values.at(-1) : null,
      realReturn: available ? real[end] / real[start] - 1 : null,
      drawdown: available ? drawdown : null,
      minimum: available ? minimum : null,
    };
  }
  function risk(value) {
    if (!Number.isFinite(value)) return { className: "", label: "Not defined" };
    return value > -15
      ? { className: "risk-low", label: "Mild" }
      : value >= -40
        ? { className: "risk-medium", label: "Significant" }
        : { className: "risk-high", label: "Severe" };
  }
  function verdict(metrics) {
    if (metrics.ann_real_return < 0) return "Loses to inflation";
    if (metrics.max_drawdown < -40) return "Positive return, deep drawdowns";
    if (metrics.max_drawdown <= -15) return "Grows, with drawdown risk";
    return "Preserved purchasing power";
  }
  const api = { validateData, calculateHolding, risk, verdict, monthLabel };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof document === "undefined") return;
  const A = global.RealWorthAnalytics;
  const charts = new Map();
  const text = (id, value) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  };
  function plot(id, config) {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    if (typeof global.Chart !== "function") {
      canvas.hidden = true;
      canvas.parentElement.querySelector(".chart-fallback").hidden = false;
      return;
    }
    charts.get(id)?.destroy();
    charts.set(id, new global.Chart(canvas, config));
  }
  function chartOptions(extra = {}) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: global.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? false
        : { duration: 250 },
      interaction: { mode: "index", intersect: false },
      plugins: { legend: { display: false } },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: colors.muted, maxTicksLimit: 7, maxRotation: 0 },
        },
        y: {
          grid: { color: colors.grid },
          border: { display: false },
          ticks: { color: colors.muted },
        },
      },
      ...extra,
    };
  }
  function renderCalculator(data) {
    const form = document.getElementById("calculator-form");
    const assetInput = document.getElementById("asset");
    const buyInput = document.getElementById("buy-month");
    const results = document.getElementById("calculator-results");
    const error = document.getElementById("calculator-error");
    const updateMin = () => {
      const first = data.growth.nominal[assetInput.value].findIndex(
        Number.isFinite,
      );
      buyInput.min = data.growth.dates[first];
    };
    buyInput.max = data.meta.data_through;
    buyInput.value = data.growth.dates.includes("2021-11")
      ? "2021-11"
      : data.growth.dates[8];
    updateMin();
    function update(event) {
      event?.preventDefault();
      const period = document.getElementById("holding-period");
      const start = data.growth.dates.indexOf(buyInput.value);
      for (const option of period.options) {
        option.disabled =
          option.value !== "latest" &&
          start + Number(option.value) >= data.growth.dates.length;
      }
      const changed = period.selectedOptions[0]?.disabled;
      if (changed) period.value = "latest";
      text(
        "period-help",
        `Unavailable terms are disabled: data ends ${monthLabel(data.meta.data_through)}.${changed ? " Selected term exceeded the data; showing until latest data." : ""}`,
      );
      error.hidden = true;
      try {
        const result = calculateHolding(
          data,
          assetInput.value,
          buyInput.value,
          document.getElementById("holding-period").value,
          Number(document.getElementById("amount").value),
        );
        results.hidden = false;
        text(
          "result-period",
          `${monthLabel(result.dates[0])} → ${monthLabel(result.dates.at(-1))} · ${result.end - result.start} months · month-end observations`,
        );
        text("nominal-value", money(result.nominalValue));
        text(
          "nominal-return",
          `${percent(result.nominalReturn * 100)} nominal return`,
        );
        text("real-value", money(result.realValue));
        text(
          "real-return",
          result.realReturn === null
            ? "CPI is missing at a selected endpoint"
            : `${percent(result.realReturn * 100)} real return`,
        );
        text(
          "real-units",
          `Purchasing power in ${monthLabel(result.dates[0])} dollars`,
        );
        text(
          "hold-drawdown",
          result.drawdown === null ? "No data" : percent(result.drawdown * 100),
        );
        document.getElementById("hold-drawdown").className =
          `result-value ${result.drawdown !== null && result.drawdown < -0.3 ? "risk-high" : ""}`;
        text(
          "hold-severity",
          result.drawdown === null
            ? "A known starting CPI is required"
            : result.drawdown < -0.3
              ? "Large decline"
              : risk(result.drawdown * 100).label + " decline",
        );
        text(
          "calculator-summary",
          result.realValue === null
            ? `Your ${money(result.amount)} in ${result.asset} ended at ${money(result.nominalValue)} before inflation. Real return is unavailable because CPI is missing at the buy or end month. Choose endpoints with known CPI.`
            : `Your ${money(result.amount)} in ${result.asset} ended at ${money(result.realValue)} after inflation, in buy-month dollars. The largest observed fall from a prior peak was ${percent(result.drawdown * 100)}; the lowest observed value was ${money(result.minimum)}.`,
        );
        const gap = document.getElementById("gap-warning");
        gap.hidden = result.missingMonths.length === 0;
        gap.textContent = `No CPI data for ${result.missingMonths.map(monthLabel).join(", ")}. Charts leave gaps. Drawdowns use known observations and may understate the worst fall during missing months.`;
        document
          .getElementById("investment-chart")
          .setAttribute(
            "aria-label",
            `Real ${result.asset} investment value in buy-month dollars, ${monthLabel(result.dates[0])} to ${monthLabel(result.dates.at(-1))}. ${result.missingMonths.length} missing month(s).`,
          );
        plot("investment-chart", {
          type: "line",
          data: {
            labels: result.dates.map(monthLabel),
            datasets: [
              {
                label: "Real value (buy-month USD)",
                data: result.values,
                borderColor: colors.green,
                backgroundColor: "#25665712",
                fill: true,
                borderWidth: 2,
                pointRadius: 0,
                pointHitRadius: 10,
                tension: 0.15,
                spanGaps: false,
              },
            ],
          },
          options: chartOptions({
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: { label: (context) => money(context.parsed.y) },
              },
            },
            scales: {
              x: {
                grid: { display: false },
                ticks: {
                  maxTicksLimit: 7,
                  maxRotation: 0,
                  color: colors.muted,
                },
              },
              y: {
                grid: { color: colors.grid },
                ticks: {
                  color: colors.muted,
                  callback: (value) => money(value),
                },
              },
            },
          }),
        });
        renderComparison(data, result);
      } catch (exc) {
        results.hidden = true;
        error.hidden = false;
        error.textContent = exc.message;
      }
    }
    document.getElementById("calculator-inputs").disabled = false;
    form.addEventListener("submit", update);
    form.addEventListener("input", update);
    assetInput.addEventListener("change", () => {
      updateMin();
      update();
    });
    update();
  }
  function renderComparison(data, selected) {
    const body = document.getElementById("comparison-body");
    if (!body) return;
    const sets = [];
    body.replaceChildren();
    const palette = [
      colors.green,
      colors.gold,
      "#637eaa",
      "#986c89",
      "#668171",
    ];
    for (const [i, asset] of data.meta.assets.entries()) {
      const row = document.createElement("tr"),
        name = document.createElement("th");
      name.scope = "row";
      name.textContent = asset;
      row.append(name);
      let vals;
      try {
        const result = calculateHolding(
          data,
          asset,
          data.growth.dates[selected.start],
          document.getElementById("holding-period").value,
          selected.amount,
        );
        const rec = A.recovery(result.values);
        vals = [
          money(result.realValue),
          result.drawdown === null ? "No data" : percent(result.drawdown * 100),
          rec.months === null
            ? rec.status
            : `${rec.months} months · ${rec.status}`,
        ];
        sets.push({
          label: asset,
          data: result.values,
          borderColor: palette[i],
          borderWidth: 2,
          pointRadius: 0,
          spanGaps: false,
        });
      } catch (e) {
        vals = ["No data", "No data", e.message];
      }
      for (const v of vals) {
        const td = document.createElement("td");
        td.textContent = v;
        row.append(td);
      }
      body.append(row);
    }
    plot("comparison-chart", {
      type: "line",
      data: { labels: selected.dates.map(monthLabel), datasets: sets },
      options: chartOptions({
        plugins: { legend: { display: true, position: "bottom" } },
        scales: {
          y: { ticks: { callback: (v) => money(v) } },
          x: { ticks: { maxTicksLimit: 6, maxRotation: 0 } },
        },
      }),
    });
  }
  function renderScorecard(data) {
    const body = document.getElementById("scorecard-body");
    if (!body) return;
    body.replaceChildren();
    const common = document.getElementById("history-scope")?.value !== "full";
    const b = A.bounds(data);
    const scores = common
      ? Object.fromEntries(
          data.meta.assets.map((a) => [a, A.score(data, a, b.start, b.end)]),
        )
      : data.scorecard;
    text(
      "scorecard-period",
      common
        ? `Common period: ${monthLabel(data.growth.dates[b.start])}–${monthLabel(data.growth.dates[b.end])}. All five assets start and end together.`
        : "Full histories: each asset uses its own first available month. These are unequal samples.",
    );
    for (const asset of data.meta.assets) {
      const metrics = scores[asset];
      const row = document.createElement("tr");
      row.dataset.asset = asset;
      const name = document.createElement("th");
      name.scope = "row";
      name.textContent = asset;
      const ticker = document.createElement("span");
      ticker.className = "ticker";
      ticker.textContent = TICKERS[asset];
      name.append(ticker);
      row.append(name);
      for (const key of [
        "ann_real_return",
        "ann_volatility",
        "sharpe",
        "max_drawdown",
        "calmar",
        "current_drawdown",
      ]) {
        const cell = document.createElement("td");
        cell.dataset.metric = key;
        const value = metrics[key];
        cell.textContent =
          value === null
            ? "Not defined"
            : ["sharpe", "calmar"].includes(key)
              ? value.toFixed(3)
              : percent(value);
        if (key.includes("drawdown")) {
          const severity = risk(value);
          cell.className = severity.className;
          const label = document.createElement("span");
          label.className = "risk-label";
          label.textContent = severity.label;
          cell.append(label);
        }
        row.append(cell);
      }
      const label = document.createElement("td");
      label.className = "verdict";
      label.textContent = verdict(metrics);
      row.append(label);
      body.append(row);
    }
    plot("drawdown-chart", {
      type: "bar",
      data: {
        labels: data.meta.assets,
        datasets: [
          {
            label: "Max real drawdown (%)",
            data: data.meta.assets.map((asset) => scores[asset].max_drawdown),
            backgroundColor: data.meta.assets.map((asset) =>
              scores[asset].max_drawdown < -40
                ? colors.red
                : scores[asset].max_drawdown <= -15
                  ? colors.gold
                  : colors.green,
            ),
            borderRadius: 4,
            barPercentage: 0.65,
          },
        ],
      },
      options: chartOptions({
        indexAxis: "y",
        scales: {
          x: {
            min: -100,
            max: 0,
            grid: { color: colors.grid },
            ticks: { callback: (v) => `${v}%`, color: colors.muted },
          },
          y: {
            grid: { display: false },
            border: { display: false },
            ticks: { color: colors.ink },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: { label: (context) => percent(context.parsed.x) },
          },
        },
      }),
    });
  }
  function renderRegime(data) {
    if (!document.getElementById("cpi-chart")) return;
    const regime = data.regime;
    text("current-inflation", percent(regime.current_yoy));
    text(
      "inflation-month",
      `${monthLabel(data.meta.data_through)} · year-over-year change`,
    );
    text(
      "regime-badge",
      regime.current_regime === null
        ? "Current regime: no data"
        : `${regime.current_regime}-inflation regime`,
    );
    document.getElementById("regime-badge").className =
      `badge ${regime.current_regime === "Low" ? "low" : regime.current_regime === null ? "neutral" : ""}`;
    text("quartile-badge", regime.current_quartile ?? "Quartile: no data");
    text(
      "regime-thresholds",
      `Sample median ${percent(regime.median_threshold)} · Q25 ${percent(regime.q25)} · Q75 ${percent(regime.q75)}. Thresholds use shared, observed return months.`,
    );
    const threshold = (label, value, color) => ({
      label: `${label} (${percent(value)})`,
      data: regime.cpi_dates.map(() => value),
      borderColor: color,
      borderDash: [5, 5],
      borderWidth: 1,
      pointRadius: 0,
    });
    plot("cpi-chart", {
      type: "line",
      data: {
        labels: regime.cpi_dates.map(monthLabel),
        datasets: [
          {
            label: "CPI YoY",
            data: regime.cpi_yoy,
            borderColor: colors.green,
            borderWidth: 2,
            pointRadius: 0,
            pointHitRadius: 8,
            tension: 0.2,
            spanGaps: false,
          },
          threshold("Median", regime.median_threshold, colors.gold),
          threshold("Q25", regime.q25, "#728db0"),
          threshold("Q75", regime.q75, "#ae7380"),
        ],
      },
      options: chartOptions({
        plugins: {
          legend: {
            display: true,
            position: "bottom",
            labels: { boxWidth: 16, boxHeight: 2, font: { size: 9 } },
          },
          tooltip: {
            callbacks: {
              label: (context) =>
                `${context.dataset.label}: ${percent(context.parsed.y)}`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { maxTicksLimit: 5, maxRotation: 0, color: colors.muted },
          },
          y: {
            grid: { color: colors.grid },
            ticks: { color: colors.muted, callback: (value) => `${value}%` },
          },
        },
      }),
    });
    let currentMode = "median";
    function update(mode) {
      currentMode = mode;
      const kind = document.getElementById("regime-return-kind").value;
      const groups = A.regimeStats(data, mode, kind);
      for (const [id, m] of [
        ["median-toggle", "median"],
        ["quartile-toggle", "quartile"],
        ["trend-toggle", "trend"],
      ])
        document
          .getElementById(id)
          .setAttribute("aria-pressed", String(mode === m));
      const body = document.getElementById("regime-table-body"),
        head = document.getElementById("regime-table-head");
      head.innerHTML =
        '<tr><th scope="col">Asset / group</th><th scope="col">Months</th><th scope="col">Mean (%)</th><th scope="col">Median (%)</th><th scope="col">P10–P90 (%)</th><th scope="col">Min–max (%)</th></tr>';
      body.replaceChildren();
      for (const asset of data.meta.assets)
        for (const group of groups) {
          const r = group.assets[asset],
            row = document.createElement("tr");
          for (const [i, v] of [
            `${asset} · ${group.label}`,
            r.n,
            percent(r.mean),
            percent(r.median),
            `${percent(r.q10)} to ${percent(r.q90)}`,
            `${percent(r.min)} to ${percent(r.max)}`,
          ].entries()) {
            const cell = document.createElement(i === 0 ? "th" : "td");
            if (!i) cell.scope = "row";
            cell.textContent = v;
            row.append(cell);
          }
          body.append(row);
        }
      plot("regime-chart", {
        type: "bar",
        data: {
          labels: data.meta.assets,
          datasets: groups.flatMap((group, i) =>
            ["mean", "median"].map((stat, j) => ({
              label: `${group.label} · ${stat}`,
              data: data.meta.assets.map((a) => group.assets[a][stat]),
              backgroundColor:
                i === 0
                  ? j
                    ? "#75a18f"
                    : colors.green
                  : j
                    ? "#ddc19d"
                    : colors.gold,
            })),
          ),
        },
        options: chartOptions({
          plugins: { legend: { display: true, position: "bottom" } },
          scales: {
            y: { ticks: { callback: (v) => `${v}%` } },
            x: { ticks: { maxRotation: 0 } },
          },
        }),
      });
      text(
        "regime-summary",
        regime.current_regime === null
          ? "Current CPI YoY is unavailable. We do not assign a current regime. Historical groups only use observed months."
          : `Current level regime: ${regime.current_regime}. The chart compares ${kind} monthly mean and median returns; the table reports sample sizes and distribution ranges. ${mode === "trend" ? "Rising versus falling/flat inflation is a separate test from high versus low inflation." : "Level groups use the historical CPI YoY median/quartiles."}`,
      );
      document
        .getElementById("regime-chart")
        .setAttribute(
          "aria-label",
          `${kind} monthly mean and median returns by ${mode}; sample sizes and ranges in the visible table.`,
        );
    }
    for (const [id, mode] of [
      ["median-toggle", "median"],
      ["quartile-toggle", "quartile"],
      ["trend-toggle", "trend"],
    ])
      document.getElementById(id).addEventListener("click", () => update(mode));
    document
      .getElementById("regime-return-kind")
      .addEventListener("change", () => update(currentMode));
    update("median");
  }
  function renderRolling(data) {
    const target = document.getElementById("rolling-body");
    if (!target) return;
    const common = document.getElementById("history-scope").value !== "full";
    const months = Number(document.getElementById("rolling-period").value);
    target.replaceChildren();
    for (const asset of data.meta.assets) {
      const r = A.rolling(data, asset, months, common),
        row = document.createElement("tr");
      for (const [i, v] of [
        asset,
        `${r.n} (${r.skipped} omitted)`,
        percent(r.beat),
        percent(r.min),
        percent(r.median),
        `${percent(r.q10)} to ${percent(r.q90)}`,
      ].entries()) {
        const cell = document.createElement(i === 0 ? "th" : "td");
        if (!i) cell.scope = "row";
        cell.textContent = v;
        row.append(cell);
      }
      target.append(row);
    }
  }
  async function initDashboard() {
    if (
      !document.getElementById("calculator-form") &&
      !document.getElementById("scorecard-body")
    )
      return;
    const status = document.getElementById("load-status");
    try {
      const response = await fetch(
        new URL("data/data.json", document.baseURI),
        { cache: "no-cache" },
      );
      if (!response.ok)
        throw new Error(`Data request failed (HTTP ${response.status}).`);
      const data = validateData(await response.json());
      text(
        "data-stamp",
        `Data through ${monthLabel(data.meta.data_through)} · Refreshed ${data.meta.last_updated} · Monthly observations`,
      );
      text("hero-drawdown", percent(data.scorecard.Bitcoin.max_drawdown));
      status.hidden = true;
      document.getElementById("chart-warning").hidden =
        typeof global.Chart === "function";
      if (document.getElementById("calculator-form")) renderCalculator(data);
      renderScorecard(data);
      renderRegime(data);
      renderRolling(data);
      document
        .getElementById("history-scope")
        ?.addEventListener("change", () => {
          renderScorecard(data);
          renderRolling(data);
        });
      document
        .getElementById("rolling-period")
        ?.addEventListener("change", () => renderRolling(data));
      document.getElementById("dashboard").setAttribute("aria-busy", "false");
      const age =
        (Date.now() - Date.parse(`${data.meta.last_updated}T00:00:00Z`)) /
        86400000;
      if (age > 45) {
        status.hidden = false;
        status.textContent =
          "This dataset was refreshed more than 45 days ago. Check the latest update status in the GitHub repository before relying on these historical numbers.";
      }
    } catch (exc) {
      status.hidden = false;
      status.classList.add("error");
      status.setAttribute("role", "alert");
      status.textContent = `${exc.message} Please reload. For local use, serve the docs folder with Python’s HTTP server rather than opening the HTML file directly.`;
      document.getElementById("dashboard").setAttribute("aria-busy", "false");
    }
  }
  function initQuiz() {
    if (!document.getElementById("quiz-question")) return;
    const questions = [
      [
        "An investment returns 12% while inflation is 3%. How do you calculate its exact real return?",
        "Divide 1.12 by 1.03 and subtract 1: about 8.74%. Subtracting 3% from 12% gives a 9% approximation, not the exact answer.",
      ],
      [
        "An asset falls from a real-value peak of $200 to $100. What is its drawdown, and does the original buy price change that?",
        "The drawdown is $100 / $200 − 1 = −50%. Drawdown is measured from a prior peak, not from your purchase price.",
      ],
      [
        "How are High/Low inflation regimes defined, and what happens to a missing CPI month?",
        "High is strictly above the historical median CPI YoY; Low includes ties at the median. A missing CPI YoY observation belongs to neither group. The quartiles use Q25 and Q75 thresholds.",
      ],
      [
        "What runs each month, what file may it commit, and what happens if a download fails?",
        "GitHub Actions runs on the 18th at 06:00 UTC. The Python script builds derived JSON, and the workflow commits only docs/data/data.json if changed. It requests a Pages rebuild. A failed download stops the job and retains the old file.",
      ],
      [
        "Name one reason these historical results do not prove that Bitcoin will protect you from future inflation.",
        "Possible answers: the sample includes major Bitcoin bull markets; it covers only US inflation; monthly observations miss intra-month crashes; missing CPI can hide a peak or trough; or regime associations do not establish causation or predict future returns.",
      ],
    ];
    let index = 0;
    const answer = document.getElementById("quiz-answer");
    const show = document.getElementById("quiz-show");
    const next = document.getElementById("quiz-next");
    function display() {
      text("quiz-progress", `Question ${index + 1} of ${questions.length}`);
      text("quiz-question", questions[index][0]);
      answer.hidden = true;
      answer.textContent = questions[index][1];
      document.getElementById("quiz-response").value = "";
      show.hidden = false;
      next.hidden = true;
      next.textContent = index === 4 ? "Start again" : "Next question";
    }
    show.addEventListener("click", () => {
      answer.hidden = false;
      show.hidden = true;
      next.hidden = false;
    });
    next.addEventListener("click", () => {
      index = (index + 1) % questions.length;
      display();
    });
    display();
  }
  function init() {
    initDashboard();
    initQuiz();
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init);
  else init();
})(globalThis);
