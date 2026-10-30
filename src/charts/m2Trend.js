/* M2 · Yearly totals with the fitted trend: dots (grey before the fit start), a hollow dot for the
 * partial-year estimate, the fitted line with a dashed extension to the forecast year, the 80% band,
 * scenario markers and a dashed wine "growth stops" line. */
(function () {
  const DD = window.DD;
  DD.charts.m2Trend = function (el, s, opt) {
    const c = DD.chartFor(el), cfg = DD.cfg, f = s.fit, fy = cfg.FORECAST_YEAR, py = cfg.PARTIAL_YEAR;
    const fmt = opt.fmt, full = opt.fmtFull, start = s.chosen.start;
    const yhat = x => (f.shape === '% growth' ? Math.exp(f.a + f.b * x) : f.a + f.b * x);
    const band = [];
    for (let x = start; x <= fy + 0.001; x += 0.25) { const fc = DD.A.trendForecast(f, x); band.push([x, fc.lo, fc.hi]); }
    const sc = s.scenarios, hl = opt.scenario;
    const scen = [['pessimistic', 'Pessimistic'], ['average', 'Average'], ['optimistic', 'Optimistic']].map(([k, l]) => ({ value: [fy, sc[k]], name: l, k,
      symbol: k === 'average' ? 'circle' : 'diamond', symbolSize: k === hl ? 14 : 9, itemStyle: { color: k === hl ? DD.INK : '#fff', borderColor: DD.INK, borderWidth: 1.5 } }));
    c.setOption(DD.baseOption({
      grid: { left: opt.compact ? 8 : 24, right: opt.compact ? 70 : 90, top: opt.compact ? 12 : 34, bottom: 26, containLabel: true },
      legend: opt.compact ? undefined : { top: 0, left: 0, itemWidth: 12, itemHeight: 8, textStyle: { fontFamily: DD.MONO, fontSize: 11, color: DD.INK2 }, data: ['Actual years', `${py} estimate`, 'Fitted line', '80% band', 'Scenarios', 'Growth stops'] },
      xAxis: DD.axis({ type: 'value', min: s.series.years[0] - 0.5, max: fy + 0.5, interval: 1, axisLabel: { fontFamily: DD.MONO, fontSize: 11, color: DD.INK2, formatter: v => (Number.isInteger(v) ? (v === py ? v + 'e' : String(v)) : '') } }),
      yAxis: DD.axis({ type: 'value', name: opt.compact ? '' : opt.label, nameLocation: 'middle', nameGap: 56, nameRotate: 90, scale: true, axisLabel: { fontFamily: DD.MONO, fontSize: 11, color: DD.INK2, formatter: fmt } }),
      tooltip: { trigger: 'item', formatter: p => p.seriesName === 'Scenarios' ? DD.tip(`${fy} · ${p.data.name}`, [[opt.label, full(p.value[1])], ['80% range', `${full(s.forecast.lo)} – ${full(s.forecast.hi)}`]])
        : p.seriesName === `${py} estimate` ? DD.tip(`${py} (estimate)`, [['Jan–' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][cfg.PARTIAL_LAST_MONTH - 1] + ' actual', full(s.series.partial)], ['÷ share of year', DD.fmt.pct(s.series.share)], ['Full-year estimate', full(p.value[1])]])
          : p.seriesName === 'Actual years' ? DD.tip(String(p.value[0]), [[opt.label, full(p.value[1])], ['In the fit', p.value[0] >= start ? 'yes' : 'no']]) : '' },
      series: [
        { name: '80% band', type: 'custom', silent: true, data: [0], z: 1, itemStyle: { color: 'rgba(31,42,55,0.10)' }, tooltip: { show: false },
          renderItem: (params, api) => ({ type: 'polygon', shape: { points: band.map(b => api.coord([b[0], b[2]])).concat(band.slice().reverse().map(b => api.coord([b[0], b[1]]))) }, style: { fill: 'rgba(31,42,55,0.10)' } }) },
        { name: 'Fitted line', type: 'line', showSymbol: false, data: [[start, yhat(start)], [py, yhat(py)]], lineStyle: { color: DD.INK, width: 2 }, itemStyle: { color: DD.INK }, silent: true },
        { name: 'Fitted line', type: 'line', showSymbol: false, data: [[py, yhat(py)], [fy, yhat(fy)]], lineStyle: { color: DD.INK, width: 2, type: 'dashed' }, itemStyle: { color: DD.INK }, silent: true },
        { name: 'Actual years', type: 'scatter', symbolSize: 9, z: 4, data: s.series.years.map((y, i) => ({ value: [y, s.series.values[i]], itemStyle: { color: y >= start ? DD.INK : '#C9C6BE' } })), itemStyle: { color: DD.INK } },
        { name: `${py} estimate`, type: 'scatter', symbolSize: 11, z: 4, data: [[py, s.series.estimate]], itemStyle: { color: '#fff', borderColor: DD.INK, borderWidth: 2 } },
        { name: 'Growth stops', type: 'line', showSymbol: false, data: [[py, s.growthStops], [fy, s.growthStops]], lineStyle: { color: DD.OVER, type: 'dashed', width: 1.5 }, itemStyle: { color: DD.OVER }, silent: true },
        { name: 'Scenarios', type: 'scatter', z: 5, data: scen, itemStyle: { color: DD.INK },
          label: { show: true, position: 'right', distance: 8, fontFamily: DD.MONO, fontSize: 10.5, color: DD.INK, formatter: p => `${p.data.name.slice(0, opt.compact ? 3 : 20)} ${fmt(p.value[1])}` } },
      ],
    }), true);
  };
})();
