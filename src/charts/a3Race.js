/* A3 · YTD revenue vs actual cost by designer ("the race"): bullet chart or margin gap,
 * animated frame by frame (months, or years with Yearly granularity). */
(function () {
  const DD = window.DD;
  DD.charts.a3Race = function (el, frame, opt) {
    const c = DD.chartFor(el);
    let rows = frame.rows.slice();
    if (opt.hideZero) rows = rows.filter(r => r.rev || r.cost);
    const key = { revenue: 'rev', cost: 'cost', margin: 'margin', marginPct: 'marginPct' }[opt.sort];
    rows.sort((a, b) => (a[key] || 0) - (b[key] || 0));
    el.style.height = Math.max(320, rows.length * 22 + 70) + 'px';
    c.resize();
    const names = rows.map(r => r.designer);
    const tip = { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: ps => {
      const r = rows[ps[0].dataIndex];
      const g = r.prevRev ? r.rev / r.prevRev - 1 : null;
      return DD.tip(`${DD.esc(r.designer)} · ${frame.label}`, [['Revenue', DD.fmt.money(r.rev)], ['Actual cost', DD.fmt.money(r.cost)], ['Margin', `${DD.fmt.money(r.margin)} (${DD.fmt.pct(r.marginPct)})`],
        ['Projects (n)', DD.fmt.n(r.n)], [`Revenue vs ${frame.prevLabel}`, g === null ? '–' : DD.fmt.pct(g, true)]]);
    } };
    const endLabel = r => `{${r.margin >= 0 ? 'up' : 'dn'}|${r.margin >= 0 ? '▲' : '▼'} ${DD.fmt.signed(r.margin, DD.fmt.moneyC)} · ${DD.fmt.pct(r.marginPct, true)}}`;
    const rich = { up: { color: DD.UNDER, fontFamily: DD.MONO, fontSize: 11 }, dn: { color: DD.OVER, fontFamily: DD.MONO, fontSize: 11 } };
    let series, xAxis;
    if (opt.gapOnly) {
      xAxis = DD.axis({ type: 'value', axisLabel: { fontFamily: DD.MONO, fontSize: 11, color: DD.INK2, formatter: v => DD.fmt.moneyC(v) } });
      series = [{ type: 'bar', name: 'Margin', barWidth: '58%', data: rows.map(r => ({ value: Math.round(r.margin), itemStyle: { color: r.margin >= 0 ? DD.UNDER : DD.OVER } })),
        label: { show: true, position: 'right', formatter: p => endLabel(rows[p.dataIndex]), rich } }];
    } else {
      xAxis = DD.axis({ type: 'value', max: v => v.max * 1.18, axisLabel: { fontFamily: DD.MONO, fontSize: 11, color: DD.INK2, formatter: v => DD.fmt.moneyC(v) } });
      series = [
        { type: 'bar', name: 'Actual cost', barWidth: '50%', itemStyle: { color: DD.UNDER }, data: rows.map(r => Math.round(r.cost)) },
        { type: 'scatter', name: 'Revenue', symbol: 'rect', symbolSize: [3, 18], itemStyle: { color: DD.INK }, z: 4, data: rows.map((r, i) => [Math.round(r.rev), i]),
          label: { show: true, position: 'right', distance: 8, formatter: p => endLabel(rows[p.dataIndex]), rich } },
      ];
    }
    c.setOption(DD.baseOption({
      animationDurationUpdate: opt.playing ? 420 : 500,
      grid: { left: 8, right: 110, top: 30, bottom: 8, containLabel: true },
      legend: opt.gapOnly ? undefined : { top: 0, left: 0, itemWidth: 12, itemHeight: 10, textStyle: { fontFamily: DD.MONO, fontSize: 11, color: DD.INK2 } },
      graphic: [{ type: 'text', right: 120, bottom: 24, z: 0, style: { text: frame.watermark, font: `600 64px 'Barlow Condensed'`, fill: 'rgba(31,42,55,0.07)' } }],
      xAxis, yAxis: DD.axis({ type: 'category', data: names, axisLabel: { fontFamily: "'IBM Plex Sans'", fontSize: 12, color: DD.INK, interval: 0 } }),
      tooltip: tip, series,
    }), { notMerge: false, replaceMerge: ['series', 'graphic', 'legend'] });
    return rows;
  };
})();
