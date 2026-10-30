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
from statsmodels.stats.multitest import multipletests
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


def kw(groups):
    g = [np.asarray(x, float) for x in groups if len(x) > 0]
    if len(g) < 2:
        return np.nan
    try:
        return float(stats.kruskal(*g).pvalue)
    except ValueError:
        return 1.0


def ref_level(rows, col, levels):
    vc = rows[col].value_counts()
    return max(levels, key=lambda l: (vc.get(l, 0), -levels.index(l)))


def realised(rows):
    return rows.ah.sum() / rows.ph.sum()


def full_years(f, t):
    return [y for y in range(C.FIRST_ANALYSIS_YEAR, C.LAST_FULL_YEAR + 1) if y * 12 >= f and y * 12 + 11 <= t]


# ----------------------------------------------------------------------------- models
def cluster_ols(y, X, groups):
    res = sm.OLS(y, X).fit(cov_type="cluster", cov_kwds={"groups": pd.factorize(groups)[0]}, use_t=True)
    return res


def wald_p(res, names, prefix, G):
    idx = [i for i, n in enumerate(names) if n.startswith(prefix)]
    if not idx:
        return np.nan
    b = np.asarray(res.params)[idx]
    V = np.asarray(res.cov_params())[np.ix_(idx, idx)]
    F = b @ np.linalg.solve(V, b) / len(idx)
    df2 = G - 1 if G else res.df_resid
    return float(stats.f.sf(F, len(idx), df2))


def perf_design(rows, factors, refs=None):
    counts = {t: int((rows.type == t).sum()) for t in TYPES}
    base = max(TYPES, key=lambda t: counts[t])
    terms = [t for t in TYPES if t != base and counts[t] >= C.MIN_PROJECTS]
    pooled = [t for t in TYPES if t != base and 0 < counts[t] < C.MIN_PROJECTS]
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
    res = cluster_ols(y, Xm, rows.designer.values)
    e = pd.Series(y - Xm @ np.asarray(res.params), index=rows.index)
    g = rows.designer
    n_d, m_d = e.groupby(g).size(), e.groupby(g).mean()
    sw = ((e - e.groupby(g).transform("mean")) ** 2).sum() / (len(e) - len(n_d))
    sb = max(m_d.var(ddof=1) - sw * np.mean(1 / n_d), 1e-4)
    u = m_d * n_d / (n_d + sw / sb)
    adj = e - u.reindex(g).values
    sst = ((y - y.mean()) ** 2).sum()
    return dict(names=names, X=X, Xm=Xm, res=res, u=u, sw=sw, sb=sb, adj=adj.values, pooled=pooled, refs=refs,
                r2=res.rsquared, r2d=1 - (adj ** 2).sum() / sst, smear=np.exp(adj).mean(),
                q10=np.quantile(adj, 0.1), q90=np.quantile(adj, 0.9), y=y)


def predict(m, rows_like, designers):
    lin = m["X"](rows_like) @ np.asarray(m["res"].params) + np.array([m["u"].get(d, 0.0) for d in designers])
    med = np.exp(lin)
    return med, med * m["smear"], med * np.exp(m["q10"]), med * np.exp(m["q90"])


# ----------------------------------------------------------------------------- bootstrap (same generator as the browser)
def mulberry32(seed, count):
    k = np.arange(1, count + 1, dtype=np.uint64)
    a = (np.uint64(seed) + k * np.uint64(0x6D2B79F5)) & np.uint64(0xFFFFFFFF)
    M = np.uint64(0xFFFFFFFF)
    imul = lambda x, y: (x * y) & M
    t = imul(a ^ (a >> np.uint64(15)), a | np.uint64(1))
    t = ((t + imul(t ^ (t >> np.uint64(7)), t | np.uint64(61))) & M) ^ t
    return ((t ^ (t >> np.uint64(14))) & M).astype(np.float64) / 4294967296.0


def boot_margin(g):
    n = len(g)
    u = mulberry32(C.RANDOM_SEED, n * C.BOOTSTRAP_N).reshape(C.BOOTSTRAP_N, n)
    idx = np.floor(u * n).astype(int)
    rev, cost = g.rev.values[idx].sum(1), g.cost.values[idx].sum(1)
    bs = (rev - cost) / rev
    return [float(np.quantile(bs, 0.05)), float(np.quantile(bs, 0.95))]


