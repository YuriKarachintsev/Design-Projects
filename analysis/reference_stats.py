"""Reference implementation of every statistic and model in the dashboard, used only for
verification. It reads the Excel file with pandas and recomputes everything with
numpy / scipy / statsmodels, independently of the browser engine (src/stats.js, src/analysis.js).

    python analysis/reference_stats.py [--input file.xlsx] [--opts '{"from":..., "to":..., "source":"original"}']
    python analysis/reference_stats.py --tab-a '{"from":..., "to":..., "types":[1,2], "regions":["North"], ...}'

Prints a JSON summary with the same keys as tests/engine_summary.js (and tests/tab_a.js).
"""
import argparse
import itertools
import json
import sys
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
import statsmodels.api as sm
from scipy import stats
from statsmodels.stats.outliers_influence import variance_inflation_factor
from statsmodels.stats.diagnostic import het_breuschpagan

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import config as C  # noqa: E402

warnings.filterwarnings("ignore")
EDUS = ["High school", "Bachelor degree", "Master degree"]
REGIONS = ["North", "East", "South", "West"]
TYPES = [1, 2, 3, 4]
LOCS = [C.LOCATION_BY_RATE[k] for k in sorted(C.LOCATION_BY_RATE)]


# ----------------------------------------------------------------------------- data
def load(path):
    df = pd.read_excel(path, sheet_name="Sheet1")
    d = pd.DataFrame({
        "id": df["Prj ID"].astype(str), "type": df["Project type"].str.extract(r"(\d)")[0].astype(int),
        "region": df["Region"], "designer": df["Designer"], "yrs": df["Years of experience"], "edu": df["Education"],
        "date": pd.to_datetime(df["Start date"]), "month": df["Start month"], "year": df["Start year"],
        "actual": df["Actual"].astype(float), "planned": df["Planned"].astype(float), "rate": df["Hourly rate"],
        "source": df["Source"] if "Source" in df else "Uploaded",
    })
    d["loc"] = d.rate.map(C.LOCATION_BY_RATE)
    d["ah"], d["ph"] = d.actual / d.rate, d.planned / d.rate
    d["pr"] = d.actual / d.planned
    t = C.ON_PLAN_TOLERANCE
    d["cls"] = np.where(d.pr > 1 + t, "Overrun", np.where(d.pr < 1 - t, "Underrun", "On plan"))
    d["exp"] = d.yrs - (C.EXPERIENCE_AS_OF - d.year)
    d["ym"] = d.year * 12 + d.month - 1
    d["rev"], d["cost"] = d.planned, d.actual
    d["zero"] = d.actual == 0
    return d.sort_values("date", kind="stable").reset_index(drop=True)


def valid(d):
    return d if C.INCLUDE_ZERO_ACTUAL else d[~d.zero]


def ref_level(rows, col, levels):
    vc = rows[col].value_counts()
    return max(levels, key=lambda l: (vc.get(l, 0), -levels.index(l)))


def realised(rows):
    return rows.ah.sum() / rows.ph.sum()


def full_years(f, t):
    return [y for y in range(C.FIRST_ANALYSIS_YEAR, C.LAST_FULL_YEAR + 1) if y * 12 >= f and y * 12 + 11 <= t]



# ----------------------------------------------------------------------------- the simple test (normal distribution)
CRIT = C.CRITICAL_VALUE


def norm_p(t):
    return float(2 * stats.norm.sf(abs(t)))


def describe(v, proportion=False):
    v = np.asarray(v, float)
    n, m = len(v), v.mean()
    se = np.sqrt(m * (1 - m) / n) if proportion else v.std(ddof=1) / np.sqrt(n)
    return n, m, se


