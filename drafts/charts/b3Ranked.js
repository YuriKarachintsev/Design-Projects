/* B3 · Designers ranked by cost per planned hour, coloured by location, with a list-rate tick. */
(function () {
  const DD = window.DD;
  DD.charts.b3Ranked = function (el, designers) {
    const c = DD.chartFor(el), rows = designers.slice().sort((a, b) => b.cpph - a.cpph);
    el.style.height = Math.max(320, rows.length * 22 + 60) + 'px'; c.resize();
    c.setOption(DD.baseOption({
      grid: { left: 8, right: 50, top: 26, bottom: 8, containLabel: true },
      legend: { top: 0, left: 0, data: ['Cost per planned hour', 'List rate'], itemWidth: 10, itemHeight: 10, textStyle: { fontFamily: DD.MONO, fontSize: 11, color: DD.INK2 } },
      xAxis: DD.axis({ type: 'value', axisLabel: { fontFamily: DD.MONO, fontSize: 11, color: DD.INK2, formatter: v => DD.fmt.rateN(v) } }),
      yAxis: DD.axis({ type: 'category', data: rows.map(r => r.designer), axisLabel: { interval: 0, fontFamily: "'IBM Plex Sans'", fontSize: 12, color: DD.INK } }),
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: ps => { const r = rows[ps[0].dataIndex]; return DD.tip(`${DD.esc(r.designer)} · ${r.loc}`, [['Cost per planned hour', DD.fmt.rate(r.cpph)], ['List rate', DD.fmt.rate(r.rate)], ['Hours vs plan (realised PR)', DD.fmt.pr(r.rpr)], ['Projects (n)', DD.fmt.n(r.n)]]); } },
      series: [{ name: 'Cost per planned hour', type: 'bar', barWidth: '60%', data: rows.map(r => ({ value: +r.cpph.toFixed(2), itemStyle: { color: DD.locCol(r.loc) } })),
        label: { show: true, position: 'right', fontFamily: DD.MONO, fontSize: 11, color: DD.INK, formatter: p => DD.fmt.rateN(p.value) } },
        { name: 'List rate', type: 'scatter', symbol: 'rect', symbolSize: [2, 16], itemStyle: { color: DD.INK }, data: rows.map((r, i) => [r.rate, i]), z: 4 }],
    }), true);
  };
})();
