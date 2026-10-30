/* Designer scatter with a fitted straight trend line, dots coloured by home location. */
(function () {
  const DD = window.DD;
  DD.charts.bScatter = function (el, pts, opt) {
    const c = DD.chartFor(el);
    const xs = pts.map(p => p.x), ys = pts.map(p => opt.log ? Math.log(p.y) : p.y);
    let line = [];
    if (pts.length > 2) {
      const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
      let sxy = 0, sxx = 0; xs.forEach((x, i) => { sxy += (x - mx) * (ys[i] - my); sxx += (x - mx) ** 2; });
      const b = sxy / sxx, a = my - b * mx, x0 = Math.min(...xs), x1 = Math.max(...xs), f = x => opt.log ? Math.exp(a + b * x) : a + b * x;
      line = [[x0, f(x0)], [x1, f(x1)]];
    }
    c.setOption(DD.baseOption({
      grid: { left: 8, right: 20, top: 26, bottom: 30, containLabel: true },
      xAxis: DD.axis({ type: 'value', name: opt.xName, nameLocation: 'middle', nameGap: 26, scale: true }),
      yAxis: DD.axis({ type: opt.log ? 'log' : 'value', name: opt.yName, scale: true, axisLabel: { fontFamily: DD.MONO, fontSize: 11, color: DD.INK2, formatter: opt.fmt } }),
      legend: { top: 0, left: 0, data: Object.keys(DD.LOC_COL).map(l => l + ' designers'), itemWidth: 10, itemHeight: 10, textStyle: { fontFamily: DD.MONO, fontSize: 11, color: DD.INK2 } },
      tooltip: { trigger: 'item', formatter: p => p.seriesType === 'line' ? '' : DD.tip(DD.esc(p.data.name), [[opt.xLabel, DD.fmt.x(p.value[0], 0)], [opt.yLabel, opt.fmtFull(p.value[1])], ['Projects (n)', DD.fmt.n(p.data.n)]]) },
      series: Object.keys(DD.LOC_COL).map(l => ({ name: l + ' designers', type: 'scatter', symbolSize: 11, itemStyle: { color: DD.LOC_COL[l], borderColor: DD.INK, borderWidth: 0.5 },
        data: pts.filter(p => p.loc === l).map(p => ({ value: [p.x, p.y], name: p.designer, n: p.n })) }))
        .concat([{ type: 'line', name: 'Trend', data: line, showSymbol: false, lineStyle: { color: DD.INK, width: 1.5, type: 'dashed' }, silent: true }]),
    }), true);
  };
})();
