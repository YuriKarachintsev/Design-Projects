/* M1 diagnostics · normal Q-Q plot of residuals. */
(function () {
  const DD = window.DD;
  DD.charts.m1QQ = function (el, m) {
    const c = DD.chartFor(el), e = m.fit.e.slice().sort((a, b) => a - b), n = e.length, sd = Math.sqrt(m.fit.s2);
    const pts = e.map((v, i) => [+(DD.S.normInv((i + 0.5) / n) * sd).toFixed(4), +v.toFixed(4)]);
    const lim = [pts[0][0], pts[n - 1][0]];
    c.setOption(DD.baseOption({ animation: false, grid: { left: 8, right: 10, top: 10, bottom: 30, containLabel: true },
      xAxis: DD.axis({ type: 'value', name: 'Expected (normal)', nameLocation: 'middle', nameGap: 22 }), yAxis: DD.axis({ type: 'value', name: 'Observed residual' }),
      series: [{ type: 'scatter', symbolSize: 3, large: true, itemStyle: { color: DD.INK, opacity: 0.5 }, data: pts },
        { type: 'line', data: [[lim[0], lim[0]], [lim[1], lim[1]]], showSymbol: false, lineStyle: { color: DD.OVER, type: 'dashed' }, silent: true }] }), true);
  };
})();
