/* Selected public market-structure evidence, independently from research tools. */
(async () => {
  "use strict";
  const root = document.getElementById("structure-cards");
  if (!root) return;
  const make = (tag, text, cls) => {
    const n = document.createElement(tag);
    if (text !== undefined) n.textContent = text;
    if (cls) n.className = cls;
    return n;
  };
  const link = (label, url) => {
    const a = make("a", label);
    const u = new URL(url);
    if (u.protocol !== "https:" || u.username || u.password)
      throw Error("Invalid source URL");
    a.href = u.href;
    a.rel = "noopener noreferrer";
    a.target = "_blank";
    return a;
  };
  const value = (v) =>
    Number.isFinite(v)
      ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 }).format(v)
      : "No data";
  try {
    const response = await fetch("data/structure.json", {
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw Error("HTTP " + response.status);
    const d = await response.json();
    if (!Array.isArray(d.indicators) || !d.meta?.checked_at)
      throw Error("Invalid snapshot");
    for (const r of d.indicators) {
      const card = make("article", undefined, "structure-card");
      card.append(make("p", r.category, "eyebrow"));
      const heading = make("h3");
      heading.append(link(r.name, r.source));
      card.append(
        heading,
        make("p", value(r.value) + " " + r.unit, "structure-value"),
        make(
          "p",
          `${r.period || "No observation date"} · ${r.status}${r.stale ? " · stale / unavailable" : ""}`,
          "tiny",
        ),
      );
      card.append(make("p", r.note, "tiny"));
      if (r.error) card.append(make("p", `Source issue: ${r.error}`, "tiny"));
      const history = (r.history || []).filter((p) => Number.isFinite(p.value));
      if (history.length > 1) {
        const svg = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "svg",
        );
        svg.setAttribute("viewBox", "0 0 300 70");
        svg.classList.add("structure-spark");
        svg.setAttribute("role", "img");
        svg.setAttribute(
          "aria-label",
          `${r.name} historical trend, ${history[0].date}–${history.at(-1).date}. Last value ${value(r.value)} ${r.unit}.`,
        );
        const vals = history.map((p) => p.value),
          lo = Math.min(...vals),
          hi = Math.max(...vals);
        const path = document.createElementNS(svg.namespaceURI, "polyline");
        path.setAttribute(
          "points",
          vals
            .map(
              (v, i) =>
                `${5 + (290 * i) / (vals.length - 1)},${60 - (50 * (v - lo)) / (hi - lo || 1)}`,
            )
            .join(" "),
        );
        path.setAttribute("fill", "none");
        path.setAttribute("stroke", "currentColor");
        path.setAttribute("stroke-width", "2");
        svg.append(path);
        card.append(svg);
        const change =
          history[0].value === 0
            ? null
            : 100 * (history.at(-1).value / history[0].value - 1);
        card.append(
          make(
            "p",
            `${history.length} observations · ${history[0].date} to ${history.at(-1).date}${change !== null && r.id === "gld" ? ` · holdings change ${change.toFixed(2)}%` : ""}`,
            "tiny",
          ),
        );
        if (r.id === "gld" && Number.isFinite(history.at(-1).price_index)) {
          const first = history.find((p) => Number.isFinite(p.price_index));
          const last = history.at(-1);
          card.append(
            make(
              "p",
              `Same-source price change ${(100 * (last.price_index / first.price_index - 1)).toFixed(2)}%; holdings change ${(100 * (last.value / first.value - 1)).toFixed(2)}% over the same dated interval. This does not establish causation.`,
              "tiny",
            ),
          );
        }
      }
      card.append(
        make(
          "p",
          Number.isFinite(r.percentile)
            ? `Empirical rank over the year ending at the observation date: ${r.percentile.toFixed(1)}th percentile (${r.observations} observations).`
            : `Trailing-year percentile unavailable: ${r.observations} comparable observations; requires ≥${r.percentile_minimum || 250} spanning ≥330 days.`,
          "tiny",
        ),
      );
      root.append(card);
    }
    const dir = document.getElementById("structure-directory");
    for (const item of d.directory || []) {
      const p = make("p");
      p.append(
        link(item.name, item.url),
        make("span", ` · ${item.status}. ${item.note}`),
      );
      dir.append(p);
    }
    document.getElementById("structure-status").textContent =
      `Checked ${new Date(d.meta.checked_at).toLocaleString()} · ${d.indicators.filter((r) => r.status === "Fetched").length}/${d.indicators.length} readings fetched. ${d.meta.refresh}`;
  } catch (e) {
    document.getElementById("structure-status").textContent =
      `Market-structure data unavailable: ${e.message}. Other tools remain available; no missing value is replaced by zero.`;
  }
})();
