/* C1 · Expected cost of a typical project per type on a "% of plan" axis: 80% range bar, a dot at the
 * expected cost, a dashed plan line at 100%, money in an aligned column on the right. */
(function () {
  const DD = window.DD;
  DD.charts.c1Range = function (el, rows) {
    const c = DD.chartFor(el), rs = rows.slice().reverse(), cats = rs.map(r => `Type ${r.type}${r.limited ? ' ◌' : ''}`);
    const lab = r => `${DD.fmt.moneyC(r.cost)} vs plan ${DD.fmt.moneyC(r.plan)}`;
    c.setOption(DD.baseOption({
      grid: { left: 8, right: 8, top: 26, bottom: 30, containLabel: true },
      xAxis: DD.axis({ type: 'value', min: 0, max: v => Math.ceil(Math.max(v.max, 1.1) * 2) / 2, interval: 0.5, name: '% of plan (80% range)', nameLocation: 'middle', nameGap: 24, axisLabel: { fontFamily: DD.MONO, fontSize: 11, color: DD.INK2, formatter: v => DD.fmt.pct(v).replace('.0', '') } }),
      yAxis: [DD.axis({ type: 'category', data: cats, axisLabel: { interval: 0, fontFamily: DD.MONO, fontSize: 12, color: DD.INK } }),
        DD.axis({ type: 'category', data: rs.map(lab), position: 'right', axisLine: { show: false }, axisLabel: { interval: 0, fontFamily: DD.MONO, fontSize: 11, color: DD.INK } })],
      tooltip: { trigger: 'item', formatter: p => { const r = rs[p.dataIndex]; return DD.tip(`Type ${r.type} · ${DD.fmt.h(r.plannedH)} planned${r.limited ? ' · limited data' : ''}`, [['Expected hours', DD.fmt.h(r.hours)], ['Expected cost', DD.fmt.money(r.cost)], ['80% range', `${DD.fmt.money(r.lo)} – ${DD.fmt.money(r.hi)}`], ['Plan cost', DD.fmt.money(r.plan)], ['% of plan', DD.fmt.pct(r.pctOfPlan)], ['Plan × realised PR', DD.fmt.money(r.benchmark)], ['n (completed projects)', DD.fmt.n(r.n)]]); } },
      series: [
        { type: 'custom', renderItem: (params, api) => { const r = rs[params.dataIndex], a = api.coord([r.lo / r.plan, params.dataIndex]), b = api.coord([r.hi / r.plan, params.dataIndex]), h = 12;
          return { type: 'rect', shape: { x: a[0], y: a[1] - h / 2, width: b[0] - a[0], height: h }, style: { fill: DD.TYPE_COL[r.type], opacity: r.limited ? 0.3 : 0.45, stroke: r.limited ? DD.TYPE_COL[r.type] : null, lineDash: r.limited ? [3, 3] : null } }; },
          data: rs.map((r, i) => [r.lo / r.plan, r.hi / r.plan, i]), encode: { x: [0, 1], y: 2 }, z: 2, tooltip: { show: false } },
        { type: 'scatter', symbolSize: 13, z: 4, data: rs.map((r, i) => ({ value: [r.pctOfPlan, i], itemStyle: { color: DD.TYPE_COL[r.type], borderColor: DD.INK, borderWidth: 1 } })),
          label: { show: true, position: 'top', fontFamily: DD.MONO, fontSize: 11, color: DD.INK, formatter: p => DD.fmt.pct(rs[p.dataIndex].pctOfPlan) },
          markLine: { silent: true, symbol: 'none', lineStyle: { type: 'dashed', color: DD.INK }, label: { formatter: 'Plan', fontFamily: DD.MONO, fontSize: 10.5, color: DD.INK }, data: [{ xAxis: 1 }] } },
      ],
    }), true);
  };
})();
