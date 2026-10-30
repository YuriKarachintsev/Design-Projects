/* Findings board · "The data": mini dots with 95% CI whiskers. */
(function () {
  const DD = window.DD;
  DD.charts.bMiniCI = function (el, items, opt = {}) {
    const c = DD.chartFor(el), lo = Math.min(...items.map(i => i.lo)), hi = Math.max(...items.map(i => i.hi));
    c.setOption(DD.baseOption({ animationDuration: 450, grid: { left: 2, right: 2, top: 4, bottom: 14 },
      xAxis: { type: 'category', data: items.map(i => i.label), axisLine: { lineStyle: { color: DD.LINE } }, axisTick: { show: false }, axisLabel: { fontFamily: DD.MONO, fontSize: 9, color: DD.INK2, interval: 0, margin: 3 } },
      yAxis: { type: opt.log ? 'log' : 'value', show: false, min: lo - (opt.log ? 0 : (hi - lo) * 0.08), max: hi + (opt.log ? 0 : (hi - lo) * 0.08), scale: true },
      tooltip: { trigger: 'item', formatter: p => { const i = items[p.dataIndex]; return DD.tip(i.full, [['Value', i.text], ['95% CI', i.ciText], ['n', i.n]]); } },
      series: [
        { type: 'custom', renderItem: (params, api) => { const a = api.coord([params.dataIndex, api.value(1)]), b = api.coord([params.dataIndex, api.value(2)]);
          return { type: 'line', shape: { x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, style: { stroke: items[params.dataIndex].limited ? DD.INK3 : DD.INK, lineWidth: 1.2, lineDash: items[params.dataIndex].limited ? [2, 2] : null } }; },
          data: items.map((i, k) => [k, i.lo, i.hi]), z: 2, tooltip: { show: false } },
        { type: 'scatter', symbolSize: 6, z: 3, data: items.map((i, k) => ({ value: [k, i.value], itemStyle: { color: i.limited ? '#fff' : (i.color || DD.INK), borderColor: i.color || DD.INK, borderWidth: 1.2 } })) },
        ...(DD.ok(opt.ref) ? [{ type: 'line', data: [], markLine: { silent: true, symbol: 'none', lineStyle: { type: 'dashed', color: DD.INK3, width: 1 }, label: { show: false }, data: [{ yAxis: opt.ref }] } }] : []),
      ] }), true);
  };
})();
