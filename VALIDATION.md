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

Source, branch-based GitHub Pages and Actions are being configured after local
checks. Remote run IDs and live verification results will be recorded here
after completion; local checks alone do not prove deployment.

## Human checks

The responsive layout was tested in Chromium, not on the student's physical
phone. The [learning guide](LEARNING.md) and interactive methodology quiz are
provided. Student understanding is not automatically graded or certified.
