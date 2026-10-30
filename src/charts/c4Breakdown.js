/* C4 · Revenue 2027 broken down by project region or project type (last-3-year shares). */
(function () {
  const DD = window.DD;
  DD.charts.c4Breakdown = function (el, items, opt) {
    const c = DD.chartFor(el), rs = items.slice().sort((a, b) => a.value - b.value);
    c.setOption(DD.baseOption({
      grid: { left: 8, right: 70, top: 6, bottom: 6, containLabel: true },
      xAxis: { type: 'value', show: false }, yAxis: DD.axis({ type: 'category', data: rs.map(r => r.label), axisLabel: { interval: 0, fontFamily: DD.MONO, fontSize: 11.5, color: DD.INK } }),
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: ps => { const r = rs[ps[0].dataIndex]; return DD.tip(r.label, [['Revenue 2027', DD.fmt.money(r.value)], ['Range', `${DD.fmt.money(r.lo)} – ${DD.fmt.money(r.hi)}`], ['Share (last 3 years)', DD.fmt.pct(r.share)], ['n projects (last 3 years)', DD.fmt.n(r.n)]]); } },
      series: [{ type: 'bar', barWidth: '58%', data: rs.map(r => ({ value: Math.round(r.value), itemStyle: { color: r.color } })),
        label: { show: true, position: 'right', fontFamily: DD.MONO, fontSize: 11, color: DD.INK, formatter: p => `${DD.fmt.moneyC(p.value)} · ${DD.fmt.pct(rs[p.dataIndex].share)}` } }],
    }), true);
  };
})();
