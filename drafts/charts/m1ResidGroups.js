/* M1 diagnostics · residual boxes by project type and by education. */
(function () {
  const DD = window.DD, S = () => DD.S;
  DD.charts.m1ResidGroups = function (el, m) {
    const c = DD.chartFor(el), groups = [];
    [1, 2, 3, 4].forEach(t => groups.push({ label: `Type ${t}`, v: m.rows.map((r, i) => (r.type === t ? m.fit.e[i] : null)).filter(x => x !== null), col: DD.TYPE_COL[t] }));
    ['High school', 'Bachelor degree', 'Master degree'].forEach(e => groups.push({ label: e.split(' ')[0], v: m.rows.map((r, i) => (r.edu === e ? m.fit.e[i] : null)).filter(x => x !== null), col: DD.INK2 }));
    const gs = groups.filter(g => g.v.length), q = (a, p) => S().quantile(a, p);
    c.setOption(DD.baseOption({ animation: false, grid: { left: 8, right: 10, top: 10, bottom: 8, containLabel: true },
      xAxis: DD.axis({ type: 'category', data: gs.map(g => g.label), axisLabel: { interval: 0, fontFamily: DD.MONO, fontSize: 10, color: DD.INK } }), yAxis: DD.axis({ type: 'value', name: 'Residual' }),
      tooltip: { trigger: 'item', formatter: p => DD.tip(gs[p.dataIndex].label, [['Median residual', DD.fmt.x(p.value[3])], ['n', gs[p.dataIndex].v.length]]) },
      series: [{ type: 'boxplot', data: gs.map(g => ({ value: [q(g.v, 0.05), q(g.v, 0.25), q(g.v, 0.5), q(g.v, 0.75), q(g.v, 0.95)], itemStyle: { color: '#fff', borderColor: g.col } })),
        markLine: { silent: true, symbol: 'none', lineStyle: { color: DD.INK3, type: 'dashed' }, label: { show: false }, data: [{ yAxis: 0 }] } }] }), true);
  };
})();
