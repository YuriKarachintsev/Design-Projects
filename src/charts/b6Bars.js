/* B6 · Margin per project by type with the department line. */
(function () {
  const DD = window.DD;
  DD.charts.b6Bars = function (el, res) {
    const c = DD.chartFor(el), ts = res.types;
    c.setOption(DD.baseOption({ grid: { left: 8, right: 20, top: 20, bottom: 8, containLabel: true },
      xAxis: DD.axis({ type: 'category', data: ts.map(t => `Type ${t.type}${t.limited ? ' ◌' : ''}`), axisLabel: { interval: 0, fontFamily: DD.MONO, fontSize: 11, color: DD.INK } }),
      yAxis: DD.axis({ type: 'value', axisLabel: { fontFamily: DD.MONO, fontSize: 11, color: DD.INK2, formatter: v => DD.fmt.moneyC(v) } }),
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: ps => { const t = ts[ps[0].dataIndex]; return DD.tip(`Type ${t.type}`, [['Margin per project', DD.fmt.money(t.marginPerProject)], ['Margin %', DD.fmt.pct(t.mean)], ['n projects', DD.fmt.n(t.n)]]); } },
      series: [{ type: 'bar', barWidth: '46%', data: ts.map(t => ({ value: Math.round(t.marginPerProject), itemStyle: { color: DD.TYPE_COL[t.type], opacity: t.limited ? 0.5 : 1 } })),
        label: { show: true, position: 'top', fontFamily: DD.MONO, fontSize: 11, color: DD.INK, formatter: p => DD.fmt.moneyC(p.value) },
        markLine: { silent: true, symbol: 'none', lineStyle: { type: 'dashed', color: DD.INK }, label: { formatter: 'Department', fontFamily: DD.MONO, fontSize: 10.5, color: DD.INK }, data: [{ yAxis: Math.round(res.dept.marginPerProject) }] } }] }), true);
  };
})();
