// Runs the browser engine (src/stats.js + src/analysis.js) in Node on a dataset dumped by
//   python build.py --dump-json tests/_data.json
// and prints the sanity values as JSON (for comparison with analysis/reference_stats.py).
//   node tests/engine_summary.js tests/_data.json [optionsJSON]
const path = require('path');
const fs = require('fs');
globalThis.jStat = require(path.join(__dirname, '..', 'vendor', 'jstat.min.js'));
require(path.join(__dirname, '..', 'src', 'stats.js'));
const A = require(path.join(__dirname, '..', 'src', 'analysis.js'));

function summary(dump, opts = {}) {
  const cfg = dump.config, data = A.prepare(dump.rows, cfg);
  const from = opts.from !== undefined ? opts.from : data.minYM, to = opts.to !== undefined ? opts.to : data.maxYM;
  const bopt = { from, to, source: opts.source || 'all' };
  const rows = A.rowsB(data, bopt);
  const out = { n_all: data.all.length, n_valid: data.valid.length, n_zero: data.nZero };
  const o = A.b1(rows, data, { ...bopt, view: 'output', factor: 'all' }, cfg).output;
  out.b1_output = { edu_p: o.education.p, loc_p: o.location.p, exp_rho: o.experience.rho, exp_p: o.experience.p,
    joint_edu_p: o.joint && o.joint.tests.education.p, joint_loc_p: o.joint && o.joint.tests.location.p, joint_exp_p: o.joint && o.joint.tests.experience.p };
  const p = A.b1(rows, data, { ...bopt, view: 'performance', factor: 'all' }, cfg).performance;
  const pct = n => { const c = p.joint.coefs.find(c => c.name === n); return c ? Math.exp(c.b) - 1 : null; };
  out.b1_perf = { edu_p: p.joint.tests.education.p, loc_p: p.joint.tests.location.p, exp_p: p.joint.tests.experience.p,
    hs_pct: pct('Education: High school'), master_pct: pct('Education: Master degree'), south_pct: pct('Location: South'),
    single_edu_proj_p: p.single.education.project.p, single_edu_des_p: p.single.education.designer.p,
    single_loc_proj_p: p.single.location.project.p, single_loc_des_p: p.single.location.designer.p,
    single_exp_proj_p: p.single.experience.project.p, single_exp_des_p: p.single.experience.designer.p };
  out.performanceFactors = A.performanceFactors(data, cfg).factors;
  const b2 = A.b2(rows, data, { type: 'all', plannedH: 100 }, cfg);
  out.b2 = { per100: Object.fromEntries(b2.groups.map(g => [g.level, g.per100])), proj_p: b2.project.p, des_p: b2.designer.p, status: b2.status, meter: b2.meter };
  const b3 = A.b3(rows, data, { type: 'all' }, cfg);
  out.b3 = { min: [b3.designers[0].designer, b3.designers[0].cpph], max: [b3.designers[b3.designers.length - 1].designer, b3.designers[b3.designers.length - 1].cpph],
    des_p: b3.desTest.p, loc_p: b3.locTest.p, loc_proj_p: b3.locProj.p, share_perf: b3.shares.performance, share_rate: b3.shares.rate, loc_share: b3.locationShare, status: b3.status, meter: b3.meter };
  const b4 = A.b4(rows, data, { mode: 'over', groupBy: 'loc', type: 'all' }, cfg);
  out.b4 = { over: Object.fromEntries(b4.groups.map(g => [g.level, g.shares.Overrun])), chi_p: b4.chi.p, des_p: b4.designerTest.p, status: b4.status, meter: b4.meter };
  const b4r = A.b4(rows, data, { mode: 'over', groupBy: 'region', type: 'all' }, cfg);
  out.b4_region = { chi_p: b4r.chi.p, status: b4r.status };
  const b5 = A.b5(rows, data, { ...bopt, metric: 'revenue', type: 'all' }, cfg);
  out.b5 = { median: Object.fromEntries(b5.regions.map(r => [r.level, r.median])), p: b5.kw.p, leader: b5.leader, proven: b5.proven,
    pairs: Object.fromEntries(b5.pairs.map(q => [q.a + '-' + q.b, q.pHolm])), status: b5.status, meter: b5.meter };
  const b6 = A.b6(rows, data, {}, cfg);
  out.b6 = { margin: Object.fromEntries(b6.types.map(t => ['T' + t.type, t.marginPct])), ranges: Object.fromEntries(b6.types.map(t => ['T' + t.type, t.range])),
    p: b6.kw.p, leader: b6.leader, watching: b6.watching, status: b6.status, meter: b6.meter };
  if (opts.bOnly) return out;
  // tab C (always full data)
  const M1 = A.m1(data, cfg, out.performanceFactors), m = M1.model;
  out.m1 = { n: m.rows.length, coefs: Object.fromEntries(m.fit.coefs.map(c => [c.name, c.b])), p: Object.fromEntries(m.fit.coefs.map(c => [c.name, c.p])),
    r2: m.r2, r2_designer: m.r2Designer, resSD: m.fit.resSD, smear: m.smear, range: [Math.exp(m.q10), Math.exp(m.q90)], vif_max: Math.max(...M1.vif.map(v => v.vif)),
    sw: m.sw, sb: m.sb, pooled: m.des.pooled, bp_p: M1.bp.p, lodo_mae: M1.lodoMAE };
  out.backtest = { n: M1.backtest.test, plans: M1.backtest.plans, ratio: M1.backtest.ratio, m1: M1.backtest.m1 };
  out.c1 = A.c1(data, cfg, M1, { size: 'typical', designer: 'mix' }).map(t => ({ type: t.type, plannedH: t.plannedH, hours: t.hours, cost: t.cost, plan: t.plan, pct: t.pctOfPlan, lo: t.lo, hi: t.hi, benchmark: t.benchmark }));
  const M2 = A.m2(data, cfg);
  const rv = M2.metrics.revenue;
  out.m2_revenue = { values: rv.series.values, estimate: rv.series.estimate, share: rv.series.share, chosen: [rv.chosen.start, rv.chosen.shape], errLast: rv.chosen.errLast, errPartial: rv.chosen.errPartial,
    slope: rv.fit.b, r2: rv.fit.r2, forecast: [rv.forecast.y, rv.forecast.lo, rv.forecast.hi], scenarios: rv.scenarios };
  out.m2_chosen = Object.fromEntries(Object.entries(M2.metrics).map(([k, v]) => [k, [v.chosen.start, v.chosen.shape, v.forecast.y, v.forecast.lo, v.forecast.hi]]));
  const c4 = A.c4(data, cfg, M2);
  out.c4 = { ratio: c4.ratio, average: c4.scenarios.average, projects: [c4.scenarios.average.projects, ...c4.range.projects] };
  const wl = A.workload(data, cfg, M2), cells = wl.cells.average;
  const byReg = k => Object.fromEntries(A.REGIONS.map(g => [g, cells.filter(c => c.region === g).reduce((s, c) => s + c[k], 0)]));
  const byDes = new Map(); cells.forEach(c => byDes.set(c.designer, (byDes.get(c.designer) || 0) + c.variance));
  out.c2 = { planned: M2.metrics.plannedHours.scenarios.average, actual: cells.reduce((s, c) => s + c.actual, 0), byRegion: byReg('actual') };
  out.c3 = { hours: cells.reduce((s, c) => s + c.variance, 0), money: cells.reduce((s, c) => s + c.money, 0), byRegion: byReg('variance'),
    overrun: Object.fromEntries([...byDes.entries()].filter(([, v]) => v > 0)) };
  return out;
}
module.exports = { summary };
if (require.main === module) {
  const dump = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const opts = process.argv[3] ? JSON.parse(process.argv[3]) : {};
  console.log(JSON.stringify(summary(dump, opts), null, 1));
}