def vs_rest(values, labels, levels, proportion=False, min_n=None):
    """Each group against the rest: SE_diff = sqrt(SE1^2 + SE2^2), t = diff / SE_diff, normal p."""
    min_n = C.MIN_N if min_n is None else min_n
    values, labels = np.asarray(values, float), np.asarray(labels, dtype=object)
    out = {}
    for l in levels:
        a, b = values[labels == l], values[labels != l]
        if not len(a):
            continue
        n, m, se = describe(a, proportion)
        if n < min_n or len(b) < 2:
            out[str(l)] = [n, float(m), None, None]
            continue
        _, mb, seb = describe(b, proportion)
        t = (m - mb) / np.sqrt(se ** 2 + seb ** 2)
        out[str(l)] = [n, float(m), float(t), norm_p(t)]
    return out


def ols_table(y, X, names):
    """OLS with ordinary SEs (statsmodels), normal p-values: {name: [b, se, t, p]}."""
    res = sm.OLS(np.asarray(y, float), np.asarray(X, float)).fit()
    b, se = np.asarray(res.params), np.asarray(res.bse)
    return res, {n: [float(b[i]), float(se[i]), float(b[i] / se[i]), norm_p(b[i] / se[i])] for i, n in enumerate(names)}


def verdict(table, coef=False):
    ps = [v[3] for v in table.values() if v[3] is not None]
    status = "CONFIRMED" if any(p < C.ALPHA for p in ps) else ("NO CLEAR GAP" if ps else "LIMITED DATA")
    mp = min(ps) if ps else np.nan
    meter = 1 if mp != mp else 5 if mp < 0.001 else 4 if mp < 0.01 else 3 if mp < 0.05 else 2 if mp < 0.10 else 1
    return {"status": status, "meter": meter}


def perf_design(rows, factors, refs=None):
    counts = {t: int((rows.type == t).sum()) for t in TYPES}
    terms = [t for t in TYPES if t != 1 and counts[t] >= C.MIN_PROJECTS]
    pooled = [t for t in TYPES if t != 1 and 0 < counts[t] < C.MIN_PROJECTS]
    refs = refs or {"edu": ref_level(rows, "edu", EDUS), "loc": ref_level(rows, "loc", LOCS)}
    eduL = [e for e in EDUS if e != refs["edu"] and (rows.edu == e).any()] if "education" in factors else []
    locL = [l for l in LOCS if l != refs["loc"] and (rows["loc"] == l).any()] if "location" in factors else []
    names = ["Intercept", "ln(planned hours)"] + [f"Type {t}" for t in terms] + [f"Education: {e}" for e in eduL] + \
            [f"Location: {l}" for l in locL] + (["Experience at start (years)"] if "experience" in factors else [])

    def X(r):
        cols = [np.ones(len(r)), np.log(r.ph.values)] + [(r.type == t).values.astype(float) for t in terms] + \
               [(r.edu == e).values.astype(float) for e in eduL] + [(r["loc"] == l).values.astype(float) for l in locL] + \
               ([r.exp.values.astype(float)] if "experience" in factors else [])
        return np.column_stack(cols)
    return names, X, pooled, refs


def fit_m1(rows, factors, refs=None):
    names, X, pooled, refs = perf_design(rows, factors, refs)
    Xm, y = X(rows), np.log(rows.ah.values)
    res, table = ols_table(y, Xm, names)
    e = pd.Series(y - Xm @ np.asarray(res.params), index=rows.index)
    g = rows.designer
    n_d, m_d = e.groupby(g).size(), e.groupby(g).mean()
    sw = ((e - e.groupby(g).transform("mean")) ** 2).sum() / (len(e) - len(n_d))
    sb = max(m_d.var(ddof=1) - sw * np.mean(1 / n_d), 1e-4)
    u = m_d * n_d / (n_d + sw / sb)
    adj = e - u.reindex(g).values
    sigma = np.sqrt((adj ** 2).sum() / (len(adj) - Xm.shape[1]))
    sst = ((y - y.mean()) ** 2).sum()
    return dict(names=names, X=X, Xm=Xm, res=res, table=table, u=u, sw=sw, sb=sb, pooled=pooled, refs=refs, y=y, sigma=sigma,
                r2=res.rsquared, adjr2=res.rsquared_adj, r2d=1 - (adj ** 2).sum() / sst, mf=np.exp(sigma ** 2 / 2))


