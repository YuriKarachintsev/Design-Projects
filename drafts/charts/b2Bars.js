/* B2 · Median actual hours for a project of the chosen planned size, by designer location, with IQR whiskers. */
(function () {
  const DD = window.DD;
  DD.charts.b2Bars = function (el, groups, planned) {
    const c = DD.chartFor(el), f = planned / 100, gs = groups.filter(g => g.n);
    c.setOption(DD.baseOption({
      grid: { left: 8, right: 20, top: 20, bottom: 8, containLabel: true },
      xAxis: DD.axis({ type: 'category', data: gs.map(g => g.level + ' designers'), axisLabel: { interval: 0, fontFamily: DD.MONO, fontSize: 11, color: DD.INK } }),
      yAxis: DD.axis({ type: 'value', name: 'Actual hours', min: 0, axisLabel: { fontFamily: DD.MONO, fontSize: 11, color: DD.INK2, formatter: v => DD.fmt.n(v) } }),
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: ps => { const g = gs[ps[0].dataIndex]; return DD.tip(`${g.level} designers`, [[`Median for a ${DD.fmt.n(planned)} h plan`, DD.fmt.h(g.per100 * f)], ['Middle half of projects', `${DD.fmt.h(g.q1 * f)} – ${DD.fmt.h(g.q3 * f)}`], ['Projects (n)', DD.fmt.n(g.n)], ['Designers (n)', DD.fmt.n(g.nDesigners)]]); } },
      series: [
        { type: 'bar', barWidth: '46%', data: gs.map(g => ({ value: +(g.per100 * f).toFixed(1), itemStyle: { color: DD.locCol(g.level), opacity: g.limited ? 0.4 : 1 } })),
          label: { show: true, position: 'insideTop', fontFamily: DD.MONO, fontSize: 12, color: '#fff', formatter: p => DD.fmt.n(p.value) },
          markLine: { silent: true, symbol: 'none', lineStyle: { type: 'dashed', color: DD.INK }, label: { formatter: `Plan ${DD.fmt.n(planned)} h`, fontFamily: DD.MONO, fontSize: 10.5, color: DD.INK }, data: [{ yAxis: planned }] } },
        { type: 'custom', renderItem: (params, api) => {
          const lo = api.coord([params.dataIndex, api.value(1)]), hi = api.coord([params.dataIndex, api.value(2)]), w = 10;
          return { type: 'group', children: [{ type: 'line', shape: { x1: lo[0], y1: lo[1], x2: hi[0], y2: hi[1] }, style: { stroke: DD.INK, lineWidth: 1.2 } },
            { type: 'line', shape: { x1: lo[0] - w, y1: lo[1], x2: lo[0] + w, y2: lo[1] }, style: { stroke: DD.INK, lineWidth: 1.2 } },
            { type: 'line', shape: { x1: hi[0] - w, y1: hi[1], x2: hi[0] + w, y2: hi[1] }, style: { stroke: DD.INK, lineWidth: 1.2 } }] };
        }, data: gs.map((g, i) => [i, g.q1 * f, g.q3 * f]), z: 5, tooltip: { show: false } },
      ],
    }), true);
  };
})();
