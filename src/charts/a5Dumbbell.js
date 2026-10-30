/* A5 · Rate efficiency: list rate (hollow) to cost per planned hour or earned per hour worked (solid). */
(function () {
  const DD = window.DD;
  DD.charts.a5Dumbbell = function (el, a5, opt) {
    const c = DD.chartFor(el), view = opt.view, md = DD.cfg.MIN_DESIGNER_PROJECTS;
    const rows = a5.rows.filter(r => DD.ok(r[view])).slice();
    // best at top: lower cost is better, higher earned is better (category axis draws bottom-up)
    rows.sort((a, b) => view === 'cpph' ? b.cpph - a.cpph : a.earned - b.earned);
    el.style.height = Math.max(320, rows.length * 22 + 80) + 'px';
    c.resize();
    const dept = a5.dept[view];
    const col = r => r.n < md ? '#C9C6BE' : DD.locCol(r.loc);
    // Scale to designers with enough projects (and the list rates and department line); a designer with a
    // handful of projects can have an extreme ratio, which is pinned to the edge with an arrow and its real value.
    const core = rows.filter(r => r.n >= md).length ? rows.filter(r => r.n >= md) : rows;
    const span = core.flatMap(r => [r.rate, r[view]]).concat(rows.map(r => r.rate), DD.ok(dept) ? [dept] : []);
    let lo = Math.min(...span), hi = Math.max(...span);
    const pad = (hi - lo) * 0.08 || hi * 0.1 || 1; const step = hi - lo > 200 ? 50 : hi - lo > 80 ? 20 : 10;
    lo = Math.max(0, Math.floor((lo - pad) / step) * step); hi = Math.ceil((hi + pad) / step) * step;
    const clip = v => Math.min(hi, Math.max(lo, v)), out = v => v > hi ? 1 : v < lo ? -1 : 0;
    c.setOption(DD.baseOption({
      grid: { left: 8, right: 30, top: 34, bottom: 30, containLabel: true },
      xAxis: DD.axis({ type: 'value', min: lo, max: hi, interval: step, name: view === 'cpph' ? 'Cost per planned hour (lower is better)' : 'Earned per hour worked (higher is better)', nameLocation: 'middle', nameGap: 24,
        axisLabel: { fontFamily: DD.MONO, fontSize: 11, color: DD.INK2, formatter: v => DD.fmt.rateN(v) } }),
      yAxis: DD.axis({ type: 'category', data: rows.map(r => r.designer), axisLabel: { interval: 0, fontFamily: "'IBM Plex Sans'", fontSize: 12, color: DD.INK, formatter: (v, i) => rows[i].n < md ? `{g|${v}}` : v, rich: { g: { color: DD.INK3, fontSize: 12 } } } }),
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: ps => {
        const r = rows[ps[0].dataIndex];
        return DD.tip(`${DD.esc(r.designer)} · ${r.loc}${r.n < md ? ' · few projects' : ''}`, [['List rate', DD.fmt.rate(r.rate)], ['Realised PR (Σ actual h ÷ Σ planned h)', DD.fmt.pr(r.rpr)], ['Median PR', DD.fmt.pr(r.medianPR)],
          ['Projects (n)', DD.fmt.n(r.n)], ['Actual hours', DD.fmt.h(r.hours)], ['Cost per planned hour', DD.fmt.rate(r.cpph)], ['Earned per hour worked', DD.fmt.rate(r.earned)]]);
      } },
      series: [
        { type: 'custom', name: 'link', silent: true, renderItem: (params, api) => {
          const a = api.coord([api.value(0), params.dataIndex]), b = api.coord([api.value(1), params.dataIndex]);
          return { type: 'line', shape: { x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, style: { stroke: '#C9C6BE', lineWidth: 1.5 } };
        }, data: rows.map(r => [r.rate, clip(r[view])]), encode: { x: [0, 1] }, z: 1, tooltip: { show: false } },
        { type: 'scatter', name: 'List rate', symbol: 'circle', symbolSize: 9, itemStyle: { color: '#fff', borderColor: DD.INK3, borderWidth: 1.5 }, data: rows.map((r, i) => [r.rate, i]), z: 3 },
        { type: 'scatter', name: view === 'cpph' ? 'Cost per planned hour' : 'Earned per hour worked', symbolSize: 11, z: 4, data: rows.map((r, i) => {
            const o = out(r[view]), base = { value: [+clip(r[view]).toFixed(2), i], itemStyle: { color: col(r), borderColor: r.n < md ? '#C9C6BE' : DD.INK, borderWidth: 0.6 } };
            return o ? Object.assign(base, { symbol: 'triangle', symbolRotate: o > 0 ? -90 : 90, symbolSize: 12,
              label: { show: true, position: o > 0 ? 'left' : 'right', formatter: (o > 0 ? '' : '← ') + DD.fmt.rateN(r[view]) + (o > 0 ? ' →' : ''), fontFamily: DD.MONO, fontSize: 10.5, color: DD.INK2, backgroundColor: 'rgba(255,255,255,0.85)', padding: [1, 3] } }) : base;
          }),
          markLine: { silent: true, symbol: 'none', lineStyle: { color: DD.INK, type: 'dashed', width: 1 }, label: { formatter: `Department ${DD.fmt.rateN(dept)}`, fontFamily: DD.MONO, fontSize: 10.5, color: DD.INK }, data: [{ xAxis: +dept.toFixed(2) }] } },
      ].map(s => (s.type === 'scatter' ? Object.assign(s, { encode: undefined }) : s)),
      legend: { top: 0, left: 0, data: ['List rate', view === 'cpph' ? 'Cost per planned hour' : 'Earned per hour worked'], itemWidth: 10, itemHeight: 10, textStyle: { fontFamily: DD.MONO, fontSize: 11, color: DD.INK2 } },
    }), true);
    return rows;
  };
})();
