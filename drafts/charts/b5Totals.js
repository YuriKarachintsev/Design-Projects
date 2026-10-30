/* B5 · Typical yearly total per project region (median bar, yearly dots). */
(function () {
  const DD = window.DD;
  DD.charts.b5Totals = function (el, res) {
    const c = DD.chartFor(el), regs = res.regions.slice().sort((a, b) => b.median - a.median);
    c.setOption(DD.baseOption({
      grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
      xAxis: DD.axis({ type: 'category', data: regs.map(r => r.level), axisLabel: { interval: 0, fontFamily: DD.MONO, fontSize: 11, color: DD.INK } }),
      yAxis: DD.axis({ type: 'value', axisLabel: { fontFamily: DD.MONO, fontSize: 11, color: DD.INK2, formatter: v => DD.fmt.moneyC(v) } }),
      tooltip: { trigger: 'item', formatter: p => p.seriesType === 'bar' ? DD.tip(`${regs[p.dataIndex].level} · typical year`, [['Median yearly total', DD.fmt.money(p.value)], ['Years (n)', res.years.length], ['Projects (n)', DD.fmt.n(regs[p.dataIndex].n)]]) : DD.tip(`${p.data.region} · ${p.data.year}`, [['Yearly total', DD.fmt.money(p.value[1])], ['Projects (n)', DD.fmt.n(p.data.n)]]) },
      series: [{ type: 'bar', barWidth: '50%', data: regs.map(r => ({ value: Math.round(r.median), itemStyle: { color: r.level === res.leader ? DD.INK : '#C9C6BE' } })),
        label: { show: true, position: 'top', fontFamily: DD.MONO, fontSize: 11, color: DD.INK, formatter: p => DD.fmt.moneyC(p.value) } },
        { type: 'scatter', symbolSize: 6, itemStyle: { color: '#fff', borderColor: DD.INK2, borderWidth: 1 }, z: 4,
          data: regs.flatMap((r, i) => r.yearly.map((v, k) => ({ value: [i, Math.round(v)], region: r.level, year: res.years[k], n: r.yearN ? r.yearN[k] : undefined }))) }],
    }), true);
  };
})();
