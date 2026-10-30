/* B3 · What drives cost: 100% bar of variance shares (hours vs plan | rate). */
(function () {
  const DD = window.DD;
  DD.charts.b3Share = function (el, shares) {
    const c = DD.chartFor(el);
    c.setOption(DD.baseOption({
      grid: { left: 8, right: 8, top: 10, bottom: 10, containLabel: false },
      xAxis: { type: 'value', max: 1, show: false }, yAxis: { type: 'category', data: [''], show: false },
      tooltip: { trigger: 'item', formatter: p => DD.tip(p.seriesName, [['Share of the differences between designers', DD.fmt.pct(p.value)]]) },
      series: [['Their hours vs plan', shares.performance, DD.INK], ['Their rate', shares.rate, DD.LOC_COL.East]].map(([n, v, col]) => ({ name: n, type: 'bar', stack: 's', barWidth: 46, data: [+v.toFixed(4)], itemStyle: { color: col, borderColor: '#fff', borderWidth: 2 },
        label: { show: true, position: 'inside', color: '#fff', fontFamily: DD.MONO, fontSize: 13, formatter: () => `${n} ${DD.fmt.pct(v)}` } })),
    }), true);
  };
})();
