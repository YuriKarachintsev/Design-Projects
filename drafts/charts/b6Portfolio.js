/* B6 · Portfolio bubble matrix: x = margin %, y = margin per project, size = revenue,
 * with the 90% bootstrap range of margin % through each bubble and dashed department lines. */
(function () {
  const DD = window.DD;
  DD.charts.b6Portfolio = function (el, res) {
    const c = DD.chartFor(el), ts = res.types, maxRev = Math.max(...ts.map(t => t.rev));
    const xs = ts.flatMap(t => t.range.filter(DD.ok)).concat(ts.map(t => t.marginPct)), ys = ts.map(t => t.marginPerProject);
    const xmin = Math.min(...xs, res.dept.marginPct) - 0.05, xmax = Math.max(...xs, res.dept.marginPct) + 0.05;
    const ymin = Math.min(0, ...ys) * 1.15, ymax = Math.max(...ys, res.dept.marginPerProject) * 1.25;
    c.setOption(DD.baseOption({
      grid: { left: 8, right: 24, top: 20, bottom: 36, containLabel: true },
      xAxis: DD.axis({ type: 'value', min: xmin, max: xmax, name: 'Margin % (90% range)', nameLocation: 'middle', nameGap: 26, axisLabel: { fontFamily: DD.MONO, fontSize: 11, color: DD.INK2, formatter: v => DD.fmt.pct(v) } }),
      yAxis: DD.axis({ type: 'value', min: ymin, max: ymax, name: 'Margin per project', axisLabel: { fontFamily: DD.MONO, fontSize: 11, color: DD.INK2, formatter: v => DD.fmt.moneyC(v) } }),
      tooltip: { trigger: 'item', formatter: p => { const t = ts[p.data.i]; return DD.tip(`Type ${t.type}${t.limited ? ' · limited data' : ''}`, [['Projects (n)', DD.fmt.n(t.n)], ['Revenue', DD.fmt.money(t.rev)], ['Margin %', `${DD.fmt.pct(t.marginPct)} (${DD.fmt.pct(t.range[0])} – ${DD.fmt.pct(t.range[1])})`], ['Margin per project', DD.fmt.money(t.marginPerProject)], ['Overrun share', DD.fmt.pct(t.overShare)], ['Earned per hour worked', DD.fmt.rate(t.earned)]]); } },
      series: [
        { type: 'custom', renderItem: (params, api) => {
          const t = ts[params.dataIndex], a = api.coord([t.range[0], t.marginPerProject]), b = api.coord([t.range[1], t.marginPerProject]);
          return { type: 'group', children: [{ type: 'line', shape: { x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, style: { stroke: DD.TYPE_COL[t.type], lineWidth: 2, lineDash: t.n < 20 ? [5, 4] : null } },
            { type: 'line', shape: { x1: a[0], y1: a[1] - 5, x2: a[0], y2: a[1] + 5 }, style: { stroke: DD.TYPE_COL[t.type], lineWidth: 2 } }, { type: 'line', shape: { x1: b[0], y1: b[1] - 5, x2: b[0], y2: b[1] + 5 }, style: { stroke: DD.TYPE_COL[t.type], lineWidth: 2 } }] };
        }, data: ts.map(t => [t.range[0], t.range[1], t.marginPerProject]), encode: { x: [0, 1], y: 2 }, z: 2, tooltip: { show: false } },
        { type: 'scatter', z: 4, data: ts.map((t, i) => ({ value: [t.marginPct, t.marginPerProject], i, symbolSize: 18 + 46 * Math.sqrt(t.rev / maxRev),
            itemStyle: { color: DD.TYPE_COL[t.type], opacity: t.limited ? 0.45 : 0.9, borderColor: '#fff', borderWidth: 1.5 } })),
          label: { show: true, position: 'right', distance: 8, fontFamily: DD.MONO, fontSize: 11.5, color: DD.INK, formatter: p => `T${ts[p.data.i].type}${ts[p.data.i].limited ? ' · limited' : ''}` },
          markLine: { silent: true, symbol: 'none', lineStyle: { type: 'dashed', color: DD.INK3 }, label: { show: false }, data: [{ xAxis: res.dept.marginPct }, { yAxis: res.dept.marginPerProject }] } },
      ],
    }), true);
    // quadrant labels in data space
    const pos = (x, y) => c.convertToPixel({ gridIndex: 0 }, [x, y]);
    const tl = pos(xmin, ymax), br = pos(xmax, ymin), mid = pos(res.dept.marginPct, res.dept.marginPerProject);
    c.setOption({ graphic: [
      { type: 'text', left: tl[0] + 8, top: tl[1] + 4, style: { text: 'Big tickets, thin margin', font: "500 11px 'IBM Plex Mono'", fill: '#A6ADB8' } },
      { type: 'text', left: mid[0] + 8, top: tl[1] + 4, style: { text: 'Grow candidates', font: "500 11px 'IBM Plex Mono'", fill: '#A6ADB8' } },
      { type: 'text', left: tl[0] + 8, top: br[1] - 20, style: { text: 'Core volume', font: "500 11px 'IBM Plex Mono'", fill: '#A6ADB8' } },
      { type: 'text', left: mid[0] + 8, top: br[1] - 20, style: { text: 'Good margin, small tickets', font: "500 11px 'IBM Plex Mono'", fill: '#A6ADB8' } },
    ] }, { replaceMerge: ['graphic'] });
  };
})();
