/* Mini normal curve: tails beyond ±critical value shaded, a marker at the t-stat. */
(function () {
  const DD = window.DD;
  DD.charts.bNormal = function (el, t, crit) {
    const c = DD.chartFor(el), pts = [], tails = [];
    const phi = x => Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI);
    for (let x = -4.5; x <= 4.5001; x += 0.05) { pts.push([+x.toFixed(2), phi(x)]); tails.push([+x.toFixed(2), Math.abs(x) >= crit ? phi(x) : null]); }
    const tc = Math.max(-4.4, Math.min(4.4, DD.ok(t) ? t : 0));
    c.setOption(DD.baseOption({ animation: !DD.reducedMotion, grid: { left: 8, right: 8, top: 22, bottom: 30 },
      xAxis: { type: 'value', min: -4.5, max: 4.5, interval: 1.96 * 0 + 1, axisLine: { lineStyle: { color: DD.LINE } }, axisTick: { show: false }, splitLine: { show: false }, axisLabel: { fontFamily: DD.MONO, fontSize: 9, color: DD.INK2, formatter: v => (Math.abs(v) === 4 || v === 0 ? String(v) : '') } },
      yAxis: { type: 'value', show: false, max: 0.45 },
      tooltip: { show: false },
      series: [
        { type: 'line', data: pts, showSymbol: false, lineStyle: { color: DD.INK2, width: 1.2 }, silent: true },
        { type: 'line', data: tails, showSymbol: false, connectNulls: false, lineStyle: { width: 0 }, areaStyle: { color: 'rgba(142,47,69,0.28)' }, silent: true },
        { type: 'scatter', data: [[tc, 0]], symbol: 'triangle', symbolSize: 10, itemStyle: { color: DD.INK }, silent: true,
          markLine: { silent: true, symbol: 'none', lineStyle: { color: DD.INK, width: 1.5 }, label: { formatter: `t = ${DD.fmt.x(t, 2)}${t > 4.4 ? ' →' : t < -4.4 ? ' ←' : ''}`, fontFamily: DD.MONO, fontSize: 10, color: DD.INK, position: 'end', align: tc < -2.5 ? 'left' : tc > 2.5 ? 'right' : 'center' }, data: [{ xAxis: tc }] } },
        { type: 'line', data: [], markLine: { silent: true, symbol: 'none', lineStyle: { color: DD.OVER, type: 'dashed', width: 1 }, label: { formatter: p => (p.value > 0 ? `+${crit}` : `−${crit}`), fontFamily: DD.MONO, fontSize: 9, color: DD.OVER, position: 'start', distance: 2 }, data: [{ xAxis: -crit }, { xAxis: crit }] } },
      ] }), true);
  };
})();
