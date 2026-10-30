/* C2 · Expected actual hours 2027 per region or designer: bars for the selected scenario,
 * whiskers from pessimistic to optimistic, a tick at planned hours. */
(function () {
  const DD = window.DD;
  DD.charts.c2Workload = function (el, items, opt) {
    const c = DD.chartFor(el), rs = items.slice().sort((a, b) => a.actual - b.actual);
    el.style.height = Math.max(280, rs.length * (opt.byDesigner ? 22 : 46) + 70) + 'px'; c.resize();
    c.setOption(DD.baseOption({
      grid: { left: 8, right: 60, top: 28, bottom: 8, containLabel: true },
      legend: { top: 0, left: 0, data: ['Expected actual hours', 'Planned hours', 'Pessimistic – optimistic'], itemWidth: 12, itemHeight: 8, textStyle: { fontFamily: DD.MONO, fontSize: 11, color: DD.INK2 } },
      xAxis: DD.axis({ type: 'value', axisLabel: { fontFamily: DD.MONO, fontSize: 11, color: DD.INK2, formatter: v => DD.fmt.hk(v) } }),
      yAxis: DD.axis({ type: 'category', data: rs.map(r => r.label), axisLabel: { interval: 0, fontFamily: opt.byDesigner ? "'IBM Plex Sans'" : DD.MONO, fontSize: opt.byDesigner ? 11.5 : 12, color: DD.INK, formatter: (v, i) => (rs[i].flag ? `{g|${v} ◌}` : v), rich: { g: { color: DD.INK3 } } } }),
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: ps => { const r = rs[ps[0].dataIndex]; return DD.tip(DD.esc(r.label), [['Planned hours', DD.fmt.h(r.planned)], ['Expected actual hours', DD.fmt.h(r.actual)], ['Pessimistic – optimistic', `${DD.fmt.h(r.pess)} – ${DD.fmt.h(r.opt)}`], ['vs plan', DD.fmt.pct(r.actual / r.planned - 1, true)], ['n (completed projects behind PR)', DD.fmt.n(r.n)]]); } },
      series: [
        { name: 'Expected actual hours', type: 'bar', barWidth: '54%', itemStyle: { color: '#6F7A88' }, data: rs.map(r => ({ value: Math.round(r.actual), itemStyle: { color: opt.colorOf(r) } })),
          label: { show: true, position: 'insideLeft', fontFamily: DD.MONO, fontSize: 11, color: '#fff', formatter: p => (p.value > Math.max(...rs.map(r => r.opt)) * 0.12 ? DD.fmt.hk(p.value) : '') } },
        { name: 'Pessimistic – optimistic', type: 'custom', z: 4, itemStyle: { color: DD.INK }, renderItem: (params, api) => { const r = rs[params.dataIndex], a = api.coord([r.pess, params.dataIndex]), b = api.coord([r.opt, params.dataIndex]), w = 5;
          return { type: 'group', children: [{ type: 'line', shape: { x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, style: { stroke: DD.INK, lineWidth: 1.2 } }, { type: 'line', shape: { x1: a[0], y1: a[1] - w, x2: a[0], y2: a[1] + w }, style: { stroke: DD.INK, lineWidth: 1.2 } }, { type: 'line', shape: { x1: b[0], y1: b[1] - w, x2: b[0], y2: b[1] + w }, style: { stroke: DD.INK, lineWidth: 1.2 } }] }; },
          data: rs.map((r, i) => [r.pess, r.opt, i]), encode: { x: [0, 1], y: 2 }, tooltip: { show: false } },
        { name: 'Planned hours', type: 'scatter', symbol: 'rect', symbolSize: [2, 18], z: 5, itemStyle: { color: DD.OVER }, data: rs.map((r, i) => [Math.round(r.planned), i]) },
      ],
    }), true);
  };
})();
