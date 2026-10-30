/* A4 · Heatmap: designers grouped by home location x project regions. */
(function () {
  const DD = window.DD;
  DD.charts.a4Heatmap = function (el, cells, designers, opt) {
    const c = DD.chartFor(el), regions = ['North', 'East', 'South', 'West'];
    const ds = designers.slice().sort((a, b) => Object.keys(DD.LOC_COL).indexOf(b.loc) - Object.keys(DD.LOC_COL).indexOf(a.loc) || b.name.localeCompare(a.name));
    el.style.height = Math.max(320, ds.length * 20 + 70) + 'px'; c.resize();
    const data = []; let max = 0;
    ds.forEach((d, i) => regions.forEach((r, j) => { const v = cells.get(d.name + '|' + r) || { v: 0, n: 0 }; max = Math.max(max, Math.abs(v.v)); data.push([j, i, +v.v.toFixed(2), v.n]); }));
    const rich = {}; Object.entries(DD.LOC_COL).forEach(([l, col]) => { rich[l] = { backgroundColor: col, width: 6, height: 12 }; });
    c.setOption(DD.baseOption({
      grid: { left: 8, right: 70, top: 26, bottom: 8, containLabel: true },
      xAxis: DD.axis({ type: 'category', position: 'top', data: regions.map(r => r + ' projects'), splitArea: { show: false }, axisLabel: { interval: 0, fontFamily: DD.MONO, fontSize: 11, color: DD.INK2 } }),
      yAxis: DD.axis({ type: 'category', data: ds.map(d => d.name), axisLabel: { interval: 0, fontFamily: "'IBM Plex Sans'", fontSize: 11.5, color: DD.INK, formatter: (v, i) => `${v} {${ds[i].loc}|}`, rich } }),
      visualMap: { dimension: 2, min: opt.diverging ? -max : 0, max: max || 1, calculable: false, orient: 'vertical', right: 0, top: 'middle', itemHeight: 140, itemWidth: 10,
        inRange: { color: opt.diverging ? [DD.OVER, '#F6F5F2', DD.UNDER] : ['#F6F5F2', '#5E7A99', '#1F2A37'] }, textStyle: { fontFamily: DD.MONO, fontSize: 10, color: DD.INK2 }, formatter: v => opt.fmt(v) },
      tooltip: { formatter: p => DD.tip(`${ds[p.value[1]].name} (${ds[p.value[1]].loc}) → ${regions[p.value[0]]} projects`, [[opt.label, opt.fmtFull(p.value[2])], ['Projects (n)', DD.fmt.n(p.value[3])]]) },
      series: [{ type: 'heatmap', data, itemStyle: { borderColor: '#fff', borderWidth: 1 }, emphasis: { itemStyle: { borderColor: DD.INK, borderWidth: 1 } } }],
    }), true);
  };
})();
