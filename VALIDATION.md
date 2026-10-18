# Validation record

## Article AI and next-period scenarios — 2026-10-18 UTC

This section supersedes the earlier headline-only scope, refresh cadence and
test counts below. Historical paper-comparison and student checks still apply.

- **45 Python tests**, **18 JavaScript tests**, and **18 real Chromium
  scenarios locally plus 18 against the public HTTPS site** passed. Browser
  coverage includes actual model output and short evidence quotes, five-asset
  scenario values, diagnostics and pending-ledger display, missing-AI recovery,
  the original tools and charts, news filters, quiz and 390px mobile layout.
  The public check uses actual remote responses through verified system TLS;
  Chart.js passes the pinned SHA-384 check. No certificate checks were disabled.
- [Today → Tomorrow](https://ethanli0831.github.io/RealWorth/#outlook) and
  [News & Impact Chains](https://ethanli0831.github.io/RealWorth/#news) are live.
  The [Chinese website guide](USER_GUIDE.zh-CN.md), README and methodology
  explain the distinction between headline templates, actual model hypotheses
  and statistical price bands. Neither evidence links nor passing software
  tests certify an economic interpretation as correct.
- The real inference backend is **Qwen2.5-7B-Instruct-GGUF**, Q4_K_M through
  llama.cpp, model revision `bb5d59e06d9551d752d08b292a50eb208b07ab1f`.
  GitHub Models did not return usable model JSON in this environment; the
  open-weight CPU fallback actually ran. The initial
  [production inference run](https://github.com/Ethanli0831/RealWorth/actions/runs/39084836867)
  succeeded, and later
  [scheduled inference](https://github.com/Ethanli0831/RealWorth/actions/runs/39123969397)
  also succeeded. No user API key is required.
- At **11:48:03 UTC**, the public AI snapshot contained **10 article reads and
  5 retained interpretations**, including cached interpretations awaiting a
  re-read. Other articles were queued or explicitly rejected. The reader
  respects source allowlists and robots/paywall constraints; the historical
  CERN page was unavailable to this reader and was not represented as a
  current AI finding. Selected public articles do not cover every headline,
  paid bank report or the whole Internet.
- Model records expose source URLs, publication/read/analysis times, body
  hashes, model revision, short actual source fragments and context length.
  At most 4,500 article characters are supplied to each model call; full
  publisher bodies are not published. Schema and semantic checks reject
  placeholders, unrelated summaries, unsupported numeric claims and missing
  financial channels. Conditional gold/Bitcoin hypotheses remain fallible;
  the model is not an independent fact checker. Earlier small-model outputs
  that copied examples or invented automatic safe-haven effects were withdrawn.
  Inference slots rotate to avoid repeated rejections starving other articles;
  an existing unit test checks that queue property.
- **All three update workflows have actually run on their schedules**:
  [monthly research](https://github.com/Ethanli0831/RealWorth/actions/runs/39118886945),
  [news and observed quotes](https://github.com/Ethanli0831/RealWorth/actions/runs/39137986529),
  and the scheduled article inference linked above. Configured cadence is
  monthly on the 18th at 06:00 UTC, quote/news scans at minutes 7/22/37/52,
  and article AI at minute 29. **These are scheduling requests, not real-time
  guarantees:** observed GitHub delays on this date included several hours
  between runs. Visible pages poll published quote/AI snapshots every minute
  and research snapshots every five minutes; polling cannot create fresh data
  before a scheduled job finishes. Source errors preserve dated old data.
- Five assets have lower/central/upper **empirical price-only scenarios** from
  252 matching-horizon historical log returns. These are not AI price targets
  or guaranteed probabilities. GLD is an ETF share price, not spot gold per
  ounce. Bitcoin uses a frozen quote-to-24-hour target; ETF horizons use the
  first actual exchange close on or after tomorrow, including weekends,
  holidays and one/two-session matching. Walk-forward diagnostics use only
  outcomes available at each historical origin and compare against a no-change
  baseline. Overlapping outcomes are correlated and do not prove an edge.
- Issued levels/digests were compared across quote refreshes and stayed frozen.
  At **14:53:30 UTC**, the ledger retained **6 pending forecasts and 1 explicitly
  invalidated initial draft**, with **0 prospectively verified outcomes**.
  The invalid draft used an issue timestamp preceding its returned quote by
  five seconds; it was retained as invalid and excluded from scoring.
  The earliest valid Bitcoin target is October 18 at 23:45 UTC; another issue
  targets October 19 at 06:35 UTC. The four ETF records target October 19 at
  20:00 UTC. Later observations, not backfilled guesses, will determine errors.
- The monthly dataset is through **September 2026**. Original approximate
  paper replication still has **0/11** within-tolerance results under the
  author's approved independent exact method; no claim of replication is made.
  The student's physical-phone check and personal quiz answers remain human
  tasks; responsive Chromium checks and the interactive quiz are provided.

### Cloud environment refresh

The restored environment initially lacked `beautifulsoup4` and
`exchange-calendars`. Installing the existing pinned `requirements-dev.txt`
resolved that setup defect. The complete installation script then passed all
45 Python, 18 JavaScript and 18 local browser checks. The virtualenv HTTP
startup command was started/stopped twice and served the actual dashboard and
all five JSON endpoints successfully. No application source was changed for
onboarding. Python 3.12, Node 24 and system Chromium were used locally; the
successful GitHub runner uses Python 3.11.

Updated complete `install_script` and `start_skill` fields were saved to the
cloud configuration draft, preserving network and credential settings. The
startup instructions cover the new datasets, all tests and separate optional
model-runtime requirements. Heavy model weights were not installed locally;
inference was verified on GitHub's runner. **Saving this draft does not publish
the environment.** Review/save the cloud environment settings and publish the
environment to activate the reusable configuration; fresh-task restoration of
this revision has not been independently verified. This is separate from the
already deployed public website.

## Economic-weather and news extension — 2026-10-17

- **29 Python tests**, **15 JavaScript tests** and **15 Chromium functional
  scenarios** passed. The browser checks also passed against the public HTTPS
  site using verified system TLS transport. Added coverage includes the ten
  macro rows, bank/journalism filters, headline search, mechanism chains,
  preserving an open chain on refresh, mobile layout, missing research data,
  stale macro warnings and safe display of HTML-like publisher titles.
- [Economic Weather](https://ethanli0831.github.io/RealWorth/#weather) and
  [News & Impact Chains](https://ethanli0831.github.io/RealWorth/#news) are live.
  The [reading directory](https://ethanli0831.github.io/RealWorth/#research-sources)
  contains 18 sources, including eight banks, Bridgewater, Dalio, journalism
  and primary institutions. Client/subscription restrictions are labelled.
- The [corrected research update](https://github.com/Ethanli0831/RealWorth/actions/runs/39077565321)
  succeeded, downloaded all ten FRED series, committed only research.json and
  requested Pages rebuilding. The [monthly updater](https://github.com/Ethanli0831/RealWorth/actions/runs/39077565293)
  also succeeded with the expanded tests. The [resulting Pages deployment](https://github.com/Ethanli0831/RealWorth/actions/runs/39077613384)
  succeeded.
- The initial runner timed out on FRED requests with a short read timeout and
  custom request shape. Matching the existing monthly builder's request shape,
  increasing the read timeout and reducing concurrency resolved that issue.
  Macro-only local refreshes preserve news scan timestamps.
- At the recorded scan, **26 headlines** were retained and **5/6 feeds**
  fetched successfully. CNBC's new request failed, so 15 previously retrieved
  headlines retained their original dates and explicit cached labels. This is
  partial coverage, not a claim of complete news monitoring.
- Current observed weather was **growth slowing / inflation rising**. The
  short-cycle label explicitly reports an unavailable labour baseline. Private
  credit/GDP is dated 2025Q4 and is flagged stale. The model makes no full
  long-term debt-cycle determination or calibrated forecast.
- The CERN lead-to-gold primary page was retrieved. Its short excerpt supports
  a laboratory nuclear-transmutation case, not a demonstrated commercial gold
  supply shock. A separate French announcement remains unconfirmed. The case
  is labelled historical, and gold-to-Bitcoin substitution remains conditional.
- Hourly scans are scheduled at minute 17 UTC; visible pages check published
  snapshots every five minutes. Publisher and GitHub queue delays apply.
  Headline matching uses transparent templates rather than full-article AI
  analysis, and does not verify causal effects or predict prices.

The original paper-comparison and human-check limitations below remain.

## Current-instance checks — 2026-10-10

- Python: **20 tests passed**, none skipped or expected failures.
- JavaScript: **10 tests passed**, none skipped or expected failures.
- Chromium: **11 functional scenarios passed** using actual Chart.js and
  the derived dataset: all four charts, calculator, exact scorecard values,
  regime toggle, desktop and 390px mobile layout, quiz, missing JSON, unavailable
  CDN, unknown current regime, and CPI-gap handling.
- Real-data historical run through December 2025 succeeded. October 2025 CPI
  is null; real growth resumes in November without filling the gap.
- Two consecutive latest-data runs succeeded. The second reported Unchanged.
  Dataset covers August 2026, the last CPI month returned by FRED during setup.
- Bitcoin November 2021–November 2022 observed real drawdown is about −71.89%;
  gold is about −18.82% under the approved exact-return formula.
- [Paper comparison](PAPER_COMPARISON.md): **0/11** original within-0.01 checks
  match. The independent exact method was approved by the author; this project
  does not claim exact paper replication.

## Deployment

- All implementation stages were committed separately and pushed to
  [main](https://github.com/Ethanli0831/RealWorth/tree/main).
- GitHub's Python 3.11 runner successfully installed the pinned dependencies,
  passed 20 Python and 10 JavaScript tests, and downloaded the real dataset.
  [Current-version push run](https://github.com/Ethanli0831/RealWorth/actions/runs/38082246509)
  succeeded.
- Two consecutive manual updates succeeded:
  [first](https://github.com/Ethanli0831/RealWorth/actions/runs/38082328304)
  and [second](https://github.com/Ethanli0831/RealWorth/actions/runs/38082537872).
  The remote main SHA remained
  `763a36b3489ae8e9fb29c03fbcdc50059be13d5d` before and after both runs.
  Neither run created an unnecessary data commit; the second skipped the
  Pages rebuild because its data was unchanged.
- **Public hosting is complete.** The owner enabled **Deploy from a branch →
  main → /docs**. GitHub reports Pages status `built`, and the
  [initial Pages deployment](https://github.com/Ethanli0831/RealWorth/actions/runs/38091297269)
  succeeded. The earlier token creation request failed with HTTP 403; owner
  activation resolved that blocker.
- [The live website](https://ethanli0831.github.io/RealWorth/) returned HTTPS
  200 for the index, methodology, JSON, JavaScript and CSS. All five responses
  exactly matched their committed files.
- **11 real Chromium scenarios passed against the public site**, including
  all four Chart.js charts, calculator, exact scorecard values, inflation
  toggle, mobile layout, quiz and graceful error states. Actual remote HTTPS
  responses were fetched with Python's verified system TLS before routing
  into Chromium because the cloud browser does not trust the proxy's CA.
  Certificate checks remained enabled; no local site files substituted for
  remote content. Official CDN bytes also passed the pinned SHA-384 check.

## Cloud environment

The complete saved installation script was executed successfully in the
virtual environment: pinned development dependencies, 20 Python tests,
10 JavaScript tests and 11 Chromium scenarios. The virtualenv HTTP server
startup command was separately verified against the dashboard and five-asset
JSON. Reusable installation and startup instructions were saved to the cloud
configuration draft. Saving a draft does not publish it; the owner must review
and save its environment settings, then publish the environment for reuse.

## Homework completion

| Requirement | Outcome |
| --- | --- |
| Data pipeline, retry and safe JSON writes | Implemented and verified locally and on GitHub. |
| Original paper values within 0.01 | **0/11 pass**; original replication criterion is unmet under the approved independent exact methodology. |
| Three interactive dashboard tools | Implemented; real-browser and mobile viewport checks passed. |
| Per-stage Git commits | Created and pushed. |
| Scheduled monthly refresh and two manual runs | Configured; both manual runs passed without redundant commits. |
| GitHub Pages main /docs and a working public site | Complete; deployment succeeded, public HTTPS checks and 11 browser scenarios passed. |
| README, methodology, MIT licence and screenshot | Complete. |
| Sources, limitations and failure guidance | Documented. |
| Quiz and two mistakes | Quiz and actual development mistakes documented; student answers remain a human task. |
| Student's physical-phone check | Pending; responsive Chromium checks passed. |

## Human checks

The responsive layout was tested in Chromium, not on the student's physical
phone. The [learning guide](LEARNING.md) and interactive methodology quiz are
provided. Student understanding is not automatically graded or certified.
