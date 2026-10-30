/* Coefficient chart: effect with its 95% CI; grey when the CI crosses zero, dashed when limited. */
(function () {
  const DD = window.DD;
  DD.charts.bCoef = function (el, items, opt = {}) {
    const c = DD.chartFor(el), rows = items.slice().reverse();
    el.style.height = Math.max(200, rows.length * 34 + 70) + 'px'; c.resize();
    const grey = r => r.lo <= 0 && r.hi >= 0, fmt = opt.fmt || (v => DD.fmt.pct(v, true));
    c.setOption(DD.baseOption({
      grid: { left: 14, right: 80, top: 10, bottom: 34, containLabel: true },
      xAxis: DD.axis({ type: 'value', name: opt.xName || '% effect (95% CI)', nameLocation: 'middle', nameGap: 24, axisLabel: { fontFamily: DD.MONO, fontSize: 11, color: DD.INK2, formatter: fmt } }),
      yAxis: DD.axis({ type: 'category', data: rows.map(r => r.label), axisLabel: { interval: 0, fontFamily: "'IBM Plex Sans'", fontSize: 12, color: DD.INK } }),
      tooltip: { trigger: 'item', formatter: p => { const r = rows[p.dataIndex]; return DD.tip(DD.esc(r.label), [['Effect', fmt(r.value)], ['95% CI', `${fmt(r.lo)} to ${fmt(r.hi)}`], ['t-stat', DD.fmt.x(r.t, 2)], ['p-value', DD.fmt.p(r.p)], ['n', DD.fmt.n(opt.n)]]); } },
      series: [
        { type: 'custom', renderItem: (params, api) => { const r = rows[params.dataIndex], a = api.coord([r.lo, params.dataIndex]), b = api.coord([r.hi, params.dataIndex]);
          return { type: 'line', shape: { x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, style: { stroke: grey(r) ? DD.INK3 : DD.INK, lineWidth: 2, lineDash: r.limited ? [4, 3] : null } }; },
          data: rows.map((r, i) => [r.lo, r.hi, i]), encode: { x: [0, 1] }, z: 2, tooltip: { show: false } },
        { type: 'scatter', symbol: 'rect', symbolSize: 10, z: 3, data: rows.map((r, i) => ({ value: [r.value, i], itemStyle: { color: grey(r) ? DD.INK3 : DD.INK } })),
          label: { show: true, position: 'right', distance: 10, fontFamily: DD.MONO, fontSize: 11, color: DD.INK, formatter: p => fmt(rows[p.dataIndex].value) },
          markLine: { silent: true, symbol: 'none', lineStyle: { color: DD.INK, width: 1 }, label: { show: false }, data: [{ xAxis: 0 }] } },
      ],
    }), true);
  };
})();
