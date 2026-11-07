/* Attributed event watches: scenarios, never probability or price forecasts. */
(function (root) {
  "use strict";
  const finiteTime = (x) =>
    typeof x === "string" && Number.isFinite(Date.parse(x));
  const safeLink = (value) => {
    try {
      const u = new URL(value);
      return u.protocol === "https:" && !u.username && !u.password;
    } catch {
      return false;
    }
  };
  function validateRisk(data) {
    if (
      !data ||
      !finiteTime(data.meta?.built_at) ||
      !finiteTime(data.meta?.source_checked_at) ||
      !finiteTime(data.meta?.tracking_started_at) ||
      typeof data.meta.news_stale !== "boolean" ||
      !Array.isArray(data.events) ||
      !Array.isArray(data.categories) ||
      !data.categories.length ||
      !Array.isArray(data.regions) ||
      !Array.isArray(data.gaps) ||
      !Array.isArray(data.calendar_health) ||
      !Array.isArray(data.source_directory)
    )
      throw Error("Incomplete event-risk evidence");
    const ids = new Set(data.categories.map((c) => c.id));
    if (
      ids.size !== data.categories.length ||
      !data.categories.every(
        (c) =>
          typeof c.name === "string" &&
          Array.isArray(c.chain) &&
          c.chain.every((x) => typeof x === "string") &&
          Array.isArray(c.checks) &&
          c.checks.every((x) => typeof x === "string"),
      )
    )
      throw Error("Invalid risk framework");
    if (
      !data.events.every(
        (e) =>
          /^[a-f0-9]{24}$/.test(e.id) &&
          typeof e.title === "string" &&
          safeLink(e.url) &&
          finiteTime(e.first_observed_at) &&
          (finiteTime(e.published_at) || finiteTime(e.scheduled_at)) &&
          Array.isArray(e.categories) &&
          e.categories.length &&
          e.categories.every((x) => ids.has(x)) &&
          Array.isArray(e.tickers) &&
          e.tickers.every((x) =>
            ["BTC-USD", "GLD", "SPY", "BIL", "TLT"].includes(x),
          ) &&
          Array.isArray(e.regions) &&
          typeof e.stage === "string",
      )
    )
      throw Error("Invalid event source or timestamp");
    if (
      !data.source_directory.every((s) => safeLink(s.url)) ||
      !data.regions.every(
        (r) =>
          typeof r.name === "string" &&
          typeof r.channel === "string" &&
          typeof r.caveat === "string",
      )
    )
      throw Error("Invalid regional/source evidence");
    return data;
  }
  function assess(profile, input, now = Date.now()) {
    const empty = {
      status: "unavailable",
      review: false,
      gatedTickers: [],
      events: [],
      message:
        "Event-risk evidence is unavailable. Historical fit does not establish that current conditions are safe.",
    };
    let d;
    try {
      d = validateRisk(input);
    } catch {
      return empty;
    }
    if (d.meta.news_unavailable === true)
      return {
        ...empty,
        message:
          "No headline feed was successfully retrieved. Current event coverage is unknown; cached reports and a missing watch do not establish a safe entry.",
      };
    const built = now - Date.parse(d.meta.built_at),
      age = now - Date.parse(d.meta.source_checked_at);
    if (
      d.meta.news_stale ||
      age > 48 * 36e5 ||
      built > 48 * 36e5 ||
      age < -6e5 ||
      built < -6e5
    )
      return {
        ...empty,
        status: "stale",
        message:
          "Event-risk evidence is stale or has an inconsistent clock. No current-entry conclusion is supported.",
      };
    const region = profile.region || "Global",
      concentration = profile.concentration || "unknown";
    const sensitive = new Set([
      "elections",
      "ai_regulation",
      "ai_economics",
      "trade",
      "credit",
      "energy",
      "geopolitics",
      "earnings",
      "leverage",
    ]);
    const events = d.events.filter((e) => {
      if (Date.parse(e.first_observed_at) > now + 6e5) return false;
      if (
        !(
          region === "Global" ||
          e.regions.includes("All") ||
          e.regions.includes(region)
        )
      )
        return false;
      if (e.scheduled_at) {
        const until = Date.parse(e.scheduled_at) - now,
          dateOnly = e.date_precision?.startsWith("Date only");
        return until <= 72 * 36e5 && until >= (dateOnly ? -24 * 36e5 : 0);
      }
      const elapsed = now - Date.parse(e.published_at);
      const macroSurprise =
        e.categories.some((c) =>
          [
            "rates",
            "growth",
            "currency",
            "crypto_access",
            "commodity_supply",
          ].includes(c),
        ) &&
        /unexpected|surpris|exceeds? expectations|hikes?|raises?|cuts?|recession|collapse|crash|devalu|hack|ban|restrict|disrupt|defaults?|capital flight|transmut/i.test(
          e.title,
        );
      return (
        elapsed >= -6e5 &&
        elapsed <= 7 * 864e5 &&
        (e.categories.some((c) => sensitive.has(c)) || macroSurprise)
      );
    });
    const concentrated = ["ai", "regional"].includes(concentration);
    const review =
      events.length > 0 && (Number(profile.horizon) <= 12 || concentrated);
    const gatedTickers = review
      ? [...new Set(events.flatMap((e) => e.tickers))]
      : [];
    return {
      status: "limited",
      review,
      gatedTickers,
      events,
      sourceChecked: d.meta.source_checked_at,
      concentration,
      region,
      message: review
        ? "Pause adding to affected exposure until you check the reported event, its legal stage and your concentration. This is a review gate, not a prediction of a crash or an instruction to sell everything."
        : events.length
          ? "There are relevant event watches. Long-term historical fit can remain worth researching, but it does not resolve current policy or earnings uncertainty."
          : "No recent matching decision-sensitive watch was found in these selected inputs. This does not mean that risks are absent or that buying now is safe.",
    };
  }
  const api = { validateRisk, assess, safeLink };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.RealWorthRisk = api;
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
  const date = (value) =>
    finiteTime(value)
      ? new Intl.DateTimeFormat("en-US", {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "America/Toronto",
        }).format(new Date(value)) + " Toronto"
      : "Not established";
  const link = (text, url) => {
    const n = make("a", text);
    if (safeLink(url)) {
      n.href = url;
      n.rel = "noopener noreferrer";
    }
    return n;
  };
  let data = null,
    articles = null,
    visible = 6,
    located = false;
  function renderEvents() {
    const mount = document.getElementById("risk-events");
    if (!mount || !data) return;
    const selected = document.getElementById("risk-category").value;
    const events = data.events.filter(
      (e) => !selected || e.categories.includes(selected),
    );
    const target = location.hash.startsWith("#event-")
      ? location.hash.slice(7)
      : null;
    if (target && !located)
      visible = Math.max(visible, events.findIndex((e) => e.id === target) + 1);
    mount.replaceChildren();
    for (const e of events.slice(0, visible)) {
      const card = make("article", undefined, "risk-event");
      card.id = "event-" + e.id;
      card.append(
        make("p", e.kind, "eyebrow"),
        make("h3", e.title),
        make("p", e.stage, "notice"),
      );
      card.append(
        make("p", e.evidence),
        link(e.publisher + " · source", e.url),
      );
      if (e.published_at)
        card.append(
          make("p", "Publisher date: " + date(e.published_at), "tiny"),
        );
      if (e.scheduled_at)
        card.append(
          make(
            "p",
            e.date_precision?.startsWith("Date only")
              ? "Scheduled date: " +
                  e.scheduled_at.slice(0, 10) +
                  " · " +
                  e.date_precision
              : "Scheduled: " + date(e.scheduled_at),
            "tiny",
          ),
        );
      card.append(
        make(
          "p",
          "This watch version first recorded: " +
            date(e.first_observed_at) +
            ". A published date is not proof that this site warned at that earlier time.",
          "tiny",
        ),
      );
      const detail = make("details");
      detail.append(
        make("summary", "Possible transmission and what to verify"),
      );
      for (const id of e.categories) {
        const c = data.categories.find((x) => x.id === id);
        detail.append(make("h4", c.name));
        const chain = make("ol");
        for (const s of c.chain) chain.append(make("li", s));
        detail.append(chain);
        const checks = make("ul");
        for (const s of c.checks) checks.append(make("li", s));
        detail.append(checks);
      }
      detail.append(
        make(
          "p",
          "Potentially exposed proxies: " +
            e.tickers.join(" · ") +
            ". This is a qualitative map, not a measured loss estimate.",
          "tiny",
        ),
      );
      const ai = articles?.articles?.find((a) => a.url === e.url && a.analysis);
      if (ai) {
        detail.append(
          make("h4", "Separate AI interpretation — not verification"),
          make("p", ai.analysis.summary),
          make(
            "p",
            "Model: " + ai.model + " · Analyzed " + date(ai.analyzed_at),
            "tiny",
          ),
        );
      }
      card.append(detail);
      mount.append(card);
    }
    set(
      "risk-event-count",
      events.length +
        " current watches. " +
        Math.min(visible, events.length) +
        " shown. Absence of a watch is not a safety signal.",
    );
    document.getElementById("risk-more").hidden = visible >= events.length;
    if (target && !located) {
      const card = document.getElementById("event-" + target);
      if (card) {
        located = true;
        requestAnimationFrame(() => card.scrollIntoView({ block: "start" }));
      }
    }
  }
  function render() {
    const assessment = assess(
      { horizon: 60, region: "Global", concentration: "unknown" },
      data,
    );
    set(
      "event-risk-summary",
      (assessment.status === "limited"
        ? "Risk Watch: " + data.events.length + " selected watches. "
        : "Risk Watch: ") + assessment.message,
    );
    const leads = document.getElementById("event-risk-leads");
    if (leads) {
      leads.replaceChildren();
      for (const e of assessment.events.slice(0, 2)) {
        const p = make("p"),
          a = make("a", e.title);
        a.href = "risk.html#event-" + e.id;
        p.append(a, make("span", " · " + e.stage, "tiny"));
        leads.append(p);
      }
    }
    if (!document.getElementById("risk-events")) return;
    set(
      "risk-status",
      "Built " +
        date(data.meta.built_at) +
        " · News source check " +
        date(data.meta.source_checked_at) +
        ". Coverage is partial; this is not an all-clear.",
    );
    set(
      "risk-tracking",
      "Tracking began " +
        date(data.meta.tracking_started_at) +
        ". Records created now are not pre-election predictions. " +
        data.meta.ledger_records +
        " frozen records.",
    );
    set(
      "risk-feed-status",
      data.meta.feeds_fetched +
        " of " +
        data.meta.feeds_total +
        " configured headline feeds reported fetched. A feed can omit important stories even when retrieval succeeds.",
    );
    const feedHealth = document.getElementById("risk-feed-health");
    if (feedHealth) {
      feedHealth.replaceChildren();
      for (const h of data.feed_health || []) {
        const p = make("p", (h.name || h.id) + ": " + h.status + ". ");
        if (h.url) p.append(link("Feed", h.url));
        p.append(make("span", " · Last success: " + date(h.last_success)));
        feedHealth.append(p);
      }
    }
    const option = document.getElementById("risk-category");
    if (option.options.length === 1)
      for (const c of data.categories) {
        const n = make("option", c.name);
        n.value = c.id;
        option.append(n);
      }
    const coverage = document.getElementById("risk-coverage");
    coverage.replaceChildren();
    for (const c of data.categories) {
      const tr = make("tr");
      const th = make("th", c.name);
      th.scope = "row";
      tr.append(th, make("td", String(c.event_count)), make("td", c.coverage));
      coverage.append(tr);
    }
    const regions = document.getElementById("risk-regions");
    regions.replaceChildren();
    for (const r of data.regions) {
      const card = make("article", undefined, "risk-region");
      card.append(
        make("h3", r.name),
        make("p", r.channel),
        make("p", r.caveat, "tiny"),
      );
      regions.append(card);
    }
    const gaps = document.getElementById("risk-gaps");
    gaps.replaceChildren();
    for (const g of data.gaps) gaps.append(make("li", g));
    const calendars = document.getElementById("risk-calendar-health");
    calendars.replaceChildren();
    for (const h of data.calendar_health) {
      const p = make("p", h.id.toUpperCase() + ": " + h.status + ". ");
      p.append(link("Official calendar", h.url));
      if (h.last_success)
        p.append(
          make("span", " · Last successful retrieval " + date(h.last_success)),
        );
      calendars.append(p);
    }
    const sources = document.getElementById("risk-sources");
    sources.replaceChildren();
    for (const s of data.source_directory) {
      const li = make("li");
      li.append(
        link(s.name, s.url),
        make("span", " — " + s.scope + ". " + s.connection + "."),
      );
      sources.append(li);
    }
    renderEvents();
  }
  async function load() {
    try {
      const r = await fetch("data/risk.json", {
        cache: "no-store",
        signal: AbortSignal.timeout(20000),
      });
      if (!r.ok) throw Error("HTTP " + r.status);
      data = validateRisk(await r.json());
      render();
      if (document.getElementById("risk-events")) {
        try {
          const a = await fetch("data/intelligence.json", {
            cache: "no-store",
            signal: AbortSignal.timeout(10000),
          });
          if (a.ok) {
            articles = await a.json();
            renderEvents();
          }
        } catch {}
      }
    } catch (e) {
      document.getElementById("event-risk-leads")?.replaceChildren();
      set(
        "risk-status",
        "Risk evidence unavailable: " +
          e.message +
          ". No current safety conclusion can be made.",
      );
      set(
        "event-risk-summary",
        "Event-risk evidence is unavailable. A historical comparison is not a current-entry clearance.",
      );
    }
  }
  if (
    document.getElementById("risk-events") ||
    document.getElementById("event-risk-summary")
  ) {
    document.getElementById("risk-category")?.addEventListener("change", () => {
      visible = 6;
      renderEvents();
    });
    document.getElementById("risk-more")?.addEventListener("click", () => {
      visible += 6;
      renderEvents();
    });
    document.getElementById("risk-refresh")?.addEventListener("click", load);
    addEventListener("hashchange", () => {
      located = false;
      renderEvents();
    });
    load();
    setInterval(
      () => {
        if (!document.hidden) load();
      },
      5 * 60 * 1000,
    );
  }
})(globalThis);
