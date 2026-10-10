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
  function renderScorecard(data) {
    const body = document.getElementById("scorecard-body");
    if (!body) return;
    body.replaceChildren();
    for (const asset of data.meta.assets) {
      const metrics = data.scorecard[asset];
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
            data: data.meta.assets.map(
              (asset) => data.scorecard[asset].max_drawdown,
            ),
            backgroundColor: data.meta.assets.map((asset) =>
              data.scorecard[asset].max_drawdown < -40
                ? colors.red
                : data.scorecard[asset].max_drawdown <= -15
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
  async function initDashboard() {
    if (!document.getElementById("calculator-form")) return;
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
      renderCalculator(data);
      renderScorecard(data);
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
  function init() {
    initDashboard();
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init);
  else init();
})(globalThis);
