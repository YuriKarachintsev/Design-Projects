# Verification report

Built-in data (`Report2_extended_adjusted.xlsx`, 1,260 projects, 1,219 with Actual > 0), all sources, full period,
default controls. All checks were run from a clean build of `dist/dashboard.html`.

## 1 · Browser engine vs `analysis/reference_stats.py`

`python tests/compare_engines.py`. Every mean, SE, t-stat, p-value, coefficient, forecast, status and evidence meter
compared (p and coefficients to 3 decimals, money to the nearest unit, statuses and meters identical).

| Scenario | Values compared | Differences |
|---|---:|---:|
| Default (all sources, full period), tab B + tab C | 546 | 0 |
| Original only | 356 | 0 |
| 2023-01 … 2026-09 | 356 | 0 |
| 2020-01 … 2025-12 | 355 | 0 |
| 2018-01 … 2022-12 | 356 | 0 |
| Original only, 2024-01 … 2026-09 | 352 | 0 |
| 2021-07 … 2024-06 | 347 | 0 |

## 2 · Tab A vs reference

`python tests/compare_tab_a.py`. Hours by designer × type, cumulative revenue / cost / margin by type, YTD by
designer, cost per planned hour and earned per hour worked.

| Filters | Values | Differences | Largest abs. difference |
|---|---:|---:|---:|
| All data, start month | 156 | 0 | 7e-9 |
| Types 1-2, North + East, 2023-01 … 2026-09, spread over duration | 128 | 0 | 2e-9 |
| Types 2-4, all regions, 2019-07 … 2021-06, start month | 73 | 0 | 4e-10 |

## 3 · Tab D upload gate

`node tests/verify_tabD.js` (browser) and `python build.py --input …` (same rules).

| File | Browser | build.py |
|---|---|---|
| Template .xlsx (downloaded from the page) | loads 3 projects; all tabs open without errors | — |
| Template .csv | loads 3 projects | — |
| Built-in data exported to CSV | loads; identical results to the built-in data | builds |
| Missing column · misspelled header · empty cell · duplicate Prj ID · "System type 5" · text in Planned · Planned = 0 · bad date · mismatched Start month · unknown rate · designer with two rates · .txt file | all 12 rejected with the corrupt message, data unchanged | all 12 refused (exit code 2) |
| "Remember on this computer" + reload | uploaded data kept | — |
| Reset + reload | built-in data back | — |

## 4 · Offline click-through

`node tests/verify_dashboard.js` — Chromium, `file://`, network disabled.

67 segmented toggles, 54 select options, 16 type/region chips, 23 period presets, 8 checkboxes, play/pause, the empty
state, 12 analyst drawers opened and 12 closed, Statistics On/Off on tabs B and C, data toggle, expand/collapse,
accordion rows, 3 scenarios, 4 "Built on" chips, an upload and a reset. **Console errors: 0. Network requests: 0.**
No horizontal scrolling at 1024 or 820 px. 42 section screenshots in `screenshots/` (1440 and 1024 px).

## 5 · Sanity values

All sanity values in the prompt are reproduced, except the two below.

| Value | Prompt | Dashboard | Reason |
|---|---|---|---|
| B3: designers with ≥ 30 projects that differ from the rest | 8 of 14 | **7 of 14** | Same extremes (The Weekend 36.9, t −3.04; Stevie Wonder 77.5, t 2.93). Every definition of "the rest" tried (all other projects, other designers with ≥ 30 projects, all projects) gives 6–7. |
| M1 backtest (n = 328) | MAE 200 h, −6.1%, coverage ≈ 89% | **MAE 204 h, −5.7%, coverage 90.2%** | Plans (208 h, +22.8%) and plan × ratio (180 h, −3.6%) match exactly, and the full-data M1 matches every coefficient; the small gap is in the model refitted on ≤ 2023 data. |
| C4 average cost | ≈ 8.16M | 8.15M | Rounding: 10.40M × 0.7838 = 8.153M. |

Selected matches: B1 output High school 175k (t −2.11), Master 361k (t 2.44), North 152k (t −3.10), West 342k
(t 3.44), experience −46k per 10 years (t −1.97, p 0.049); B1 performance All together High school +33% (t 4.46),
Master +15% (t 2.28), East +20% (t 2.37), South +18% (t 2.30) → performanceFactors = [education, location];
B2 East 71 / North 70 / South 76 / West 69; B3 North 59.9 (t 3.12), South 47.1 (t −2.42); B4 by region East 15.9%
(t −2.32), South 24.0% (t 2.07); B5 East 2.31M (t 3.15), West 0.21M (t −9.64); B6 T1 20.5% (16.4–24.6%),
T3 50.2% limited → NO CLEAR GAP · WORTH WATCHING; M1 coefficients and t-stats, R² 0.70 (0.72), σ 0.717, e^(σ²/2)
1.293, range 0.40–2.51×, VIF ≤ 1.59; C1 T1 21.3k vs 23.0k (93%, 6.6–41.3k); M2 revenue 10.40M (9.72–11.08M), slope
t 12.4, CI 0.80–1.10M; C4 projects 201 (175–227); C2 114.2k h; C3 −30.1k h / −2.15M, only Jay Z, Tom Jones and
Mirey Matie overrun.