def predict(m, rows_like, designers):
    lin = m["X"](rows_like) @ np.asarray(m["res"].params) + np.array([m["u"].get(d, 0.0) for d in designers])
    med = np.exp(lin)
    z80 = stats.norm.ppf(0.9)
    return med, med * m["mf"], med * np.exp(-z80 * m["sigma"]), med * np.exp(z80 * m["sigma"])


# ----------------------------------------------------------------------------- trend model (normal 80% PI)
def trend_fit(xs, ys, shape):
    x = np.asarray(xs, float)
    y = np.log(ys) if shape == "% growth" else np.asarray(ys, float)
    res = sm.OLS(y, sm.add_constant(x)).fit()
    a, b = res.params
    return dict(a=a, b=b, s=np.sqrt(res.ssr / res.df_resid), n=len(x), x=x, shape=shape, r2=res.rsquared, seb=res.bse[1])


def trend_fc(f, x0):
    z = stats.norm.ppf(0.9)
    se = f["s"] * np.sqrt(1 + 1 / f["n"] + (x0 - f["x"].mean()) ** 2 / ((f["x"] - f["x"].mean()) ** 2).sum())
    m = f["a"] + f["b"] * x0
    if f["shape"] == "% growth":
        return np.exp(m), np.exp(m - z * se), np.exp(m + z * se)
    return max(m, 0), max(m - z * se, 0), max(m + z * se, 0)


def m2_series(rows, metric, region=None):
    f = {"revenue": lambda r: r.rev.sum(), "cost": lambda r: r.cost.sum(), "plannedHours": lambda r: r.ph.sum(),
         "actualHours": lambda r: r.ah.sum(), "projects": lambda r: float(len(r))}[metric]
    r = rows if region is None else rows[rows.region == region]
    years = list(range(C.FIRST_ANALYSIS_YEAR, C.LAST_FULL_YEAR + 1))
    vals = [f(r[r.year == y]) for y in years]
    hist = r[r.year.between(C.FIRST_ANALYSIS_YEAR, C.LAST_FULL_YEAR)]
    share = f(hist[hist.month <= C.PARTIAL_LAST_MONTH]) / f(hist)
    est = f(r[r.year == C.PARTIAL_YEAR]) / share
    combos = []
    for start in C.TREND_FIT_START_OPTIONS:
        for shape in C.TREND_SHAPES:
            xs = [y for y in years if start <= y < C.LAST_FULL_YEAR]
            e1 = trend_fc(trend_fit(xs, [vals[years.index(y)] for y in xs], shape), C.LAST_FULL_YEAR)[0] / vals[-1] - 1
            xs2 = [y for y in years if y >= start]
            e2 = trend_fc(trend_fit(xs2, [vals[years.index(y)] for y in xs2], shape), C.PARTIAL_YEAR)[0] / est - 1
            combos.append((abs(e1) / 2 + abs(e2) / 2, start, shape, e1, e2))
    best = min(combos, key=lambda c: c[0])
    xs = [y for y in years if y >= best[1]] + [C.PARTIAL_YEAR]
    ys = [vals[years.index(y)] for y in years if y >= best[1]] + [est]
    fit = trend_fit(xs, ys, best[2])
    y0, lo, hi = trend_fc(fit, C.FORECAST_YEAR)
    t = fit["b"] / fit["seb"]
    return dict(values=vals, estimate=est, share=share, chosen=[best[1], best[2]], errLast=best[3], errPartial=best[4],
                slope=[fit["b"], fit["seb"], t, norm_p(t), fit["b"] - CRIT * fit["seb"], fit["b"] + CRIT * fit["seb"]],
                r2=fit["r2"], s=fit["s"], forecast=[y0, lo, hi], scenarios={"average": y0, "optimistic": hi, "pessimistic": min(lo, est)})