# ----------------------------------------------------------------------------- trend model
def trend_fit(xs, ys, shape):
    x = np.asarray(xs, float)
    y = np.log(ys) if shape == "% growth" else np.asarray(ys, float)
    b, a = np.polyfit(x, y, 1)
    res = y - (a + b * x)
    n = len(x)
    s = np.sqrt(res @ res / (n - 2))
    return dict(a=a, b=b, s=s, n=n, x=x, y=y, shape=shape, r2=1 - res @ res / ((y - y.mean()) ** 2).sum())


def trend_fc(f, x0):
    t = stats.t.ppf(0.9, f["n"] - 2)
    se = f["s"] * np.sqrt(1 + 1 / f["n"] + (x0 - f["x"].mean()) ** 2 / ((f["x"] - f["x"].mean()) ** 2).sum())
    m = f["a"] + f["b"] * x0
    if f["shape"] == "% growth":
        return np.exp(m), np.exp(m - t * se), np.exp(m + t * se)
    return max(m, 0), max(m - t * se, 0), max(m + t * se, 0)


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
    return dict(values=vals, estimate=est, share=share, chosen=[best[1], best[2]], errLast=best[3], errPartial=best[4],
                slope=fit["b"], r2=fit["r2"], forecast=[y0, lo, hi], scenarios={"average": y0, "optimistic": hi, "pessimistic": min(lo, est)})


