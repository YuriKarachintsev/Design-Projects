/* A2 · Cumulative (or per period) output by project type, combined or as small multiples. */
(function () {
  const DD = window.DD;
  const METRIC = { hours: ['ah', 'ph', 'Actual hours', 'Planned hours'], revenue: ['rev', null, 'Revenue'], cost: ['cost', 'rev', 'Actual cost', 'Revenue'], margin: ['margin', null, 'Margin'] };
  DD.charts.a2Cumulative = function (el, a2, opt) {
    const c = DD.chartFor(el), [key, planKey, label, planLabel] = METRIC[opt.metric];
    const isMoney = opt.metric !== 'hours', fmt = isMoney ? DD.fmt.moneyC : DD.fmt.n, fmtFull = isMoney ? DD.fmt.money : DD.fmt.h;
    const labels = a2.periods.map(p => a2.gran === 'yearly' ? String(p) : DD.fmt.ym(p));
    const val = (t, k) => { const s = a2.byType[t]; const v = k === 'margin' ? s.rev.map((r, i) => r - s.cost[i]) : s[k]; return v; };
    const cum = a => { let s = 0; return a.map(v => (s += v)); };
    const series = [], grids = [], xAxes = [], yAxes = [];
    const types = opt.types, multi = opt.layout === 'multiples' && types.length > 1;
    types.forEach((t, i) => {
      const gi = multi ? i : 0;
      if (multi || i === 0) {
        const rows = Math.ceil(types.length / 2), r = Math.floor(i / 2), col = i % 2;
        grids.push(multi ? { left: col ? '54%' : '2%', right: col ? '2%' : '54%', top: `${8 + r * (88 / rows)}%`, height: `${88 / rows - 14}%`, containLabel: true }
          : { left: 8, right: 16, top: 30, bottom: 8, containLabel: true });
        xAxes.push(DD.axis({ type: 'category', gridIndex: gi, data: labels, boundaryGap: !opt.cumulative, axisLabel: { fontFamily: DD.MONO, fontSize: 10, color: DD.INK2, hideOverlap: true } }));
        yAxes.push(DD.axis({ type: 'value', gridIndex: gi, axisLabel: { fontFamily: DD.MONO, fontSize: 10, color: DD.INK2, formatter: v => fmt(v) },
          name: multi ? DD.typeName(t) : '', nameLocation: 'end', nameTextStyle: { fontFamily: DD.MONO, color: DD.TYPE_COL[t], fontSize: 11, align: 'left', padding: [0, 0, 0, -30] } }));
      }
      let v = val(t, key); if (opt.cumulative) v = cum(v);
      series.push({ name: DD.typeName(t), type: opt.cumulative ? 'line' : 'bar', stack: !opt.cumulative && !multi ? 'p' : undefined, xAxisIndex: gi, yAxisIndex: gi, showSymbol: false,
        smooth: false, lineStyle: { width: 2 }, itemStyle: { color: DD.TYPE_COL[t] }, data: v.map(x => +x.toFixed(2)), barMaxWidth: 26 });
      if (opt.showPlan && planKey) {
        let pv = val(t, planKey); if (opt.cumulative) pv = cum(pv);
        series.push({ name: `${DD.typeName(t)} · ${planLabel}`, type: 'line', xAxisIndex: gi, yAxisIndex: gi, showSymbol: false, lineStyle: { width: 1.5, type: 'dashed', color: DD.TYPE_COL[t] },
          itemStyle: { color: DD.TYPE_COL[t] }, data: pv.map(x => +x.toFixed(2)) });
      }
    });
    const counts = a2.counts;
    c.setOption(DD.baseOption({
      grid: grids, xAxis: xAxes, yAxis: yAxes, series,
      legend: multi ? undefined : { top: 0, left: 0, itemWidth: 14, itemHeight: 8, textStyle: { fontFamily: DD.MONO, fontSize: 11, color: DD.INK2 }, data: types.map(DD.typeName) },
      tooltip: { trigger: 'axis', formatter: ps => DD.tip(ps[0].axisValue, ps.map(p => [`<span style="color:${p.color}">■</span> ${p.seriesName}`, fmtFull(p.value)])
        .concat([['Projects started (n)', DD.fmt.n(counts[ps[0].dataIndex])]])) },
    }), true);
  };
})();
