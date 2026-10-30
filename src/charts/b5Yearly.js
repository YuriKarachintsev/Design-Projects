/* B5 · Yearly small multiples per region, with a "winner of each year" strip underneath. */
(function () {
  const DD = window.DD;
  DD.charts.b5Yearly = function (el, res) {
    const c = DD.chartFor(el), regs = ['North', 'East', 'South', 'West'], yrs = res.years.map(String), n = regs.length;
    const val = (g, y) => res.units.find(u => u.region === g && u.year === y);
    const max = Math.max(...res.units.map(u => u.value), 1), min = Math.min(0, ...res.units.map(u => u.value));
    c.setOption(DD.baseOption({
      grid: regs.map((r, i) => ({ left: `${8 + i * 23}%`, width: '20%', top: 26, bottom: 54 })).concat([{ left: '8%', right: '1.5%', bottom: 6, height: 24 }]),
      title: regs.map((r, i) => ({ text: r, left: `${8 + i * 23}%`, top: 2, textStyle: { fontFamily: "'Barlow Condensed'", fontSize: 14, fontWeight: 600, color: DD.INK } })),
      xAxis: regs.map((r, i) => DD.axis({ type: 'category', gridIndex: i, data: yrs, axisLabel: { fontFamily: DD.MONO, fontSize: 9, color: DD.INK2, formatter: v => "'" + v.slice(2) } })).concat([{ type: 'category', gridIndex: n, data: yrs, show: false }]),
      yAxis: regs.map((r, i) => DD.axis({ type: 'value', gridIndex: i, min, max, show: i === 0, axisLabel: { fontFamily: DD.MONO, fontSize: 9, color: DD.INK2, formatter: v => DD.fmt.moneyC(v) } })).concat([{ type: 'value', gridIndex: n, show: false }]),
      tooltip: { trigger: 'item', formatter: p => (p.seriesName === 'winner' ? DD.tip(`${p.name}: ${p.data.region} leads`, [['Total', DD.fmt.money(p.data.v)]]) : DD.tip(`${p.seriesName} · ${p.name}`, [['Total', DD.fmt.money(p.value)], ['n projects', DD.fmt.n(p.data.n)]])) },
      series: regs.map((r, i) => ({ name: r, type: 'bar', xAxisIndex: i, yAxisIndex: i, barWidth: '62%', data: res.years.map((y, k) => { const u = val(r, y); return { value: Math.round(u.value), n: u.n, itemStyle: { color: res.winners[k] && res.winners[k].region === r ? DD.INK : '#C9C6BE' } }; }) }))
        .concat([{ name: 'winner', type: 'bar', xAxisIndex: n, yAxisIndex: n, barWidth: '96%', data: res.winners.map(w => ({ value: 1, region: w.region, v: w.value, itemStyle: { color: '#F1EFEA' } })),
          label: { show: true, position: 'inside', fontFamily: DD.MONO, fontSize: 10, color: DD.INK, formatter: p => `'${yrs[p.dataIndex].slice(2)} ${p.data.region}` } }]),
    }), true);
  };
})();