# ----------------------------------------------------------------------------- summary (same keys as tests/engine_summary.js)
def summary(d, opts):
    v = valid(d)
    f, t = opts.get("from", int(d.ym.min())), opts.get("to", int(d.ym.max()))
    rows = v[(v.ym >= f) & (v.ym <= t)]
    if opts.get("source") == "original":
        rows = rows[rows.source == "Original"]
    out = {"n_all": len(d), "n_valid": len(v), "n_zero": int(d.zero.sum()), "n_b": len(rows)}
    refs = {"edu": ref_level(rows, "edu", EDUS), "loc": ref_level(rows, "loc", LOCS)}

    # B1 output: designer-years
    years = full_years(f, t)
    prof = d.groupby("designer").agg(edu=("edu", "first"), loc=("loc", "first"), yrs=("yrs", "first"), rate=("rate", "first"))
    recs = []
    for des, p in prof.iterrows():
        for y in years:
            if y >= C.EXPERIENCE_AS_OF - p.yrs:
                recs.append(dict(designer=des, edu=p.edu, loc=p["loc"], exp=p.yrs - (C.EXPERIENCE_AS_OF - y),
                                 value=rows[(rows.designer == des) & (rows.year == y)].rev.sum()))
    U = pd.DataFrame(recs)
    _, ox = ols_table(U.value, np.column_stack([np.ones(len(U)), U.exp / 10]), ["Intercept", "Experience (per 10 years)"])
    eL, lL = [e for e in EDUS if e != refs["edu"]], [l for l in LOCS if l != refs["loc"]]
    Xa = np.column_stack([np.ones(len(U))] + [(U.edu == e).astype(float) for e in eL] + [(U["loc"] == l).astype(float) for l in lL] + [U.exp / 10])
    _, oa = ols_table(U.value, Xa, ["Intercept"] + [f"Education: {e}" for e in eL] + [f"Location: {l}" for l in lL] + ["Experience (per 10 years)"])
    ox.pop("Intercept"); oa.pop("Intercept")
    oe, ol = vs_rest(U.value, U.edu, EDUS), vs_rest(U.value, U["loc"], LOCS)
    out["b1_output"] = {"n": len(U), "education": oe, "location": ol, "experience": ox, "all": oa,
                        "verdicts": [verdict(oe), verdict(ol), verdict(ox), verdict(oa)]}

    # B1 performance
    lnpr = np.log(rows.pr.values)
    pe, pl = vs_rest(lnpr, rows.edu, EDUS), vs_rest(lnpr, rows["loc"], LOCS)
    _, px = ols_table(lnpr, np.column_stack([np.ones(len(rows)), rows.exp / 10]), ["Intercept", "Experience at start (per 10 years)"])
    px.pop("Intercept")
    names, X, _, _ = perf_design(rows, ["education", "location", "experience"], refs)
    _, pa = ols_table(np.log(rows.ah.values), X(rows), names)
    pa.pop("Intercept")
    pa_f = {k: x for k, x in pa.items() if k.split(":")[0] in ("Education", "Location") or k.startswith("Experience")}
    out["b1_perf"] = {"education": pe, "location": pl, "experience": px, "all": pa, "verdicts": [verdict(pe), verdict(pl), verdict(px), verdict(pa_f)]}
    full = valid(d)
    nF, XF, _, _ = perf_design(full, ["education", "location", "experience"])
    _, tf = ols_table(np.log(full.ah.values), XF(full), nF)
    out["performanceFactors"] = [k for k, pre in (("education", "Education"), ("location", "Location"), ("experience", "Experience"))
                                 if any(n.startswith(pre) and x[3] < C.ALPHA for n, x in tf.items())]

    # B2 / B3 / B4
    out["b2"] = {"tests": pl, **verdict(pl)}
    lc = np.log(rows.rate.values * rows.pr.values)
    b3l = vs_rest(lc, rows["loc"], LOCS)
    b3d = vs_rest(lc, rows.designer, list(pd.unique(rows.designer)))
    dd = rows.groupby("designer").agg(ah=("ah", "sum"), ph=("ph", "sum"), rate=("rate", "first"), loc=("loc", "first"), n=("pr", "size"))
    dd = dd[dd.n >= C.MIN_DESIGNER_PROJECTS]
    a_, b_ = np.log(dd.rate), np.log(dd.ah / dd.ph)
    yl = a_ + b_
    eta = 1 - sum(((g - g.mean()) ** 2).sum() for _, g in yl.groupby(dd["loc"])) / ((yl - yl.mean()) ** 2).sum()
    allv = {**{"L" + k: x for k, x in b3l.items()}, **{"D" + k: x for k, x in b3d.items()}}
    out["b3"] = {"locations": b3l, "designers": b3d, "share_perf": float(b_.var() / (a_.var() + b_.var())), "share_rate": float(a_.var() / (a_.var() + b_.var())),
                 "loc_share": float(eta), **verdict(allv)}
    over = (rows.cls == "Overrun").astype(float).values
    b4l, b4r = vs_rest(over, rows["loc"], LOCS, proportion=True), vs_rest(over, rows.region, REGIONS, proportion=True)
    out["b4"] = {"loc": b4l, "region": b4r, "verdicts": [verdict(b4l), verdict(b4r)]}

    # B5: region-year totals, each region vs the other regions' yearly totals
    U5 = pd.DataFrame([dict(region=g, value=rows[(rows.region == g) & (rows.year == y)].rev.sum()) for g in REGIONS for y in years])
    b5 = vs_rest(U5.value, U5.region, REGIONS, min_n=2) if len(years) >= 2 else {}
    v5 = verdict(b5)
    if len(years) < C.MIN_YEARS:
        v5["status"] = "LIMITED DATA"
    out["b5"] = {"years": len(years), "tests": b5, **v5}

    # B6: aggregate margin % with the delta-method SE
    def mse(g):
        A, P = g.actual.values, g.planned.values
        R = A.sum() / P.sum()
        n = len(g)
        return 1 - R, (np.sqrt(((A - R * P) ** 2).sum() / (n * (n - 1))) / P.mean()) if n > 1 else np.nan
    b6 = {}
    for t_ in TYPES:
        g, o = rows[rows.type == t_], rows[rows.type != t_]
        if not len(g):
            continue
        m, se = mse(g)
        if len(g) < C.MIN_N:
            b6[f"T{t_}"] = [len(g), float(m), float(se), None, None]
        else:
            mo, seo = mse(o)
            tt = (m - mo) / np.sqrt(se ** 2 + seo ** 2)
            b6[f"T{t_}"] = [len(g), float(m), float(se), float(tt), norm_p(tt)]
    lead = max(b6, key=lambda k: b6[k][1])
    ci = {k: (x[1] - CRIT * x[2], x[1] + CRIT * x[2]) for k, x in b6.items()}
    watching = b6[lead][3] is None and any(k != lead and ci[k][1] >= ci[lead][0] and ci[k][0] <= ci[lead][1] for k in b6)
    out["b6"] = {"tests": b6, "watching": bool(watching), **verdict({k: [x[0], x[1], x[3], x[4]] for k, x in b6.items()})}
    if opts.get("bOnly"):
        return out

    # M1
    train = v[v.year <= C.LAST_FULL_YEAR]
    m = fit_m1(train, out["performanceFactors"])
    vif = [variance_inflation_factor(m["Xm"], i) for i in range(1, m["Xm"].shape[1])]
    out["m1"] = dict(n=len(train), coefs=m["table"], r2=float(m["r2"]), adjR2=float(m["adjr2"]), r2_designer=float(m["r2d"]),
                     resSD=float(np.sqrt(m["res"].ssr / m["res"].df_resid)), sigma=float(m["sigma"]), meanFactor=float(m["mf"]),
                     range=[float(np.exp(-stats.norm.ppf(0.9) * m["sigma"])), float(np.exp(stats.norm.ppf(0.9) * m["sigma"]))],
                     sw=float(m["sw"]), sb=float(m["sb"]), vif_max=float(max(vif)), pooled=m["pooled"],
                     bp_p=float(het_breuschpagan(m["res"].resid, m["Xm"])[1]))
    tr, te = train[train.year <= C.BACKTEST_LAST_TRAIN_YEAR], train[train.year > C.BACKTEST_LAST_TRAIN_YEAR]
    mb = fit_m1(tr, out["performanceFactors"], m["refs"])
    _, mean_, lo_, hi_ = predict(mb, te, te.designer.values)
    act = te.ah.values

    def met(p, lo=None, hi=None):
        e = p - act
        return dict(mae=float(np.abs(e).mean()), mdape=float(np.median(np.abs(e) / act)), bias=float(p.sum() / act.sum() - 1),
                    coverage=float(((act >= lo) & (act <= hi)).mean()) if lo is not None else None, n=len(act))
    out["backtest"] = dict(n=len(te), plans=met(te.ph.values), ratio=met(te.ph.values * realised(tr)), m1=met(mean_, lo_, hi_))
    # C1
    c1 = []
    for t_ in TYPES:
        g = train[train.type == t_]
        if not len(g):
            continue
        ph = g.ph.median()
        pool = v[(v.type == t_) & v.year.between(C.USUAL_MIX_FIRST_YEAR, C.LAST_FULL_YEAR)]
        if not len(pool):
            pool = v[v.type == t_]
        w = pool.designer.value_counts() / len(pool)
        probe = pd.DataFrame({"ph": ph, "type": t_, "edu": prof.loc[w.index].edu.values, "loc": prof.loc[w.index]["loc"].values,
                              "exp": (prof.loc[w.index].yrs - (C.EXPERIENCE_AS_OF - C.FORECAST_YEAR)).values})
        _, mn_, lo_, hi_ = predict(m, probe, list(w.index))
        rate = prof.loc[w.index].rate.values
        cost, plan = (w.values * mn_ * rate).sum(), (w.values * ph * rate).sum()
        c1.append(dict(type=t_, plannedH=float(ph), hours=float((w.values * mn_).sum()), cost=float(cost), plan=float(plan), pct=float(cost / plan),
                       lo=float((w.values * lo_ * rate).sum()), hi=float((w.values * hi_ * rate).sum()), benchmark=float(plan * realised(g))))
    out["c1"] = c1
    # M2, C4, C2/C3
    vol = d if C.ZERO_ACTUAL_IN_VOLUMES else v
    M2 = {k: m2_series(vol, k) for k in ["revenue", "cost", "plannedHours", "actualHours", "projects"]}
    out["m2_revenue"] = M2["revenue"]
    out["m2_chosen"] = {k: s["chosen"] + s["forecast"] for k, s in M2.items()}
    last = v[v.year.between(C.LAST_FULL_YEAR - C.COST_RATIO_YEARS + 1, C.LAST_FULL_YEAR)]
    ratio = last.cost.sum() / last.rev.sum()
    out["c4"] = {"ratio": float(ratio), "scenarios": {k: dict(revenue=M2["revenue"]["scenarios"][k], cost=M2["revenue"]["scenarios"][k] * ratio,
                 margin=M2["revenue"]["scenarios"][k] * (1 - ratio), marginPct=1 - ratio, projects=M2["projects"]["scenarios"][k]) for k in ["pessimistic", "average", "optimistic"]}}
    cr = train.groupby("designer").agg(ah=("ah", "sum"), ph=("ph", "sum"), n=("ah", "size"))
    dept = train.ah.sum() / train.ph.sum()
    wgt = cr.n / (cr.n + C.SHRINK_K_PROJECTS)
    prs = wgt * cr.ah / cr.ph + (1 - wgt) * dept
    sh = vol[vol.year.between(C.WORKLOAD_SHARE_FIRST_YEAR, C.PARTIAL_YEAR)].groupby(["designer", "region"]).ph.sum()
    sh = sh / sh.sum()
    P = M2["plannedHours"]["scenarios"]["average"]
    cells = pd.DataFrame({"planned": P * sh})
    dn = cells.index.get_level_values(0)
    cells["prs"] = prs.reindex(dn).fillna(dept).values
    cells["rate"] = prof.rate.reindex(dn).values
    cells["actual"] = cells.planned * cells.prs
    cells["var"] = cells.planned * (cells.prs - 1)
    out["c2"] = dict(planned=P, actual=float(cells.actual.sum()), byRegion={r: float(cells.actual.xs(r, level=1).sum()) for r in REGIONS})
    byd = cells["var"].groupby(level=0).sum()
    out["c3"] = dict(hours=float(cells["var"].sum()), money=float((cells["var"] * cells.rate).sum()),
                     byRegion={r: float(cells["var"].xs(r, level=1).sum()) for r in REGIONS}, overrun={k: float(x) for k, x in byd[byd > 0].items()})
    return out


