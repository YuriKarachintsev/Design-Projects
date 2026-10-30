/* Forest plot of % effects with 95% ranges; grey when the range crosses zero, dashed when limited. */
(function () {
  const DD = window.DD;
  DD.charts.bForest = function (el, items, opt = {}) {
    const c = DD.chartFor(el), rows = items.slice().reverse();
    el.style.height = Math.max(200, rows.length * 34 + 70) + 'px'; c.resize();
    const col = r => (r.lo <= 0 && r.hi >= 0) ? DD.INK3 : DD.INK;
    c.setOption(DD.baseOption({
      grid: { left: 8, right: 70, top: 10, bottom: 34, containLabel: true },
      xAxis: DD.axis({ type: 'value', name: opt.xName || '% effect (95% range)', nameLocation: 'middle', nameGap: 24, axisLabel: { fontFamily: DD.MONO, fontSize: 11, color: DD.INK2, formatter: v => DD.fmt.pct(v, true) } }),
      yAxis: DD.axis({ type: 'category', data: rows.map(r => r.label), axisLabel: { interval: 0, fontFamily: "'IBM Plex Sans'", fontSize: 12, color: DD.INK } }),
      tooltip: { trigger: 'item', formatter: p => { const r = rows[p.dataIndex]; return DD.tip(DD.esc(r.label), [['Effect', DD.fmt.pct(r.pct, true)], ['95% range', `${DD.fmt.pct(r.lo, true)} to ${DD.fmt.pct(r.hi, true)}`], ...(r.n !== undefined ? [['n', DD.fmt.n(r.n)]] : []), ...(r.note ? [['Note', r.note]] : [])]); } },
      series: [
        { type: 'custom', renderItem: (params, api) => {
          const r = rows[params.dataIndex], a = api.coord([r.lo, params.dataIndex]), b = api.coord([r.hi, params.dataIndex]);
          return { type: 'line', shape: { x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, style: { stroke: col(r), lineWidth: 2, lineDash: r.limited ? [4, 3] : null } };
        }, data: rows.map(r => [r.lo, r.hi]), encode: { x: [0, 1] }, z: 2 },
        { type: 'scatter', symbol: 'rect', symbolSize: 10, data: rows.map((r, i) => ({ value: [r.pct, i], itemStyle: { color: col(r) } })), z: 3,
          label: { show: true, position: 'right', distance: 10, fontFamily: DD.MONO, fontSize: 11, color: DD.INK, formatter: p => DD.fmt.pct(rows[p.dataIndex].pct, true) },
          markLine: { silent: true, symbol: 'none', lineStyle: { color: DD.INK, width: 1 }, label: { show: false }, data: [{ xAxis: 0 }] } },
      ],
    }), true);
  };
})();
