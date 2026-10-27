/* Transparent suitability rules. Answers stay in this page's memory. */
(function (root) {
  "use strict";
  const A =
    typeof module !== "undefined" && module.exports
      ? require("./analytics.js")
      : root.RealWorthAnalytics;
  const tickers = {
    Bitcoin: "BTC-USD",
    Gold: "GLD",
    "S&P 500": "SPY",
    "T-Bills": "BIL",
    "LT Bonds": "TLT",
  };
  const policies = {
    Bitcoin: { months: 36, stress: 100 },
    Gold: { months: 36, stress: 35 },
    "S&P 500": { months: 60, stress: 40 },
    "T-Bills": { months: 0, stress: 5 },
    "LT Bonds": { months: 60, stress: 40 },
  };
  const validTime = (x) =>
    typeof x === "string" && Number.isFinite(Date.parse(x));
  const dict = {
    en: {
      title: "What is this money for?",
      intro:
        "Tell us what this money must do. We will explain what fits, what does not, and which data supports that view.",
      privacy:
        "Your answers stay on this page. No account, saved profile or AI upload. This is a limited suitability screen, not a complete financial plan.",
      purpose: "1. What kind of money is this?",
      purposeOptions: [
        ["essential", "Rent, tuition, emergency money — I need it back"],
        ["reserve", "Important savings — a loss would delay my plans"],
        ["surplus", "Truly spare money — losing it would not affect my life"],
        ["borrowed", "Borrowed money / money I owe someone"],
      ],
      horizon: "2. When might you need it?",
      horizonOptions: [
        ["0", "Days or weeks"],
        ["3", "Within a few months"],
        ["12", "About a year"],
        ["36", "At least 3 years"],
        ["60", "At least 5 years"],
        ["120", "At least 10 years"],
      ],
      loss: "3. How much could disappear without breaking your plan?",
      lossOptions: [
        ["0", "None — I need the full amount"],
        ["5", "5% — $50 of every $1,000"],
        ["15", "15% — $150 of every $1,000"],
        ["30", "30% — $300 of every $1,000"],
        ["50", "50% — half the money"],
        ["100", "All of it — this is a disposable experiment"],
      ],
      readiness: "4. Are your financial basics covered?",
      readinessOptions: [
        ["ready", "I have an emergency reserve and no expensive debt"],
        ["no-reserve", "I do not have an emergency reserve"],
        ["debt", "I have expensive debt to deal with"],
        ["unknown", "I am not sure"],
      ],
      goal: "5. What do you want this money to do?",
      goalOptions: [
        ["protect", "Stay available and protect the amount"],
        ["income", "Provide steady income"],
        ["growth", "Grow purchasing power over several years"],
        ["quick", "Make quick money from a short-term price move"],
      ],
      currency: "6. What currency will you spend it in?",
      currencyOptions: [
        ["USD", "US dollars (USD)"],
        ["CAD", "Canadian dollars (CAD)"],
        ["other", "Another currency"],
      ],
      amount: "Amount you are considering",
      choose: "Choose an answer",
      submit: "Show my recommendation and evidence",
      changed:
        "Answers changed. Generate a new result before using the previous guidance.",
      result: "What we recommend for this money",
      why: "Why this conclusion?",
      next: "A practical next step",
      evidence: "Check each asset against your needs",
      history: "What actually happened in the shared history",
      data: "Open the underlying data",
      rules: "How the screening rules work",
      protected: "Keep this money out of these market investments.",
      debt: "Do not use this money to speculate. Put essential cash needs and expensive debt first.",
      reserve:
        "Build or clarify your emergency reserve before taking market risk.",
      quick: "Do not use this dashboard as a quick-profit trading system.",
      short:
        "For money needed soon, compare cash-like options before market investments.",
      currencyTitle:
        "Resolve the spending-currency risk before choosing a US-dollar investment.",
      growth:
        "Start by comparing a diversified long-term approach, rather than treating Bitcoin as savings.",
      income:
        "Compare liquidity and variable income; none of these ETFs promises a fixed payout or principal.",
      cautious:
        "Your needs and the available evidence do not support taking more market risk. Keeping the money available is a valid choice.",
      need: "You said this money is essential, borrowed, or cannot lose value. Wanting higher returns does not change that constraint.",
      basics:
        "A missing emergency reserve, expensive debt or an unknown cash position reduces what you can afford to risk.",
      quickWhy:
        "A short-term gain is possible, but reliable quick profit is not established. Price-estimate errors and interval coverage do not prove that a trading strategy earns money after fees, spreads or taxes.",
      shortWhy:
        "A monthly history cannot establish the chance of preserving money over days or weeks. Even low-volatility ETFs can fall; a cash-like ETF is not an insured bank deposit.",
      currencyWhy:
        "The return research uses USD and US CPI. It does not measure your CAD/other-currency purchasing power, exchange costs or local taxes.",
      longWhy:
        "Time and truly spare money make research possible, but do not make an investment safe. Historical losses can be exceeded, and overlapping holding windows are not independent trials.",
      cashNext:
        "Compare locally protected savings/deposits or short government securities matched to your currency, deadline and withdrawal needs. Check eligibility, protection limits and early-exit terms with the provider; this site does not compare those products or their current rates.",
      debtNext:
        "Clarify essential cash needs and the cost of your debt before considering a risky purchase. Do not borrow to chase a price move.",
      reserveNext:
        "Work out what money must stay accessible. If you are unsure, keep this amount outside speculative investments until that is clear.",
      quickNext:
        "Pause a quick-profit order. You can observe the frozen forecasts and compare them with later results without risking essential money. The site has no validated, fee-adjusted timing signal for buying today.",
      longNext:
        "Review the eligible comparisons below, then check fees, taxes, currency and your wider portfolio. No entry price, allocation percentage or guaranteed return is being prescribed.",
      avoid: "Not suitable for the stated need",
      research: "Worth comparing — not a buy-today signal",
      experiment: "Disposable experiment only — not savings",
      unknown: "Cannot assess from the available data",
      reasons: {
        protected:
          "Your essential-money / principal constraint overrides return-seeking.",
        basics: "Financial basics are not yet confirmed.",
        quick:
          "This price tool has not established a profitable short-term trading rule.",
        currency: "Local-currency risk is not assessed here.",
        deadline:
          "Your deadline is shorter than our conservative minimum for this asset.",
        loss: "Your stated loss limit is below the screening stress level.",
        income:
          "This asset is not a reliable source of the steady income you requested.",
        history:
          "Too few matching historical windows to support this comparison.",
        capital:
          "This does not fit keeping your amount available and prioritising capital preservation.",
        eligible:
          "Your answers pass this limited screen; loss and future underperformance remain possible.",
      },
      insufficient:
        "The research dataset is unavailable, incomplete or too old to assess this choice. No asset is being cleared as suitable. Keep essential money protected and retry when dated evidence is available.",
      limited:
        "This screen uses only five assets and self-reported answers. It does not know your full finances, tax position or available local products. It is not a professional suitability assessment.",
      whyCards: "What do these price cards mean for my money?",
      summary:
        "These cards show how far prices have moved over similar past periods. They do not tell you that buying today will make money. Start with your money’s purpose, not the biggest number.",
      cardNames: {
        "BTC-USD":
          "Bitcoin is a highly volatile digital asset. A big quoted price does not mean your whole investment must cost that amount.",
        GLD: "This is one share of a gold fund, not an ounce of gold. Its price can fall too.",
        SPY: "This fund holds large US companies. Diversification reduces single-company exposure, not the possibility of a stock-market loss.",
        BIL: "This fund holds short US Treasury bills. It is steadier than many assets, but it is not a guaranteed bank balance.",
        TLT: "This fund holds long US government bonds. Its share price can fall sharply when interest rates change.",
      },
      plain: "What this means",
      details: "See the numbers and how we checked",
      noSignal:
        "This is a rough planning range, not a reliable reason to buy or sell today.",
      noTest: "There is no usable historical error comparison for this card.",
      equal:
        "The price estimate was about as accurate as simply assuming the price would not change.",
      worse:
        "The price estimate missed by more than simply assuming the price would not change.",
      lower:
        "The estimate was closer in this sample. That is not proof of a profitable trading advantage.",
      coverage:
        "Being inside the displayed outer range is not the same as getting the direction right. Prices can also finish outside it.",
      stale:
        "The snapshot or target is out of date / incomplete. Do not treat it as a fresh entry signal.",
      fit: "For your money",
      beforeFit:
        "Want to know whether this risk fits your money? Answer the money-purpose questions above.",
      oldResearch:
        "Research data is dated; historical comparisons are shown, but do not establish current entry conditions.",
    },
  };
  Object.assign(dict.en, {
    amount: "Total money for this plan (not the purchase amount for one asset)",
    partial: "Compare reduced exposure, not an all-in position",
    conditional: "USD comparison possible; currency assessment still needed",
    observe: "Observe and learn; no validated quick-profit strategy",
    budgetTitle:
      "Some options may fit at a smaller scale. Compare the loss budget first.",
    currencyTitle:
      "There are USD comparisons to research; separately assess the currency you will spend.",
    research: "Purpose and horizon support further research",
    experiment: "Possible disposable-money experiment",
    next: "A practical next step",
    role: "Possible role",
    roles: {
      Bitcoin: "High-risk experiment",
      Gold: "Diversification / gold exposure",
      "S&P 500": "Long-term diversified equity growth",
      "T-Bills": "Short-duration liquidity buffer",
      "LT Bonds": "Long-duration rate exposure",
    },
    budgetNext:
      "Compare the smaller-exposure illustrations below. They assume the remainder is unchanged cash and the stated stress occurs; they are not recommended allocations or loss caps. Then review fees, currency, existing holdings and whether that assumed loss still fits your plans.",
    currencyNext:
      "Use the USD evidence to make a research shortlist, then compare unhedged versus hedged exposure, exchange costs and local purchasing power. Amount-based risk budgets are withheld until the currency effect is assessed.",
    fitTiming: "Long-term fit and short-term timing are different questions",
    timingText:
      "The next-period model has not established a profitable entry rule. That does not make a compatible long-term investment unsuitable. You can research diversification, costs and an investment schedule without claiming to know tomorrow’s best price.",
    noSignal:
      "This next-period range is not an entry-timing rule. Long-term suitability is assessed separately above.",
  });

  Object.assign(dict.en.reasons, {
    budget:
      "The all-in exposure exceeds your loss limit; a reduced-exposure scenario can be researched.",
    quick:
      "The quick-profit strategy is unsupported; that is different from saying the asset can never serve a longer-term role.",
  });

  function exposureScenario(amount, lossPercent, stressPercent) {
    if (
      ![amount, lossPercent, stressPercent].every(Number.isFinite) ||
      amount <= 0 ||
      lossPercent <= 0 ||
      lossPercent > 100 ||
      stressPercent <= 0 ||
      stressPercent > 100
    )
      return null;
    const fraction = Math.min(1, lossPercent / stressPercent),
      riskAmount = amount * fraction;
    return {
      fraction,
      riskAmount,
      cashAmount: amount - riskAmount,
      stressLoss: (riskAmount * stressPercent) / 100,
      stressPercent,
      lossPercent,
    };
  }
  function validateProfile(p) {
    for (const key of [
      "purpose",
      "horizon",
      "loss",
      "readiness",
      "goal",
      "currency",
    ]) {
      const allowed = dict.en[key + "Options"].map((x) => x[0]);
      if (!allowed.includes(String(p[key])))
        throw Error("Complete each money-purpose question.");
    }
    if (
      !Number.isFinite(Number(p.amount)) ||
      Number(p.amount) < 1 ||
      Number(p.amount) > 1e9
    )
      throw Error("Enter an amount from 1 to 1,000,000,000.");
    return {
      ...p,
      horizon: Number(p.horizon),
      loss: Number(p.loss),
      amount: Number(p.amount),
    };
  }
  function validateHistory(d, now) {
    if (
      !A ||
      !Array.isArray(d?.meta?.assets) ||
      d.meta.assets.length !== 5 ||
      !d.meta.assets.every((a) => Object.hasOwn(tickers, a)) ||
      new Set(d.meta.assets).size !== 5 ||
      !validTime(d.meta.last_updated) ||
      !Array.isArray(d.growth?.dates) ||
      d.growth.dates.length < 13
    )
      throw Error("Invalid research evidence");
    const dates = d.growth.dates;
    dates.forEach((v, i) => {
      if (
        !/^\d{4}-(0[1-9]|1[0-2])$/.test(v) ||
        (i &&
          Date.parse(v + "-01") !==
            Date.UTC(
              Number(dates[i - 1].slice(0, 4)),
              Number(dates[i - 1].slice(5, 7)),
              1,
            ))
      )
        throw Error("Invalid monthly evidence dates");
    });
    for (const kind of ["real", "nominal"])
      for (const a of d.meta.assets) {
        const v = d.growth[kind]?.[a];
        if (
          !Array.isArray(v) ||
          v.length !== dates.length ||
          v.some((x) => x !== null && (!Number.isFinite(x) || x <= 0))
        )
          throw Error("Invalid growth evidence");
      }
    if (
      d.meta.data_through !== dates.at(-1) ||
      now - Date.parse(d.meta.last_updated) > 75 * 864e5 ||
      now - Date.parse(dates.at(-1) + "-01") > 110 * 864e5 ||
      Date.parse(d.meta.last_updated) > now + 864e5
    )
      throw Error("Research evidence is too old or future-dated");
    const b = A.bounds(d);
    if (b.start < 0 || b.end - b.start < 12)
      throw Error("Too little common evidence");
    return b;
  }
  function nominalDrawdown(path, start, end) {
    let peak = path[start],
      dd = 0;
    for (let i = start; i <= end; i++)
      if (Number.isFinite(path[i])) {
        peak = Math.max(peak, path[i]);
        dd = Math.min(dd, 100 * (path[i] / peak - 1));
      }
    return dd;
  }
  function assessForecast(row, now = Date.now()) {
    const b = row?.forecast?.backtest;
    const valid =
      b &&
      Number.isFinite(b.mean_abs_price_error_percent) &&
      b.mean_abs_price_error_percent >= 0 &&
      Number.isFinite(b.random_walk_error_percent) &&
      b.random_walk_error_percent >= 0 &&
      Number.isInteger(b.observations) &&
      b.observations > 0;
    let comparison = "unknown";
    if (valid) {
      const model = Number(b.mean_abs_price_error_percent.toFixed(2)),
        base = Number(b.random_walk_error_percent.toFixed(2));
      comparison = model > base ? "worse" : model < base ? "lower" : "equal";
    }
    const stale =
      !row ||
      row.quote_stale ||
      !Number.isFinite(row.quote) ||
      row.quote <= 0 ||
      !validTime(row.quote_at) ||
      now - Date.parse(row.quote_at) > 4 * 864e5 ||
      !validTime(row.forecast?.target_at) ||
      Date.parse(row.forecast.target_at) <= now;
    return {
      comparison,
      valid,
      stale,
      model: valid ? b.mean_abs_price_error_percent : null,
      baseline: valid ? b.random_walk_error_percent : null,
      n: valid ? b.observations : null,
      coverage: Number.isFinite(b?.coverage_percent)
        ? b.coverage_percent
        : null,
      entrySignal: false,
    };
  }
  function investmentIllustration(row, amount = 1000) {
    const f = row?.forecast;
    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !Number.isFinite(f?.anchor_price) ||
      f.anchor_price <= 0 ||
      ![f.levels?.q10, f.levels?.q90].every(
        (n) => Number.isFinite(n) && n > 0,
      ) ||
      f.levels.q10 > f.levels.q90
    )
      return null;
    return {
      lower: (amount * f.levels.q10) / f.anchor_price,
      upper: (amount * f.levels.q90) / f.anchor_price,
      amount,
    };
  }
  function evaluate(
    profile,
    data,
    forecasts,
    now = Date.now(),
    research = null,
  ) {
    const p = validateProfile(profile);
    let bounds;
    try {
      bounds = validateHistory(data, now);
    } catch (e) {
      return { profile: p, action: "unavailable", rows: [], unavailable: true };
    }
    const protectedMoney =
      ["essential", "borrowed"].includes(p.purpose) || p.loss === 0;
    const basics = p.readiness !== "ready";
    let action = protectedMoney
      ? p.purpose === "borrowed"
        ? "debt"
        : "protected"
      : basics
        ? p.readiness === "debt"
          ? "debt"
          : "reserve"
        : p.goal === "quick"
          ? "quick"
          : p.horizon <= 12
            ? "short"
            : p.goal === "protect"
              ? "cautious"
              : p.goal === "income"
                ? "income"
                : "growth";
    const matching = p.horizon >= 12 ? p.horizon : 12;
    const rows = data.meta.assets.map((asset) => {
      const policy = policies[asset],
        nominalDD = nominalDrawdown(
          data.growth.nominal[asset],
          bounds.start,
          bounds.end,
        ),
        real = A.score(data, asset, bounds.start, bounds.end),
        rolling = A.rolling(data, asset, matching, true);
      const stress = Math.max(policy.stress, Math.abs(nominalDD));
      let reason = protectedMoney
        ? "protected"
        : basics
          ? "basics"
          : p.goal === "quick"
            ? "quick"
            : p.horizon < policy.months
              ? "deadline"
              : p.goal === "protect" && asset !== "T-Bills"
                ? "capital"
                : p.goal === "income" && asset !== "T-Bills"
                  ? "income"
                  : rolling.n < 12
                    ? "history"
                    : asset === "Bitcoin" && p.purpose !== "surplus"
                      ? "protected"
                      : p.loss < stress
                        ? "budget"
                        : "eligible";
      let baseStatus =
        reason === "eligible"
          ? asset === "Bitcoin"
            ? "experiment"
            : "research"
          : reason === "budget"
            ? "partial"
            : reason === "quick"
              ? "observe"
              : reason === "history"
                ? "unknown"
                : "avoid";
      const currencyUnassessed = p.currency !== "USD";
      const status =
        currencyUnassessed &&
        ["research", "partial", "experiment"].includes(baseStatus)
          ? "conditional"
          : baseStatus;
      const scenario =
        baseStatus === "partial" && !currencyUnassessed
          ? exposureScenario(p.amount, p.loss, stress)
          : null;
      const f = forecasts?.assets?.find((r) => r.ticker === tickers[asset]);
      return {
        asset,
        ticker: tickers[asset],
        status,
        reason,
        baseStatus,
        currencyUnassessed,
        scenario,
        nominalDD,
        realDD: real.max_drawdown,
        annReal: real.ann_real_return,
        rolling,
        matching,
        matchedToDeadline: p.horizon >= 12,
        stress,
        policy,
        market: assessForecast(f, now),
      };
    });
    const candidates = rows.filter((r) =>
      ["research", "partial", "conditional", "experiment"].includes(r.status),
    );
    if (action === "growth") {
      if (!candidates.length) action = "cautious";
      else if (rows.some((r) => r.baseStatus === "partial"))
        action = "budgetTitle";
    }
    if (
      p.currency !== "USD" &&
      candidates.length &&
      !protectedMoney &&
      !basics &&
      p.goal !== "quick" &&
      ["growth", "budgetTitle", "income"].includes(action)
    )
      action = "currencyTitle";
    return {
      profile: p,
      action,
      rows,
      bounds,
      start: data.growth.dates[bounds.start],
      end: data.growth.dates[bounds.end],
      updated: data.meta.last_updated,
      unavailable: false,
      forecastChecked: forecasts?.meta?.checked_at || null,
      macro: {
        fresh:
          !!research?.macro &&
          validTime(research.macro.checked_at) &&
          now - Date.parse(research.macro.checked_at) <= 48 * 36e5 &&
          Date.parse(research.macro.checked_at) <= now + 6e5 &&
          !research.macro.stale,
        checked: research?.macro?.checked_at || null,
        growth: research?.macro?.growth_direction || "Unknown",
        inflation: research?.macro?.inflation_direction || "Unknown",
        pressure: Array.isArray(research?.macro?.pressure_flags)
          ? research.macro.pressure_flags
          : [],
      },
      forecastsStale:
        !validTime(forecasts?.meta?.checked_at) ||
        now - Date.parse(forecasts.meta.checked_at) > 45 * 6e4,
    };
  }
  const api = {
    evaluate,
    assessForecast,
    investmentIllustration,
    exposureScenario,
    validateProfile,
    policies,
    dict,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.RealWorthGuidance = api;
  if (typeof document === "undefined") return;
  const make = (tag, text, cls) => {
    const n = document.createElement(tag);
    if (text !== undefined) n.textContent = text;
    if (cls) n.className = cls;
    return n;
  };
  const pct = (n) => (Number.isFinite(n) ? n.toFixed(2) + "%" : "—");
  let state = null,
    history = null,
    forecasts = null,
    busy = false;
  const t = () => dict.en;
  const label = (asset) => asset;

  function renderForm(preserve = false) {
    const mount = document.getElementById("money-form-root");
    if (!mount) return;
    const previous = preserve ? readForm() : null,
      d = t();
    mount.replaceChildren();
    document.getElementById("money-title").textContent = d.title;
    document.getElementById("money-intro").textContent = d.intro;
    document.getElementById("money-privacy").textContent = d.privacy;
    const form = make("form");
    form.id = "money-form";
    const grid = make("div", undefined, "money-questions");
    for (const key of [
      "purpose",
      "horizon",
      "loss",
      "readiness",
      "goal",
      "currency",
    ]) {
      const wrapper = make("label", d[key]),
        select = make("select");
      select.name = key;
      select.id = "money-" + key;
      select.required = true;
      const empty = make("option", d.choose);
      empty.value = "";
      empty.disabled = true;
      empty.selected = true;
      select.append(empty);
      for (const [value, text] of d[key + "Options"]) {
        const option = make("option", text);
        option.value = value;
        select.append(option);
      }
      if (previous && previous[key] !== undefined) select.value = previous[key];
      wrapper.append(select);
      grid.append(wrapper);
    }
    const amount = make("label", d.amount),
      input = make("input");
    input.id = "money-amount";
    input.type = "number";
    input.name = "amount";
    input.min = "1";
    input.max = "1000000000";
    input.step = "any";
    input.required = true;
    input.inputMode = "decimal";
    input.value = previous?.amount || "1000";
    amount.append(input);
    grid.append(amount);
    form.append(grid);
    const submit = make("button", d.submit, "button");
    submit.type = "submit";
    submit.disabled = busy;
    form.append(submit);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      generate();
    });
    form.addEventListener("input", () => {
      if (state) {
        state = null;
        document.getElementById("money-result").hidden = true;
        document.getElementById("money-status").textContent = d.changed;
        document.dispatchEvent(new Event("realworth:guidance-changed"));
      }
    });
    mount.append(form);
  }
  function readForm() {
    const form = document.getElementById("money-form");
    return form ? Object.fromEntries(new FormData(form)) : null;
  }
  function evidenceRow(r) {
    const d = t(),
      box = make(
        "article",
        undefined,
        "money-asset " +
          (r.status === "research" ? "money-compare" : "money-" + r.status),
      );
    box.dataset.asset = r.asset;
    box.dataset.status = r.status;
    box.append(
      make("h4", label(r.asset)),
      make("p", d[r.status], "fit-label"),
      make("p", d.reasons[r.reason]),
    );
    box.append(make("p", `${d.role}: ${d.roles[r.asset]}`, "tiny"));
    if (r.scenario) {
      const x = r.scenario,
        f = (n) =>
          "$" + n.toLocaleString("en-US", { maximumFractionDigits: 2 });
      box.append(
        make(
          "p",
          `Arithmetic illustration: from ${f(state.profile.amount)}, ${f(x.riskAmount)} exposed to a ${pct(x.stressPercent)} fall and ${f(x.cashAmount)} assumed unchanged would lose about ${f(x.stressLoss)} (${x.lossPercent}% of the total). This is not a recommended allocation; a larger fall, costs or FX can exceed it.`,
          "budget-illustration",
        ),
      );
    }
    if (r.currencyUnassessed) box.append(make("p", d.currencyWhy, "tiny"));
    const detailed = make("details"),
      summary = make("summary", "Why? See the evidence");
    detailed.append(summary);
    const lines = [
      `Same endpoints: ${state.start} to ${state.end}; data updated ${state.updated}.`,
      `Observed month-end nominal drawdown ${pct(r.nominalDD)}; real drawdown ${pct(r.realDD)}. These measure different losses; intra-month falls can be worse.`,
      `${r.matching / 12}-year windows: ${r.rolling.n}, with ${r.rolling.skipped} missing endpoints omitted. Historical inflation-beating share ${pct(r.rolling.beat)}; worst final real return ${pct(r.rolling.min)}. ${r.matchedToDeadline ? "" : "This is one-year context, not a result for your days/months deadline."}`,
      `Your loss limit: ${pLoss()}%; screening stress: ${pct(r.stress)} nominal loss. The policy floor is ${r.policy.stress}%, and never below the observed nominal drawdown. Bitcoin requires disposable money that can be lost entirely. These are disclosed screening assumptions, not predictions or maximum possible losses.`,
      `Next-period estimate: ${forecastWords(r.market)} This is not evidence of trading profitability.`,
    ];
    for (const line of lines) detailed.append(make("p", line, "tiny"));
    if (state.profile.currency === "USD")
      detailed.append(
        make(
          "p",
          `For your $${state.profile.amount.toLocaleString()}, the same historical nominal decline would reduce value by about $${((state.profile.amount * Math.abs(r.nominalDD)) / 100).toFixed(0)}. This scales a past decline, not a future loss estimate.`,
          "tiny",
        ),
      );
    detailed.append(
      make(
        "p",
        `Annualised real growth over this sample: ${pct(r.annReal)}. This is not an expected future return; a negative value means purchasing power eroded in this sample.`,
        "tiny",
      ),
    );
    const readable = make("a", "Open the historical comparison tables → ");
    readable.href = "research.html#scorecard";
    detailed.append(readable);
    const source = make("a", d.data);
    source.href = "data/data.json";
    detailed.append(source);
    box.append(detailed);
    return box;
  }
  function pLoss() {
    return state.profile.loss;
  }
  function forecastWords(m) {
    if (!m.valid) return t().noTest;
    return (
      `Average miss ${pct(m.model)} versus ${pct(m.baseline)} for unchanged prices, across ${m.n} historical checks. ` +
      t()[m.comparison]
    );
  }
  function renderResult() {
    const mount = document.getElementById("money-result");
    if (!mount) return;
    if (!state) {
      mount.hidden = true;
      return;
    }
    mount.hidden = false;
    mount.replaceChildren();
    const d = t();
    mount.append(make("p", d.result, "eyebrow"));
    if (state.unavailable) {
      mount.append(make("h3", d.insufficient));
      return;
    }
    mount.append(make("h3", d[state.action]));
    const selected = [
      "purpose",
      "horizon",
      "loss",
      "readiness",
      "goal",
      "currency",
    ].map(
      (key) =>
        d[key + "Options"].find((o) => o[0] === String(state.profile[key]))[1],
    );
    mount.append(make("p", selected.join(" · "), "tiny"));
    const why = make("div", undefined, "money-reasons");
    why.append(make("h4", d.why));
    const reasons = [];
    if (
      ["essential", "borrowed"].includes(state.profile.purpose) ||
      state.profile.loss === 0
    )
      reasons.push(d.need);
    if (state.profile.readiness !== "ready") reasons.push(d.basics);
    if (state.profile.goal === "quick") reasons.push(d.quickWhy);
    if (state.profile.horizon <= 12) reasons.push(d.shortWhy);
    if (state.profile.currency !== "USD") reasons.push(d.currencyWhy);
    if (!reasons.length) reasons.push(d.longWhy);
    for (const text of reasons) why.append(make("p", text));
    mount.append(why);
    let next = ["protected", "short", "cautious"].includes(state.action)
      ? d.cashNext
      : state.action === "debt"
        ? d.debtNext
        : state.action === "reserve"
          ? d.reserveNext
          : state.action === "quick"
            ? d.quickNext
            : state.action === "currencyTitle"
              ? d.cashNext
              : d.longNext;
    if (state.action === "budgetTitle") next = d.budgetNext;
    if (state.action === "currencyTitle") next = d.currencyNext;
    mount.append(make("h4", d.next), make("p", next));
    const choices = state.rows.filter((r) =>
      ["research", "partial", "conditional", "experiment"].includes(r.status),
    );
    if (choices.length)
      mount.append(
        make(
          "p",
          "Research options (not a return ranking): " +
            choices.map((r) => label(r.asset)).join(" · "),
          "research-shortlist",
        ),
      );
    if (state.forecastsStale)
      mount.append(
        make(
          "p",
          "The quote snapshot is stale or unavailable; it cannot establish current entry conditions.",
          "notice",
        ),
      );
    const current = make("div", undefined, "money-current");
    current.append(make("h4", d.fitTiming));
    current.append(make("p", d.timingText));
    const m = state.macro;
    if (m?.fresh) {
      const text =
        m.growth === "Falling" && m.inflation === "Rising"
          ? "The macro panel shows slowing growth and rising inflation: a harder policy trade-off, not a short-term opportunity signal."
          : "The macro panel supplies context, not a validated entry-timing model.";
      current.append(make("p", text));
      if (m.pressure.length)
        current.append(
          make(
            "p",
            "The panel also flags credit or employment pressure. Investigate the risk rather than treating stress as a reason to buy.",
          ),
        );
      current.append(make("p", "Macro snapshot checked: " + m.checked, "tiny"));
    } else
      current.append(
        make(
          "p",
          "Current macro evidence is missing or stale; it cannot establish that now is a good entry time.",
          "tiny",
        ),
      );
    const macroLink = make("a", "Inspect the economic evidence");
    macroLink.href = "research.html#weather";
    current.append(macroLink);
    mount.append(current);
    mount.append(make("h4", d.evidence));
    if (state.rows.some((r) => r.scenario))
      mount.append(
        make(
          "p",
          "Each card is an alternative single-asset-plus-unchanged-cash scenario. Do not add their amounts together. Multiple simultaneous exposures require a new assessment of combined loss and correlation.",
          "notice",
        ),
      );
    const grid = make("div", undefined, "money-evidence-grid");
    for (const row of state.rows) grid.append(evidenceRow(row));
    mount.append(grid);
    const rules = make("details");
    rules.append(
      make("summary", d.rules),
      make(
        "p",
        "The screen checks essential/borrowed money, zero-loss needs and financial basics before goals, currency, horizon, stress and sample size. Willingness does not override capacity. Policy minima: five years for SPY/TLT; three for gold/Bitcoin. These conservative horizons and stress amounts do not guarantee recovery. Overlapping window proportions are not future probabilities or evidence that today’s price is cheap.",
      ),
      make("p", d.limited, "tiny"),
    );
    mount.append(rules);
  }
  async function read(url) {
    const r = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) throw Error("HTTP " + r.status);
    return r.json();
  }
  async function generate() {
    const status = document.getElementById("money-status");
    busy = true;
    document.querySelector("#money-form button").disabled = true;
    status.textContent = "Reading dated research and price evidence…";
    const answers = readForm();
    try {
      const results = await Promise.allSettled([
        read("data/data.json"),
        read("data/forecasts.json"),
        read("data/research.json"),
      ]);
      if (JSON.stringify(readForm()) !== JSON.stringify(answers)) {
        state = null;
        renderResult();
        status.textContent = t().changed;
        return;
      }
      history = results[0].status === "fulfilled" ? results[0].value : null;
      forecasts = results[1].status === "fulfilled" ? results[1].value : null;
      state = evaluate(
        answers,
        history,
        forecasts,
        Date.now(),
        results[2].status === "fulfilled" ? results[2].value : null,
      );
      renderResult();
      status.textContent = state.unavailable
        ? t().insufficient
        : "Ready. Read the conclusion, then open each asset’s evidence.";
      document.dispatchEvent(new Event("realworth:guidance-changed"));
    } catch (e) {
      state = null;
      renderResult();
      status.textContent =
        "Could not complete this check. Confirm every answer and amount; no asset has been cleared for purchase.";
    } finally {
      busy = false;
      document.querySelector("#money-form button").disabled = false;
    }
  }
  function appendCardGuide(row, card, meta, live) {
    const d = t(),
      m = assessForecast(row),
      box = make("div", undefined, "card-explanation");
    if (
      !validTime(meta?.checked_at) ||
      Date.now() - Date.parse(meta.checked_at) > 45 * 6e4 ||
      Date.parse(meta.checked_at) > Date.now() + 6e5
    )
      m.stale = true;
    const oldSnapshot =
      !validTime(meta?.checked_at) ||
      Date.now() - Date.parse(meta.checked_at) > 45 * 6e4 ||
      Date.parse(meta.checked_at) > Date.now() + 6e5;
    const staleText = oldSnapshot
      ? "The quote snapshot is not a sufficiently fresh current observation. Check its update time before considering an entry."
      : validTime(row.forecast?.target_at) &&
          Date.parse(row.forecast.target_at) <= Date.now()
        ? "This scenario’s target has passed. Read the outcome check rather than treating it as a new prediction."
        : d.stale;
    box.append(
      make("h4", d.plain),
      make("p", m.stale ? staleText : m.valid ? d[m.comparison] : d.noTest),
    );
    const proof = make("details");
    proof.className = "card-test-evidence";
    proof.append(
      make("summary", "Why? See the test evidence"),
      make("p", forecastWords(m), "tiny"),
      make("p", d.noSignal, "tiny"),
      make("p", d.coverage, "tiny"),
    );
    if (live)
      proof.append(
        make(
          "p",
          `Published checks: ${live.dates} distinct target dates; ${pct(live.coverage)} inside the outer range. This is not the share of profitable trades or correct directions.`,
          "tiny",
        ),
      );
    else
      proof.append(
        make(
          "p",
          "Post-publication checks are not available for this card.",
          "tiny",
        ),
      );
    box.append(proof);
    if (!state || state.profile.currency === "USD") {
      const amount = state?.profile?.amount || 1000,
        example = investmentIllustration(row, amount);
      if (example) {
        const exampleBox = make("details"),
          format = (n) => "$" + Math.round(n).toLocaleString();
        exampleBox.append(
          make("summary", "What would that mean for an amount of money?"),
          make(
            "p",
            `For illustration only: ${format(amount)} invested at the frozen starting quote would scale the outer range to about ${format(example.lower)}–${format(example.upper)}. This is not a return forecast for buying at today’s quote, excludes costs/taxes, and outcomes can lie outside it.`,
            "tiny",
          ),
        );
        box.append(exampleBox);
      }
    }
    const fit = state?.rows?.find((r) => r.ticker === row.ticker);
    box.append(
      make(
        "p",
        fit
          ? `${d.fit}: ${d[fit.status]} — ${d.reasons[fit.reason]}`
          : state?.unavailable
            ? d.insufficient
            : d.beforeFit,
        "card-fit",
      ),
    );
    const link = make("a", "Check my money’s purpose ↑");
    link.href = "#money-plan";
    box.append(link);
    card.append(box);
  }
  api.appendCardGuide = appendCardGuide;
  api.assetDescription = (ticker) => t().cardNames[ticker];

  api.snapshot = () => state;
  api.updateIntro = () => {
    const h = document.getElementById("forecast-guide-title"),
      p = document.getElementById("forecast-guide-summary");
    if (h) h.textContent = t().whyCards;
    if (p) p.textContent = t().summary;
  };
  api.updateIntro();

  renderForm();
})(globalThis);
