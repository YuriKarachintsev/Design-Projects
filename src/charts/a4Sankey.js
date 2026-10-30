/* A4 · Sankey: designer home location -> project region. */
(function () {
  const DD = window.DD;
  DD.charts.a4Sankey = function (el, flows, opt) {
    const c = DD.chartFor(el), locs = Object.keys(DD.LOC_COL);
    const nodes = locs.map(l => ({ name: `${l} designers`, itemStyle: { color: DD.locCol(l) } })).concat(['North', 'East', 'South', 'West'].map(r => ({ name: `${r} projects`, itemStyle: { color: '#D8D5CD' } })));
    const links = flows.filter(f => f.value > 0).map(f => ({ source: `${f.from} designers`, target: `${f.to} projects`, value: +f.value.toFixed(2), n: f.n }));
    c.setOption(DD.baseOption({
      tooltip: { trigger: 'item', formatter: p => p.dataType === 'edge' ? DD.tip(`${p.data.source} → ${p.data.target}`, [[opt.label, opt.fmtFull(p.data.value)], ['Projects (n)', DD.fmt.n(p.data.n)]]) : DD.tip(p.name, [[opt.label, opt.fmtFull(p.value)]]) },
      series: [{ type: 'sankey', left: 4, right: 110, top: 8, bottom: 8, nodeWidth: 12, nodeGap: 12, draggable: false, layoutIterations: 0, data: nodes, links,
        label: { fontFamily: DD.MONO, fontSize: 11, color: DD.INK }, lineStyle: { color: 'source', opacity: 0.35, curveness: 0.5 }, emphasis: { focus: 'adjacency' } }],
    }), true);
  };
})();
