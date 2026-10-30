/* Shared data layer and every computation in the dashboard: tab A aggregates, the B1-B6
 * hypothesis tests, the M1/M2 models and the C1-C4 forecasts. Pure functions of the
 * row-level data and the config, so an uploaded file updates every tab. Runs in the browser
 * and in Node (tests/engine_summary.js) for verification against analysis/reference_stats.py. */
(function (root) {
  'use strict';
  const S = root.DDStats || (typeof require === 'function' ? require('./stats.js') : null);
  const { sum, mean, median, quantile, ols } = S;

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

  // ================================================================ TAB B · simple standard-error tests
  /** Rows for tab B: valid rows inside the period, all sources or Original only. */
  function rowsB(data, opt) {
    return data.valid.filter(r => r.ym >= opt.from && r.ym <= opt.to && (opt.source !== 'original' || r.source === 'Original'));
  }
  function fullYears(opt, cfg) {
    const ys = [];
    for (let y = cfg.FIRST_ANALYSIS_YEAR; y <= cfg.LAST_FULL_YEAR; y++) if (ym(y, 1) >= opt.from && ym(y, 12) <= opt.to) ys.push(y);
    return ys;
  }
  const byType = (rows, t) => (t && t !== 'all' ? rows.filter(r => r.type === +t) : rows);
  const vsRest = (values, labels, levels, cfg, opts = {}) => S.vsRest(values, labels, levels, { minN: opts.minN === undefined ? cfg.MIN_N : opts.minN, alpha: cfg.ALPHA, proportion: opts.proportion });

  /** Summary of a set of comparisons: the headline is the tested comparison with the largest |t|. */
  function summarise(tests) {
    const tested = tests.filter(t => Number.isFinite(t.p));
    const head = tested.slice().sort((a, b) => Math.abs(b.t) - Math.abs(a.t))[0] || null;
    const minP = tested.length ? Math.min(...tested.map(t => t.p)) : NaN;
    const status = tested.some(t => t.reject) ? 'CONFIRMED' : (!tested.length ? 'LIMITED DATA' : 'NO CLEAR GAP');
    return { head, minP, status, meter: meter(minP), nTested: tested.length, nRejected: tested.filter(t => t.reject).length };
  }
  /** Regression coefficients as comparisons (t = b / SE). */
  const coefTests = (fit, skip = ['Intercept']) => fit.coefs.filter(c => !skip.includes(c.name)).map(c => ({ ...c, level: c.name, diff: c.b, seDiff: c.se }));

  // ---- B1
  function designerYears(rows, data, opt, cfg, metric) {
    const years = fullYears(opt, cfg), out = [];
    data.designers.forEach(info => {
      years.filter(y => y >= info.careerStart).forEach(y => {
        const rr = rows.filter(r => r.designer === info.name && r.year === y);
        const v = metric === 'hours' ? sum(rr.map(r => r.ah)) : metric === 'projects' ? rr.length : sum(rr.map(r => r.rev));
        out.push({ designer: info.name, loc: info.loc, edu: info.edu, year: y, exp: info.yrs - (cfg.EXPERIENCE_AS_OF - y), value: v });
      });
    });
    return { years, units: out };
  }
  /** The performance model shared by B1 "All together" and M1: ln(actual h) on ln(planned h), type terms
   * (types with >= MIN_PROJECTS; smaller types pooled into the baseline type) and the chosen factors. */
  function perfDesign(rows, data, factors, cfg, refs) {
    const counts = TYPES.map(t => rows.filter(r => r.type === t).length);
    const baseType = 1;
    const typeTerms = TYPES.filter(t => t !== baseType && counts[t - 1] >= cfg.MIN_PROJECTS);
    const pooled = TYPES.filter(t => t !== baseType && counts[t - 1] > 0 && counts[t - 1] < cfg.MIN_PROJECTS);
    refs = refs || { edu: refLevel(rows, 'edu', EDUS), loc: refLevel(rows, 'loc', data.locations) };
    const eduL = factors.includes('education') ? EDUS.filter(e => e !== refs.edu && rows.some(r => r.edu === e)) : [];
    const locL = factors.includes('location') ? data.locations.filter(l => l !== refs.loc && rows.some(r => r.loc === l)) : [];
    const useExp = factors.includes('experience');
    const names = ['Intercept', 'ln(planned hours)', ...typeTerms.map(t => 'Type ' + t), ...eduL.map(e => 'Education: ' + e), ...locL.map(l => 'Location: ' + l), ...(useExp ? ['Experience at start (years)'] : [])];
    const row = x => [1, Math.log(x.ph), ...typeTerms.map(t => +(x.type === t)), ...eduL.map(e => +(x.edu === e)), ...locL.map(l => +(x.loc === l)), ...(useExp ? [x.exp] : [])];
    return { names, row, baseType, typeTerms, pooled, refs, eduL, locL, useExp, counts };
  }
  const factorOf = name => (name.startsWith('Education') ? 'education' : name.startsWith('Location') ? 'location' : name.startsWith('Experience') ? 'experience' : null);

  function b1(rows, data, opt, cfg) {
    const view = opt.view || 'output', factor = opt.factor || 'experience', metric = opt.metric || 'revenue';
    const refs = { edu: refLevel(rows, 'edu', EDUS), loc: refLevel(rows, 'loc', data.locations) };
    const res = { view, factor, metric, refs };
    if (view === 'output') {
      const dy = designerYears(rows, data, opt, cfg, metric), u = dy.units;
      Object.assign(res, { unit: 'designer-year', years: dy.years, units: u, n: u.length });
      if (factor === 'education' || factor === 'location') {
        const key = factor === 'education' ? 'edu' : 'loc';
        res.tests = vsRest(u.map(x => x.value), u.map(x => x[key]), factor === 'education' ? EDUS : data.locations, cfg);
        res.tests.forEach(t => { t.nDesigners = new Set(u.filter(x => x[key] === t.level).map(x => x.designer)).size; });
        res.points = u;
      } else if (factor === 'experience') {
        const fit = ols(u.map(x => x.value), u.map(x => [1, x.exp / 10]), ['Intercept', 'Experience (per 10 years)']);
        res.fit = fit; res.tests = coefTests(fit); res.points = u;
      } else {
        const eduL = EDUS.filter(e => e !== refs.edu), locL = data.locations.filter(l => l !== refs.loc);
        const names = ['Intercept', ...eduL.map(e => 'Education: ' + e), ...locL.map(l => 'Location: ' + l), 'Experience (per 10 years)'];
        const fit = ols(u.map(x => x.value), u.map(x => [1, ...eduL.map(e => +(x.edu === e)), ...locL.map(l => +(x.loc === l)), x.exp / 10]), names);
        res.fit = fit; res.tests = coefTests(fit);
      }
    } else {
      const y = rows.map(r => Math.log(r.pr));
      res.unit = 'project'; res.n = rows.length;
      if (factor === 'education' || factor === 'location') {
        const key = factor === 'education' ? 'edu' : 'loc';
        res.tests = vsRest(y, rows.map(r => r[key]), factor === 'education' ? EDUS : data.locations, cfg);
        res.tests.forEach(t => { t.nDesigners = new Set(rows.filter(r => r[key] === t.level).map(r => r.designer)).size; });
        res.log = true;
      } else if (factor === 'experience') {
        const fit = ols(y, rows.map(r => [1, r.exp / 10]), ['Intercept', 'Experience at start (per 10 years)']);
        res.fit = fit; res.tests = coefTests(fit); res.log = true;
        res.points = designerTable(rows, data).map(d => ({ designer: d.designer, x: d.medExp, y: d.gmPR, n: d.n, loc: d.loc }));
      } else {
        const des = perfDesign(rows, data, ['education', 'location', 'experience'], cfg, refs);
        const fit = ols(rows.map(r => Math.log(r.ah)), rows.map(des.row), des.names);
        res.fit = fit; res.design = des; res.tests = coefTests(fit, ['Intercept', 'ln(planned hours)', ...des.typeTerms.map(t => 'Type ' + t)]);
        res.allCoefs = coefTests(fit, ['Intercept']);
      }
    }
    return Object.assign(res, summarise(res.tests));
  }
  function designerTable(rows, data) {
    return [...groupBy(rows, 'designer').entries()].map(([d, rr]) => {
      const info = data.designers.get(d);
      return { designer: d, n: rr.length, loc: info.loc, edu: info.edu, rate: info.rate, gmPR: Math.exp(mean(rr.map(r => Math.log(r.pr)))), rpr: realisedPR(rr), medExp: median(rr.map(r => r.exp)), rows: rr };
    });
  }
  /** Factors with at least one coefficient rejected at 5% in the performance "All together" model,
   * computed on the full dataset with default controls. Tab C uses this list. */
  function performanceFactors(data, cfg) {
    const opt = { from: data.minYM, to: data.maxYM, source: 'all' };
    let r;
    try { r = b1(rowsB(data, opt), data, { ...opt, view: 'performance', factor: 'all' }, cfg); } catch (e) { return { factors: [], tests: [], error: 'The performance model cannot be fitted on this data.' }; }
    const factors = ['education', 'location', 'experience'].filter(f => r.tests.some(t => factorOf(t.level) === f && t.reject));
    return { factors, tests: r.tests };
  }

  // ---- B2
  function b2(rows, data, opt, cfg) {
    const rr = byType(rows, opt.type);
    const tests = vsRest(rr.map(r => Math.log(r.pr)), rr.map(r => r.loc), data.locations, cfg);
    tests.forEach(t => { t.nDesigners = new Set(rr.filter(r => r.loc === t.level).map(r => r.designer)).size; });
    return { tests, log: true, n: rr.length, overall: Math.exp(mean(rr.map(r => Math.log(r.pr)))), plannedH: opt.plannedH || 100, ...summarise(tests) };
  }

  // ---- B3
  function b3(rows, data, opt, cfg) {
    const rr = byType(rows, opt.type), y = rr.map(r => Math.log(r.rate * r.pr));
    const locations = vsRest(y, rr.map(r => r.loc), data.locations, cfg);
    locations.forEach(t => { t.nDesigners = new Set(rr.filter(r => r.loc === t.level).map(r => r.designer)).size; t.rate = (data.designers.get(rr.find(r => r.loc === t.level).designer) || {}).rate; });
    const names = [...new Set(rr.map(r => r.designer))];
    const designers = vsRest(y, rr.map(r => r.designer), names, cfg);
    designers.forEach(t => { const info = data.designers.get(t.level); t.loc = info.loc; t.rate = info.rate; });
    // What drives cost (descriptive): across designers with >= MIN_DESIGNER_PROJECTS projects
    const dt = designerTable(rr, data).filter(d => d.n >= cfg.MIN_DESIGNER_PROJECTS);
    const ly = dt.map(d => Math.log(d.rate * d.rpr)), la = dt.map(d => Math.log(d.rate)), lb = dt.map(d => Math.log(d.rpr));
    const va = S.variance(la), vb = S.variance(lb), my = mean(ly), sst = sum(ly.map(v => (v - my) ** 2));
    let ssw = 0; data.locations.forEach(l => { const g = dt.filter(d => d.loc === l).map(d => Math.log(d.rate * d.rpr)); const m = mean(g); g.forEach(v => { ssw += (v - m) ** 2; }); });
    const all = locations.concat(designers);
    return { locations, designers, log: true, n: rr.length, overall: Math.exp(mean(y)), shares: { performance: vb / (va + vb), rate: va / (va + vb) }, locationShare: sst ? 1 - ssw / sst : NaN,
      nDriveDesigners: dt.length, locSummary: summarise(locations), desSummary: summarise(designers), ...summarise(all) };
  }

  // ---- B4
  function b4(rows, data, opt, cfg) {
    const rr = byType(rows, opt.type), by = opt.groupBy === 'region' ? 'region' : 'loc', levels = by === 'loc' ? data.locations : REGIONS;
    const focus = opt.mode === 'under' ? 'Underrun' : 'Overrun';
    const tests = vsRest(rr.map(r => +(r.cls === focus)), rr.map(r => r[by]), levels, cfg, { proportion: true });
    const mix = levels.map(l => {
      const g = rr.filter(r => r[by] === l), c = {}; CLASSES.forEach(k => { c[k] = g.filter(r => r.cls === k).length; });
      return { level: l, n: g.length, nDesigners: new Set(g.map(r => r.designer)).size, counts: c, shares: Object.fromEntries(CLASSES.map(k => [k, g.length ? c[k] / g.length : NaN])),
        overMoney: sum(g.filter(r => r.cls === 'Overrun').map(r => r.actual - r.planned)), underMoney: sum(g.filter(r => r.cls === 'Underrun').map(r => r.planned - r.actual)) };
    }).filter(g => g.n);
    tests.forEach(t => { t.nDesigners = mix.find(m => m.level === t.level).nDesigners; });
    return { by, focus, tests, mix, n: rr.length, overall: mean(rr.map(r => +(r.cls === focus))), ...summarise(tests) };
  }

  // ---- B5
  function b5(rows, data, opt, cfg) {
    const rr = byType(rows, opt.type), years = fullYears(opt, cfg), key = opt.metric === 'margin' ? 'margin' : 'rev';
    const units = [];
    REGIONS.forEach(g => years.forEach(y => { const s = rr.filter(r => r.region === g && r.year === y); units.push({ region: g, year: y, value: sum(s.map(r => r[key])), n: s.length }); }));
    const tests = years.length >= 2 ? vsRest(units.map(u => u.value), units.map(u => u.region), REGIONS, cfg, { minN: 2 }) : [];
    tests.forEach(t => { t.nProjects = sum(units.filter(u => u.region === t.level).map(u => u.n)); });
    const winners = years.map(y => units.filter(u => u.year === y).sort((a, b) => b.value - a.value)[0]);
    const s = summarise(tests);
    if (years.length < cfg.MIN_YEARS) { s.status = 'LIMITED DATA'; }
    return { years, units, tests, winners, metric: key, overall: mean(units.map(u => u.value)), indicative: `indicative: ${years.length} years`, ...s };
  }

  // ---- B6
  function b6(rows, data, opt, cfg) {
    const types = TYPES.map(t => {
      const g = rows.filter(r => r.type === t), o = rows.filter(r => r.type !== t);
      if (!g.length) return null;
      const a = S.ratioSE(g.map(r => r.actual), g.map(r => r.planned)), b = S.ratioSE(o.map(r => r.actual), o.map(r => r.planned));
      const m = 1 - a.R, mr = 1 - b.R, rev = sum(g.map(r => r.rev)), cost = sum(g.map(r => r.cost));
      const out = { level: t, type: t, n: g.length, nDesigners: new Set(g.map(r => r.designer)).size, mean: m, se: a.se, lo95: m - S.CRIT * a.se, hi95: m + S.CRIT * a.se,
        restN: o.length, restMean: mr, restSE: b.se, limited: g.length < cfg.MIN_N, rev, cost, margin: rev - cost, marginPerProject: (rev - cost) / g.length,
        overShare: g.filter(r => r.cls === 'Overrun').length / g.length, earned: rev / sum(g.map(r => r.ah)) };
      if (!out.limited && o.length >= 2) Object.assign(out, S.test(m, a.se, mr, b.se, cfg.ALPHA));
      return out;
    }).filter(Boolean);
    const all = { rev: sum(rows.map(r => r.rev)), cost: sum(rows.map(r => r.cost)) };
    const dept = { marginPct: (all.rev - all.cost) / all.rev, marginPerProject: (all.rev - all.cost) / rows.length };
    const s = summarise(types);
    const lead = types.slice().sort((a, b) => b.mean - a.mean)[0];
    const watching = !!lead && lead.limited && types.some(t => t !== lead && t.hi95 >= lead.lo95 && t.lo95 <= lead.hi95);
    const years = [...new Set(rows.map(r => r.year))].sort();
    const trend = TYPES.map(t => ({ type: t, points: years.map(y => { const g = rows.filter(r => r.type === t && r.year === y); const rv = sum(g.map(r => r.rev)); return { year: y, n: g.length, marginPct: rv ? (rv - sum(g.map(r => r.cost))) / rv : null }; }) }));
    return { tests: types, types, dept, leader: lead ? lead.type : null, watching, trend, n: rows.length, ...s };
  }

  // ================================================================ TAB C · M1
  function fitM1(rows, data, factors, cfg, refs) {
    const des = perfDesign(rows, data, factors, cfg, refs);
    const X = rows.map(des.row), y = rows.map(r => Math.log(r.ah));
    const fit = ols(y, X, des.names, cfg.ALPHA);
    // empirical-Bayes designer adjustment
    const byD = groupBy(rows.map((r, i) => ({ d: r.designer, e: fit.e[i] })), 'd');
    const md = new Map(); let ssw = 0;
    byD.forEach((v, d) => { const m = mean(v.map(x => x.e)); md.set(d, { n: v.length, mean: m }); v.forEach(x => { ssw += (x.e - m) ** 2; }); });
    const G = md.size, sw = ssw / (rows.length - G);
    const sb = Math.max(S.variance([...md.values()].map(v => v.mean)) - sw * mean([...md.values()].map(v => 1 / v.n)), 1e-4), kShrink = sw / sb;
    const u = new Map(); md.forEach((v, d) => { const w = v.n / (v.n + kShrink); u.set(d, { u: v.mean * w, n: v.n, mean: v.mean, w }); });
    const adj = rows.map((r, i) => fit.e[i] - u.get(r.designer).u);
    const sigma = Math.sqrt(sum(adj.map(v => v * v)) / (rows.length - fit.k));
    const my = mean(y), sst = sum(y.map(v => (v - my) ** 2));
    return { des, fit, X, y, rows, u, sw, sb, kShrink, adj, sigma, meanFactor: Math.exp(sigma * sigma / 2), r2: fit.r2, adjR2: fit.adjR2,
      r2Designer: 1 - sum(adj.map(v => v * v)) / sst, rangeLo: Math.exp(-S.Z80 * sigma), rangeHi: Math.exp(S.Z80 * sigma), factors };
  }
  /** Median = exp(x'b + u_d); expected = median·exp(σ²/2); 80% range = exp(x'b + u_d ± 1.2816σ). */
  function predictM1(m, x, designer) {
    const lin = m.des.row(x).reduce((s, v, j) => s + v * m.fit.b[j], 0) + (designer && m.u.has(designer) ? m.u.get(designer).u : 0);
    const med = Math.exp(lin);
    return { median: med, mean: med * m.meanFactor, lo: med * m.rangeLo, hi: med * m.rangeHi };
  }
  const xOf = r => ({ ph: r.ph, type: r.type, edu: r.edu, loc: r.loc, exp: r.exp });
  const trainingM1 = (data, cfg) => data.valid.filter(r => r.year <= cfg.LAST_FULL_YEAR);

  function m1(data, cfg, factors) {
    const train = trainingM1(data, cfg);
    const m = fitM1(train, data, factors, cfg);
    const tr = train.filter(r => r.year <= cfg.BACKTEST_LAST_TRAIN_YEAR), te = train.filter(r => r.year > cfg.BACKTEST_LAST_TRAIN_YEAR);
    const mb = fitM1(tr, data, factors, cfg, m.des.refs), ratio = realisedPR(tr), act = te.map(r => r.ah);
    const metric = (pred, lo, hi) => {
      const err = pred.map((p, i) => p - act[i]);
      return { mae: mean(err.map(Math.abs)), mdape: median(err.map((e, i) => Math.abs(e) / act[i])), bias: sum(pred) / sum(act) - 1,
        coverage: lo ? mean(act.map((a, i) => +(a >= lo[i] && a <= hi[i]))) : null, n: act.length };
    };
    const P = te.map(r => predictM1(mb, xOf(r), r.designer));
    const backtest = { train: tr.length, test: te.length, ratioValue: ratio, plans: metric(te.map(r => r.ph)), ratio: metric(te.map(r => r.ph * ratio)), m1: metric(P.map(p => p.mean), P.map(p => p.lo), P.map(p => p.hi)) };
    const lodoErr = [];
    [...new Set(train.map(r => r.designer))].forEach(d => {
      try { const md = fitM1(train.filter(r => r.designer !== d), data, factors, cfg, m.des.refs); train.filter(r => r.designer === d).forEach(r => lodoErr.push(Math.abs(predictM1(md, xOf(r), null).mean - r.ah))); } catch (e) { /* cannot leave this designer out */ }
    });
    let robust = null;
    try { const o = fitM1(train.filter(r => r.source === 'Original'), data, factors, cfg, m.des.refs); robust = { n: o.rows.length, coefs: o.fit.coefs, r2: o.r2 }; } catch (e) { robust = null; }
    const ck = S.cooks(m.fit, m.X);
    const cooks = ck.map((c, i) => ({ c, i })).sort((a, b) => b.c - a.c).slice(0, 5).map(o => ({ id: train[o.i].id, designer: train[o.i].designer, cook: o.c, ah: train[o.i].ah, ph: train[o.i].ph }));
    return { model: m, backtest, lodoMAE: mean(lodoErr), lodoN: lodoErr.length, robust, vif: S.vif(m.X, m.des.names), bp: S.breuschPagan(m.fit, m.X), cooks };
  }

  // ================================================================ TAB C · M2
  function volumeRows(data, cfg) { return cfg.ZERO_ACTUAL_IN_VOLUMES ? data.all : data.valid; }
  const METRICS = { revenue: r => r.rev, cost: r => r.cost, plannedHours: r => r.ph, actualHours: r => r.ah, projects: () => 1 };
  function yearlySeries(rows, metric, cfg, region) {
    const f = METRICS[metric], rr = region ? rows.filter(r => r.region === region) : rows;
    const years = []; for (let y = cfg.FIRST_ANALYSIS_YEAR; y <= cfg.LAST_FULL_YEAR; y++) years.push(y);
    const hist = rr.filter(r => r.year >= cfg.FIRST_ANALYSIS_YEAR && r.year <= cfg.LAST_FULL_YEAR);
    const share = sum(hist.filter(r => r.month <= cfg.PARTIAL_LAST_MONTH).map(f)) / sum(hist.map(f));
    const partial = sum(rr.filter(r => r.year === cfg.PARTIAL_YEAR).map(f));
    return { metric, region: region || null, years, values: years.map(y => sum(rr.filter(r => r.year === y).map(f))), partial, share, estimate: partial / share };
  }
  /** Simple linear regression y = a + b·year (or ln y for % growth) with ordinary SEs and normal inference. */
  function trendFit(xs, ys, shape, cfg) {
    const yy = shape === '% growth' ? ys.map(Math.log) : ys, n = xs.length, mx = mean(xs), my = mean(yy);
    let sxy = 0, sxx = 0; xs.forEach((x, i) => { sxy += (x - mx) * (yy[i] - my); sxx += (x - mx) ** 2; });
    const b = sxy / sxx, a = my - b * mx, res = yy.map((v, i) => v - (a + b * xs[i])), sse = sum(res.map(v => v * v)), s = Math.sqrt(sse / (n - 2));
    const seB = s / Math.sqrt(sxx), t = b / seB, p = S.pValue(t), crit = S.CRIT;
    return { a, b, s, n, mx, my, sxx, res, yy, r2: 1 - sse / sum(yy.map(v => (v - my) ** 2)), shape, xs,
      slope: { b, se: seB, t, crit, p, lo: b - crit * seB, hi: b + crit * seB, reject: p < (cfg ? cfg.ALPHA : 0.05) },
      centred: { b: my, se: s / Math.sqrt(n), t: my / (s / Math.sqrt(n)), p: S.pValue(my / (s / Math.sqrt(n))), lo: my - crit * s / Math.sqrt(n), hi: my + crit * s / Math.sqrt(n) } };
  }
  /** 80% prediction interval ŷ ± 1.2816·s·√(1 + 1/n + (x0 - x̄)²/Σ(x - x̄)²); never below zero. */
  function trendForecast(fit, x0) {
    const se = fit.s * Math.sqrt(1 + 1 / fit.n + (x0 - fit.mx) ** 2 / fit.sxx), m = fit.a + fit.b * x0, lo = m - S.Z80 * se, hi = m + S.Z80 * se;
    if (fit.shape === '% growth') return { y: Math.exp(m), lo: Math.exp(lo), hi: Math.exp(hi), se, z: S.Z80 };
    return { y: Math.max(0, m), lo: Math.max(0, lo), hi: Math.max(0, hi), se, z: S.Z80 };
  }
  function m2Series(series, cfg, override) {
    const val = y => series.values[series.years.indexOf(y)];
    const combos = [];
    cfg.TREND_FIT_START_OPTIONS.forEach(start => cfg.TREND_SHAPES.forEach(shape => {
      const xs = series.years.filter(y => y >= start && y < cfg.LAST_FULL_YEAR);
      const e1 = trendForecast(trendFit(xs, xs.map(val), shape), cfg.LAST_FULL_YEAR).y / val(cfg.LAST_FULL_YEAR) - 1;
      const xs2 = series.years.filter(y => y >= start);
      const e2 = trendForecast(trendFit(xs2, xs2.map(val), shape), cfg.PARTIAL_YEAR).y / series.estimate - 1;
      combos.push({ start, shape, errLast: e1, errPartial: e2, mape: (Math.abs(e1) + Math.abs(e2)) / 2 });
    }));
    const best = combos.slice().sort((a, b) => a.mape - b.mape)[0];
    const chosen = (override && combos.find(c => c.start === override.start && c.shape === override.shape)) || best;
    const xs = series.years.filter(y => y >= chosen.start).concat([cfg.PARTIAL_YEAR]);
    const ys = series.years.filter(y => y >= chosen.start).map(val).concat([series.estimate]);
    const fit = trendFit(xs, ys, chosen.shape, cfg), fc = trendForecast(fit, cfg.FORECAST_YEAR);
    return { series, combos, best, chosen, overridden: chosen !== best, fit, forecast: fc, dw: S.durbinWatson(fit.res),
      scenarios: { average: fc.y, optimistic: fc.hi, pessimistic: Math.min(fc.lo, series.estimate) }, growthStops: series.estimate };
  }
  function m2(data, cfg, overrides = {}) {
    const rows = volumeRows(data, cfg), metrics = {};
    Object.keys(METRICS).forEach(k => { metrics[k] = m2Series(yearlySeries(rows, k, cfg), cfg, overrides[k]); });
    return { metrics, series: (metric, region, ov) => m2Series(yearlySeries(rows, metric, cfg, region), cfg, ov) };
  }

  // ================================================================ TAB C · forecasts
  function c1(data, cfg, M1, opt = {}) {
    const m = M1.model, comp = trainingM1(data, cfg), designerOpt = opt.designer || 'mix';
    return TYPES.map(t => {
      const g = comp.filter(r => r.type === t);
      if (!g.length) return null;
      const ph = opt.size === 'average' ? mean(g.map(r => r.ph)) : median(g.map(r => r.ph));
      let weights;
      if (designerOpt === 'mix') {
        let pool = data.valid.filter(r => r.type === t && r.year >= cfg.USUAL_MIX_FIRST_YEAR && r.year <= cfg.LAST_FULL_YEAR);
        if (!pool.length) pool = data.valid.filter(r => r.type === t);
        weights = [...groupBy(pool, 'designer').entries()].map(([d, rr]) => [d, rr.length / pool.length]);
      } else if (designerOpt.startsWith('loc:')) {
        const l = designerOpt.slice(4), ds = [...data.designers.values()].filter(d => d.loc === l);
        const cnt = ds.map(d => comp.filter(r => r.designer === d.name).length), tot = sum(cnt);
        weights = ds.map((d, i) => [d.name, tot ? cnt[i] / tot : 1 / ds.length]);
      } else weights = [[designerOpt.replace(/^des:/, ''), 1]];
      let E = 0, C = 0, lo = 0, hi = 0, plan = 0;
      weights.forEach(([d, w]) => {
        const info = data.designers.get(d);
        const p = predictM1(m, { ph, type: t, edu: info.edu, loc: info.loc, exp: info.yrs - (cfg.EXPERIENCE_AS_OF - cfg.FORECAST_YEAR) }, d);
        E += w * p.mean; C += w * p.mean * info.rate; lo += w * p.lo * info.rate; hi += w * p.hi * info.rate; plan += w * ph * info.rate;
      });
      const typePR = realisedPR(g);
      return { type: t, n: g.length, nDesigners: new Set(g.map(r => r.designer)).size, plannedH: ph, hours: E, cost: C, lo, hi, plan, pctOfPlan: C / plan, benchmark: plan * typePR, typePR,
        limited: m.des.pooled.includes(t) || g.length < cfg.MIN_PROJECTS, pooled: m.des.pooled.includes(t), designers: weights.length };
    }).filter(Boolean);
  }
  function shrunkPR(data, cfg) {
    const comp = trainingM1(data, cfg), dept = realisedPR(comp), map = new Map();
    groupBy(comp, 'designer').forEach((rr, d) => { const w = rr.length / (rr.length + cfg.SHRINK_K_PROJECTS); map.set(d, { pr: realisedPR(rr), n: rr.length, w, prs: w * realisedPR(rr) + (1 - w) * dept }); });
    return { dept, map };
  }
  function workload(data, cfg, M2) {
    const rows = volumeRows(data, cfg).filter(r => r.year >= cfg.WORKLOAD_SHARE_FIRST_YEAR && r.year <= cfg.PARTIAL_YEAR);
    const tot = sum(rows.map(r => r.ph)), cells = new Map();
    rows.forEach(r => { const k = r.designer + '|' + r.region; cells.set(k, (cells.get(k) || 0) + r.ph); });
    const sp = shrunkPR(data, cfg), out = {};
    ['pessimistic', 'average', 'optimistic'].forEach(sc => {
      const P = M2.metrics.plannedHours.scenarios[sc];
      out[sc] = [...cells.entries()].map(([k, v]) => {
        const [d, region] = k.split('|'), info = data.designers.get(d), s = sp.map.get(d), prs = s ? s.prs : sp.dept, share = v / tot, planned = P * share;
        return { designer: d, region, loc: info.loc, rate: info.rate, share, planned, actual: planned * prs, variance: planned * (prs - 1), money: planned * (prs - 1) * info.rate, prs, n: s ? s.n : 0, w: s ? s.w : 0, pr: s ? s.pr : NaN };
      });
    });
    return { cells: out, dept: sp.dept, shrink: sp, totalPlannedShareBase: tot };
  }
  function c4(data, cfg, M2) {
    const last = r => r.year > cfg.LAST_FULL_YEAR - cfg.COST_RATIO_YEARS && r.year <= cfg.LAST_FULL_YEAR;
    const v = data.valid.filter(last), ratio = sum(v.map(r => r.cost)) / sum(v.map(r => r.rev));
    const vol = volumeRows(data, cfg).filter(last), totRev = sum(vol.map(r => r.rev));
    const shares = { region: REGIONS.map(g => ({ key: g, share: sum(vol.filter(r => r.region === g).map(r => r.rev)) / totRev })),
      type: TYPES.map(t => ({ key: t, share: sum(vol.filter(r => r.type === t).map(r => r.rev)) / totRev })) };
    const sc = {};
    ['pessimistic', 'average', 'optimistic'].forEach(k => {
      const rev = M2.metrics.revenue.scenarios[k], cost = rev * ratio;
      sc[k] = { revenue: rev, cost, margin: rev - cost, marginPct: (rev - cost) / rev, projects: M2.metrics.projects.scenarios[k] };
    });
    return { ratio, shares, scenarios: sc, ratioYears: [cfg.LAST_FULL_YEAR - cfg.COST_RATIO_YEARS + 1, cfg.LAST_FULL_YEAR],
      range: { revenue: [M2.metrics.revenue.forecast.lo, M2.metrics.revenue.forecast.hi], projects: [M2.metrics.projects.forecast.lo, M2.metrics.projects.forecast.hi] } };
  }

  const api = { TYPES, REGIONS, EDUS, CLASSES, ym, ymYear, ymMonth, prepare, refLevel, groupBy, realisedPR, bandLabels, expBand, meter,
    allocation, tabA, rowsB, fullYears, summarise, designerYears, designerTable, b1, performanceFactors, b2, b3, b4, b5, b6, factorOf,
    perfDesign, fitM1, predictM1, m1, trainingM1, yearlySeries, trendFit, trendForecast, m2Series, m2, c1, shrunkPR, workload, c4, volumeRows };
  root.DDAnalysis = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
