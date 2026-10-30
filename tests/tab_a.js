// Tab A aggregates from the browser engine, in the same shape as analysis/reference_stats.py --tab-a.
//   node tests/tab_a.js tests/_data.json '<filters JSON>'
const path = require('path'), fs = require('fs');
globalThis.jStat = require(path.join(__dirname, '..', 'vendor', 'jstat.min.js'));
require(path.join(__dirname, '..', 'src', 'stats.js'));
const A = require(path.join(__dirname, '..', 'src', 'analysis.js'));
const dump = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')), f = JSON.parse(process.argv[3]);
const data = A.prepare(dump.rows, dump.config);
const r = A.tabA(data, { ...f, granularity: 'monthly' }, dump.config);
const sum = a => a.reduce((s, v) => s + v, 0);
const out = {
  a1: Object.fromEntries(r.a1.map(d => [d.designer, Object.fromEntries(Object.entries(d.hours).filter(([, v]) => v !== 0 || true).map(([t, v]) => [t, v]))])),
  a2: Object.fromEntries(A.TYPES.map(t => { const s = r.a2.byType[t]; return [String(t), { rev: sum(s.rev), cost: sum(s.cost), margin: sum(s.rev) - sum(s.cost) }]; })),
  a3: Object.fromEntries(r.a3.rows.map(d => [d.designer, { rev: d.rev, cost: d.cost }])),
  a5: Object.fromEntries(r.a5.rows.map(d => [d.designer, { cpph: d.cpph, earned: d.earned }])),
};
console.log(JSON.stringify(out));