# ----------------------------------------------------------------------------- summary (same keys as tests/engine_summary.js)
def summary(d, opts):
    v = valid(d)
    f, t = opts.get("from", int(d.ym.min())), opts.get("to", int(d.ym.max()))
    rows = v[(v.ym >= f) & (v.ym <= t)]
    if opts.get("source") == "original":
        rows = rows[rows.source == "Original"]
    out = {"n_all": len(d), "n_valid": len(v), "n_zero": int(d.zero.sum())}
    md = C.MIN_DESIGNER_PROJECTS

    # B1 output
    years = full_years(f, t)
    prof = d.groupby("designer").agg(edu=("edu", "first"), loc=("loc", "first"), yrs=("yrs", "first"), rate=("rate", "first"))
    recs = []
    for des, p in prof.iterrows():
        act = [y for y in years if y >= C.EXPERIENCE_AS_OF - p.yrs]
        if act:
            recs.append(dict(designer=des, edu=p.edu, loc=p["loc"], yrs=p.yrs, value=rows[(rows.designer == des) & rows.year.isin(act)].rev.sum() / len(act)))
    D = pd.DataFrame(recs)
    rho, sp = stats.spearmanr(D.yrs, D.value)
    pos = D[D.value > 0]
    re, rl = ref_level(rows, "edu", EDUS), ref_level(rows, "loc", LOCS)
    eL, lL = [e for e in EDUS if e != re and (pos.edu == e).any()], [l for l in LOCS if l != rl and (pos["loc"] == l).any()]
    Xo = np.column_stack([np.ones(len(pos))] + [(pos.edu == e).astype(float) for e in eL] + [(pos["loc"] == l).astype(float) for l in lL] + [pos.yrs.astype(float)])
    no = ["Intercept"] + [f"Education: {e}" for e in eL] + [f"Location: {l}" for l in lL] + ["Experience"]
    ro = sm.OLS(np.log(pos.value.values), Xo).fit()
    out["b1_output"] = dict(edu_p=kw([g.value for _, g in D.groupby("edu")]), loc_p=kw([g.value for _, g in D.groupby("loc")]),
                            exp_rho=float(rho), exp_p=float(sp), joint_edu_p=wald_p(ro, no, "Education", None),
                            joint_loc_p=wald_p(ro, no, "Location", None), joint_exp_p=wald_p(ro, no, "Experience", None))

    # B1 performance
    dt = rows.groupby("designer").agg(n=("pr", "size"), med=("pr", "median"), loc=("loc", "first"), edu=("edu", "first"), mexp=("exp", "median"))
    dt5 = dt[dt.n >= md]
    names, X, pooled, refs = perf_design(rows, ["education", "location", "experience"])
    res = cluster_ols(np.log(rows.ah.values), X(rows), rows.designer.values)
    G = rows.designer.nunique()
    pct = lambda n: float(np.exp(res.params[names.index(n)]) - 1) if n in names else None
    bands = C.EXPERIENCE_BANDS
    band = np.digitize(rows.exp, bands[1:-1])
    out["b1_perf"] = dict(edu_p=wald_p(res, names, "Education", G), loc_p=wald_p(res, names, "Location", G), exp_p=wald_p(res, names, "Experience", G),
                          hs_pct=pct("Education: High school"), master_pct=pct("Education: Master degree"), south_pct=pct("Location: South"),
                          single_edu_proj_p=kw([np.log(g.pr) for _, g in rows.groupby("edu")]), single_edu_des_p=kw([np.log(g.med) for _, g in dt5.groupby("edu")]),
                          single_loc_proj_p=kw([np.log(g.pr) for _, g in rows.groupby("loc")]), single_loc_des_p=kw([np.log(g.med) for _, g in dt5.groupby("loc")]),
                          single_exp_proj_p=kw([np.log(rows.pr[band == i]) for i in range(len(bands) - 1)]),
                          single_exp_des_p=float(stats.spearmanr(dt5.mexp, dt5.med).pvalue))
    full = valid(d)
    namesF, XF, _, _ = perf_design(full, ["education", "location", "experience"])
    rf = cluster_ols(np.log(full.ah.values), XF(full), full.designer.values)
    out["performanceFactors"] = [k for k, pre in (("education", "Education"), ("location", "Location"), ("experience", "Experience"))
                                 if wald_p(rf, namesF, pre, full.designer.nunique()) < C.ALPHA]

    # B2
    out["b2"] = dict(per100={l: float(100 * rows[rows["loc"] == l].pr.median()) for l in LOCS}, proj_p=kw([g.pr for _, g in rows.groupby("loc")]),
                     des_p=kw([g.med for _, g in dt5.groupby("loc")]))
    # B3
    dd = rows.groupby("designer").agg(ah=("ah", "sum"), ph=("ph", "sum"), rate=("rate", "first"), loc=("loc", "first"), n=("pr", "size"))
    dd = dd[dd.n >= md].copy()
    dd["cpph"] = dd.rate * dd.ah / dd.ph
    a, b = np.log(dd.rate), np.log(dd.ah / dd.ph)
    yl = np.log(dd.cpph)
    eta = 1 - sum(((g - g.mean()) ** 2).sum() for _, g in yl.groupby(dd["loc"])) / ((yl - yl.mean()) ** 2).sum()
    r5 = rows[rows.designer.isin(dd.index)]
    out["b3"] = dict(min=[dd.cpph.idxmin(), float(dd.cpph.min())], max=[dd.cpph.idxmax(), float(dd.cpph.max())],
                     des_p=kw([g.rate * g.pr for _, g in r5.groupby("designer")]), loc_p=kw([g.cpph for _, g in dd.groupby("loc")]),
                     loc_proj_p=kw([g.rate * g.pr for _, g in rows.groupby("loc")]), share_perf=float(b.var() / (a.var() + b.var())),
                     share_rate=float(a.var() / (a.var() + b.var())), loc_share=float(eta))
    # B4
    ct = pd.crosstab(rows["loc"], rows.cls)
    ds = rows[rows.designer.isin(dt5.index)].groupby("designer").agg(o=("cls", lambda s: (s == "Overrun").mean()), loc=("loc", "first"))
    out["b4"] = dict(over={l: float(ct.loc[l, "Overrun"] / ct.loc[l].sum()) for l in LOCS}, chi_p=float(stats.chi2_contingency(ct.values, correction=False)[1]),
                     des_p=kw([g.o for _, g in ds.groupby("loc")]))
    out["b4_region"] = dict(chi_p=float(stats.chi2_contingency(pd.crosstab(rows.region, rows.cls).values, correction=False)[1]))
    # B5
    yy = rows[rows.year.isin(years)].groupby(["region", "year"]).rev.sum().unstack(fill_value=0).reindex(index=REGIONS, columns=years, fill_value=0)
    pairs = [(a_, b_, stats.mannwhitneyu(yy.loc[a_], yy.loc[b_], method="asymptotic", use_continuity=True).pvalue) for a_, b_ in itertools.combinations(REGIONS, 2)]
    adj = multipletests([p for *_, p in pairs], method="holm")[1]
    med = yy.median(1)
    leader = med.idxmax()
    out["b5"] = dict(median={r: float(med[r]) for r in REGIONS}, p=kw([yy.loc[r].values for r in REGIONS]), leader=leader,
                     proven=[(b_ if a_ == leader else a_) for (a_, b_, _), q in zip(pairs, adj) if leader in (a_, b_) and q < C.ALPHA],
                     pairs={f"{a_}-{b_}": float(q) for (a_, b_, _), q in zip(pairs, adj)})
    # B6
    out["b6"] = dict(margin={f"T{t_}": float(1 - g.cost.sum() / g.rev.sum()) for t_, g in rows.groupby("type")},
                     ranges={f"T{t_}": boot_margin(g) for t_, g in rows.groupby("type")},
                     p=kw([1 - g.pr for _, g in rows.groupby("type") if len(g) >= md]))
    if opts.get("bOnly"):
        return out

    # M1
    train = v[v.year <= C.LAST_FULL_YEAR]
    m = fit_m1(train, out["performanceFactors"])
    pr_ = m["res"]
    vif = [variance_inflation_factor(m["Xm"], i) for i in range(1, m["Xm"].shape[1])]
    out["m1"] = dict(n=len(train), coefs=dict(zip(m["names"], map(float, pr_.params))), p=dict(zip(m["names"], map(float, pr_.pvalues))),
                     r2=float(m["r2"]), r2_designer=float(m["r2d"]), resSD=float(np.sqrt(pr_.ssr / pr_.df_resid)), smear=float(m["smear"]),
                     range=[float(np.exp(m["q10"])), float(np.exp(m["q90"]))], vif_max=float(max(vif)), sw=float(m["sw"]), sb=float(m["sb"]),
                     pooled=m["pooled"], bp_p=float(het_breuschpagan(sm.OLS(m["y"], m["Xm"]).fit().resid, m["Xm"])[1]))
    tr, te = train[train.year <= C.BACKTEST_LAST_TRAIN_YEAR], train[train.year > C.BACKTEST_LAST_TRAIN_YEAR]
    mb = fit_m1(tr, out["performanceFactors"])
    med_, mean_, lo_, hi_ = predict(mb, te, te.designer.values)
    act = te.ah.values

    def met(p, lo=None, hi=None):
        e = p - act
        return dict(mae=float(np.abs(e).mean()), mdape=float(np.median(np.abs(e) / act)), bias=float(p.sum() / act.sum() - 1),
                    coverage=float(((act >= lo) & (act <= hi)).mean()) if lo is not None else None, n=len(act))
    out["backtest"] = dict(n=len(te), plans=met(te.ph.values), ratio=met(te.ph.values * realised(tr)), m1=met(mean_, lo_, hi_))
    # C1
    comp = train
    c1 = []
    for t_ in TYPES:
        g = comp[comp.type == t_]
        if not len(g):
            continue
        ph = g.ph.median()
        pool = v[(v.type == t_) & v.year.between(C.USUAL_MIX_FIRST_YEAR, C.LAST_FULL_YEAR)]
        if not len(pool):
            pool = v[v.type == t_]
        w = pool.designer.value_counts() / len(pool)
        probe = pd.DataFrame({"ph": ph, "type": t_, "edu": prof.loc[w.index].edu.values, "loc": prof.loc[w.index]["loc"].values,
                              "exp": (prof.loc[w.index].yrs - (C.EXPERIENCE_AS_OF - C.FORECAST_YEAR)).values})
        md_, mn_, lo_, hi_ = predict(m, probe, list(w.index))
        rate = prof.loc[w.index].rate.values
        cost, plan = (w.values * mn_ * rate).sum(), (w.values * ph * rate).sum()
        c1.append(dict(type=t_, plannedH=float(ph), hours=float((w.values * mn_).sum()), cost=float(cost), plan=float(plan), pct=float(cost / plan),
                       lo=float((w.values * lo_ * rate).sum()), hi=float((w.values * hi_ * rate).sum()), benchmark=float(plan * realised(g))))
    out["c1"] = c1
    # M2
    vol = d if C.ZERO_ACTUAL_IN_VOLUMES else v
    M2 = {k: m2_series(vol, k) for k in ["revenue", "cost", "plannedHours", "actualHours", "projects"]}
    out["m2_revenue"] = M2["revenue"]
    out["m2_chosen"] = {k: s["chosen"] + s["forecast"] for k, s in M2.items()}
    last = v[v.year.between(C.LAST_FULL_YEAR - C.COST_RATIO_YEARS + 1, C.LAST_FULL_YEAR)]
    ratio = last.cost.sum() / last.rev.sum()
    rev = M2["revenue"]["scenarios"]["average"]
    out["c4"] = dict(ratio=float(ratio), average=dict(revenue=rev, cost=rev * ratio, margin=rev * (1 - ratio), marginPct=1 - ratio,
                     projects=M2["projects"]["scenarios"]["average"]), projects=[M2["projects"]["scenarios"]["average"]] + M2["projects"]["forecast"][1:])
    # C2 / C3
    cr = comp.groupby("designer").agg(ah=("ah", "sum"), ph=("ph", "sum"), n=("ah", "size"))
    dept = comp.ah.sum() / comp.ph.sum()
    w = cr.n / (cr.n + C.SHRINK_K_PROJECTS)
    prs = w * cr.ah / cr.ph + (1 - w) * dept
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
