# Design Department · Performance & Prediction Dashboard

One self-contained file, **`dist/dashboard.html`** (≈ 2.8 MB). Double-click it to open in Chrome, Edge, Firefox
or Safari. It works fully offline: data, JavaScript, CSS, fonts and libraries (ECharts 5.5.1, jStat 1.9.6,
SheetJS 0.18.5) are all inlined.

| Tab | What it answers |
|---|---|
| **A · Overview** | Descriptive view: KPI departure board, hours by designer, cumulative output by project type, year-to-date revenue vs cost "race", rate efficiency, regional comparison. Live filters (period, type, region, granularity, attribution). |
| **B · Hypotheses** | Six questions (experience/education/location, same-size projects, cost per planned hour, overruns, regional revenue, project type to grow), each answered in plain words with a simple standard-error test of every group against the rest. |
| **C · Prediction** | M1 project model (actual hours from planned hours, type, education, location, designer track record) and M2 trend model, feeding the 2027 forecasts: typical project cost, workload, overrun/underrun and revenue, under pessimistic / average / optimistic scenarios. |
| **D · Data** | Upload a new `.xlsx` / `.xls` / `.csv` file. A pass/fail check against the required format; on pass, every tab is recalculated. |

All statistics run in the browser on the row-level data, so filters are live and an uploaded file updates every tab.
"For analysts ▸" drawers (or **Statistics: On**) show the full tables, formulas and caveats.

## Refresh with a new data export

```bash
pip install -r requirements.txt
python build.py --input path/to/export.xlsx
```

`build.py` validates the file with the same rules as tab D (it refuses a non-conforming file with
*"The data is corrupt: the file does not match the required format. Nothing was changed."*) and writes
`dist/dashboard.html`. Libraries and fonts are read from `vendor/`; if that folder is missing they are downloaded
once from the npm registry. Every assumption is in **`config.py`** (also shown in the dashboard's
"Data & assumptions" footer).

Alternatively, load a new file directly in tab D of an existing dashboard; no rebuild is needed.

## Method in brief

- **Units.** Actual and Planned are cost in USD; hours = cost ÷ the designer's hourly rate. The rate identifies
  the designer's home location (62 South, 68 East, 74 West, 86 North); *region* always means the project's region.
- **Exclusions.** The 41 projects with Actual = 0 are left out of every ratio, test and model (1,219 remain). As
  opened projects they still count in the volume trends (M2) and workload shares (C2/C3).
- **Tab B test.** Each group against the rest: SE = s/√n (share: √(p(1−p)/n); aggregate margin %: delta method),
  SE_diff = √(SE₁² + SE₂²), t-stat = difference / SE_diff, critical value 1.96, p = 2(1 − Φ(|t|)) from the
  normal distribution, 95% CI = difference ± 1.96·SE_diff. Skewed measures (PR, cost per planned hour) are tested on
  the log scale and shown as geometric means. Groups with fewer than 30 units are shown as LIMITED DATA and not
  tested (exception: B5, 8 yearly totals per region, "indicative").
- **M1.** OLS of ln(actual hours) on ln(planned hours), type terms and the factors confirmed in tab B
  (education, location), plus an empirical-Bayes designer adjustment. Median = e^(x'b + u_d); expected value =
  median × e^(σ²/2); 80% range = e^(x'b + u_d ± 1.2816σ).
- **M2.** Straight-line or %-growth trend on yearly totals (2026 annualised), chosen by backtest; 80% prediction
  interval with the normal value 1.2816. Pessimistic = the lower of the lower bound and "growth stops" at the 2026 level.
- **Caveats.** Observational data (associations, not causes); 876 of 1,260 rows are synthetic; projects by the same
  designer are not independent, so standard errors can be optimistic.

## Repository layout

```
config.py                  every assumption (emitted as JSON for the browser)
build.py                   validate the Excel file and inline everything into dist/dashboard.html
src/                       template.html, styles.css, app.js (shared state), stats.js, analysis.js (data layer and
                           all computations), validate.js (tab D rules), tabs/tab{A,B,C,D}.js, charts/ (one file per chart)
vendor/                    ECharts, jStat, SheetJS and the woff2 fonts
data/                      Report2_extended_adjusted.xlsx (built-in data)
dist/dashboard.html        the dashboard
analysis/reference_stats.py independent Python reference of every statistic (verification only)
tests/                     verification scripts (see docs/VERIFICATION.md)
screenshots/               every section at 1440 and 1024 px from the verification run
```

## Verification

```bash
python tests/compare_engines.py                    # browser engine vs Python reference: tab B (7 filter combinations) + tab C
python tests/compare_tab_a.py                      # tab A aggregates vs reference, 3 filter combinations
python tests/make_upload_cases.py /tmp/cases       # tab D test files (built-in CSV + 12 broken files)
node tests/verify_tabD.js /tmp/cases               # tab D pass/fail gate in the browser
node tests/verify_dashboard.js /tmp/cases          # offline click-through of everything + screenshots
```

Results are in [docs/VERIFICATION.md](docs/VERIFICATION.md).
