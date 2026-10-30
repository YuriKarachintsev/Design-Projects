/* Findings board · "The data": a small bar chart of the group values. */
(function () {
  const DD = window.DD;
  DD.charts.bMini = function (el, items) {
    const c = DD.chartFor(el);
    c.setOption(DD.baseOption({ animationDuration: 400, grid: { left: 0, right: 0, top: 4, bottom: 14 },
      xAxis: { type: 'category', data: items.map(i => i.label), axisLine: { lineStyle: { color: DD.LINE } }, axisTick: { show: false }, axisLabel: { fontFamily: DD.MONO, fontSize: 9, color: DD.INK2, interval: 0, margin: 3 } },
      yAxis: { type: 'value', show: false, min: v => Math.min(0, v.min) },
      tooltip: { trigger: 'axis', formatter: ps => DD.tip(items[ps[0].dataIndex].full || ps[0].name, [['Value', items[ps[0].dataIndex].text], ['n', items[ps[0].dataIndex].n]]) },
      series: [{ type: 'bar', barWidth: '62%', data: items.map(i => ({ value: i.value, itemStyle: { color: i.color || DD.INK, opacity: i.limited ? 0.35 : 1 } })) }] }), true);
  };
})();
