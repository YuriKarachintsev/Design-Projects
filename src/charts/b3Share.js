/* B3 · What drives cost: 100% bar of variance shares across designers (hours vs plan | rate). */
(function () {
  const DD = window.DD;
  DD.charts.b3Share = function (el, shares, n) {
    const c = DD.chartFor(el);
    c.setOption(DD.baseOption({ grid: { left: 4, right: 4, top: 8, bottom: 8 }, xAxis: { type: 'value', max: 1, show: false }, yAxis: { type: 'category', data: [''], show: false },
      tooltip: { trigger: 'item', formatter: p => DD.tip(p.seriesName, [['Share of the differences between designers', DD.fmt.pct(p.value)], ['Designers (n)', DD.fmt.n(n)]]) },
      series: [['Their hours vs plan', shares.performance, DD.INK], ['Their rate', shares.rate, DD.LOC_COL.West]].map(([nm, v, col]) => ({ name: nm, type: 'bar', stack: 's', barWidth: 52, data: [+v.toFixed(4)],
        itemStyle: { color: col, borderColor: '#fff', borderWidth: 2 }, label: { show: true, position: 'inside', color: '#fff', fontFamily: DD.MONO, fontSize: 13, formatter: () => `${nm} ${DD.fmt.pct(v)}` } })) }), true);
  };
})();
