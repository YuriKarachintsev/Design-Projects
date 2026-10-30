/* B4 · 100% stacked outcome bars with money labels, plus a dot per designer. */
(function () {
  const DD = window.DD;
  DD.charts.b4Stacked = function (el, res) {
    const c = DD.chartFor(el), gs = res.groups.filter(g => g.n), cats = gs.map(g => g.level + (res.by === 'loc' ? ' designers' : ' projects'));
    const col = { Underrun: DD.UNDER, 'On plan': '#D9D6CF', Overrun: DD.OVER };
    const series = ['Underrun', 'On plan', 'Overrun'].map(k => ({ name: k, type: 'bar', stack: 's', barWidth: '48%', itemStyle: { color: col[k], borderColor: '#fff', borderWidth: 1 },
      data: gs.map(g => +g.shares[k].toFixed(4)),
      label: { show: k !== 'On plan', position: 'inside', fontFamily: DD.MONO, fontSize: 10.5, color: '#fff', formatter: p => { const g = gs[p.dataIndex]; return p.value < 0.07 ? '' : `${DD.fmt.pct(p.value)}\n${k === 'Overrun' ? '▼ ' + DD.fmt.moneyC(g.overMoney) : '▲ ' + DD.fmt.moneyC(g.underMoney)}`; } } }));
    if (res.dots.length) {
      const idx = Object.fromEntries(gs.map((g, i) => [g.level, i]));
      series.push({ name: `Designer ${res.focus.toLowerCase()} share`, type: 'scatter', symbolSize: 8, z: 5, itemStyle: { color: '#fff', borderColor: DD.INK, borderWidth: 1.2 },
        data: res.dots.filter(d => idx[d.group] !== undefined).map((d, k) => ({ value: [idx[d.group] + ((k % 5) - 2) * 0.06, res.focus === 'Overrun' ? 1 - d.share : d.share], name: d.designer, n: d.n, share: d.share })), xAxisIndex: 1 });
    }
    c.setOption(DD.baseOption({
      grid: { left: 8, right: 16, top: 30, bottom: 8, containLabel: true },
      legend: { top: 0, left: 0, itemWidth: 10, itemHeight: 10, textStyle: { fontFamily: DD.MONO, fontSize: 11, color: DD.INK2 } },
      xAxis: [DD.axis({ type: 'category', data: cats, axisLabel: { interval: 0, fontFamily: DD.MONO, fontSize: 11, color: DD.INK } }), { type: 'value', min: -0.5, max: cats.length - 0.5, show: false }],
      yAxis: DD.axis({ type: 'value', max: 1, axisLabel: { fontFamily: DD.MONO, fontSize: 11, color: DD.INK2, formatter: v => DD.fmt.pct(v) } }),
      tooltip: { trigger: 'item', formatter: p => p.seriesType === 'scatter' ? DD.tip(DD.esc(p.data.name), [[`${res.focus} share`, DD.fmt.pct(p.data.share)], ['Projects (n)', DD.fmt.n(p.data.n)]]) :
        DD.tip(`${cats[p.dataIndex]} · ${p.seriesName}`, [['Share of projects', DD.fmt.pct(p.value)], ['Projects in class (n)', DD.fmt.n(gs[p.dataIndex].counts[p.seriesName])], ['All projects (n)', DD.fmt.n(gs[p.dataIndex].n)],
          ...(p.seriesName === 'Overrun' ? [['Money lost', DD.fmt.money(gs[p.dataIndex].overMoney)]] : p.seriesName === 'Underrun' ? [['Money gained', DD.fmt.money(gs[p.dataIndex].underMoney)]] : [])]) },
      series,
    }), true);
  };
})();
