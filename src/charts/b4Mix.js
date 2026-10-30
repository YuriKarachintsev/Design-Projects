/* B4 · 100% stacked outcome mix per group (slate underrun / light grey on plan / wine overrun) with money labels. */
(function () {
  const DD = window.DD;
  DD.charts.b4Mix = function (el, mix, by) {
    const c = DD.chartFor(el), cats = mix.map(g => g.level + (by === 'loc' ? ' designers' : ' projects'));
    const col = { Underrun: DD.UNDER, 'On plan': '#D9D6CF', Overrun: DD.OVER };
    c.setOption(DD.baseOption({
      grid: { left: 8, right: 16, top: 30, bottom: 8, containLabel: true },
      legend: { top: 0, left: 0, itemWidth: 10, itemHeight: 10, textStyle: { fontFamily: DD.MONO, fontSize: 11, color: DD.INK2 } },
      xAxis: DD.axis({ type: 'value', max: 1, axisLabel: { fontFamily: DD.MONO, fontSize: 11, color: DD.INK2, formatter: v => DD.fmt.pct(v) } }),
      yAxis: DD.axis({ type: 'category', data: cats, axisLabel: { interval: 0, fontFamily: DD.MONO, fontSize: 11, color: DD.INK } }),
      tooltip: { trigger: 'item', formatter: p => { const g = mix[p.dataIndex]; return DD.tip(`${cats[p.dataIndex]} · ${p.seriesName}`, [['Share', DD.fmt.pct(p.value)], ['Projects in class', DD.fmt.n(g.counts[p.seriesName])], ['n', DD.fmt.n(g.n)],
        ...(p.seriesName === 'Overrun' ? [['Margin lost', '▼ ' + DD.fmt.money(g.overMoney)]] : p.seriesName === 'Underrun' ? [['Margin gained', '▲ ' + DD.fmt.money(g.underMoney)]] : [])]); } },
      series: ['Underrun', 'On plan', 'Overrun'].map(k => ({ name: k, type: 'bar', stack: 's', barWidth: '56%', itemStyle: { color: col[k], borderColor: '#fff', borderWidth: 1 }, data: mix.map(g => +g.shares[k].toFixed(4)),
        label: { show: k !== 'On plan', position: 'inside', fontFamily: DD.MONO, fontSize: 10.5, color: '#fff', formatter: p => { const g = mix[p.dataIndex]; return p.value < 0.1 ? '' : `${DD.fmt.pct(p.value)} · ${k === 'Overrun' ? '▼ −' + DD.fmt.moneyC(g.overMoney) : '▲ +' + DD.fmt.moneyC(g.underMoney)}`; } } })),
    }), true);
  };
})();
