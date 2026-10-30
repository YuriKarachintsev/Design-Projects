/* B5 · Yearly small multiples per region, plus a "winner of each year" strip. */
(function () {
  const DD = window.DD;
  DD.charts.b5Yearly = function (el, res) {
    const c = DD.chartFor(el), regs = res.regions, n = regs.length, yrs = res.years.map(String);
    const max = Math.max(...regs.flatMap(r => r.yearly));
    const grids = regs.map((r, i) => ({ left: `${2 + i * 24.5}%`, width: '21%', top: 28, bottom: 50, containLabel: false }));
    c.setOption(DD.baseOption({
      grid: grids.concat([{ left: '2%', right: '2%', bottom: 6, height: 22 }]),
      title: regs.map((r, i) => ({ text: r.level, left: `${2 + i * 24.5}%`, top: 4, textStyle: { fontFamily: "'Barlow Condensed'", fontSize: 14, fontWeight: 600, color: DD.INK } })),
      xAxis: regs.map((r, i) => DD.axis({ type: 'category', gridIndex: i, data: yrs, axisLabel: { fontFamily: DD.MONO, fontSize: 9, color: DD.INK2, interval: 'auto' } })).concat([{ type: 'category', gridIndex: n, data: yrs, show: false }]),
      yAxis: regs.map((r, i) => DD.axis({ type: 'value', gridIndex: i, max, show: i === 0, axisLabel: { fontFamily: DD.MONO, fontSize: 9, color: DD.INK2, formatter: v => DD.fmt.moneyC(v) } })).concat([{ type: 'value', gridIndex: n, show: false }]),
      tooltip: { trigger: 'item', formatter: p => p.seriesName === 'winner' ? DD.tip(`${p.name}: ${p.data.region} leads`, [['Total', DD.fmt.money(p.data.v)]]) : DD.tip(`${p.seriesName} · ${p.name}`, [['Total', DD.fmt.money(p.value)], ['Projects (n)', DD.fmt.n(p.data.n)]]) },
      series: regs.map((r, i) => ({ name: r.level, type: 'bar', xAxisIndex: i, yAxisIndex: i, barWidth: '60%', data: r.yearly.map((v, k) => ({ value: Math.round(v), n: r.yearN[k], itemStyle: { color: res.winners[k] && res.winners[k].region === r.level ? DD.INK : '#C9C6BE' } })) }))
        .concat([{ name: 'winner', type: 'bar', xAxisIndex: n, yAxisIndex: n, barWidth: '96%', data: res.winners.map(w => ({ value: 1, region: w.region, v: w.v, itemStyle: { color: '#F1EFEA', borderColor: '#fff' } })),
          label: { show: true, position: 'inside', fontFamily: DD.MONO, fontSize: 10, color: DD.INK, formatter: p => `${yrs[p.dataIndex].slice(2)}·${p.data.region[0]}` } }]),
    }), true);
  };
})();
