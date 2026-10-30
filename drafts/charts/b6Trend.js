/* B6 · Margin % by start year and project type. */
(function () {
  const DD = window.DD;
  DD.charts.b6Trend = function (el, res) {
    const c = DD.chartFor(el), years = res.trend[0].points.map(p => String(p.year));
    c.setOption(DD.baseOption({
      grid: { left: 8, right: 20, top: 30, bottom: 8, containLabel: true },
      legend: { top: 0, left: 0, itemWidth: 14, itemHeight: 8, textStyle: { fontFamily: DD.MONO, fontSize: 11, color: DD.INK2 } },
      xAxis: DD.axis({ type: 'category', data: years }),
      yAxis: DD.axis({ type: 'value', axisLabel: { fontFamily: DD.MONO, fontSize: 11, color: DD.INK2, formatter: v => DD.fmt.pct(v) } }),
      tooltip: { trigger: 'axis', formatter: ps => DD.tip(ps[0].axisValue, ps.filter(p => p.value !== null && p.value !== undefined).map(p => [`<span style="color:${p.color}">■</span> ${p.seriesName}`, `${DD.fmt.pct(p.value)} (n=${p.data.n})`])) },
      series: res.trend.filter(t => t.points.some(p => p.n)).map(t => ({ name: `Type ${t.type}`, type: 'line', connectNulls: false, symbolSize: 6, itemStyle: { color: DD.TYPE_COL[t.type] }, lineStyle: { width: 2, type: t.points.reduce((s, p) => s + p.n, 0) < 20 ? 'dashed' : 'solid' },
        data: t.points.map(p => ({ value: p.marginPct === null ? null : +p.marginPct.toFixed(4), n: p.n })) })),
    }), true);
  };
})();
