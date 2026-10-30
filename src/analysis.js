/* Shared data layer and every computation in the dashboard: tab A aggregates, the B1-B6
 * hypothesis tests, the M1/M2 models and the C1-C4 forecasts. Pure functions of the
 * row-level data and the config, so an uploaded file updates every tab. Runs in the browser
 * and in Node (tests/engine_summary.js) for verification against analysis/reference_stats.py. */
(function (root) {
  'use strict';
  const S = root.DDStats || (typeof require === 'function' ? require('./stats.js') : null);
  const { sum, mean, median, quantile, kruskal, spearman, chiSquare, mannWhitney, holm, ols, waldF } = S;

  const TYPES = [1, 2, 3, 4];
  const REGIONS = ['North', 'East', 'South', 'West'];
  const EDUS = ['High school', 'Bachelor degree', 'Master degree'];
  const CLASSES = ['Underrun', 'On plan', 'Overrun'];
  const ym = (y, m) => y * 12 + (m - 1);
  const ymYear = v => Math.floor(v / 12), ymMonth = v => (v % 12) + 1;

  // ================================================================ data layer
  /** Turn canonical raw rows into analysis rows. Raw keys: id, name, type ("System type N"),
   * region, designer, yrs, edu, date (ISO), month, year, actual, planned, rate, source. */
  function prepare(raw, cfg) {
    const locOf = r => cfg.LOCATION_BY_RATE[String(r)];
    const locations = Object.keys(cfg.LOCATION_BY_RATE).map(Number).sort((a, b) => a - b).map(k => cfg.LOCATION_BY_RATE[String(k)]);
    const tol = cfg.ON_PLAN_TOLERANCE;
    const all = raw.map(r => {
      const type = typeof r.type === 'number' ? r.type : parseInt(String(r.type).replace(/\D+/g, ''), 10);
      const ah = r.actual / r.rate, ph = r.planned / r.rate, pr = r.actual / r.planned;
      return {
        id: r.id, name: r.name, type, region: r.region, designer: r.designer, yrs: r.yrs, edu: r.edu, date: r.date,
        month: r.month, year: r.year, ym: ym(r.year, r.month), actual: r.actual, planned: r.planned, rate: r.rate,
        source: r.source || 'Uploaded', loc: locOf(r.rate), ah, ph, pr,
        cls: pr > 1 + tol ? 'Overrun' : pr < 1 - tol ? 'Underrun' : 'On plan',
        exp: r.yrs - (cfg.EXPERIENCE_AS_OF - r.year), rev: r.planned, cost: r.actual, margin: r.planned - r.actual,
        zero: r.actual === 0,
      };
    }).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const valid = cfg.INCLUDE_ZERO_ACTUAL ? all : all.filter(r => !r.zero);
    const designers = new Map();
    all.forEach(r => { if (!designers.has(r.designer)) designers.set(r.designer, { name: r.designer, rate: r.rate, loc: r.loc, edu: r.edu, yrs: r.yrs, careerStart: cfg.EXPERIENCE_AS_OF - r.yrs }); });
    const yms = all.map(r => r.ym);
    return { all, valid, designers, locations, minYM: Math.min(...yms), maxYM: Math.max(...yms), nZero: all.filter(r => r.zero).length };
  }

  /** Reference (baseline) level = the level with the most projects. */
  function refLevel(rows, key, levels) {
    let best = null, bn = -1;
    levels.forEach(l => { const n = rows.filter(r => r[key] === l).length; if (n > bn) { bn = n; best = l; } });
    return best;
  }
  const groupBy = (rows, f) => { const m = new Map(); rows.forEach(r => { const k = typeof f === 'function' ? f(r) : r[f]; if (!m.has(k)) m.set(k, []); m.get(k).push(r); }); return m; };
  const realisedPR = rows => sum(rows.map(r => r.ah)) / sum(rows.map(r => r.ph));
  const expBand = (e, bands) => { for (let i = 0; i < bands.length - 1; i++) if (e >= bands[i] && e < bands[i + 1]) return i; return bands.length - 2; };
  const bandLabels = bands => bands.slice(0, -1).map((b, i) => bands[i + 1] >= 99 ? `${b}+ yrs` : `${b}-${bands[i + 1] - 1} yrs`);

  // ================================================================ evidence and status
  function meter(p) { return !Number.isFinite(p) ? 1 : p < 0.001 ? 5 : p < 0.01 ? 4 : p < 0.05 ? 3 : p < 0.10 ? 2 : 1; }

  // ================================================================ TAB A
  /** Monthly allocation of one project: start month only, or spread evenly over its planned duration. */
  function allocation(r, mode, cfg) {
    if (mode !== 'spread') return [[r.ym, 1]];
    const weeks = r.ph / (cfg.HOURS_PER_WEEK * cfg.PROJECT_ALLOCATION);
    const months = Math.max(weeks * 7 / (365.25 / 12), 1e-9);
    const out = []; let left = months, m = r.ym;
    while (left > 1e-9) { const f = Math.min(1, left); out.push([m, f / months]); left -= f; m++; }
    return out;
  }
  function filterA(rows, f) {
    return rows.filter(r => f.types.includes(r.type) && f.regions.includes(r.region));
  }
  /** Sum of a metric over a period, honouring the attribution mode. */
  function periodSums(rows, from, to, mode, cfg) {
    const acc = new Map();
    rows.forEach(r => {
      allocation(r, mode, cfg).forEach(([m, w]) => {
        if (m < from || m > to) return;
        if (!acc.has(r)) acc.set(r, 0);
        acc.set(r, acc.get(r) + w);
      });
    });
    return acc; // row -> weight inside the period
  }
  function kpis(rows, from, to, mode, cfg) {
    const w = periodSums(rows, from, to, mode, cfg);
    let ah = 0, ph = 0, rev = 0, cost = 0;
    w.forEach((wt, r) => { ah += r.ah * wt; ph += r.ph * wt; rev += r.rev * wt; cost += r.cost * wt; });
    const started = rows.filter(r => r.ym >= from && r.ym <= to);
    return { ah, ph, rev, cost, margin: rev - cost, marginPct: rev ? (rev - cost) / rev : NaN, projects: started.length,
      designers: new Set(started.map(r => r.designer)).size, medianPR: median(started.map(r => r.pr)),
      overShare: started.length ? started.filter(r => r.cls === 'Overrun').length / started.length : NaN };
  }
  function tabA(data, f, cfg) {
    const rows = filterA(data.valid, f), from = f.from, to = f.to, mode = f.attribution || 'start';
    const cur = kpis(rows, from, to, mode, cfg);
    const len = to - from + 1;
    const prev = from - len >= data.minYM ? kpis(rows, from - len, from - 1, mode, cfg) : null;
    const w = periodSums(rows, from, to, mode, cfg);
    // A1 hours by designer x type
    const byDes = new Map();
    w.forEach((wt, r) => {
      if (!byDes.has(r.designer)) byDes.set(r.designer, { designer: r.designer, rate: r.rate, loc: r.loc, hours: {}, total: 0, planned: 0, n: 0 });
      const o = byDes.get(r.designer); o.hours[r.type] = (o.hours[r.type] || 0) + r.ah * wt; o.total += r.ah * wt; o.planned += r.ph * wt;
    });
    rows.filter(r => r.ym >= from && r.ym <= to).forEach(r => { if (byDes.has(r.designer)) byDes.get(r.designer).n++; });
    const a1 = [...byDes.values()].map(o => ({ ...o, pr: o.planned ? o.total / o.planned : NaN }));
    // A2 per period by type
    const gran = f.granularity || 'monthly';
    const key = m => gran === 'yearly' ? ymYear(m) : m;
    const periods = [];
    for (let m = from; m <= to; m++) { const k = key(m); if (!periods.length || periods[periods.length - 1] !== k) periods.push(k); }
    const a2 = {};
    TYPES.forEach(t => { a2[t] = { ah: periods.map(() => 0), ph: periods.map(() => 0), rev: periods.map(() => 0), cost: periods.map(() => 0) }; });
    rows.forEach(r => allocation(r, mode, cfg).forEach(([m, wt]) => {
      if (m < from || m > to) return;
      const i = periods.indexOf(key(m)); const s = a2[r.type];
      s.ah[i] += r.ah * wt; s.ph[i] += r.ph * wt; s.rev[i] += r.rev * wt; s.cost[i] += r.cost * wt;
    }));
    // A3 YTD by designer for the year of the To month (start-month attribution of revenue/cost)
    const yr = ymYear(to), mTo = ymMonth(to);
    const ytd = (y, mEnd) => {
      const o = new Map();
      rows.forEach(r => allocation(r, mode, cfg).forEach(([m, wt]) => {
        if (ymYear(m) !== y || ymMonth(m) > mEnd) return;
        if (!o.has(r.designer)) o.set(r.designer, { rev: 0, cost: 0 });
        const v = o.get(r.designer); v.rev += r.rev * wt; v.cost += r.cost * wt;
      }));
      return o;
    };
    const cy = ytd(yr, mTo), ly = ytd(yr - 1, mTo);
    const a3 = [...cy.entries()].map(([d, v]) => ({ designer: d, loc: data.designers.get(d).loc, rate: data.designers.get(d).rate, rev: v.rev, cost: v.cost,
      margin: v.rev - v.cost, marginPct: v.rev ? (v.rev - v.cost) / v.rev : NaN, prevRev: ly.has(d) ? ly.get(d).rev : 0 }));
    // A5 rate efficiency (projects started in the period)
    const started = rows.filter(r => r.ym >= from && r.ym <= to);
    const a5 = [...groupBy(started, 'designer').entries()].map(([d, rr]) => {
      const rpr = realisedPR(rr), rate = rr[0].rate;
      return { designer: d, loc: rr[0].loc, rate, rpr, medianPR: median(rr.map(r => r.pr)), n: rr.length, hours: sum(rr.map(r => r.ah)), cpph: rate * rpr, earned: rate / rpr };
    });
    const dept = started.length ? { cpph: sum(started.map(r => r.cost)) / sum(started.map(r => r.ph)), earned: sum(started.map(r => r.rev)) / sum(started.map(r => r.ah)) } : { cpph: NaN, earned: NaN };
    // A4 regional output
    const basis = f.regionBasis === 'home' ? 'loc' : 'region';
    const regs = basis === 'loc' ? data.locations : REGIONS;
    const a4 = regs.map(g => {
      const rr = []; w.forEach((wt, r) => { if (r[basis] === g) rr.push([r, wt]); });
      const s = k => sum(rr.map(([r, wt]) => r[k] * wt));
      return { region: g, ah: s('ah'), rev: s('rev'), cost: s('cost'), margin: s('rev') - s('cost'), projects: started.filter(r => r[basis] === g).length };
    });
    const flows = new Map();
    w.forEach((wt, r) => { const k = r.loc + '>' + r.region; flows.set(k, (flows.get(k) || 0) + r.ah * wt); });
    return { kpi: cur, prev, a1, a2: { periods, gran, byType: a2 }, a3: { year: yr, month: mTo, rows: a3 }, a5: { rows: a5, dept }, a4: { basis, rows: a4 },
      flows: [...flows.entries()].map(([k, v]) => ({ from: k.split('>')[0], to: k.split('>')[1], hours: v })), n: started.length, nDesigners: new Set(started.map(r => r.designer)).size };
  }

  // ================================================================ TAB B
  /** Rows for tab B: valid rows inside the period, all sources or Original only. */
  function rowsB(data, opt) {
    return data.valid.filter(r => r.ym >= opt.from && r.ym <= opt.to && (opt.source !== 'original' || r.source === 'Original'));
  }
  function fullYears(opt, cfg) {
    const ys = [];
    for (let y = cfg.FIRST_ANALYSIS_YEAR; y <= cfg.LAST_FULL_YEAR; y++) if (ym(y, 1) >= opt.from && ym(y, 12) <= opt.to) ys.push(y);
    return ys;
  }
  const minDes = (cfg) => cfg.MIN_DESIGNER_PROJECTS;

  /** Designer-level summaries used by several questions. */
  function designerTable(rows, data) {
    return [...groupBy(rows, 'designer').entries()].map(([d, rr]) => {
      const info = data.designers.get(d);
      return { designer: d, n: rr.length, loc: info.loc, edu: info.edu, yrs: info.yrs, rate: info.rate, medPR: median(rr.map(r => r.pr)),
        rpr: realisedPR(rr), medExp: median(rr.map(r => r.exp)), rows: rr };
    });
  }

  function status(parts) {
    // parts: [{p (deciding), pProject (optional), limited}]
    const conf = parts.filter(x => x.p < x.alpha);
    if (parts.length > 1 && conf.length && conf.length < parts.length) return 'PARTLY';
    if (conf.length && conf.length === parts.length) return 'CONFIRMED';
    if (parts.some(x => x.limited)) return 'LIMITED DATA';
    if (parts.some(x => x.pProject < x.alpha)) return 'FEW DESIGNERS';
    return 'NO CLEAR GAP';
  }

  // ---- B1
  function b1Output(rows, data, opt, cfg) {
    const years = fullYears(opt, cfg), metric = opt.metric || 'revenue';
    const out = [];
    data.designers.forEach(info => {
      const act = years.filter(y => y >= info.careerStart);
      if (!act.length) return;
      const rr = rows.filter(r => r.designer === info.name && act.includes(r.year));
      const tot = metric === 'hours' ? sum(rr.map(r => r.ah)) : metric === 'projects' ? rr.length : sum(rr.map(r => r.rev));
      out.push({ designer: info.name, loc: info.loc, edu: info.edu, yrs: info.yrs, years: act.length, value: tot / act.length });
    });
    const groupTest = key => {
      const levels = key === 'loc' ? data.locations : EDUS;
      const groups = levels.map(l => out.filter(d => d[key] === l).map(d => d.value));
      const kw = kruskal(groups);
      return { test: 'Kruskal-Wallis on designer mean annual output', ...kw, groups: levels.map((l, i) => ({ level: l, values: groups[i], median: median(groups[i]), nDesigners: groups[i].length })), p: kw.p };
    };
    const sp = spearman(out.map(d => d.yrs), out.map(d => d.value));
    const res = { unit: 'designer-year', years, designers: out, education: groupTest('edu'), location: groupTest('loc'),
      experience: { test: 'Spearman', ...sp } };
    // All together: OLS of log(mean annual output) on education, location and experience (n = designers)
    const pos = out.filter(d => d.value > 0);
    const refEdu = refLevel(rows, 'edu', EDUS), refLoc = refLevel(rows, 'loc', data.locations);
    const eduL = EDUS.filter(e => e !== refEdu && pos.some(d => d.edu === e)), locL = data.locations.filter(l => l !== refLoc && pos.some(d => d.loc === l));
    const names = ['Intercept', ...eduL.map(e => 'Education: ' + e), ...locL.map(l => 'Location: ' + l), 'Experience (years)'];
    const X = pos.map(d => [1, ...eduL.map(e => +(d.edu === e)), ...locL.map(l => +(d.loc === l)), d.yrs]);
    try {
      const fit = ols(pos.map(d => Math.log(d.value)), X, names);
      const idx = pre => names.map((n, i) => n.startsWith(pre) ? i : -1).filter(i => i >= 0);
      res.joint = { n: pos.length, refEdu, refLoc, coefs: fit.coefs.slice(1), r2: fit.r2,
        tests: { education: waldF(fit, idx('Education')), location: waldF(fit, idx('Location')), experience: waldF(fit, idx('Experience')) } };
    } catch (e) { res.joint = null; }
    return res;
  }

  /** The performance model shared by B1 "All together" and M1: ln(actual h) on ln(planned h),
   * type terms (types with >= MIN_PROJECTS, others pooled into the baseline type), and factors. */
  function perfDesign(rows, data, factors, cfg, refs) {
    const counts = TYPES.map(t => rows.filter(r => r.type === t).length);
    const baseType = TYPES[counts.indexOf(Math.max(...counts))];
    const typeTerms = TYPES.filter(t => t !== baseType && counts[t - 1] >= cfg.MIN_PROJECTS);
    const pooled = TYPES.filter(t => t !== baseType && counts[t - 1] > 0 && counts[t - 1] < cfg.MIN_PROJECTS);
    refs = refs || { edu: refLevel(rows, 'edu', EDUS), loc: refLevel(rows, 'loc', data.locations) };
    const eduL = factors.includes('education') ? EDUS.filter(e => e !== refs.edu && rows.some(r => r.edu === e)) : [];
    const locL = factors.includes('location') ? data.locations.filter(l => l !== refs.loc && rows.some(r => r.loc === l)) : [];
    const useExp = factors.includes('experience');
    const names = ['Intercept', 'ln(planned hours)', ...typeTerms.map(t => 'Type ' + t), ...eduL.map(e => 'Education: ' + e), ...locL.map(l => 'Location: ' + l), ...(useExp ? ['Experience at start (years)'] : [])];
    const row = x => [1, Math.log(x.ph), ...typeTerms.map(t => +(x.type === t)), ...eduL.map(e => +(x.edu === e)), ...locL.map(l => +(x.loc === l)), ...(useExp ? [x.exp] : [])];
    return { names, row, baseType, typeTerms, pooled, refs, eduL, locL, useExp };
  }

  function b1Performance(rows, data, opt, cfg) {
    const md = minDes(cfg), dt = designerTable(rows, data).filter(d => d.n >= md);
    const bands = cfg.EXPERIENCE_BANDS, bl = bandLabels(bands);
    const single = {};
    [['education', 'edu', EDUS], ['location', 'loc', data.locations]].forEach(([k, key, levels]) => {
      const proj = kruskal(levels.map(l => rows.filter(r => r[key] === l).map(r => Math.log(r.pr))));
      const des = kruskal(levels.map(l => dt.filter(d => d[key] === l).map(d => Math.log(d.medPR))));
      single[k] = { project: proj, designer: des, groups: levels.map(l => ({ level: l, medianPR: median(rows.filter(r => r[key] === l).map(r => r.pr)), n: rows.filter(r => r[key] === l).length,
        nDesigners: new Set(rows.filter(r => r[key] === l).map(r => r.designer)).size, designerMedians: dt.filter(d => d[key] === l).map(d => ({ designer: d.designer, v: d.medPR, n: d.n })) })) };
    });
    const projE = kruskal(bl.map((_, i) => rows.filter(r => expBand(r.exp, bands) === i).map(r => Math.log(r.pr))));
    const desE = spearman(dt.map(d => d.medExp), dt.map(d => d.medPR));
    single.experience = { project: projE, designer: desE, groups: bl.map((l, i) => { const rr = rows.filter(r => expBand(r.exp, bands) === i); return { level: l, medianPR: median(rr.map(r => r.pr)), n: rr.length, nDesigners: new Set(rr.map(r => r.designer)).size }; }),
      points: dt.map(d => ({ designer: d.designer, x: d.medExp, y: d.medPR, n: d.n, loc: d.loc })) };
    // All together
    const des = perfDesign(rows, data, ['education', 'location', 'experience'], cfg);
    let joint = null;
    try {
      const fit = ols(rows.map(r => Math.log(r.ah)), rows.map(des.row), des.names, rows.map(r => r.designer));
      const idx = pre => des.names.map((n, i) => n.startsWith(pre) ? i : -1).filter(i => i >= 0);
      joint = { n: rows.length, G: fit.G, coefs: fit.coefs, r2: fit.r2, refs: des.refs, pooled: des.pooled, baseType: des.baseType,
        tests: { education: waldF(fit, idx('Education')), location: waldF(fit, idx('Location')), experience: waldF(fit, idx('Experience')) } };
    } catch (e) { joint = null; }
    return { single, joint };
  }

  function b1(rows, data, opt, cfg) {
    const view = opt.view || 'output', factor = opt.factor || 'experience';
    const out = view === 'output' ? b1Output(rows, data, opt, cfg) : null;
    const perf = view === 'performance' ? b1Performance(rows, data, opt, cfg) : null;
    const A = cfg.ALPHA, parts = [];
    ['experience', 'education', 'location'].forEach(k => {
      if (view === 'output') {
        const p = factor === 'all' && out.joint ? out.joint.tests[k].p : out[k].p;
        parts.push({ key: k, p, alpha: A });
      } else {
        if (factor === 'all' && perf.joint) parts.push({ key: k, p: perf.joint.tests[k].p, alpha: A });
        else parts.push({ key: k, p: perf.single[k].designer.p, pProject: perf.single[k].project.p, alpha: A });
      }
    });
    const st = status(parts);
    return { view, factor, output: out, performance: perf, parts, status: st, meter: meter(Math.min(...parts.map(x => x.p).filter(Number.isFinite))) };
  }
  /** Designer factors whose joint Wald p < ALPHA in the performance model (full data, default controls). */
  function performanceFactors(data, cfg) {
    const opt = { from: data.minYM, to: data.maxYM, source: 'all' };
    const p = b1Performance(rowsB(data, opt), data, opt, cfg);
    return { factors: p.joint ? ['education', 'location', 'experience'].filter(k => p.joint.tests[k].p < cfg.ALPHA) : [], tests: p.joint ? p.joint.tests : {} };
  }

  // ---- B2
  function b2(rows, data, opt, cfg) {
    const rr = opt.type && opt.type !== 'all' ? rows.filter(r => r.type === +opt.type) : rows;
    const md = minDes(cfg), dt = designerTable(rr, data).filter(d => d.n >= md);
    const planned = opt.plannedH || 100;
    const groups = data.locations.map(l => {
      const g = rr.filter(r => r.loc === l);
      return { level: l, n: g.length, nDesigners: new Set(g.map(r => r.designer)).size, per100: 100 * median(g.map(r => r.pr)),
        q1: 100 * quantile(g.map(r => r.pr), 0.25), q3: 100 * quantile(g.map(r => r.pr), 0.75), expected: planned * median(g.map(r => r.pr)),
        designers: dt.filter(d => d.loc === l).map(d => ({ designer: d.designer, v: 100 * d.medPR, n: d.n })) };
    });
    const proj = kruskal(data.locations.map(l => rr.filter(r => r.loc === l).map(r => r.pr)));
    const des = kruskal(data.locations.map(l => dt.filter(d => d.loc === l).map(d => d.medPR)));
    const limited = groups.some(g => g.n > 0 && (g.n < cfg.MIN_PROJECTS || g.nDesigners < cfg.MIN_DESIGNERS));
    const parts = [{ p: des.p, pProject: proj.p, alpha: cfg.ALPHA, limited }];
    return { groups, project: proj, designer: des, nDesigners: dt.length, plannedH: planned, status: status(parts), meter: meter(des.p) };
  }

  // ---- B3
  function b3(rows, data, opt, cfg) {
    const rr = opt.type && opt.type !== 'all' ? rows.filter(r => r.type === +opt.type) : rows;
    const md = minDes(cfg), dtAll = designerTable(rr, data), dt = dtAll.filter(d => d.n >= md);
    dt.forEach(d => { d.cpph = d.rate * d.rpr; });
    const locTest = kruskal(data.locations.map(l => dt.filter(d => d.loc === l).map(d => d.cpph)));
    const locProj = kruskal(data.locations.map(l => rr.filter(r => r.loc === l).map(r => r.rate * r.pr)));
    const desTest = kruskal(dt.map(d => d.rows.map(r => r.rate * r.pr)));
    const y = dt.map(d => Math.log(d.cpph)), a = dt.map(d => Math.log(d.rate)), b = dt.map(d => Math.log(d.rpr));
    const va = S.variance(a), vb = S.variance(b);
    const my = mean(y), sst = sum(y.map(v => (v - my) ** 2));
    let ssw = 0; data.locations.forEach(l => { const g = dt.filter(d => d.loc === l).map(d => Math.log(d.cpph)); const m = mean(g); g.forEach(v => { ssw += (v - m) ** 2; }); });
    const locations = data.locations.map(l => { const g = dt.filter(d => d.loc === l); return { level: l, median: median(g.map(d => d.cpph)), nDesigners: g.length, n: sum(g.map(d => d.n)), rate: g.length ? g[0].rate : NaN }; });
    const parts = [{ key: 'designers', p: desTest.p, alpha: cfg.ALPHA }, { key: 'locations', p: locTest.p, pProject: locProj.p, alpha: cfg.ALPHA }];
    let st = status(parts);
    if (st === 'NO CLEAR GAP' && locProj.p < cfg.ALPHA) st = 'FEW DESIGNERS';
    const excluded = dtAll.filter(d => d.n < md).map(d => ({ designer: d.designer, n: d.n }));
    return { designers: dt.map(d => ({ designer: d.designer, loc: d.loc, rate: d.rate, rpr: d.rpr, cpph: d.cpph, n: d.n })).sort((p, q) => p.cpph - q.cpph),
      excluded, locations, locTest, locProj, desTest, shares: { performance: vb / (va + vb), rate: va / (va + vb) }, locationShare: sst ? 1 - ssw / sst : NaN,
      status: st, meter: meter(Math.min(desTest.p, locTest.p)) };
  }

  // ---- B4
  function b4(rows, data, opt, cfg) {
    const rr = opt.type && opt.type !== 'all' ? rows.filter(r => r.type === +opt.type) : rows;
    const by = opt.groupBy === 'region' ? 'region' : 'loc', levels = by === 'loc' ? data.locations : REGIONS;
    const focus = opt.mode === 'under' ? 'Underrun' : 'Overrun';
    const groups = levels.map(l => {
      const g = rr.filter(r => r[by] === l), c = {};
      CLASSES.forEach(k => { c[k] = g.filter(r => r.cls === k).length; });
      return { level: l, n: g.length, nDesigners: new Set(g.map(r => r.designer)).size, counts: c, shares: Object.fromEntries(CLASSES.map(k => [k, g.length ? c[k] / g.length : NaN])),
        overMoney: sum(g.filter(r => r.cls === 'Overrun').map(r => r.actual - r.planned)), underMoney: sum(g.filter(r => r.cls === 'Underrun').map(r => r.planned - r.actual)) };
    });
    const chi = chiSquare(groups.map(g => CLASSES.map(k => g.counts[k])));
    const md = minDes(cfg), dt = designerTable(rr, data).filter(d => d.n >= md);
    const dots = dt.map(d => ({ designer: d.designer, group: by === 'loc' ? d.loc : null, n: d.n, share: d.rows.filter(r => r.cls === focus).length / d.n }));
    let desTest = null;
    if (by === 'loc') desTest = kruskal(data.locations.map(l => dots.filter(d => d.group === l).map(d => d.share)));
    const parts = by === 'loc' ? [{ p: desTest.p, pProject: chi.p, alpha: cfg.ALPHA }] : [{ p: chi.p, alpha: cfg.ALPHA }];
    return { by, focus, groups, chi, designerTest: desTest, dots: by === 'loc' ? dots : [], status: status(parts), meter: meter(by === 'loc' ? desTest.p : chi.p) };
  }

  // ---- B5
  function b5(rows, data, opt, cfg) {
    const rr = opt.type && opt.type !== 'all' ? rows.filter(r => r.type === +opt.type) : rows;
    const years = fullYears(opt, cfg), metric = opt.metric === 'margin' ? 'margin' : 'rev';
    const totals = REGIONS.map(g => years.map(y => sum(rr.filter(r => r.region === g && r.year === y).map(r => r[metric]))));
    const regions = REGIONS.map((g, i) => ({ level: g, total: sum(totals[i]), median: median(totals[i]), yearly: totals[i], n: rr.filter(r => r.region === g && years.includes(r.year)).length,
      yearN: years.map(y => rr.filter(r => r.region === g && r.year === y).length) }));
    const kw = years.length >= 2 ? kruskal(totals) : { p: NaN };
    const pairs = [];
    for (let i = 0; i < REGIONS.length; i++) for (let j = i + 1; j < REGIONS.length; j++) pairs.push({ a: REGIONS[i], b: REGIONS[j], ...mannWhitney(totals[i], totals[j]) });
    const adj = holm(pairs.map(p => Number.isFinite(p.p) ? p.p : 1)); pairs.forEach((p, i) => { p.pHolm = adj[i]; });
    const order = regions.slice().sort((a, b) => b.median - a.median), leader = order[0].level;
    const winners = years.map((y, k) => { let best = null; REGIONS.forEach((g, i) => { if (!best || totals[i][k] > best.v) best = { year: y, region: g, v: totals[i][k] }; }); return best; });
    const limited = years.length < cfg.MIN_YEARS;
    const st = limited ? 'LIMITED DATA' : status([{ p: kw.p, alpha: cfg.ALPHA }]);
    const proven = pairs.filter(p => (p.a === leader || p.b === leader) && p.pHolm < cfg.ALPHA).map(p => (p.a === leader ? p.b : p.a));
    return { years, metric, regions, kw, pairs, leader, proven, winners, status: st, meter: meter(kw.p) };
  }

  // ---- B6
  function b6(rows, data, opt, cfg) {
    const types = TYPES.map(t => {
      const g = rows.filter(r => r.type === t);
      const rev = sum(g.map(r => r.rev)), cost = sum(g.map(r => r.cost));
      let range = [NaN, NaN];
      if (g.length) {
        const bs = S.bootstrap(g.length, cfg.BOOTSTRAP_N, cfg.RANDOM_SEED, idx => { let a = 0, c = 0; for (const i of idx) { a += g[i].rev; c += g[i].cost; } return (a - c) / a; });
        range = [quantile(bs, 0.05), quantile(bs, 0.95)];
      }
      return { type: t, n: g.length, nDesigners: new Set(g.map(r => r.designer)).size, rev, cost, margin: rev - cost, marginPct: rev ? (rev - cost) / rev : NaN,
        marginPerProject: g.length ? (rev - cost) / g.length : NaN, overShare: g.length ? g.filter(r => r.cls === 'Overrun').length / g.length : NaN,
        earned: rev / sum(g.map(r => r.ah)), range, limited: g.length < cfg.MIN_PROJECTS || new Set(g.map(r => r.designer)).size < cfg.MIN_DESIGNERS };
    }).filter(t => t.n > 0);
    const tested = types.filter(t => t.n >= minDes(cfg));
    const kw = kruskal(tested.map(t => rows.filter(r => r.type === t.type).map(r => 1 - r.pr)));
    const all = { rev: sum(rows.map(r => r.rev)), cost: sum(rows.map(r => r.cost)) };
    const dept = { marginPct: (all.rev - all.cost) / all.rev, marginPerProject: (all.rev - all.cost) / rows.length };
    const leader = types.filter(t => !t.limited).sort((a, b) => b.marginPct - a.marginPct)[0] || types[0];
    const overlap = types.some(t => t !== leader && t.range[1] >= leader.range[0] && t.range[0] <= leader.range[1]);
    const watching = leader.n < 30 && overlap;
    const years = [...new Set(rows.map(r => r.year))].sort();
    const trend = TYPES.map(t => ({ type: t, points: years.map(y => { const g = rows.filter(r => r.type === t && r.year === y); const rv = sum(g.map(r => r.rev)); return { year: y, n: g.length, marginPct: rv ? (rv - sum(g.map(r => r.cost))) / rv : null }; }) }));
    return { types, kw, testedTypes: tested.map(t => t.type), dept, leader: leader.type, watching, trend, status: status([{ p: kw.p, alpha: cfg.ALPHA }]), meter: meter(kw.p) };
  }

  // ================================================================ TAB C · M1
  function fitM1(rows, data, factors, cfg, refs) {
    const des = perfDesign(rows, data, factors, cfg, refs);
    const X = rows.map(des.row), y = rows.map(r => Math.log(r.ah));
    const fit = ols(y, X, des.names, rows.map(r => r.designer));
    // empirical-Bayes designer adjustment
    const byD = groupBy(rows.map((r, i) => ({ d: r.designer, e: fit.e[i] })), 'd');
    const md = new Map(); let ssw = 0;
    byD.forEach((v, d) => { const m = mean(v.map(x => x.e)); md.set(d, { n: v.length, mean: m }); v.forEach(x => { ssw += (x.e - m) ** 2; }); });
    const G = md.size, sw = ssw / (rows.length - G);
    const means = [...md.values()].map(v => v.mean), invN = mean([...md.values()].map(v => 1 / v.n));
    const sb = Math.max(S.variance(means) - sw * invN, 1e-4), kShrink = sw / sb;
    const u = new Map(); md.forEach((v, d) => { const w = v.n / (v.n + kShrink); u.set(d, { u: v.mean * w, n: v.n, mean: v.mean, w }); });
    const adj = rows.map((r, i) => fit.e[i] - u.get(r.designer).u);
    const my = mean(y), sst = sum(y.map(v => (v - my) ** 2));
    return { des, fit, X, y, rows, u, sw, sb, kShrink, adj, r2: fit.r2, adjR2: fit.adjR2, r2Designer: 1 - sum(adj.map(v => v * v)) / sst,
      smear: mean(adj.map(Math.exp)), q10: quantile(adj, 0.1), q90: quantile(adj, 0.9), factors };
  }
  function predictM1(m, x, designer) {
    const row = m.des.row(x);
    const lin = row.reduce((s, v, j) => s + v * m.fit.b[j], 0) + (designer && m.u.has(designer) ? m.u.get(designer).u : 0);
    const med = Math.exp(lin);
    return { median: med, mean: med * m.smear, lo: med * Math.exp(m.q10), hi: med * Math.exp(m.q90) };
  }
  const xOf = (r, ph) => ({ ph: ph === undefined ? r.ph : ph, type: r.type, edu: r.edu, loc: r.loc, exp: r.exp });
  function trainingM1(data, cfg) { return data.valid.filter(r => r.year <= cfg.LAST_FULL_YEAR); }

  function m1(data, cfg, factors) {
    const train = trainingM1(data, cfg);
    const m = fitM1(train, data, factors, cfg);
    // backtest
    const tr = train.filter(r => r.year <= cfg.BACKTEST_LAST_TRAIN_YEAR), te = train.filter(r => r.year > cfg.BACKTEST_LAST_TRAIN_YEAR);
    const mb = fitM1(tr, data, factors, cfg);
    const ratio = realisedPR(tr);
    const act = te.map(r => r.ah);
    const metric = (pred, lo, hi) => {
      const err = pred.map((p, i) => p - act[i]);
      return { mae: mean(err.map(Math.abs)), mdape: median(err.map((e, i) => Math.abs(e) / act[i])), bias: sum(pred) / sum(act) - 1,
        coverage: lo ? mean(act.map((a, i) => +(a >= lo[i] && a <= hi[i]))) : null, n: act.length };
    };
    const P = te.map(r => predictM1(mb, xOf(r), r.designer));
    const backtest = { train: tr.length, test: te.length, plans: metric(te.map(r => r.ph)), ratio: metric(te.map(r => r.ph * ratio)),
      m1: metric(P.map(p => p.mean), P.map(p => p.lo), P.map(p => p.hi)), ratioValue: ratio };
    // leave one designer out
    const lodoErr = [];
    [...new Set(train.map(r => r.designer))].forEach(d => {
      const trd = train.filter(r => r.designer !== d), ted = train.filter(r => r.designer === d);
      try { const md = fitM1(trd, data, factors, cfg, m.des.refs); ted.forEach(r => lodoErr.push(Math.abs(predictM1(md, xOf(r), null).mean - r.ah))); } catch (e) { /* designer cannot be left out */ }
    });
    // robustness: Original only
    let robust = null;
    try { const o = fitM1(train.filter(r => r.source === 'Original'), data, factors, cfg, m.des.refs); robust = { n: o.rows.length, coefs: o.fit.coefs, r2: o.r2 }; } catch (e) { robust = null; }
    // diagnostics
    const vif = S.vif(m.X, m.des.names), bp = S.breuschPagan(m.fit, m.X), ck = S.cooks(m.fit, m.X);
    const top = ck.map((c, i) => ({ c, i })).sort((a, b) => b.c - a.c).slice(0, 5).map(o => ({ id: train[o.i].id, designer: train[o.i].designer, cook: o.c, ah: train[o.i].ah, ph: train[o.i].ph }));
    return { model: m, backtest, lodoMAE: mean(lodoErr), lodoN: lodoErr.length, robust, vif, bp, cooks: top };
  }

  // ================================================================ TAB C · M2
  function volumeRows(data, cfg) { return cfg.ZERO_ACTUAL_IN_VOLUMES ? data.all : data.valid; }
  const METRICS = { revenue: r => r.rev, cost: r => r.cost, plannedHours: r => r.ph, actualHours: r => r.ah, projects: () => 1 };
  function yearlySeries(rows, metric, cfg, region) {
    const f = METRICS[metric], rr = region ? rows.filter(r => r.region === region) : rows;
    const years = []; for (let y = cfg.FIRST_ANALYSIS_YEAR; y <= cfg.LAST_FULL_YEAR; y++) years.push(y);
    const val = years.map(y => sum(rr.filter(r => r.year === y).map(f)));
    const hist = rr.filter(r => r.year >= cfg.FIRST_ANALYSIS_YEAR && r.year <= cfg.LAST_FULL_YEAR);
    const share = sum(hist.filter(r => r.month <= cfg.PARTIAL_LAST_MONTH).map(f)) / sum(hist.map(f));
    const partial = sum(rr.filter(r => r.year === cfg.PARTIAL_YEAR).map(f));
    return { years, values: val, partial, share, estimate: partial / share };
  }
  function trendFit(xs, ys, shape) {
    const yy = shape === '% growth' ? ys.map(Math.log) : ys;
    const n = xs.length, mx = mean(xs), my = mean(yy);
    let sxy = 0, sxx = 0; xs.forEach((x, i) => { sxy += (x - mx) * (yy[i] - my); sxx += (x - mx) ** 2; });
    const b = sxy / sxx, a = my - b * mx;
    const res = yy.map((v, i) => v - (a + b * xs[i])), sse = sum(res.map(v => v * v)), s = Math.sqrt(sse / (n - 2));
    const sst = sum(yy.map(v => (v - my) ** 2));
    return { a, b, s, n, mx, sxx, res, r2: 1 - sse / sst, shape, seB: s / Math.sqrt(sxx), seAc: s / Math.sqrt(n), my };
  }
  function trendForecast(fit, x0, level = 0.8) {
    const t = S.tInv(0.5 + level / 2, fit.n - 2);
    const se = fit.s * Math.sqrt(1 + 1 / fit.n + (x0 - fit.mx) ** 2 / fit.sxx);
    const m = fit.a + fit.b * x0, lo = m - t * se, hi = m + t * se;
    if (fit.shape === '% growth') return { y: Math.exp(m), lo: Math.exp(lo), hi: Math.exp(hi), t, se };
    return { y: Math.max(0, m), lo: Math.max(0, lo), hi: Math.max(0, hi), t, se };
  }
  function m2Series(series, cfg, override) {
    const combos = [];
    cfg.TREND_FIT_START_OPTIONS.forEach(start => cfg.TREND_SHAPES.forEach(shape => {
      const xs = series.years.filter(y => y >= start && y < cfg.LAST_FULL_YEAR), ys = xs.map(y => series.values[series.years.indexOf(y)]);
      const e1 = trendForecast(trendFit(xs, ys, shape), cfg.LAST_FULL_YEAR).y / series.values[series.years.indexOf(cfg.LAST_FULL_YEAR)] - 1;
      const xs2 = series.years.filter(y => y >= start), ys2 = xs2.map(y => series.values[series.years.indexOf(y)]);
      const e2 = trendForecast(trendFit(xs2, ys2, shape), cfg.PARTIAL_YEAR).y / series.estimate - 1;
      combos.push({ start, shape, errLast: e1, errPartial: e2, mape: (Math.abs(e1) + Math.abs(e2)) / 2 });
    }));
    const best = combos.slice().sort((a, b) => a.mape - b.mape)[0];
    const chosen = override ? combos.find(c => c.start === override.start && c.shape === override.shape) || best : best;
    const xs = series.years.filter(y => y >= chosen.start).concat([cfg.PARTIAL_YEAR]);
    const ys = series.years.filter(y => y >= chosen.start).map(y => series.values[series.years.indexOf(y)]).concat([series.estimate]);
    const fit = trendFit(xs, ys, chosen.shape), fc = trendForecast(fit, cfg.FORECAST_YEAR);
    const scen = { average: fc.y, optimistic: fc.hi, pessimistic: Math.min(fc.lo, series.estimate) };
    return { series, combos, best, chosen, fit, xs, ys, forecast: fc, scenarios: scen, growthStops: series.estimate };
  }
  function m2(data, cfg, overrides = {}) {
    const rows = volumeRows(data, cfg), out = {};
    Object.keys(METRICS).forEach(k => { out[k] = m2Series(yearlySeries(rows, k, cfg), cfg, overrides[k]); });
    const regions = {};
    REGIONS.forEach(g => { regions[g] = {}; ['revenue', 'plannedHours'].forEach(k => { regions[g][k] = m2Series(yearlySeries(rows, k, cfg, g), cfg); }); });
    return { metrics: out, regions };
  }

  // ================================================================ TAB C · forecasts
  function c1(data, cfg, M1, opt = {}) {
    const m = M1.model, comp = trainingM1(data, cfg);
    const designerOpt = opt.designer || 'mix';
    return TYPES.map(t => {
      const g = comp.filter(r => r.type === t);
      if (!g.length) return null;
      const ph = opt.size === 'average' ? mean(g.map(r => r.ph)) : median(g.map(r => r.ph));
      let pool = data.valid.filter(r => r.type === t && r.year >= cfg.USUAL_MIX_FIRST_YEAR && r.year <= cfg.LAST_FULL_YEAR);
      if (!pool.length) pool = data.valid.filter(r => r.type === t);
      let weights;
      if (designerOpt === 'mix') weights = [...groupBy(pool, 'designer').entries()].map(([d, rr]) => [d, rr.length / pool.length]);
      else if (designerOpt.startsWith('loc:')) {
        const l = designerOpt.slice(4), ds = [...data.designers.values()].filter(d => d.loc === l);
        const cnt = ds.map(d => data.valid.filter(r => r.designer === d.name && r.year <= cfg.LAST_FULL_YEAR).length), tot = sum(cnt);
        weights = ds.map((d, i) => [d.name, tot ? cnt[i] / tot : 1 / ds.length]);
      } else weights = [[designerOpt.replace(/^des:/, ''), 1]];
      let E = 0, C = 0, lo = 0, hi = 0, med = 0, plan = 0;
      weights.forEach(([d, w]) => {
        const info = data.designers.get(d);
        const p = predictM1(m, { ph, type: t, edu: info.edu, loc: info.loc, exp: info.yrs - (cfg.EXPERIENCE_AS_OF - cfg.FORECAST_YEAR) }, d);
        E += w * p.mean; C += w * p.mean * info.rate; lo += w * p.lo * info.rate; hi += w * p.hi * info.rate; med += w * p.median; plan += w * ph * info.rate;
      });
      const typePR = realisedPR(g);
      return { type: t, n: g.length, plannedH: ph, hours: E, cost: C, lo, hi, plan, pctOfPlan: C / plan, benchmark: plan * typePR, typePR,
        limited: m.des.pooled.includes(t) || g.length < cfg.MIN_PROJECTS, pooled: m.des.pooled.includes(t), designers: weights.length };
    }).filter(Boolean);
  }
  function shrunkPR(data, cfg) {
    const comp = trainingM1(data, cfg), dept = realisedPR(comp), out = new Map();
    groupBy(comp, 'designer').forEach((rr, d) => { const w = rr.length / (rr.length + cfg.SHRINK_K_PROJECTS); out.set(d, { pr: realisedPR(rr), n: rr.length, w, prs: w * realisedPR(rr) + (1 - w) * dept }); });
    return { dept, map: out };
  }
  function workload(data, cfg, M2) {
    const rows = volumeRows(data, cfg).filter(r => r.year >= cfg.WORKLOAD_SHARE_FIRST_YEAR && r.year <= cfg.PARTIAL_YEAR);
    const tot = sum(rows.map(r => r.ph)), cells = new Map();
    rows.forEach(r => { const k = r.designer + '|' + r.region; cells.set(k, (cells.get(k) || 0) + r.ph); });
    const sp = shrunkPR(data, cfg);
    const out = {};
    ['pessimistic', 'average', 'optimistic'].forEach(sc => {
      const P = M2.metrics.plannedHours.scenarios[sc];
      out[sc] = [...cells.entries()].map(([k, v]) => {
        const [d, region] = k.split('|'), info = data.designers.get(d), s = sp.map.get(d);
        const prs = s ? s.prs : sp.dept, share = v / tot, planned = P * share;
        return { designer: d, region, loc: info.loc, rate: info.rate, share, planned, actual: planned * prs, variance: planned * (prs - 1), money: planned * (prs - 1) * info.rate, prs, n: s ? s.n : 0 };
      });
    });
    return { cells: out, dept: sp.dept, shrink: sp };
  }
  function c4(data, cfg, M2) {
    const v = data.valid.filter(r => r.year > cfg.LAST_FULL_YEAR - cfg.COST_RATIO_YEARS && r.year <= cfg.LAST_FULL_YEAR);
    const ratio = sum(v.map(r => r.cost)) / sum(v.map(r => r.rev));
    const vol = volumeRows(data, cfg).filter(r => r.year > cfg.LAST_FULL_YEAR - cfg.COST_RATIO_YEARS && r.year <= cfg.LAST_FULL_YEAR);
    const totRev = sum(vol.map(r => r.rev));
    const shares = { region: REGIONS.map(g => ({ key: g, share: sum(vol.filter(r => r.region === g).map(r => r.rev)) / totRev })),
      type: TYPES.map(t => ({ key: t, share: sum(vol.filter(r => r.type === t).map(r => r.rev)) / totRev })) };
    const sc = {};
    ['pessimistic', 'average', 'optimistic'].forEach(k => {
      const rev = M2.metrics.revenue.scenarios[k], cost = rev * ratio;
      sc[k] = { revenue: rev, cost, margin: rev - cost, marginPct: (rev - cost) / rev, projects: M2.metrics.projects.scenarios[k] };
    });
    return { ratio, shares, scenarios: sc, range: { revenue: [M2.metrics.revenue.forecast.lo, M2.metrics.revenue.forecast.hi], projects: [M2.metrics.projects.forecast.lo, M2.metrics.projects.forecast.hi] } };
  }

  const api = { TYPES, REGIONS, EDUS, CLASSES, ym, ymYear, ymMonth, prepare, refLevel, groupBy, realisedPR, bandLabels, expBand, meter, status,
    allocation, tabA, rowsB, fullYears, designerTable, b1, b1Output, b1Performance, performanceFactors, b2, b3, b4, b5, b6,
    perfDesign, fitM1, predictM1, m1, yearlySeries, trendFit, trendForecast, m2Series, m2, c1, shrunkPR, workload, c4, volumeRows };
  root.DDAnalysis = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
