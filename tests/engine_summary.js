// Runs the browser engine (src/stats.js + src/analysis.js) in Node on a dataset dumped by
//   python build.py --dump-json tests/_data.json
// and prints every tab B / tab C statistic as JSON, with the same keys as analysis/reference_stats.py.
//   node tests/engine_summary.js tests/_data.json [optionsJSON]
const path = require('path');
const fs = require('fs');
globalThis.jStat = require(path.join(__dirname, '..', 'vendor', 'jstat.min.js'));
const S = require(path.join(__dirname, '..', 'src', 'stats.js'));
const A = require(path.join(__dirname, '..', 'src', 'analysis.js'));

const row = t => (t.limited || !Number.isFinite(t.p) ? [t.n, t.mean, null, null] : [t.n, t.mean, t.t, t.p]);
const table = tests => Object.fromEntries(tests.map(t => [String(t.level), row(t)]));
const coefs = tests => Object.fromEntries(tests.map(t => [t.level, [t.b, t.se, t.t, t.p]]));
const verdict = r => ({ status: r.status, meter: r.meter });

function summary(dump, opts = {}) {
  const cfg = dump.config;
  S.setCritical(cfg.CRITICAL_VALUE);
  const data = A.prepare(dump.rows, cfg);
  const from = opts.from !== undefined ? opts.from : data.minYM, to = opts.to !== undefined ? opts.to : data.maxYM;
  const bopt = { from, to, source: opts.source || 'all' };
  const rows = A.rowsB(data, bopt);
  const out = { n_all: data.all.length, n_valid: data.valid.length, n_zero: data.nZero, n_b: rows.length };
  const b1 = (view, factor) => A.b1(rows, data, { ...bopt, view, factor, metric: 'revenue' }, cfg);
  const oe = b1('output', 'education'), ol = b1('output', 'location'), ox = b1('output', 'experience'), oa = b1('output', 'all');
  out.b1_output = { n: oe.n, education: table(oe.tests), location: table(ol.tests), experience: coefs(ox.tests), all: coefs(oa.tests),
    verdicts: [verdict(oe), verdict(ol), verdict(ox), verdict(oa)] };
  const pe = b1('performance', 'education'), pl = b1('performance', 'location'), px = b1('performance', 'experience'), pa = b1('performance', 'all');
  out.b1_perf = { education: table(pe.tests), location: table(pl.tests), experience: coefs(px.tests), all: coefs(pa.allCoefs), verdicts: [verdict(pe), verdict(pl), verdict(px), verdict(pa)] };
  out.performanceFactors = A.performanceFactors(data, cfg).factors;
  const b2 = A.b2(rows, data, { type: 'all', plannedH: 100 }, cfg);
  out.b2 = { tests: table(b2.tests), ...verdict(b2) };
  const b3 = A.b3(rows, data, { type: 'all' }, cfg);
  out.b3 = { locations: table(b3.locations), designers: table(b3.designers), share_perf: b3.shares.performance, share_rate: b3.shares.rate, loc_share: b3.locationShare, ...verdict(b3) };
  const b4 = A.b4(rows, data, { mode: 'over', groupBy: 'loc', type: 'all' }, cfg), b4r = A.b4(rows, data, { mode: 'over', groupBy: 'region', type: 'all' }, cfg);
  out.b4 = { loc: table(b4.tests), region: table(b4r.tests), verdicts: [verdict(b4), verdict(b4r)] };
  const b5 = A.b5(rows, data, { ...bopt, metric: 'revenue', type: 'all' }, cfg);
  out.b5 = { years: b5.years.length, tests: table(b5.tests), ...verdict(b5) };
  const b6 = A.b6(rows, data, {}, cfg);
  out.b6 = { tests: Object.fromEntries(b6.tests.map(t => ['T' + t.type, [t.n, t.mean, t.se, t.limited ? null : t.t, t.limited ? null : t.p]])), watching: b6.watching, ...verdict(b6) };
  if (opts.bOnly) return out;

  const M1 = A.m1(data, cfg, out.performanceFactors), m = M1.model;
  out.m1 = { n: m.rows.length, coefs: coefs(m.fit.coefs.map(c => ({ ...c, level: c.name }))), r2: m.r2, adjR2: m.adjR2, r2_designer: m.r2Designer, resSD: m.fit.resSD,
    sigma: m.sigma, meanFactor: m.meanFactor, range: [m.rangeLo, m.rangeHi], sw: m.sw, sb: m.sb, vif_max: Math.max(...M1.vif.map(v => v.vif)), bp_p: M1.bp.p, lodo_mae: M1.lodoMAE, pooled: m.des.pooled };
  out.backtest = { n: M1.backtest.test, plans: M1.backtest.plans, ratio: M1.backtest.ratio, m1: M1.backtest.m1 };
  out.c1 = A.c1(data, cfg, M1, { size: 'typical', designer: 'mix' }).map(t => ({ type: t.type, plannedH: t.plannedH, hours: t.hours, cost: t.cost, plan: t.plan, pct: t.pctOfPlan, lo: t.lo, hi: t.hi, benchmark: t.benchmark }));
  const M2 = A.m2(data, cfg), rv = M2.metrics.revenue;
  out.m2_revenue = { values: rv.series.values, estimate: rv.series.estimate, share: rv.series.share, chosen: [rv.chosen.start, rv.chosen.shape], errLast: rv.chosen.errLast, errPartial: rv.chosen.errPartial,
    slope: [rv.fit.slope.b, rv.fit.slope.se, rv.fit.slope.t, rv.fit.slope.p, rv.fit.slope.lo, rv.fit.slope.hi], r2: rv.fit.r2, s: rv.fit.s, forecast: [rv.forecast.y, rv.forecast.lo, rv.forecast.hi], scenarios: rv.scenarios };
  out.m2_chosen = Object.fromEntries(Object.entries(M2.metrics).map(([k, v]) => [k, [v.chosen.start, v.chosen.shape, v.forecast.y, v.forecast.lo, v.forecast.hi]]));
  const c4 = A.c4(data, cfg, M2);
  out.c4 = { ratio: c4.ratio, scenarios: c4.scenarios };
  const wl = A.workload(data, cfg, M2), cells = wl.cells.average;
  const byReg = k => Object.fromEntries(A.REGIONS.map(g => [g, cells.filter(c => c.region === g).reduce((s, c) => s + c[k], 0)]));
  const byDes = new Map(); cells.forEach(c => byDes.set(c.designer, (byDes.get(c.designer) || 0) + c.variance));
  out.c2 = { planned: M2.metrics.plannedHours.scenarios.average, actual: cells.reduce((s, c) => s + c.actual, 0), byRegion: byReg('actual') };
  out.c3 = { hours: cells.reduce((s, c) => s + c.variance, 0), money: cells.reduce((s, c) => s + c.money, 0), byRegion: byReg('variance'), overrun: Object.fromEntries([...byDes.entries()].filter(([, v]) => v > 0)) };
  return out;
}
module.exports = { summary };
if (require.main === module) {
  const dump = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  console.log(JSON.stringify(summary(dump, process.argv[3] ? JSON.parse(process.argv[3]) : {}), null, 1));
}