# ----------------------------------------------------------------------------- tab A
def allocation(r, mode):
    if mode != "spread":
        return [(r.ym, 1.0)]
    weeks = r.ph / (C.HOURS_PER_WEEK * C.PROJECT_ALLOCATION)
    months = max(weeks * 7 / (365.25 / 12), 1e-9)
    out, left, m = [], months, r.ym
    while left > 1e-9:
        fr = min(1.0, left)
        out.append((m, fr / months))
        left -= fr
        m += 1
    return out


def tab_a(d, f):
    v = valid(d)
    rows = v[v.type.isin(f["types"]) & v.region.isin(f["regions"])]
    mode, lo, hi = f.get("attribution", "start"), f["from"], f["to"]
    w = []
    for r in rows.itertuples():
        for m, wt in allocation(r, mode):
            w.append((r.Index, m, wt))
    W = pd.DataFrame(w, columns=["idx", "ym", "w"]).merge(rows, left_on="idx", right_index=True, suffixes=("_a", ""))
    W["ym"] = W["ym_a"]
    P = W[(W.ym >= lo) & (W.ym <= hi)]
    hours = P.assign(h=P.ah * P.w).groupby(["designer", "type"]).h.sum()
    a1 = {des: {str(t): float(hours[des].get(t, 0)) for t in TYPES if t in hours[des].index} for des in hours.index.get_level_values(0).unique()}
    cum = {}
    for t in TYPES:
        s = P[P.type == t]
        cum[str(t)] = dict(rev=float((s.rev * s.w).sum()), cost=float((s.cost * s.w).sum()), margin=float(((s.rev - s.cost) * s.w).sum()))
    yr, mt = hi // 12, hi % 12 + 1
    Y = W[(W.ym // 12 == yr) & (W.ym % 12 + 1 <= mt)]
    ytd = Y.assign(r_=Y.rev * Y.w, c_=Y.cost * Y.w).groupby("designer")[["r_", "c_"]].sum()
    started = rows[(rows.ym >= lo) & (rows.ym <= hi)]
    g = started.groupby("designer").agg(ah=("ah", "sum"), ph=("ph", "sum"), rate=("rate", "first"))
    return dict(a1=a1, a2=cum, a3={k: dict(rev=float(x.r_), cost=float(x.c_)) for k, x in ytd.iterrows()},
                a5={k: dict(cpph=float(x.rate * x.ah / x.ph), earned=float(x.rate / (x.ah / x.ph))) for k, x in g.iterrows()})


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", default=str(ROOT / "data" / "Report2_extended_adjusted.xlsx"))
    ap.add_argument("--opts", default="{}")
    ap.add_argument("--tab-a")
    a = ap.parse_args()
    d = load(a.input)
    res = tab_a(d, json.loads(a.tab_a)) if a.tab_a else summary(d, json.loads(a.opts))
    print(json.dumps(res, indent=1, default=lambda o: o.item() if hasattr(o, "item") else str(o)))


if __name__ == "__main__":
    main()
