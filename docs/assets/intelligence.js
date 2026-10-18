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
  if (typeof module !== "undefined" && module.exports)
    module.exports = { validateForecasts, validateIntelligence };
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
    for (const step of record.analysis.chain) chain.append(make("li", step));
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
      const record = byUrl.get(card.dataset.sourceUrl);
      if (record?.analysis) {
        const node = interpretationNode(record);
        node.open = !!opened || openedAI.has(record.url);
        box.append(node);
      } else
        box.append(
          make(
            "p",
            record
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
  function aiContext(ticker) {
    const asset =
      ticker === "BTC-USD" ? "bitcoin" : ticker === "GLD" ? "gold" : null;
    if (!asset)
      return "Macro context: see Economic Weather. No asset-specific AI price adjustment.";
    const records = (intelligence?.articles || [])
      .filter((a) => a.analysis && !a.historical)
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
      const tr = make("tr");
      const name = make("th");
      name.scope = "row";
      name.append(safeLink(row.asset, row.source));
      tr.append(name);
      const quote = make("td", money(row.quote));
      quote.append(
        make("small", date(row.quote_at), "metric-baseline"),
        make(
          "small",
          `${row.market_status}${row.quote_stale ? " · stale quote" : ""}`,
          "metric-baseline",
        ),
      );
      if (row.error) quote.append(make("small", row.error, "metric-baseline"));
      tr.append(quote);
      const f = row.forecast;
      if (!f) {
        for (let i = 0; i < 5; i++) tr.append(make("td", "No forecast"));
        return tr;
      }
      const expired = Date.parse(f.target_at) < Date.now();
      const target = make("td", date(f.target_at));
      target.append(
        make(
          "small",
          row.tomorrow_has_session === false
            ? "No scheduled ETF session tomorrow; these levels refer to the next trading close."
            : row.ticker === "BTC-USD"
              ? "24h after the frozen quote anchor (rounded to a 5-minute target)."
              : "Next scheduled trading-session close.",
          "metric-baseline",
        ),
      );
      target.append(
        make(
          "small",
          `Issued ${date(f.issued_at)}${expired ? " · target elapsed; refresh/verification required" : ""}`,
          "metric-baseline",
        ),
      );
      tr.append(target);
      const q = f.levels;
      tr.append(make("td", `${money(q.q10)} – ${money(q.q30)}`));
      const center = make("td", money(q.q50));
      center.append(
        make("small", `${money(q.q40)} – ${money(q.q60)}`, "metric-baseline"),
      );
      tr.append(center);
      tr.append(make("td", `${money(q.q70)} – ${money(q.q90)}`));
      tr.append(make("td", aiContext(row.ticker), "forecast-ai-context"));
      return tr;
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
    const v = data.verification;
    set(
      "forecast-verification",
      v.verified_forecasts
        ? `${v.verified_forecasts} prospective forecasts verified · outer-band coverage ${percent(v.outer_band_coverage_percent)} · mean absolute median error ${percent(v.mean_abs_median_error_percent)} · ${v.pending} pending · ${v.missed} missed observations.`
        : `${v.pending} forecasts await future observations. No prospective accuracy is claimed yet. ${v.missed} target observations missed. ${v.invalidated || 0} invalidated draft issues excluded from scoring.`,
    );
    document.getElementById("forecast-content").hidden = false;
    renderLedger();
  }
  function renderLedger() {
    if (!ledger) return;
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
      }
    } catch (e) {
      set("forecast-load-status", `Data validation failed: ${e.message}`);
      document.getElementById("forecast-load-status").hidden = false;
    } finally {
      loading = false;
    }
  }
  document.addEventListener("realworth:news-rendered", attachAI);
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
