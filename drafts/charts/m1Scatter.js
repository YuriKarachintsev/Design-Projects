/* M1 · Planned vs actual hours on log axes, coloured by type, with "actual = plan" and the
 * model line (baseline type, reference education, no designer adjustment) and its 80% band. */
(function () {
  const DD = window.DD;
  DD.charts.m1Scatter = function (el, m) {
    const c = DD.chartFor(el), rows = m.rows, b = m.fit.b;
    const xs = rows.map(r => r.ph), lo = Math.max(1, Math.min(...xs) * 0.8), hi = Math.max(...xs) * 1.25;
    const grid = []; for (let k = 0; k <= 40; k++) grid.push(lo * Math.pow(hi / lo, k / 40));
    const med = x => Math.exp(b[0] + b[1] * Math.log(x));
    const lab = v => v >= 1000 ? (v / 1000) + 'k h' : v + ' h';
    const ticks = { type: 'log', logBase: 10, axisLabel: { fontFamily: DD.MONO, fontSize: 11, color: DD.INK2, formatter: lab }, splitLine: { lineStyle: { color: '#EEECE7' } }, minorSplitLine: { show: false } };
    c.setOption(DD.baseOption({
      grid: { left: 8, right: 20, top: 30, bottom: 34, containLabel: true },
      legend: { top: 0, left: 0, itemWidth: 12, itemHeight: 8, textStyle: { fontFamily: DD.MONO, fontSize: 11, color: DD.INK2 }, data: [1, 2, 3, 4].map(DD.typeName).concat(['Actual = plan', 'Model (median)', '80% range']) },
      xAxis: Object.assign(DD.axis({ name: 'Planned hours', nameLocation: 'middle', nameGap: 24, min: lo, max: hi }), ticks),
      yAxis: Object.assign(DD.axis({ name: 'Actual hours', min: lo / 4, max: hi * 2 }), ticks),
      tooltip: { trigger: 'item', formatter: p => p.seriesType === 'scatter' ? DD.tip(`${DD.esc(p.data.d)} · Type ${p.data.t}`, [['Planned', DD.fmt.h(p.value[0])], ['Actual', DD.fmt.h(p.value[1])], ['PR', DD.fmt.pr(p.value[1] / p.value[0])]]) : '' },
      series: [1, 2, 3, 4].map(t => ({ name: DD.typeName(t), type: 'scatter', symbolSize: 4, large: true, itemStyle: { color: DD.TYPE_COL[t], opacity: 0.55 },
        data: rows.filter(r => r.type === t).map(r => ({ value: [+r.ph.toFixed(2), +r.ah.toFixed(2)], d: r.designer, t })) }))
        .concat([
          { name: '80% range', type: 'line', data: grid.map(x => [x, med(x) * Math.exp(m.q10)]), showSymbol: false, lineStyle: { opacity: 0 }, stack: 'band', silent: true, itemStyle: { color: '#C9C6BE' } },
          { name: '80% range', type: 'line', data: grid.map(x => [x, med(x) * (Math.exp(m.q90) - Math.exp(m.q10))]), showSymbol: false, lineStyle: { opacity: 0 }, stack: 'band', areaStyle: { color: 'rgba(31,42,55,0.10)' }, silent: true, itemStyle: { color: '#C9C6BE' } },
          { name: 'Actual = plan', type: 'line', data: [[lo, lo], [hi, hi]], showSymbol: false, lineStyle: { type: 'dashed', color: DD.INK3, width: 1.2 }, silent: true, itemStyle: { color: DD.INK3 } },
          { name: 'Model (median)', type: 'line', data: grid.map(x => [x, med(x)]), showSymbol: false, lineStyle: { color: DD.INK, width: 2 }, silent: true, itemStyle: { color: DD.INK } },
        ]),
    }), true);
  };
})();
