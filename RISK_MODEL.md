# Event Risk Watch

[Public tool](https://ethanli0831.github.io/RealWorth/risk.html)

This is a transparent, partial event-risk research screen. It cannot consider
all factors, predict election outcomes, certify legal interpretation, or produce
a calibrated crash probability. It does not backdate a new warning to the date
of an old article. Tracking begins with the first generated record in the ledger.

## What the upgrade connects

- Fourteen categories: elections/policy, AI regulation, AI economics, trade,
  rates/inflation, credit, energy, geopolitics, earnings, currencies, leverage,
  commodity supply, growth/employment and crypto access/custody.
- Nine configured headline feeds, adding BBC Technology, Guardian Technology
  and Guardian US Politics to the existing six. Retrieval success and source
  coverage are different; important reports can still be missed.
- Headline routes now admit policy/AI/trade stories into the existing selected
  public-article AI workflow. Real model output remains separate from the risk
  templates, and neither is independent verification or a numerical price target.
- Explicit possible transmission to the US, Japan, South Korea, Taiwan, China
  and Europe. These are qualitative channels, not country-index loss forecasts.
- Primary-source reference links for election verification, issuer filings,
  export controls, AI legal texts and regional central banks. References marked
  manual are not presented as automated data connections.

A reported proposal does not become an enacted law. Headline adoption wording
is labelled unverified until a reader checks the primary legal text. No political
party is treated as automatically negative for every asset. AI commercial value
is assessed separately from a fair share valuation; a loss in market capitalization
is not a cash balance that must be invested in another country.

## Calendar retrieval

The builder attempts the official Federal Reserve FOMC HTML calendar and BLS
release iCalendar. Only recognizable, explicit dates are accepted. BLS CPI and
employment entries require a known timezone. FOMC final meeting days are explicitly
date-only; a decision time is not inferred. Date-only entries stay visible during
that day. Current watches include dates within 45 days; the money-purpose review
uses the next 72 hours, not a claim about the direction of the release surprise.

Failed or changed formats retain their original last-success date and are
marked unavailable. Cached calendars do not become fresh official events. The
absence of a parsed date is not evidence that no release is scheduled. Elections,
court rulings and new legal enactments are not comprehensively ingested calendars.

## How user guidance changes

The original six required money-purpose answers remain. Concentration and region
selectors default to unknown/global and do not collect account holdings. All answers
stay in browser memory. The original capital, borrowing, emergency-reserve,
spending-currency, horizon and historical-evidence constraints still apply.

A fresh, relevant headline watch from the last seven days, or an official release
in the next 72 hours, can require additional review for a short deadline (at most
12 months) or declared AI/regional concentration. Routine rate/growth/currency
headlines require additional surprise/disruption wording before this gate. This
routing remains a disclosed heuristic, not an estimate of surprise magnitude.

For potentially affected asset proxies that otherwise passed the historical
screen, the result becomes **Event-risk review needed before adding exposure**.
The UI links to the exact watches and does not show an exposure-budget illustration
for those paused comparisons. Unaffected alternatives can remain research options.
A specific debt-ceiling/Treasury-default watch can affect BIL too; it is not
assumed immune. Existing positions are not automatically ordered sold.

Diversified long-term money can remain worth researching with an explicit event
caveat. Missing, malformed, stale (over 48 hours), future-clock or entirely
unretrieved headline evidence gives an unavailable/unknown current-event result.
It does not convert historical fit into an entry clearance. Unknown concentration
is identified as an assessment gap. Non-USD local purchasing power and portfolio
weights/correlations are not calculated.

The next-period forecast engine is unchanged. Its historical price ranges are
not event-conditioned and can be exceeded by a new policy or earnings surprise.

## Files, refresh and integrity

- `research/risk-framework.json`: disclosed categories, channels and checks.
- `scripts/build_risk.py`: builds `docs/data/risk.json` and
  `docs/data/risk-ledger.json` from attributed evidence and attempted calendars.
- `docs/assets/risk.js`: validates/renders evidence and supplies the review gate.
- `docs/assets/guidance.js`: applies the gate after the original suitability rules.
- `.github/workflows/update-research.yml`: runs the risk builder after news/quotes
  on the existing scheduled/manual update. Only successful generated outputs
  are committed; a risk-build failure fails the job before its data commit.

Run after the news builder:

```sh
python scripts/build_research.py
python scripts/build_risk.py
```

`--no-calendar-fetch` keeps retrieval explicitly unavailable for offline work.
Never edit generated watch or ledger records by hand. Frozen records include the
first observation time, exact snapshot and SHA-256 digest. An unchanged record
is reused; changed content creates a new record. Unchanged ledgers do not acquire
a new timestamp simply because the job ran. A corrupt retained record fails the
build before output writes. Repository history supplies further version evidence;
a digest is not independent trusted timestamp certification or proof a user saw
an alert. The ledger is append-only; monitor its size as the history grows.

## Verification

Python tests cover first-observation time, append-only records, corruption and
no-overwrite behavior, proposal wording, source failures, calendar year/timezone
parsing and relevant headline routing. JavaScript tests cover the review gate,
regional limits, missing evidence and priority of capital-protection constraints.
Real-browser scenarios cover source links, concentration changes, evidence failure,
price-card linkage, all page layouts and English-only output.
