/* A4 · Region cards: metric, share, margin % and a yearly sparkline. */
(function () {
  const DD = window.DD;
  DD.charts.a4Cards = function (el, cards, opt) {
    el.innerHTML = cards.map((g, i) => `<div class="tile"><div class="label">${g.region}${opt.basis === 'loc' ? ' designers' : ' projects'}</div>
      <div class="v">${opt.fmt(g.value)}</div><div class="s">${DD.fmt.pct(g.share)} of total · margin ${DD.fmt.pct(g.marginPct)}</div><div class="chart mini" id="${el.id}-sp${i}"></div></div>`).join('');
    cards.forEach((g, i) => {
      const c = DD.chartFor(document.getElementById(`${el.id}-sp${i}`));
      c.setOption(DD.baseOption({ animation: false, grid: { left: 2, right: 2, top: 6, bottom: 2 }, xAxis: { type: 'category', show: false, data: g.years.map(String) }, yAxis: { type: 'value', show: false, min: 0 },
        tooltip: { trigger: 'axis', formatter: ps => DD.tip(`${g.region} · ${ps[0].name}`, [[opt.label, opt.fmtFull(ps[0].value)], ['Projects (n)', DD.fmt.n(g.yearN[ps[0].dataIndex])]]) },
        series: [{ type: 'line', data: g.spark.map(v => +v.toFixed(2)), showSymbol: false, lineStyle: { width: 1.5, color: opt.basis === 'loc' ? DD.locCol(g.region) : DD.INK }, areaStyle: { color: 'rgba(31,42,55,0.05)' } }] }), true);
    });
  };
})();
