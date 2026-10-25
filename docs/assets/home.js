(async () => {
  try {
    const r = await fetch("data/data.json");
    if (!r.ok) throw Error("Data unavailable");
    const d = await r.json();
    document.getElementById("hero-drawdown").textContent =
      d.scorecard.Bitcoin.max_drawdown.toFixed(2) + "%";
    document.getElementById("data-stamp").textContent =
      "Monthly research through " +
      d.meta.data_through +
      " · Updated " +
      d.meta.last_updated;
  } catch {
    document.getElementById("data-stamp").textContent =
      "Monthly data unavailable. Source and failure details remain on the research pages.";
  }
})();
