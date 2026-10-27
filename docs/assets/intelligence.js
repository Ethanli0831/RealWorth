/* Real model article readings and frozen statistical price scenarios. */
(() => {
  "use strict";
  const finite = Number.isFinite;
  const positive = (x) => finite(x) && x > 0;
  const validDate = (x) => typeof x === "string" && finite(Date.parse(x));
  function validateForecasts(data) {
    if (
      !validDate(data?.meta?.checked_at) ||
      !Array.isArray(data.assets) ||
      data.assets.length !== 5 ||
      !data.verification
    )
      throw Error("Invalid forecast snapshot");
    for (const row of data.assets) {
      if (
        row.quote !== null &&
        (!positive(row.quote) || !validDate(row.quote_at))
      )
        throw Error("Invalid observed quote");
      const f = row.forecast;
      if (!f) continue;
      if (
        !validDate(f.issued_at) ||
        !validDate(f.target_at) ||
        Date.parse(f.target_at) <= Date.parse(f.issued_at)
      )
        throw Error("Forecast target must follow issue time");
      if (
        !validDate(f.anchor_at) ||
        Date.parse(f.anchor_at) > Date.parse(f.issued_at)
      )
        throw Error("Forecast anchor cannot postdate issue time");
      const levels = [10, 30, 40, 50, 60, 70, 90].map(
        (q) => f.levels?.[`q${q}`],
      );
      if (
        !levels.every(positive) ||
        levels.some((n, i) => i && n < levels[i - 1])
      )
        throw Error("Forecast bands are invalid");
      if (!f.issued_digest || !positive(f.training_observations))
        throw Error("Forecast issue record is missing");
    }
    return data;
  }
  function validateIntelligence(data) {
    if (!validDate(data?.meta?.checked_at) || !Array.isArray(data.articles))
      throw Error("Invalid AI evidence snapshot");
    for (const a of data.articles) {
      if (!a.analysis) continue;
      if (
        !a.model ||
        !a.provider ||
        !validDate(a.analyzed_at) ||
        !a.body_characters ||
        !Array.isArray(a.analysis.chain) ||
        a.analysis.chain.some((step) => typeof step !== "string") ||
        !Array.isArray(a.analysis.evidence_ids) ||
        !a.analysis.evidence_ids.length ||
        a.analysis.evidence_ids.some(
          (id) => typeof a.evidence?.[id] !== "string",
        )
      )
        throw Error("AI interpretation lacks actual evidence or provenance");
    }
    return data;
  }
  function verificationByAsset(records) {
    const groups = new Map();
    for (const r of records) {
      if (
        r.status !== "Verified against later observation" ||
        !finite(r.median_error_percent) ||
        !finite(r.actual_return_percent)
      )
        continue;
      if (!groups.has(r.ticker)) groups.set(r.ticker, []);
      groups.get(r.ticker).push(r);
    }
    return [...groups].map(([ticker, issues]) => {
      const days = new Map();
      for (const r of [...issues].sort(
        (a, b) => Date.parse(a.issued_at) - Date.parse(b.issued_at),
      )) {
        const day = new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/Toronto",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(r.target_at));
        if (!days.has(day)) days.set(day, r);
      }
      const rows = [...days.values()],
        n = rows.length;
      return {
        ticker,
        issues: issues.length,
        dates: n,
        coverage:
          (100 * rows.filter((r) => r.inside_outer_band === true).length) / n,
        mae: rows.reduce((v, r) => v + Math.abs(r.median_error_percent), 0) / n,
        baseline:
          rows.reduce(
            (v, r) =>
              v +
              Math.abs(
                (100 * r.actual_return_percent) /
                  (100 + r.actual_return_percent),
              ),
            0,
          ) / n,
      };
    });
  }
  globalThis.RealWorthForecastMath = {
    validateForecasts,
    validateIntelligence,
    verificationByAsset,
  };
  if (typeof module !== "undefined" && module.exports)
    module.exports = globalThis.RealWorthForecastMath;
  if (typeof document === "undefined") return;
  const make = (tag, text, cls) => {
    const n = document.createElement(tag);
    if (text !== undefined) n.textContent = text;
    if (cls) n.className = cls;
    return n;
  };
  const set = (id, text) => {
    const n = document.getElementById(id);
    if (n) n.textContent = text;
  };
  const date = (t) =>
    validDate(t)
      ? new Intl.DateTimeFormat(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "America/Toronto",
        }).format(new Date(t)) + " ET"
      : "No observation";
  const money = (v) =>
    positive(v)
      ? new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 2,
        }).format(v)
      : "No data";
  const percent = (v) => (finite(v) ? `${v.toFixed(2)}%` : "Pending");
  const safeLink = (label, url) => {
    const a = make("a", label);
    try {
      const u = new URL(url);
      if (u.protocol === "https:" && !u.username && !u.password) {
        a.href = u.href;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
      }
    } catch {}
    return a;
  };
  let forecasts, intelligence, ledger;
  const openedAI = new Set();
  document.addEventListener(
    "toggle",
    (event) => {
      const detail = event.target;
      if (!detail.classList?.contains("ai-analysis")) return;
      if (detail.open) openedAI.add(detail.dataset.articleUrl);
      else openedAI.delete(detail.dataset.articleUrl);
    },
    true,
  );
  function interpretationNode(record) {
    const d = make("details", undefined, "ai-analysis");
    d.dataset.articleUrl = record.url;
    d.open = openedAI.has(record.url);
    d.append(make("summary", `AI-assisted article reading · ${record.model}`));
    d.append(
      make(
        "p",
        `${record.provider} · analyzed ${date(record.analyzed_at)} · ${record.body_characters.toLocaleString()} source characters extracted; ${(record.model_context_characters || record.body_characters).toLocaleString()} body characters supplied to the model, plus short evidence fragments`,
        "tiny",
      ),
    );
    d.append(
      make(
        "p",
        "AI interpretation, not independent factual verification. Exact source fragments support the reported event; causal channels remain hypotheses.",
        "analysis-label",
      ),
    );
    d.append(make("p", record.analysis.summary));
    const chain = make("ol", undefined, "impact-chain");
    for (const step of record.analysis.chain)
      chain.append(
        make(
          "li",
          step.replace(
            /^(reported_event|financial_channel|asset_hypothesis):\s*/,
            "",
          ),
        ),
      );
    d.append(chain);
    for (const asset of ["gold", "bitcoin"]) {
      const effect = record.analysis[asset];
      if (effect)
        d.append(
          make(
            "p",
            `${asset === "gold" ? "Gold" : "Bitcoin"} · ${effect.direction}: ${effect.condition}`,
          ),
        );
    }
    d.append(make("p", `Uncertainty: ${record.analysis.uncertainty}`));
    for (const id of record.analysis.evidence_ids) {
      d.append(
        make("p", `Source fragment ${id} (shortened):`, "tiny"),
        make("blockquote", record.evidence[id] + "…"),
      );
    }
    d.append(safeLink("Read the original public article", record.url));
    d.append(
      make(
        "p",
        `Source read ${date(record.read_at)} · ${record.status}`,
        "tiny",
      ),
    );
    return d;
  }
  function attachAI() {
    if (!intelligence) return;
    const byUrl = new Map(intelligence.articles.map((a) => [a.url, a]));
    document.querySelectorAll(".news-card").forEach((card) => {
      const old = card.querySelector(".article-ai");
      const opened = old?.querySelector("details")?.open;
      const box = make("div", undefined, "article-ai");
      const record =
        byUrl.get(card.dataset.sourceUrl) ||
        JSON.parse(card.dataset.relatedUrls || "[]")
          .map((u) => byUrl.get(u))
          .find((r) => r?.analysis);
      if (record?.analysis && card.dataset.relevant !== "false") {
        const node = interpretationNode(record);
        node.open = !!opened || openedAI.has(record.url);
        box.append(node);
      } else
        box.append(
          make(
            "p",
            card.dataset.relevant === "false"
              ? "No clear macro impact; AI analysis intentionally withheld."
              : record
                ? `Article AI: ${record.status}`
                : "Article AI: not yet read/analyzed in the selected-article queue.",
            "tiny",
          ),
        );
      if (old) old.replaceWith(box);
      else card.append(box);
    });
    const caseBox = document.getElementById("gold-case-evidence");
    if (caseBox) {
      caseBox.querySelector(".historical-ai")?.remove();
      const record = intelligence.articles.find(
        (a) => a.historical && a.analysis,
      );
      if (record) {
        const box = make("div", undefined, "historical-ai");
        box.append(interpretationNode(record));
        caseBox.append(box);
      }
    }
    const read = intelligence.meta.article_reads,
      ai = intelligence.meta.ai_interpretations;
    set(
      "article-ai-status",
      `${ai} AI interpretations / ${read} selected public article bodies read · checked ${date(intelligence.meta.checked_at)}. Other headlines remain labelled rule templates or unanalyzed.`,
    );
    const old =
      Date.now() - Date.parse(intelligence.meta.checked_at) > 3 * 3600 * 1000;
    const warn = document.getElementById("article-ai-warning");
    if (warn) {
      warn.hidden = !old;
      warn.textContent =
        "The AI reading snapshot is older than three hours. Check source read and analysis times.";
    }
    if (forecasts) renderForecasts();
  }
  let relevantNewsUrls = null;
  function aiContext(ticker) {
    const asset =
      ticker === "BTC-USD" ? "bitcoin" : ticker === "GLD" ? "gold" : null;
    if (!asset)
      return "Macro context: see Economic Weather. No asset-specific AI price adjustment.";
    const records = (intelligence?.articles || [])
      .filter(
        (a) => a.analysis && !a.historical && relevantNewsUrls?.has(a.url),
      )
      .sort((a, b) => Date.parse(b.analyzed_at) - Date.parse(a.analyzed_at));
    if (!records.length)
      return "No published article-model interpretation yet.";
    const r = records[0];
    return `${r.analysis[asset].direction}: ${r.analysis[asset].condition} (AI context ${date(r.analyzed_at)}; numerical bands are unchanged.)`;
  }
  function renderForecasts() {
    const data = forecasts;
    set(
      "forecast-updated",
      `Quotes checked ${date(data.meta.checked_at)} · tomorrow ${data.meta.tomorrow}, America/Toronto · provider delays apply`,
    );
    const stale =
      Date.now() - Date.parse(data.meta.checked_at) > 45 * 60 * 1000;
    const warning = document.getElementById("forecast-warning");
    warning.hidden = !stale && !data.meta.failures.length;
    warning.textContent = stale
      ? "The quote snapshot is older than 45 minutes. Treat displayed prices and targets as dated observations."
      : "Some assets could not refresh; retained values and forecasts are labelled stale.";
    const rows = data.assets.map((row) => {
      const card = make("article", undefined, "forecast-card");
      const title = make("h3");
      title.append(safeLink(row.asset, row.source));
      card.append(title);
      if (globalThis.RealWorthGuidance)
        card.append(
          make(
            "p",
            globalThis.RealWorthGuidance.assetDescription(row.ticker),
            "asset-plain-description",
          ),
        );
      card.append(
        make(
          "p",
          `${row.ticker} · ${row.market_status}${row.quote_stale ? " · stale quote" : ""}`,
          "tiny",
        ),
      );
      card.append(make("p", money(row.quote), "quote-value"));
      card.append(make("p", `${"Observed"} ${date(row.quote_at)}`, "tiny"));
      if (row.error) card.append(make("p", row.error, "notice"));
      const f = row.forecast;
      if (!f) {
        card.append(make("p", "No forecast available."));
        globalThis.RealWorthGuidance?.appendCardGuide(
          row,
          card,
          data.meta,
          null,
        );
        return card;
      }
      card.append(make("p", `${"Target"} ${date(f.target_at)}`, "target-time"));
      card.append(
        make(
          "p",
          `Issued ${date(f.issued_at)} · ${row.ticker === "BTC-USD" ? "24h from frozen quote" : `${f.horizon_sessions || 1} exchange session(s), next eligible close`}`,
          "tiny",
        ),
      );
      if (Date.parse(f.target_at) < Date.now())
        card.append(
          make(
            "p",
            "Target elapsed; awaiting refreshed verification.",
            "notice",
          ),
        );
      const scenarios = make("dl", undefined, "scenario-grid"),
        q = f.levels;
      for (const [label, value] of [
        ["Lower historical range", `${money(q.q10)}–${money(q.q30)}`],
        ["Middle estimate", money(q.q50)],
        ["Upper historical range", `${money(q.q70)}–${money(q.q90)}`],
      ]) {
        const group = make("div");
        group.append(make("dt", label), make("dd", value));
        scenarios.append(group);
      }
      card.append(
        scenarios,
        make(
          "p",
          `${"Middle historical range"}: ${money(q.q40)}–${money(q.q60)}`,
          "tiny",
        ),
      );
      globalThis.RealWorthGuidance?.appendCardGuide(
        row,
        card,
        data.meta,
        ledger
          ? verificationByAsset(ledger.records).find(
              (r) => r.ticker === row.ticker,
            )
          : null,
      );
      const details = make("details");
      details.append(
        make("summary", "AI news context & limitations"),
        make("p", aiContext(row.ticker)),
        make(
          "p",
          "News hypotheses do not adjust the numerical price bands. GLD is an ETF share price, not spot gold per ounce.",
          "tiny",
        ),
      );
      card.append(details);
      return card;
    });
    document.getElementById("forecast-body").replaceChildren(...rows);
    const backtests = data.assets.map((row) => {
      const f = row.forecast;
      const b = f?.backtest;
      const tr = make("tr");
      tr.append(make("th", row.asset));
      for (const v of [
        b?.observations ?? "No data",
        percent(b?.coverage_percent),
        percent(b?.mean_abs_price_error_percent),
        percent(b?.random_walk_error_percent),
      ])
        tr.append(make("td", String(v)));
      return tr;
    });
    document
      .getElementById("forecast-backtest-body")
      .replaceChildren(...backtests);
    const evidence = data.assets.filter(
      (r) =>
        finite(r.forecast?.backtest?.mean_abs_price_error_percent) &&
        finite(r.forecast?.backtest?.random_walk_error_percent),
    );
    const better = evidence.filter(
      (r) =>
        Number(r.forecast.backtest.mean_abs_price_error_percent.toFixed(2)) <
        Number(r.forecast.backtest.random_walk_error_percent.toFixed(2)),
    );
    set(
      "baseline-finding",
      better.length
        ? `${better.length}/${evidence.length} asset diagnostics have lower model error in this sample; this does not establish a repeatable forecasting edge. Compare each row below.`
        : "No point-forecast advantage over unchanged prices is demonstrated in this historical test. Model errors are equal to or higher than the simple baseline at displayed precision.",
    );
    const v = data.verification;
    set(
      "forecast-verification",
      `${v.pending} pending issues · ${v.missed} missed observations · ${v.invalidated || 0} invalidated drafts excluded. Scores below are separated by asset; interval coverage is not direction-prediction accuracy.`,
    );
    document.getElementById("forecast-content").hidden = false;
    renderLedger();
  }
  function renderLedger() {
    if (!ledger) return;
    const summaries = verificationByAsset(ledger.records);
    const body = document.getElementById("verification-by-asset");
    if (body)
      body.replaceChildren(
        ...["BTC-USD", "GLD", "SPY", "BIL", "TLT"].map((ticker) => {
          const s = summaries.find((r) => r.ticker === ticker),
            row = make("tr");
          row.append(make("th", ticker));
          for (const v of [
            s?.issues ?? 0,
            s?.dates ?? 0,
            s ? percent(s.coverage) : "Pending",
            s ? percent(s.mae) : "Pending",
            s ? percent(s.baseline) : "Pending",
          ])
            row.append(make("td", String(v)));
          return row;
        }),
      );
    const rows = ledger.records.slice(0, 30).map((r) => {
      const empty = r.status.startsWith("Pending") ? "Pending" : "Not scored";
      const tr = make("tr");
      tr.append(make("th", r.ticker));
      for (const text of [
        date(r.issued_at),
        date(r.target_at),
        r.status,
        finite(r.actual_return_percent)
          ? percent(r.actual_return_percent)
          : empty,
        finite(r.median_error_percent)
          ? percent(r.median_error_percent)
          : empty,
        r.inside_outer_band === undefined
          ? empty
          : r.inside_outer_band
            ? "Inside"
            : "Outside",
      ])
        tr.append(make("td", text));
      return tr;
    });
    document.getElementById("forecast-ledger-body").replaceChildren(...rows);
  }
  async function get(path) {
    const r = await fetch(path, {
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) throw Error(`HTTP ${r.status}`);
    return r.json();
  }
  let loading = false;
  async function refresh() {
    if (loading) return;
    loading = true;
    const results = await Promise.allSettled([
      get("data/forecasts.json"),
      get("data/intelligence.json"),
      get("data/forecast-ledger.json"),
    ]);
    try {
      if (results[0].status === "fulfilled") {
        forecasts = validateForecasts(results[0].value);
        renderForecasts();
        set("forecast-load-status", "");
        document.getElementById("forecast-load-status").hidden = true;
      } else {
        set(
          "forecast-load-status",
          "Quotes and scenarios could not refresh. Previously loaded results, if any, retain their timestamps.",
        );
        document.getElementById("forecast-load-status").hidden = false;
      }
      if (results[1].status === "fulfilled") {
        intelligence = validateIntelligence(results[1].value);
        attachAI();
      } else
        set(
          "article-ai-status",
          "Article-model data is not available. Rule templates are not being relabelled as AI.",
        );
      if (
        results[2].status === "fulfilled" &&
        Array.isArray(results[2].value.records)
      ) {
        ledger = results[2].value;
        renderLedger();
        if (forecasts) renderForecasts();
      }
    } catch (e) {
      set("forecast-load-status", `Data validation failed: ${e.message}`);
      document.getElementById("forecast-load-status").hidden = false;
    } finally {
      loading = false;
    }
  }
  document.addEventListener("realworth:guidance-changed", () => {
    if (forecasts) renderForecasts();
  });
  document.addEventListener("realworth:news-rendered", (event) => {
    relevantNewsUrls = new Set(event.detail?.relevantUrls || []);
    attachAI();
  });
  document
    .getElementById("forecast-refresh")
    ?.addEventListener("click", refresh);
  if (document.getElementById("forecast-body")) {
    refresh();
    setInterval(() => {
      if (!document.hidden) refresh();
    }, 60000);
  }
})();
