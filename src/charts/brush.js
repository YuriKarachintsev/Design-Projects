/* Brush timeline of monthly project starts; the slider selects the period. */
(function () {
  const DD = window.DD;
  DD.charts.brush = function (el, data, from, to, onChange) {
    const c = DD.chartFor(el), months = [];
    for (let m = data.minYM; m <= data.maxYM; m++) months.push(m);
    const counts = months.map(m => data.valid.filter(r => r.ym === m).length);
    c.setOption(DD.baseOption({
      animation: false,
      grid: { left: 4, right: 4, top: 2, bottom: 2, containLabel: false },
      xAxis: { type: 'category', data: months.map(DD.fmt.ym), show: false },
      yAxis: { type: 'value', show: false },
      tooltip: { trigger: 'axis', formatter: p => `${p[0].name}: <b style="font-family:${DD.MONO}">${p[0].value}</b> project starts` },
      dataZoom: [{ type: 'slider', xAxisIndex: 0, startValue: from - data.minYM, endValue: to - data.minYM, height: 42, top: 2, bottom: 2, left: 4, right: 4,
        borderColor: DD.LINE, fillerColor: 'rgba(31,42,55,0.07)', handleSize: '100%', handleStyle: { color: '#fff', borderColor: DD.INK },
        moveHandleSize: 0, showDetail: false, brushSelect: true, dataBackground: { lineStyle: { opacity: 0 }, areaStyle: { opacity: 0 } }, selectedDataBackground: { lineStyle: { opacity: 0 }, areaStyle: { opacity: 0 } } }],
      series: [{ type: 'bar', data: counts, barCategoryGap: '15%', itemStyle: { color: '#C9C6BE' }, emphasis: { itemStyle: { color: DD.INK } } }],
    }), true);
    c.off('datazoom');
    let t = null;
    c.on('datazoom', () => {
      clearTimeout(t);
      t = setTimeout(() => { const dz = c.getOption().dataZoom[0]; onChange(data.minYM + Math.round(dz.startValue), data.minYM + Math.round(dz.endValue)); }, 180);
    });
    return c;
  };
})();
