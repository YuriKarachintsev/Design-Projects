/* KPI strip styled as a split-flap departure board. Digits that change flip. */
(function () {
  const DD = window.DD;
  DD.charts.kpiBoard = function (el, items) {
    const prev = el._prev || {};
    el.innerHTML = items.map((it, i) => {
      const old = prev[it.label] || '';
      const pad = it.text.padStart(old.length, ' ');
      const cells = [...it.text].map((ch, j) => {
        const changed = old.length !== it.text.length || old[j] !== ch;
        const sep = /[ ,.%]/.test(ch) && ch !== '%' ? ' sep' : '';
        return `<span class="flap${sep}${changed && old ? ' flip' : ''}"><span>${ch === ' ' ? '&nbsp;' : DD.esc(ch)}</span></span>`;
      }).join('');
      return `<div class="kpi" role="group" aria-label="${DD.esc(it.label)}: ${DD.esc(it.text)}"><div class="label">${it.label}</div><div class="flaps">${cells}</div><div class="delta">${it.delta || '&nbsp;'}</div></div>`;
    }).join('');
    el._prev = Object.fromEntries(items.map(it => [it.label, it.text]));
  };
})();
