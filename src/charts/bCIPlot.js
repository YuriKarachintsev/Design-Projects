/* CI dot plot: each group's typical value with its 95% CI whisker, a reference line (overall
 * value or plan), optional hollow list-rate markers. Limited groups are hollow with dotted whiskers. */
(function () {
  const DD = window.DD;
  DD.charts.bCIPlot = function (el, groups, opt) {
    const c = DD.chartFor(el), horizontal = !!opt.horizontal;
    if (horizontal) { el.style.height = Math.max(300, groups.length * 26 + 80) + 'px'; c.resize(); }
    const cats = groups.map(g => g.label + (g.limited ? ' ◌' : ''));
    const vals = groups.flatMap(g => [g.lo, g.hi, g.rate].filter(DD.ok)).concat(DD.ok(opt.ref) ? [opt.ref] : []);
    const lo0 = Math.min(...vals), hi0 = Math.max(...vals), span = hi0 - lo0 || Math.abs(hi0) || 1;
    const vAxis = DD.axis({ type: 'value', name: opt.axisName, nameLocation: 'middle', nameGap: horizontal ? 26 : 52, nameRotate: horizontal ? 0 : 90, scale: true,
      min: v => Math.max(opt.floor === undefined ? -Infinity : opt.floor, Math.min(v.min, lo0) - span * 0.06), max: v => Math.max(v.max, hi0) + span * 0.06,
      axisLabel: { fontFamily: DD.MONO, fontSize: 11, color: DD.INK2, formatter: opt.fmt } });
    const cAxis = DD.axis({ type: 'category', data: cats, axisLabel: { interval: 0, fontFamily: horizontal ? "'IBM Plex Sans'" : DD.MONO, fontSize: horizontal ? 12 : 11, color: DD.INK, formatter: (v, i) => (groups[i] && groups[i].limited ? `{l|${v}}` : v), rich: { l: { color: DD.INK3, fontSize: 12 } } } });
    const pt = (i, v) => (horizontal ? [v, i] : [i, v]);
    const col = g => (g.limited ? DD.INK3 : g.color || DD.INK);
    const series = [
      { type: 'custom', name: '95% CI', renderItem: (params, api) => {
        const g = groups[params.dataIndex], a = api.coord(pt(params.dataIndex, g.lo)), b = api.coord(pt(params.dataIndex, g.hi)), w = 6;
        const cap = p => (horizontal ? { x1: p[0], y1: p[1] - w, x2: p[0], y2: p[1] + w } : { x1: p[0] - w, y1: p[1], x2: p[0] + w, y2: p[1] });
        const st = { stroke: col(g), lineWidth: 1.6, lineDash: g.limited ? [3, 3] : null };
        return { type: 'group', children: [{ type: 'line', shape: { x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, style: st }, { type: 'line', shape: cap(a), style: st }, { type: 'line', shape: cap(b), style: st }] };
      }, data: groups.map((g, i) => [i, g.lo, g.hi]), encode: horizontal ? { y: 0, x: [1, 2] } : { x: 0, y: [1, 2] }, z: 2, tooltip: { show: false } },
      { type: 'scatter', name: opt.valueName || 'Typical value', symbolSize: 13, z: 4, data: groups.map((g, i) => ({ value: pt(i, g.value), itemStyle: { color: g.limited ? '#fff' : col(g), borderColor: col(g), borderWidth: 2 } })),
        label: { show: true, position: horizontal ? 'right' : 'right', distance: 10, fontFamily: DD.MONO, fontSize: 11, color: DD.INK, formatter: p => opt.fmt(groups[p.dataIndex].value) },
        markLine: DD.ok(opt.ref) ? { silent: true, symbol: 'none', lineStyle: { type: 'dashed', color: DD.INK, width: 1 }, label: { formatter: opt.refLabel, fontFamily: DD.MONO, fontSize: 10.5, color: DD.INK, position: horizontal ? 'insideEndBottom' : 'insideEndTop' }, data: [horizontal ? { xAxis: opt.ref } : { yAxis: opt.ref }] } : undefined },
    ];
    if (opt.rate) series.push({ type: 'scatter', name: 'List rate', symbol: horizontal ? 'rect' : 'circle', symbolSize: horizontal ? [2, 16] : 15, z: 3,
      itemStyle: horizontal ? { color: DD.INK } : { color: 'transparent', borderColor: DD.INK, borderWidth: 1.5 }, data: groups.map((g, i) => pt(i, g.rate)) });
    c.setOption(DD.baseOption({
      grid: { left: horizontal ? 8 : 24, right: 50, top: opt.rate ? 34 : 18, bottom: horizontal ? 34 : 8, containLabel: true },
      legend: opt.rate ? { top: 0, left: 0, data: [opt.valueName || 'Typical value', 'List rate'], itemWidth: 10, itemHeight: 10, textStyle: { fontFamily: DD.MONO, fontSize: 11, color: DD.INK2 } } : undefined,
      xAxis: horizontal ? vAxis : cAxis, yAxis: horizontal ? cAxis : vAxis,
      tooltip: { trigger: 'item', formatter: p => { const g = groups[p.dataIndex]; if (!g) return ''; return DD.tip(DD.esc(g.label) + (g.limited ? ' · limited data' : ''), [[opt.valueName || 'Typical value', opt.fmtFull(g.value)], ['95% CI', `${opt.fmtFull(g.lo)} – ${opt.fmtFull(g.hi)}`], ...(DD.ok(g.rate) ? [['List rate', DD.fmt.rate(g.rate)]] : []), ['n', DD.fmt.n(g.n)], ...(g.nDesigners ? [['Designers', DD.fmt.n(g.nDesigners)]] : [])]); } },
      series,
    }), true);
  };
})();
