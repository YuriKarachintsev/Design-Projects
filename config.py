"""Every assumption used by the dashboard. build.py emits these as JSON for the browser,
and the "Data & assumptions" footer note shows the current values."""

VALUES_ARE = "cost"          # Actual / Planned are cost in CURRENCY; hours = value / Hourly rate
CURRENCY = "USD"
LOCATION_BY_RATE = {62: "South", 68: "East", 74: "West", 86: "North"}  # designer home location
EXPERIENCE_AS_OF = 2026      # "Years of experience" is measured as of this year

EXTRACT_DATE = "2026-10-28"
LAST_FULL_YEAR = 2025
PARTIAL_YEAR = 2026          # Jan-PARTIAL_LAST_MONTH only
PARTIAL_LAST_MONTH = 9
FORECAST_YEAR = 2027
FIRST_ANALYSIS_YEAR = 2018   # first full calendar year in the data (2017 starts in June)

INCLUDE_ZERO_ACTUAL = False  # projects with Actual = 0 (cancelled / not booked) are left out of every
                             # ratio, test, model and of tab A
ZERO_ACTUAL_IN_VOLUMES = True  # ...but they are opened projects, so they count in the volume trends of
                               # M2 (projects, revenue, planned hours) and in the C2/C3 workload shares

HOURS_PER_WEEK = 40
PROJECT_ALLOCATION = 0.8

ON_PLAN_TOLERANCE = 0.05
ALPHA = 0.05
EXPERIENCE_BANDS = [0, 10, 20, 99]

MIN_PROJECTS = 10
MIN_DESIGNERS = 3
MIN_YEARS = 3
MIN_DESIGNER_PROJECTS = 5

BOOTSTRAP_N = 4000
RANDOM_SEED = 2026
SHRINK_K_PROJECTS = 10

TREND_FIT_START_OPTIONS = [2018, 2020]
TREND_SHAPES = ["straight line", "% growth"]

BACKTEST_LAST_TRAIN_YEAR = 2023   # M1 backtest: train <= this, test the following years up to LAST_FULL_YEAR
USUAL_MIX_FIRST_YEAR = 2023       # C1 "usual mix" = allocation of the type over this year .. LAST_FULL_YEAR
WORKLOAD_SHARE_FIRST_YEAR = 2024  # C2/C3 split = planned-hour shares over this year .. PARTIAL_YEAR
COST_RATIO_YEARS = 3              # C4 cost = revenue x cost/revenue of the last N full years

MAX_UPLOAD_MB = 10
MAX_UPLOAD_ROWS = 50000
