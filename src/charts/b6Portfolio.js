/* B6 · Portfolio: x = margin %, y = margin per project, size = revenue; the horizontal line is the
 * 95% CI of margin % (dashed when n < MIN_N); dashed department lines and grey quadrant labels. */
(function () {
  const DD = window.DD;
  DD.charts.b6Portfolio = function (el, res) {
    const c = DD.chartFor(el), ts = res.types, maxRev = Math.max(...ts.map(t => t.rev)), minN = DD.cfg.MIN_N;
    const xs = ts.flatMap(t => [t.lo95, t.hi95, t.mean]).filter(DD.ok).concat([res.dept.marginPct]);
    const xmin = Math.floor((Math.min(...xs) - 0.02) * 10) / 10, xmax = Math.ceil((Math.max(...xs) + 0.02) * 10) / 10;
    const ys = ts.map(t => t.marginPerProject).concat([res.dept.marginPerProject]);
    const ymin = Math.min(0, ...ys) * 1.2, ymax = Math.max(...ys) * 1.3;
    c.setOption(DD.baseOption({
      grid: { left: 24, right: 30, top: 16, bottom: 36, containLabel: true },
      xAxis: DD.axis({ type: 'value', min: xmin, max: xmax, name: 'Margin % (95% CI)', nameLocation: 'middle', nameGap: 26, axisLabel: { fontFamily: DD.MONO, fontSize: 11, color: DD.INK2, formatter: v => DD.fmt.pct(v) } }),
      yAxis: DD.axis({ type: 'value', min: ymin, max: ymax, name: 'Margin per project', nameLocation: 'middle', nameRotate: 90, nameGap: 56, axisLabel: { fontFamily: DD.MONO, fontSize: 11, color: DD.INK2, formatter: v => DD.fmt.moneyC(v) } }),
      tooltip: { trigger: 'item', formatter: p => { const t = ts[p.data.i]; if (!t) return ''; return DD.tip(`Type ${t.type}${t.limited ? ' · limited data' : ''}`, [['n projects', DD.fmt.n(t.n)], ['Revenue', DD.fmt.money(t.rev)], ['Margin %', `${DD.fmt.pct(t.mean)} (95% CI ${DD.fmt.pct(t.lo95)} – ${DD.fmt.pct(t.hi95)})`], ['Margin per project', DD.fmt.money(t.marginPerProject)]]); } },
      series: [
        { type: 'custom', renderItem: (params, api) => {
          const t = ts[params.dataIndex], a = api.coord([Math.max(xmin, t.lo95), t.marginPerProject]), b = api.coord([Math.min(xmax, t.hi95), t.marginPerProject]);
          const st = { stroke: DD.TYPE_COL[t.type], lineWidth: 2, lineDash: t.n < minN ? [5, 4] : null };
          return { type: 'group', children: [{ type: 'line', shape: { x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, style: st }, { type: 'line', shape: { x1: a[0], y1: a[1] - 5, x2: a[0], y2: a[1] + 5 }, style: st }, { type: 'line', shape: { x1: b[0], y1: b[1] - 5, x2: b[0], y2: b[1] + 5 }, style: st }] };
        }, data: ts.map(t => [t.lo95, t.hi95, t.marginPerProject]), encode: { x: [0, 1], y: 2 }, z: 2, tooltip: { show: false } },
        { type: 'scatter', z: 4, data: ts.map((t, i) => ({ value: [t.mean, t.marginPerProject], i, symbolSize: 16 + 46 * Math.sqrt(t.rev / maxRev), itemStyle: { color: DD.TYPE_COL[t.type], opacity: t.limited ? 0.5 : 0.92, borderColor: '#fff', borderWidth: 1.5 } })),
          label: { show: true, position: 'top', distance: 6, fontFamily: DD.MONO, fontSize: 11, color: DD.INK, formatter: p => `T${ts[p.data.i].type}${ts[p.data.i].limited ? ' ◌' : ''}` },
          markLine: { silent: true, symbol: 'none', lineStyle: { type: 'dashed', color: DD.INK3 }, label: { show: false }, data: [{ xAxis: res.dept.marginPct }, { yAxis: res.dept.marginPerProject }] } },
      ],
    }), true);
    const px = (x, y) => c.convertToPixel({ gridIndex: 0 }, [x, y]), tl = px(xmin, ymax), br = px(xmax, ymin), mid = px(res.dept.marginPct, res.dept.marginPerProject);
    const lab = (x, y, t, align) => ({ type: 'text', left: x, top: y, style: { text: t, font: "500 11px 'IBM Plex Mono'", fill: '#A6ADB8', textAlign: align || 'left' } });
    c.setOption({ graphic: [lab(tl[0] + 8, tl[1] + 4, 'Big tickets, thin margin'), lab(mid[0] + 8, tl[1] + 4, 'Grow candidates'), lab(tl[0] + 8, br[1] - 18, 'Core volume'), lab(mid[0] + 8, br[1] - 18, 'Good margin, small tickets')] }, { replaceMerge: ['graphic'] });
  };
})();
