/* C3 · Expected overrun / underrun 2027: diverging bars, underrun slate to the left, overrun wine to the right. */
(function () {
  const DD = window.DD;
  DD.charts.c3Diverging = function (el, items, opt) {
    const c = DD.chartFor(el), rs = items.slice().sort((a, b) => b.value - a.value);
    el.style.height = Math.max(260, rs.length * (opt.byDesigner ? 22 : 46) + 60) + 'px'; c.resize();
    const fmt = opt.money ? DD.fmt.moneyC : DD.fmt.hk, full = opt.money ? DD.fmt.money : DD.fmt.h;
    c.setOption(DD.baseOption({
      grid: { left: 8, right: 70, top: 10, bottom: 26, containLabel: true },
      xAxis: DD.axis({ type: 'value', axisLabel: { fontFamily: DD.MONO, fontSize: 11, color: DD.INK2, formatter: v => DD.fmt.signed(v, fmt) } }),
      yAxis: DD.axis({ type: 'category', data: rs.map(r => r.label), axisLabel: { interval: 0, fontFamily: opt.byDesigner ? "'IBM Plex Sans'" : DD.MONO, fontSize: opt.byDesigner ? 11.5 : 12, color: DD.INK, formatter: (v, i) => (rs[i].flag ? `{g|${v} ◌}` : v), rich: { g: { color: DD.INK3 } } } }),
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: ps => { const r = rs[ps[0].dataIndex]; return DD.tip(DD.esc(r.label) + (r.flag ? ' · few projects' : ''), [[r.value < 0 ? 'Expected underrun' : 'Expected overrun', (r.value < 0 ? '▲ ' : '▼ ') + full(r.value)], ['Hours', DD.fmt.signed(r.hours, DD.fmt.h)], ['Money', DD.fmt.signed(r.money, DD.fmt.money)], ['n (completed projects behind PR)', DD.fmt.n(r.n)]]); } },
      series: [{ type: 'bar', barWidth: '58%', data: rs.map(r => ({ value: Math.round(r.value), itemStyle: { color: r.value < 0 ? DD.UNDER : DD.OVER, opacity: r.flag ? 0.5 : 1 } })),
        label: { show: true, position: 'right', fontFamily: DD.MONO, fontSize: 11, color: DD.INK, formatter: p => `${p.value < 0 ? '▲' : '▼'} ${DD.fmt.signed(p.value, fmt)}` },
        markLine: { silent: true, symbol: 'none', lineStyle: { color: DD.INK, width: 1 }, label: { show: false }, data: [{ xAxis: 0 }] } }],
    }), true);
  };
})();
