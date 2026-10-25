/* Macro readings and publisher headlines load independently of return data. */
(() => {
  "use strict";
  const finite = Number.isFinite;
  const known = (value) => typeof value === "string" && value.trim().length > 0;
  function safeLink(value) {
    try {
      const url = new URL(value);
      return (
        ["https:", "http:"].includes(url.protocol) &&
        !url.username &&
        !url.password
      );
    } catch {
      return false;
    }
  }
  function validateResearch(data) {
    if (
      !data?.meta?.checked_at ||
      !Number.isFinite(Date.parse(data.meta.checked_at)) ||
      !Array.isArray(data.macro?.indicators) ||
      !Array.isArray(data.news) ||
      !Array.isArray(data.sources) ||
      !Array.isArray(data.mechanisms) ||
      !Array.isArray(data.feed_health)
    )
      throw Error("Research data is incomplete.");
    if (
      !data.macro.indicators.every(
        (x) =>
          known(x.name) &&
          (x.value === null || finite(x.value)) &&
          (x.change === null || finite(x.change)) &&
          safeLink(x.source),
      )
    )
      throw Error("Invalid macro evidence.");
    if (
      !data.sources.every(
        (s) => known(s.name) && known(s.category) && safeLink(s.url),
      )
    )
      throw Error("Invalid research source.");
    const ids = new Set(data.mechanisms.map((m) => m.id));
    if (
      !data.mechanisms.every(
        (m) =>
          known(m.name) &&
          Array.isArray(m.chain) &&
          m.chain.every(known) &&
          known(m.gold) &&
          known(m.bitcoin) &&
          known(m.counter),
      )
    )
      throw Error("Invalid mechanism evidence.");
    if (
      !data.news.every(
        (n) =>
          known(n.title) &&
          safeLink(n.url) &&
          Number.isFinite(Date.parse(n.published_at)) &&
          Array.isArray(n.topics) &&
          n.topics.every((id) => ids.has(id)),
      )
    )
      throw Error("Invalid news evidence.");
    return data;
  }
  function filterNews(data, topic, query) {
    const term = query.trim().toLowerCase();
    return data.news.filter(
      (n) =>
        (!topic ||
          (topic === "unclassified"
            ? !n.topics.length
            : n.topics.includes(topic))) &&
        (!term || `${n.title} ${n.publisher}`.toLowerCase().includes(term)),
    );
  }
  if (typeof module !== "undefined" && module.exports)
    module.exports = { safeLink, validateResearch, filterNews };
  if (typeof document === "undefined") return;
  const el = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  const set = (id, text) => {
    const node = document.getElementById(id);
    if (node) node.textContent = text;
  };
  const link = (label, url) => {
    const node = el("a", label);
    if (safeLink(url)) {
      node.href = url;
      node.rel = "noopener noreferrer";
      node.target = "_blank";
    }
    return node;
  };
  const date = (value) =>
    value
      ? new Intl.DateTimeFormat(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(value))
      : "Never fetched";
  const pct = (value) => (finite(value) ? `${value.toFixed(2)}%` : "No data");
  let state;
  let loading = false;
  let visible = 6;
  function renderMacro(data) {
    if (!document.getElementById("macro-body")) return;
    const macro = data.macro;
    set("weather-title", macro.weather);
    set("weather-cycle", macro.short_cycle);
    set("weather-long-cycle", macro.long_cycle);
    set("weather-outlook", macro.outlook);
    const checks = macro.checked_at;
    set(
      "weather-updated",
      `US data · checked ${date(checks)} · each observation has its own date`,
    );
    const stale =
      macro.stale || Date.now() - Date.parse(checks) > 48 * 3600 * 1000;
    const alert = document.getElementById("weather-warning");
    alert.hidden =
      !stale &&
      !macro.failures.length &&
      !macro.indicators.some((i) => i.stale);
    alert.textContent = stale
      ? "Macro snapshot is stale. The displayed regime is from the last successful check; read the observation dates before using it."
      : "Some series are missing or lagging. Stale observations are shown for context and excluded from current classification.";
    document.querySelectorAll("[data-weather-growth]").forEach((box) => {
      const active =
        !stale &&
        box.dataset.weatherGrowth === macro.growth_direction &&
        box.dataset.weatherInflation === macro.inflation_direction;
      box.classList.toggle("current-weather", active);
      box.querySelector(".weather-current").textContent = active
        ? "Current observed signals"
        : "";
    });
    const flags = document.getElementById("weather-flags");
    flags.replaceChildren(
      ...(macro.pressure_flags.length
        ? macro.pressure_flags
        : [
            "No listed credit/labour warning threshold is triggered by the available fresh observations. This is not proof of low risk.",
          ]
      ).map((f) => el("li", f)),
    );
    const baselines = {
      GDPC1: "YoY growth vs previous quarter",
      CPIAUCSL: "YoY inflation vs 6 months earlier",
      FEDFUNDS: "Rate vs 3 months earlier",
      UNRATE: "3-month average vs trailing 12-month low",
      TDSP: "Ratio vs 4 quarters earlier",
      QUSPAM770A: "Ratio vs 4 quarters earlier",
      GFDEGDQ188S: "Ratio vs 4 quarters earlier",
      BAMLH0A0HYM2: "Spread vs 6 months earlier",
      DFII10: "Yield vs 6 months earlier",
      T10Y3M: "Slope vs 6 months earlier",
    };
    const rows = macro.indicators.map((i) => {
      const row = el("tr");
      row.append(el("th", i.name));
      row.firstChild.scope = "row";
      row.append(
        el(
          "td",
          finite(i.value)
            ? `${i.value.toFixed(2)}${i.unit === "%" ? "%" : " pp"}`
            : "No data",
        ),
      );
      row.append(
        el(
          "td",
          `${i.period || "Unknown"}${i.stale ? " · stale / unavailable" : ""}`,
        ),
      );
      const change = el(
        "td",
        finite(i.change)
          ? `${i.change >= 0 ? "+" : ""}${i.change.toFixed(2)} pp`
          : "No data",
      );
      change.append(el("small", baselines[i.id] || "", "metric-baseline"));
      row.append(change);
      const source = el("td");
      source.append(link(i.id, i.source));
      row.append(source);
      return row;
    });
    document.getElementById("macro-body").replaceChildren(...rows);
  }
  function renderSources(data) {
    if (!document.getElementById("source-category")) return;
    const selector = document.getElementById("source-category");
    if (selector.options.length === 1) {
      for (const category of new Set(data.sources.map((s) => s.category))) {
        const option = el("option", category);
        option.value = category;
        selector.append(option);
      }
    }
    const shown = data.sources.filter(
      (s) => !selector.value || s.category === selector.value,
    );
    document.getElementById("research-source-list").replaceChildren(
      ...shown.map((s) => {
        const card = el("article", undefined, "source-card");
        card.append(el("p", s.category, "eyebrow"));
        const title = el("h4");
        title.append(link(s.name, s.url));
        card.append(title);
        card.append(
          el("p", s.watch),
          el("p", `Access: ${s.access}`, "tiny"),
          el("p", s.limits, "tiny"),
        );
        return card;
      }),
    );
    set("source-count", `${shown.length} research sources`);
  }
  function renderNews(data) {
    if (!document.getElementById("news-list")) return;
    const opened = new Set(
      Array.from(
        document.querySelectorAll("#news-list details[open]"),
        (node) => node.dataset.chainKey,
      ),
    );
    const items = filterNews(
      data,
      document.getElementById("news-topic").value,
      document.getElementById("news-search").value,
    );
    const mechanismMap = new Map(data.mechanisms.map((m) => [m.id, m]));
    const shown = items.slice(0, visible);
    const cards = shown.map((n) => {
      const card = el("article", undefined, "news-card");
      card.dataset.sourceUrl = n.url;
      card.dataset.relevant = String(n.topics.length > 0);
      card.dataset.relatedUrls = JSON.stringify(
        (n.related_reports || []).map((r) => r.url),
      );
      card.append(
        el(
          "p",
          `${n.publisher} · ${date(n.published_at)}${n.cached ? " · cached; feed unavailable" : ""}`,
          "tiny",
        ),
      );
      const heading = el("h3");
      heading.append(link(n.title, n.url));
      card.append(heading);
      card.append(el("p", `${n.source_kind}. ${n.evidence}`, "tiny"));
      card.append(
        el(
          "p",
          n.topics.length
            ? "Relevant headline · conditional mechanism template · causal effect unverified"
            : "No clear macro impact · no analysis generated",
          "analysis-label",
        ),
      );
      if (n.relevance) card.append(el("p", n.relevance.reason, "tiny"));
      if (n.related_reports?.length > 1) {
        const related = el("details");
        related.append(
          el("summary", `${n.related_reports.length} reports of this event`),
        );
        for (const report of n.related_reports) {
          const p = el("p");
          p.append(link(`${report.publisher}: ${report.title}`, report.url));
          related.append(p);
        }
        card.append(related);
      }
      for (const id of n.topics) {
        const m = mechanismMap.get(id);
        const detail = el("details", undefined, "chain-detail");
        detail.dataset.chainKey = JSON.stringify([n.url, id]);
        detail.open = opened.has(detail.dataset.chainKey);
        const summary = el("summary", `${m.name} · open the impact chain`);
        detail.append(summary);
        const list = el("ol", undefined, "impact-chain");
        for (const step of m.chain) list.append(el("li", step));
        detail.append(list);
        const effects = el("div", undefined, "asset-effects");
        for (const [name, text] of [
          ["Gold", m.gold],
          ["Bitcoin", m.bitcoin],
        ]) {
          const effect = el("div");
          effect.append(el("h4", name), el("p", text));
          effects.append(effect);
        }
        detail.append(
          effects,
          el(
            "p",
            `Evidence that could confirm or weaken this channel: ${m.counter}`,
          ),
          el("p", `Possible horizon: ${m.horizon}`, "tiny"),
        );
        card.append(detail);
      }
      return card;
    });
    if (!cards.length)
      cards.push(
        el(
          "p",
          "No matching headlines in the current 14-day sample. This does not mean no relevant event occurred.",
          "notice",
        ),
      );
    document.getElementById("news-list").replaceChildren(...cards);
    document.dispatchEvent(
      new CustomEvent("realworth:news-rendered", {
        detail: {
          relevantUrls: data.news
            .filter((n) => n.topics.length)
            .flatMap((n) => [
              n.url,
              ...(n.related_reports || []).map((r) => r.url),
            ]),
        },
      }),
    );
    set(
      "news-result-count",
      `${items.length} matched headlines · showing ${shown.length}`,
    );
    document.getElementById("news-more").hidden = shown.length >= items.length;
  }
  function renderCase(data) {
    if (!document.getElementById("gold-case-evidence")) return;
    const c = data.gold_case;
    const m = data.mechanisms.find((m) => m.id === "transmutation");
    const root = document.getElementById("gold-case-evidence");
    root.replaceChildren();
    root.append(
      link(
        "CERN primary source: ALICE detects conversion of lead into gold at the LHC",
        c.url,
      ),
    );
    root.append(
      el("p", `${c.status} · ${date(c.checked_at || c.attempted_at)}`, "tiny"),
    );
    if (c.excerpt) {
      root.append(
        el("blockquote", c.excerpt),
        el(
          "p",
          "Short primary-source excerpt. This historical case is not a new headline.",
          "tiny",
        ),
      );
    }
    root.append(
      el(
        "p",
        c.note ||
          "The separate user-described French announcement has not been identified. Verify its exact date and source.",
      ),
    );
    const list = el("ol", undefined, "impact-chain");
    for (const step of m.chain) list.append(el("li", step));
    root.append(
      list,
      el("p", `Gold: ${m.gold}`),
      el("p", `Bitcoin: ${m.bitcoin}`),
      el("p", `What would change the conclusion: ${m.counter}`),
    );
  }
  function renderHealth(data) {
    if (!document.getElementById("feed-health-list")) return;
    const fetched = data.feed_health.filter(
      (h) => h.status === "Fetched",
    ).length;
    const old = Date.now() - Date.parse(data.meta.checked_at) > 3 * 3600 * 1000;
    set(
      "news-updated",
      `Last scan ${date(data.meta.checked_at)} · ${fetched}/${data.feed_health.length} feeds fetched · 15-minute schedule, not a live wire`,
    );
    const warning = document.getElementById("news-health-warning");
    warning.hidden = !old && fetched === data.feed_health.length;
    warning.textContent = `${old ? "This scan is older than 3 hours. " : ""}${fetched < data.feed_health.length ? "Some feeds are unavailable; coverage is incomplete. Cached headlines retain their original publication dates. " : ""}Publisher and GitHub delays can leave recent events unobserved.`;
    document.getElementById("feed-health-list").replaceChildren(
      ...data.feed_health.map((h) => {
        const item = el("li");
        item.append(
          link(h.name, h.url),
          document.createTextNode(
            ` — ${h.status}; last success ${date(h.last_success)}; ${h.matched} matched.`,
          ),
        );
        return item;
      }),
    );
  }
  async function load() {
    if (loading) return;
    loading = true;
    const button = document.getElementById("research-refresh");
    const status = document.getElementById("research-load-status");
    button.disabled = true;
    status.hidden = false;
    status.textContent = "Checking the latest published research snapshot…";
    try {
      const response = await fetch("data/research.json", {
        cache: "no-store",
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok)
        throw Error(`Research snapshot HTTP ${response.status}`);
      const data = validateResearch(await response.json());
      state = data;
      renderMacro(data);
      renderSources(data);
      renderHealth(data);
      renderCase(data);
      const topic = document.getElementById("news-topic");
      if (topic && topic.options.length <= 2)
        for (const m of data.mechanisms) {
          const option = el("option", m.name);
          option.value = m.id;
          topic.append(option);
        }
      renderNews(data);
      for (const id of ["research-content", "news-content"]) {
        const n = document.getElementById(id);
        if (n) n.hidden = false;
      }
      status.hidden = true;
    } catch (e) {
      status.textContent = `Research could not refresh: ${e.message}. ${state ? "Previously loaded readings remain visible; check their dates." : "The calculator, scorecard and inflation tracker remain available."}`;
    } finally {
      button.disabled = false;
      loading = false;
    }
  }
  document.getElementById("research-refresh")?.addEventListener("click", load);
  document
    .getElementById("source-category")
    ?.addEventListener("change", () => state && renderSources(state));
  for (const id of ["news-topic", "news-search"])
    document.getElementById(id)?.addEventListener("input", () => {
      visible = 6;
      if (state) renderNews(state);
    });
  document.getElementById("news-more")?.addEventListener("click", () => {
    visible += 6;
    if (state) renderNews(state);
  });
  if (document.getElementById("research-refresh")) {
    load();
    setInterval(
      () => {
        if (!document.hidden) load();
      },
      5 * 60 * 1000,
    );
  }
})();
