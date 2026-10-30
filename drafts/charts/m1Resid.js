/* M1 diagnostics · residuals vs fitted values. */
(function () {
  const DD = window.DD;
  DD.charts.m1Resid = function (el, m) {
    const c = DD.chartFor(el);
    c.setOption(DD.baseOption({ animation: false, grid: { left: 8, right: 10, top: 10, bottom: 30, containLabel: true },
      xAxis: DD.axis({ type: 'value', name: 'Fitted ln(actual h)', nameLocation: 'middle', nameGap: 22, scale: true }), yAxis: DD.axis({ type: 'value', name: 'Residual' }),
      tooltip: { trigger: 'item', formatter: p => DD.tip('Project', [['Fitted', DD.fmt.x(p.value[0])], ['Residual', DD.fmt.x(p.value[1])]]) },
      series: [{ type: 'scatter', symbolSize: 3, large: true, itemStyle: { color: DD.INK, opacity: 0.4 }, data: m.fit.fitted.map((f, i) => [+f.toFixed(4), +m.fit.e[i].toFixed(4)]),
        markLine: { silent: true, symbol: 'none', lineStyle: { color: DD.OVER, type: 'dashed' }, label: { show: false }, data: [{ yAxis: 0 }] } }] }), true);
  };
})();
