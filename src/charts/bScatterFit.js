/* Experience scatter with the fitted OLS line and its 95% band (mean ± 1.96·SE of the fitted value). */
(function () {
  const DD = window.DD;
  DD.charts.bScatterFit = function (el, pts, fit, opt) {
    const c = DD.chartFor(el), xs = pts.map(p => p.x), x0 = Math.min(...xs), x1 = Math.max(...xs);
    const V = (() => { const s2 = fit.s2, M = fit.XtXi; return [[M[0][0] * s2, M[0][1] * s2], [M[1][0] * s2, M[1][1] * s2]]; })();
    const line = [], band = [];
    for (let k = 0; k <= 30; k++) {
      const x = x0 + (x1 - x0) * k / 30, xs10 = x / opt.scale, yhat = fit.b[0] + fit.b[1] * xs10;
      const se = Math.sqrt(V[0][0] + 2 * xs10 * V[0][1] + xs10 * xs10 * V[1][1]), tr = opt.back || (v => v);
      line.push([x, tr(yhat)]); band.push([x, tr(yhat - DD.S.CRIT * se), tr(yhat + DD.S.CRIT * se)]);
    }
    const locs = Object.keys(DD.LOC_COL);
    c.setOption(DD.baseOption({
      grid: { left: 24, right: 20, top: 34, bottom: 34, containLabel: true },
      legend: { top: 0, left: 0, data: locs.map(l => l + ' designers').concat(['Fitted line', '95% band']), itemWidth: 10, itemHeight: 10, textStyle: { fontFamily: DD.MONO, fontSize: 11, color: DD.INK2 } },
      xAxis: DD.axis({ type: 'value', name: opt.xName, nameLocation: 'middle', nameGap: 26, scale: true }),
      yAxis: DD.axis({ type: opt.log ? 'log' : 'value', name: opt.yName, nameLocation: 'middle', nameGap: 52, nameRotate: 90, scale: true, axisLabel: { fontFamily: DD.MONO, fontSize: 11, color: DD.INK2, formatter: opt.fmt } }),
      tooltip: { trigger: 'item', formatter: p => (p.seriesType === 'scatter' ? DD.tip(DD.esc(p.data.name), [[opt.xLabel, DD.fmt.x(p.value[0], 0)], [opt.yLabel, opt.fmtFull(p.value[1])], ['n', DD.fmt.n(p.data.n)]]) : '') },
      series: locs.map(l => ({ name: l + ' designers', type: 'scatter', symbolSize: opt.small ? 6 : 10, itemStyle: { color: DD.LOC_COL[l], borderColor: DD.INK, borderWidth: 0.4, opacity: 0.85 },
        data: pts.filter(p => p.loc === l).map(p => ({ value: [p.x, p.y], name: p.label, n: p.n })) }))
        .concat([
          { name: '95% band', type: 'custom', silent: true, itemStyle: { color: 'rgba(31,42,55,0.12)' }, data: [0], z: 1, tooltip: { show: false },
            renderItem: (params, api) => ({ type: 'polygon', shape: { points: band.map(b => api.coord([b[0], b[2]])).concat(band.slice().reverse().map(b => api.coord([b[0], b[1]]))) }, style: { fill: 'rgba(31,42,55,0.12)' } }) },
          { name: 'Fitted line', type: 'line', data: line, showSymbol: false, lineStyle: { color: DD.INK, width: 2 }, itemStyle: { color: DD.INK }, silent: true },
        ]),
    }), true);
  };
})();
