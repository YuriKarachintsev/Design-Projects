/* M1 diagnostics · residual boxes by project type, education and location. */
(function () {
  const DD = window.DD;
  DD.charts.m1ResidGroups = function (el, m) {
    const c = DD.chartFor(el), groups = [], q = (a, p) => DD.S.quantile(a, p);
    [1, 2, 3, 4].forEach(t => groups.push({ label: `T${t}`, v: m.rows.map((r, i) => (r.type === t ? m.fit.e[i] : null)).filter(x => x !== null), col: DD.TYPE_COL[t] }));
    ['High school', 'Bachelor degree', 'Master degree'].forEach(e => groups.push({ label: e.split(' ')[0].slice(0, 4), v: m.rows.map((r, i) => (r.edu === e ? m.fit.e[i] : null)).filter(x => x !== null), col: DD.INK2 }));
    Object.keys(DD.LOC_COL).forEach(l => groups.push({ label: l, v: m.rows.map((r, i) => (r.loc === l ? m.fit.e[i] : null)).filter(x => x !== null), col: DD.LOC_COL[l] }));
    const gs = groups.filter(g => g.v.length);
    c.setOption(DD.baseOption({ animation: false, grid: { left: 10, right: 10, top: 10, bottom: 8, containLabel: true },
      xAxis: DD.axis({ type: 'category', data: gs.map(g => g.label), axisLabel: { interval: 0, fontFamily: DD.MONO, fontSize: 10, color: DD.INK } }), yAxis: DD.axis({ type: 'value', name: 'Residual' }),
      tooltip: { trigger: 'item', formatter: p => DD.tip(gs[p.dataIndex].label, [['Median residual', DD.fmt.x(p.value[3])], ['n', gs[p.dataIndex].v.length]]) },
      series: [{ type: 'boxplot', data: gs.map(g => ({ value: [q(g.v, 0.05), q(g.v, 0.25), q(g.v, 0.5), q(g.v, 0.75), q(g.v, 0.95)], itemStyle: { color: '#fff', borderColor: g.col, borderWidth: 1.5 } })),
        markLine: { silent: true, symbol: 'none', lineStyle: { color: DD.INK3, type: 'dashed' }, label: { show: false }, data: [{ yAxis: 0 }] } }] }), true);
  };
})();
