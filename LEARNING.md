# Understand the project

The [methodology page](docs/methodology.html) contains a five-question self-check.
It shows one question at a time, lets you write an answer, then reveals an
explanation. It is not automatically graded. You must still explain the
project in your own words to your teacher; software tests cannot certify
your understanding.

## Four parts worth understanding first

1. **Data script:** fetches adjusted prices and CPI, aligns calendar months,
   computes derived indices and metrics, then replaces the JSON atomically.
   An error before replacement leaves the last good file intact.
2. **Website:** HTML supplies the page and controls; CSS makes the layout
   responsive; `app.js` loads one JSON file, calculates holding periods,
   builds the scorecard, and draws four Chart.js charts.
3. **Monthly workflow:** installs pinned dependencies, runs tests, builds data,
   and commits only changed `data.json`. It requests a Pages rebuild because
   an automated token's commit alone does not reliably publish a new Pages site.
4. **Methodology:** exact purchasing power, elapsed-calendar-time CAGR,
   observed monthly drawdowns, and nominal regime means are different concepts.
   Null means unknown; it never means zero return or zero inflation.

## Two actual mistakes caught during development

1. **Wrong expected values in a test fixture.** An early ChatGPT-written test
   expected the artificial Bitcoin regime means to be 1.2% and 1.87%. The
   test failed. Recalculating its alternating monthly returns showed the
   correct values were 0.6% and 1.07%. The fixture's assertions were corrected;
   the production formula was not changed to satisfy a wrong expected number.
2. **Assuming identical Yahoo requests produce identical JSON bytes.** Repeat
   downloads changed 834 growth-array entries by about one part per million,
   while displayed metrics stayed the same. This would have caused unnecessary
   update commits. The writer now ignores growth-only differences below a
   documented `1e-5` relative tolerance when every other field is unchanged.
   Tests confirm that larger revisions, changed metrics, and changed missing-data
   positions still replace the file.

Another important finding was a genuinely missing October 2025 CPI observation.
The author approved exact purchasing-power calculations so known endpoints
remain usable, while the unknown month stays null. This is a methodology
decision documented in the paper-comparison report, not a fabricated data fix.

## Try these checks yourself

- Bitcoin, November 2021, one year: a very deep drawdown (over 60%).
- Gold, the same dates: a smaller observed decline.
- Gold, September 2025, until latest: a warning and a real-value chart gap.
- Gold, October 2025, until latest: nominal value works, real value says No data.
- A period extending beyond the last month: a friendly error rather than a
  secretly shortened holding period.
- On a phone: the disclaimer appears near the top, inputs are large enough
  to tap, and the scorecard scrolls inside its own container.

## Additional checks from the article-AI and next-period extension

- A real small language model initially repeated article events and copied an
  uncertainty placeholder instead of explaining transmission. Those outputs
  were rejected and removed. The reader now uses a larger open-weight model,
  constrained JSON syntax and separate content-quality checks. A valid JSON
  object alone is not evidence of valid economic reasoning.
- The first draft Bitcoin issue used the scan-start timestamp, while the
  returned quote was five seconds newer. That draft was retained as explicitly
  invalidated and excluded from scoring. A new issue uses the actual time after
  quote acquisition; an anchor cannot postdate its issue. This correction does
  not rewrite the old forecast's levels or pretend it was a successful result.
