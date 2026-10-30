/* A1 · Hours by designer: horizontal stacked bars by project type. */
(function () {
  const DD = window.DD;
  DD.charts.a1Designers = function (el, a1, opt) {
    const c = DD.chartFor(el), types = opt.types;
    const rows = a1.map(d => ({ ...d, shown: types.reduce((s, t) => s + (d.hours[t] || 0), 0) })).filter(d => d.shown > 0 || opt.showAll);
    const sorter = { hours: (a, b) => a.shown - b.shown, name: (a, b) => b.designer.localeCompare(a.designer), rate: (a, b) => a.rate - b.rate || a.shown - b.shown }[opt.sort];
    rows.sort(sorter);
    el.style.height = Math.max(320, rows.length * 24 + 70) + 'px';
    c.resize();
    const rich = { name: { fontFamily: "'IBM Plex Sans'", fontSize: 12, color: DD.INK, padding: [0, 6, 0, 0] } };
    Object.entries(DD.LOC_COL).forEach(([l, col]) => { rich[l] = { backgroundColor: col, color: l === 'North' || l === 'West' ? '#fff' : DD.INK, fontFamily: DD.MONO, fontSize: 10, padding: [2, 4], borderRadius: 2 }; });
    const series = [1, 2, 3, 4].map(t => ({
      name: DD.typeName(t), type: 'bar', stack: 'h', barWidth: '62%', itemStyle: { color: DD.TYPE_COL[t], borderColor: '#fff', borderWidth: 1 },
      data: rows.map(d => (types.includes(t) ? +(d.hours[t] || 0).toFixed(2) : 0)), emphasis: { focus: 'series' },
    }));
    series.push({ name: 'total', type: 'bar', stack: 'h', data: rows.map(() => 0), silent: true, tooltip: { show: false },
      label: { show: true, position: 'right', fontFamily: DD.MONO, fontSize: 11, color: DD.INK, formatter: p => DD.fmt.n(rows[p.dataIndex].shown) } });
    if (opt.planMarker) series.push({ name: 'Planned hours', type: 'scatter', symbol: 'rect', symbolSize: [2, 16], z: 5, itemStyle: { color: DD.INK },
      data: rows.map((d, i) => [+(d.plannedShown || 0).toFixed(2), i]) });
    c.setOption(DD.baseOption({
      grid: { left: 8, right: 60, top: 28, bottom: 8, containLabel: true },
      legend: { top: 0, left: 0, itemWidth: 12, itemHeight: 10, textStyle: { fontFamily: DD.MONO, fontSize: 11, color: DD.INK2 },
        data: [1, 2, 3, 4].map(DD.typeName).concat(opt.planMarker ? ['Planned hours'] : []), selected: Object.fromEntries([1, 2, 3, 4].map(t => [DD.typeName(t), types.includes(t)])) },
      xAxis: DD.axis({ type: 'value', axisLabel: { fontFamily: DD.MONO, color: DD.INK2, fontSize: 11, formatter: v => DD.fmt.n(v) } }),
      yAxis: DD.axis({ type: 'category', data: rows.map(d => d.designer), axisLabel: { interval: 0, formatter: (v, i) => `{name|${v}}{${rows[i].loc}|${rows[i].rate}}`, rich } }),
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: ps => {
        const d = rows[ps[0].dataIndex];
        return DD.tip(`${DD.esc(d.designer)} · ${d.loc} · ${DD.fmt.rate(d.rate)}`, [
          ...types.filter(t => d.hours[t]).map(t => [`<span style="color:${DD.TYPE_COL[t]}">■</span> Type ${t}`, DD.fmt.h(d.hours[t])]),
          ['Projects (n)', DD.fmt.n(d.n)], ['Planned vs actual', `${DD.fmt.h(d.plannedShown)} → ${DD.fmt.h(d.shown)}`], ['PR (actual ÷ planned)', DD.fmt.pr(d.shown / d.plannedShown)]]);
      } },
      series,
    }), true);
    c.off('legendselectchanged');
    c.on('legendselectchanged', e => { const t = parseInt(e.name.replace(/\D/g, ''), 10); if (t) opt.onLegend(t, e.selected[e.name]); });
    return rows;
  };
})();
