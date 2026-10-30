/* Dot strips: one dot per designer within each group, a median tick, optional hollow list-rate marker. */
(function () {
  const DD = window.DD;
  DD.charts.bStrip = function (el, groups, opt) {
    const c = DD.chartFor(el), cats = groups.map(g => g.level), dots = [], ticks = [], rates = [];
    groups.forEach((g, i) => {
      g.points.forEach((p, k) => { const jit = g.points.length > 1 ? (k / (g.points.length - 1) - 0.5) * 0.36 : 0; dots.push({ value: [i + jit, p.v], name: p.designer, n: p.n, itemStyle: { color: opt.colorOf(g, p), opacity: p.n < (opt.minN || 0) ? 0.35 : 0.9 } }); });
      if (DD.ok(g.median)) ticks.push({ value: [i, g.median], n: g.points.length });
      if (opt.rate && DD.ok(g.rate)) rates.push({ value: [i, g.rate] });
    });
    c.setOption(DD.baseOption({
      grid: { left: 8, right: 16, top: 26, bottom: 8, containLabel: true },
      xAxis: DD.axis({ type: 'value', min: -0.5, max: cats.length - 0.5, interval: 1, splitLine: { show: false }, axisLabel: { fontFamily: DD.MONO, fontSize: 11, color: DD.INK, formatter: v => cats[Math.round(v)] || '' } }),
      yAxis: DD.axis({ type: opt.log ? 'log' : 'value', name: opt.yName, scale: !opt.log, axisLabel: { fontFamily: DD.MONO, fontSize: 11, color: DD.INK2, formatter: opt.fmt } }),
      tooltip: { trigger: 'item', formatter: p => p.seriesName === 'Designers' ? DD.tip(DD.esc(p.data.name), [[opt.yLabel, opt.fmtFull(p.value[1])], ['Projects (n)', DD.fmt.n(p.data.n)]]) :
        p.seriesName === 'Median' ? DD.tip(`${cats[p.value[0]]} · median`, [[opt.yLabel, opt.fmtFull(p.value[1])], ['Designers (n)', DD.fmt.n(p.data.n)]]) : DD.tip(`${cats[p.value[0]]} · list rate`, [['Rate', DD.fmt.rate(p.value[1])]]) },
      series: [
        { name: 'Designers', type: 'scatter', symbolSize: 10, data: dots, z: 3 },
        { name: 'Median', type: 'scatter', symbol: 'rect', symbolSize: [46, 2.5], itemStyle: { color: DD.INK }, data: ticks, z: 4 },
        ...(opt.rate ? [{ name: 'List rate', type: 'scatter', symbol: 'circle', symbolSize: 14, itemStyle: { color: 'transparent', borderColor: DD.INK, borderWidth: 1.5 }, data: rates, z: 2 }] : []),
        ...(DD.ok(opt.refLine) ? [{ type: 'line', data: [], markLine: { silent: true, symbol: 'none', lineStyle: { type: 'dashed', color: DD.INK3 }, label: { formatter: opt.refLabel, fontFamily: DD.MONO, fontSize: 10, color: DD.INK2 }, data: [{ yAxis: opt.refLine }] } }] : []),
      ],
      legend: opt.rate ? { top: 0, left: 0, data: ['Designers', 'Median', 'List rate'], itemWidth: 10, itemHeight: 10, textStyle: { fontFamily: DD.MONO, fontSize: 11, color: DD.INK2 } } : undefined,
    }), true);
  };
})();
