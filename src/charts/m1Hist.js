/* M1 diagnostics · histogram of residuals (after the designer adjustment) with the fitted normal curve. */
(function () {
  const DD = window.DD;
  DD.charts.m1Hist = function (el, m) {
    const c = DD.chartFor(el), e = m.adj, sd = m.sigma, mn = Math.min(...e), mx = Math.max(...e), bins = 36, w = (mx - mn) / bins;
    const counts = new Array(bins).fill(0); e.forEach(v => { counts[Math.min(bins - 1, Math.floor((v - mn) / w))]++; });
    const mids = counts.map((_, i) => mn + w * (i + 0.5)), phi = x => Math.exp(-x * x / (2 * sd * sd)) / (sd * Math.sqrt(2 * Math.PI));
    c.setOption(DD.baseOption({ animation: false, grid: { left: 10, right: 10, top: 10, bottom: 30, containLabel: true },
      xAxis: DD.axis({ type: 'value', name: 'Residual', nameLocation: 'middle', nameGap: 22, min: mn, max: mx }), yAxis: DD.axis({ type: 'value', name: 'Projects', nameLocation: 'middle', nameGap: 30, nameRotate: 90 }),
      tooltip: { trigger: 'item', formatter: p => DD.tip(`Residual ≈ ${DD.fmt.x(p.value[0])}`, [['Projects (n)', p.value[1]]]) },
      series: [{ type: 'bar', barWidth: '92%', data: mids.map((x, i) => [+x.toFixed(3), counts[i]]), itemStyle: { color: '#C9C6BE' } },
        { type: 'line', showSymbol: false, data: mids.map(x => [+x.toFixed(3), +(phi(x) * e.length * w).toFixed(2)]), lineStyle: { color: DD.INK, width: 2 }, silent: true, tooltip: { show: false } }] }), true);
  };
})();
