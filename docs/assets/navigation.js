(() => {
  const routes = {
    calculator: "purchasing-power.html",
    scorecard: "research.html",
    regime: "research.html",
    weather: "research.html",
    "research-sources": "research.html",
    news: "monitor.html",
    outlook: "monitor.html",
    "market-structure": "monitor.html",
  };
  function legacy() {
    const key = location.hash.slice(1);
    if (
      (location.pathname.endsWith("/") ||
        location.pathname.endsWith("/index.html")) &&
      routes[key]
    )
      location.replace(routes[key] + location.hash);
  }
  legacy();
  addEventListener("hashchange", legacy);
  for (const a of document.querySelectorAll("nav > a"))
    if (new URL(a.href).pathname === location.pathname)
      a.setAttribute("aria-current", "page");
})();
