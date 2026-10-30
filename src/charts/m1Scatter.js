/* M1 · Planned vs actual hours on log axes (dots in type colours), the dashed "actual = plan" line,
 * and the model line for Type 1 / reference education / reference location with its 80% band. */
(function () {
  const DD = window.DD;
  DD.charts.m1Scatter = function (el, m) {
    const c = DD.chartFor(el), rows = m.rows, b = m.fit.b;
    const xs = rows.map(r => r.ph), lo = Math.max(1, Math.min(...xs) * 0.8), hi = Math.max(...xs) * 1.25;
    const grid = []; for (let k = 0; k <= 40; k++) grid.push(lo * Math.pow(hi / lo, k / 40));
    const med = x => Math.exp(b[0] + b[1] * Math.log(x));
    const lab = v => (v >= 1000 ? DD.fmt.n(v / 1000) + 'k h' : DD.fmt.n(v) + ' h');
    const logAxis = name => Object.assign(DD.axis({ name, nameLocation: 'middle', nameGap: name === 'Planned hours' ? 26 : 50, nameRotate: name === 'Planned hours' ? 0 : 90 }),
      { type: 'log', logBase: 10, axisLabel: { fontFamily: DD.MONO, fontSize: 11, color: DD.INK2, formatter: lab }, minorSplitLine: { show: false } });
    c.setOption(DD.baseOption({
      grid: { left: 24, right: 20, top: 34, bottom: 34, containLabel: true },
      legend: { top: 0, left: 0, itemWidth: 12, itemHeight: 8, textStyle: { fontFamily: DD.MONO, fontSize: 11, color: DD.INK2 }, data: [1, 2, 3, 4].map(DD.typeName).concat(['Actual = plan', 'Model line', '80% band']) },
      xAxis: Object.assign(logAxis('Planned hours'), { min: lo, max: hi }), yAxis: Object.assign(logAxis('Actual hours'), { min: lo / 5, max: hi * 2 }),
      tooltip: { trigger: 'item', formatter: p => (p.seriesType === 'scatter' ? DD.tip(`${DD.esc(p.data.d)} · Type ${p.data.t}`, [['Planned', DD.fmt.h(p.value[0])], ['Actual', DD.fmt.h(p.value[1])], ['PR', DD.fmt.pr(p.value[1] / p.value[0])], ['n (all dots)', DD.fmt.n(rows.length)]]) : '') },
      series: [1, 2, 3, 4].map(t => ({ name: DD.typeName(t), type: 'scatter', symbolSize: 4, large: true, itemStyle: { color: DD.TYPE_COL[t], opacity: 0.55 },
        data: rows.filter(r => r.type === t).map(r => ({ value: [+r.ph.toFixed(2), +r.ah.toFixed(2)], d: r.designer, t })) }))
        .concat([
          { name: '80% band', type: 'custom', silent: true, data: [0], z: 1, itemStyle: { color: 'rgba(31,42,55,0.12)' }, tooltip: { show: false },
            renderItem: (params, api) => ({ type: 'polygon', shape: { points: grid.map(x => api.coord([x, med(x) * m.rangeHi])).concat(grid.slice().reverse().map(x => api.coord([x, med(x) * m.rangeLo]))) }, style: { fill: 'rgba(31,42,55,0.12)' } }) },
          { name: 'Actual = plan', type: 'line', data: [[lo, lo], [hi, hi]], showSymbol: false, lineStyle: { type: 'dashed', color: DD.INK3, width: 1.2 }, itemStyle: { color: DD.INK3 }, silent: true },
          { name: 'Model line', type: 'line', data: grid.map(x => [x, med(x)]), showSymbol: false, lineStyle: { color: DD.INK, width: 2 }, itemStyle: { color: DD.INK }, silent: true },
        ]),
    }), true);
  };
})();
