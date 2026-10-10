# Validation record

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
