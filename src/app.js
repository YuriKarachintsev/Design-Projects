/* App shell: shared data layer instance, shared state (kept in the URL hash), formatting,
 * colour tokens, the ECharts theme and small UI helpers used by every tab. */
(function () {
  'use strict';
  const A = window.DDAnalysis, S = window.DDStats;
  const cfg = window.DD_CONFIG;
  const DD = window.DD = { A, S, cfg, charts: {}, tabs: {}, listeners: {} };

  // ------------------------------------------------------------------ events
  DD.on = (ev, fn) => { (DD.listeners[ev] = DD.listeners[ev] || []).push(fn); };
  DD.emit = (ev, arg) => (DD.listeners[ev] || []).forEach(fn => fn(arg));

  // ------------------------------------------------------------------ data layer
  DD.setDataset = function (raw, meta) {
    DD.raw = raw;
    DD.meta = meta;
    S.setCritical(cfg.CRITICAL_VALUE);
    DD.data = A.prepare(raw, cfg);
    DD.perf = A.performanceFactors(DD.data, cfg);
    DD.emit('data');
  };

  // ------------------------------------------------------------------ tokens
  DD.TYPE_COL = { 1: '#B38A35', 2: '#3A6795', 3: '#B9664F', 4: '#62A08A' };
  DD.LOC_COL = { South: '#A9B9CC', East: '#8299B3', West: '#5E7A99', North: '#3F5A78' };
  DD.locCol = l => DD.LOC_COL[l] || '#5E7A99';
  DD.INK = '#1F2A37'; DD.INK2 = '#5B6675'; DD.INK3 = '#8A93A0'; DD.LINE = '#E3E1DC';
  DD.UNDER = '#8C99AA'; DD.OVER = '#8E2F45';
  DD.REGION_SHORT = { North: 'N', East: 'E', South: 'S', West: 'W' };
  DD.typeName = t => `Type ${t}`;
  DD.reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ------------------------------------------------------------------ formats
  const nf0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
  const ok = v => v !== null && v !== undefined && Number.isFinite(v);
  DD.ok = ok;
  const cur = cfg.CURRENCY === 'USD' ? '$' : cfg.CURRENCY + ' ';
  DD.fmt = {
    h: v => ok(v) ? nf0.format(Math.round(v)) + ' h' : '–',
    hk: v => ok(v) ? (Math.abs(v) >= 1e4 ? nf1.format(v / 1e3) + 'k h' : nf0.format(Math.round(v)) + ' h') : '–',
    n: v => ok(v) ? nf0.format(Math.round(v)) : '–',
    money: v => ok(v) ? (v < 0 ? '−' : '') + cur + nf0.format(Math.abs(Math.round(v))) : '–',
    moneyC: v => {
      if (!ok(v)) return '–';
      const a = Math.abs(v), s = v < 0 ? '−' : '';
      if (a >= 1e6) return s + cur + (a / 1e6).toFixed(a >= 1e7 ? 1 : 2) + 'M';
      if (a >= 1e3) return s + cur + (a / 1e3).toFixed(a >= 1e5 ? 0 : 1) + 'k';
      return s + cur + Math.round(a);
    },
    rate: v => ok(v) ? cur + nf0.format(Math.round(v)) + '/h' : '–',
    rateN: v => ok(v) ? nf0.format(Math.round(v)) : '–',
    pct: (v, signed) => ok(v) ? (signed && v > 0 ? '+' : v < 0 ? '−' : '') + nf1.format(Math.abs(v * 100)) + '%' : '–',
    pr: v => ok(v) ? v.toFixed(2) : '–',
    x: (v, k = 2) => ok(v) ? Number(v).toFixed(k) : '–',
    p: p => !ok(p) ? '–' : p < 0.001 ? '< 0.001' : p.toFixed(3),
    ym: v => { const y = Math.floor(v / 12), m = v % 12; return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m] + ' ' + y; },
    ymIso: v => `${Math.floor(v / 12)}-${String(v % 12 + 1).padStart(2, '0')}`,
    signed: (v, f) => ok(v) ? (v > 0 ? '+' : v < 0 ? '−' : '') + f(Math.abs(v)) : '–',
  };
  /** Plain-language chance statement for a p-value (no jargon). */
  DD.chance = p => {
    if (!ok(p)) return 'could not be checked';
    if (p < 0.001) return 'almost never (under 1 in 1,000)';
    const n = Math.round(1 / p);
    return n <= 1 ? 'very often (about every time)' : `about 1 in ${nf0.format(n)}`;
  };
  DD.esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  DD.list = a => a.length <= 1 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
  DD.varSpan = (v, f, invert) => {
    // margin-style values: positive = slate up (good), negative = wine down
    const good = invert ? v < 0 : v > 0;
    return `<span class="${good ? 'pos arrow-up' : v === 0 ? '' : 'neg arrow-down'} num">${DD.fmt.signed(v, f)}</span>`;
  };

  // ------------------------------------------------------------------ state + URL hash
  DD.state = {
    tab: 'A',
    A: { from: null, to: null, types: [1, 2, 3, 4], regions: ['North', 'East', 'South', 'West'], gran: 'monthly', attr: 'start' },
    B: { source: 'all', stats: false, open: [] },
    C: { scenario: 'average', stats: false, overrides: {} },
  };
  DD.readHash = function () {
    const h = new URLSearchParams(location.hash.slice(1));
    const st = DD.state;
    if (['A', 'B', 'C', 'D'].includes(h.get('tab'))) st.tab = h.get('tab');
    const ymParse = s => { const m = /^(\d{4})-(\d{2})$/.exec(s || ''); return m ? A.ym(+m[1], +m[2]) : null; };
    if (ymParse(h.get('from')) !== null) st.A.from = ymParse(h.get('from'));
    if (ymParse(h.get('to')) !== null) st.A.to = ymParse(h.get('to'));
    if (h.get('types')) st.A.types = h.get('types').split(',').map(Number).filter(t => [1, 2, 3, 4].includes(t));
    if (h.get('regions')) st.A.regions = h.get('regions').split(',').map(s => ({ N: 'North', E: 'East', S: 'South', W: 'West' }[s])).filter(Boolean);
    if (['monthly', 'yearly'].includes(h.get('gran'))) st.A.gran = h.get('gran');
    if (['start', 'spread'].includes(h.get('attr'))) st.A.attr = h.get('attr');
    if (['all', 'original'].includes(h.get('data'))) st.B.source = h.get('data');
    if (['pessimistic', 'average', 'optimistic'].includes(h.get('scenario'))) st.C.scenario = h.get('scenario');
  };
  DD.writeHash = function () {
    const st = DD.state, a = st.A, p = new URLSearchParams();
    p.set('tab', st.tab);
    if (a.from !== null) p.set('from', DD.fmt.ymIso(a.from));
    if (a.to !== null) p.set('to', DD.fmt.ymIso(a.to));
    p.set('types', a.types.join(','));
    p.set('regions', a.regions.map(r => DD.REGION_SHORT[r]).join(','));
    p.set('gran', a.gran); p.set('attr', a.attr); p.set('data', st.B.source); p.set('scenario', st.C.scenario);
    try { history.replaceState(null, '', '#' + p.toString()); } catch (e) { /* file:// in some browsers */ }
  };
  DD.clampPeriod = function () {
    const a = DD.state.A, d = DD.data;
    if (a.from === null || a.from < d.minYM || a.from > d.maxYM) a.from = d.minYM;
    if (a.to === null || a.to > d.maxYM || a.to < d.minYM) a.to = d.maxYM;
    if (a.from > a.to) [a.from, a.to] = [a.to, a.from];
    if (!a.types.length) a.types = [];
  };

  // ------------------------------------------------------------------ ECharts
  const FONT = "'IBM Plex Sans', -apple-system, 'Segoe UI', sans-serif", MONO = "'IBM Plex Mono', ui-monospace, monospace";
  DD.MONO = MONO;
  DD.theme = {
    textStyle: { fontFamily: FONT, color: DD.INK },
    tooltip: { backgroundColor: '#fff', borderColor: DD.LINE, borderWidth: 1, padding: [8, 10], textStyle: { color: DD.INK, fontFamily: FONT, fontSize: 12 },
      extraCssText: 'box-shadow:none;border-radius:3px;' },
    axisLabel: { fontFamily: MONO, color: DD.INK2, fontSize: 11 },
  };
  DD.axis = (extra = {}) => Object.assign({ axisLine: { lineStyle: { color: DD.LINE } }, axisTick: { show: false }, splitLine: { lineStyle: { color: '#EEECE7' } },
    axisLabel: { fontFamily: MONO, color: DD.INK2, fontSize: 11 }, nameTextStyle: { fontFamily: MONO, color: DD.INK2, fontSize: 10.5 } }, extra);
  DD.baseOption = (o) => Object.assign({
    animation: !DD.reducedMotion, animationDuration: 500, animationDurationUpdate: 500, animationEasing: 'cubicOut', animationEasingUpdate: 'cubicOut',
    textStyle: DD.theme.textStyle, tooltip: Object.assign({ confine: true }, DD.theme.tooltip),
    emphasis: { focus: 'series' },
  }, o);
  DD.chartFor = function (el) {
    let c = echarts.getInstanceByDom(el);
    if (!c) c = echarts.init(el, null, { renderer: 'canvas' });
    return c;
  };
  DD.resizeAll = () => document.querySelectorAll('section.tab.on [_echarts_instance_]').forEach(el => { const c = echarts.getInstanceByDom(el); if (c) c.resize(); });
  window.addEventListener('resize', () => DD.resizeAll());
  DD.tip = (title, rows) => `<div style="font:600 12px ${FONT};margin-bottom:4px">${title}</div>` +
    rows.map(([k, v]) => `<div style="display:flex;justify-content:space-between;gap:18px;font-size:12px"><span style="color:${DD.INK2}">${k}</span><span style="font-family:${MONO}">${v}</span></div>`).join('');

  // ------------------------------------------------------------------ UI helpers
  DD.h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  DD.seg = function (el, items, value, onChange, label) {
    el.classList.add('seg'); el.setAttribute('role', 'group'); if (label) el.setAttribute('aria-label', label);
    el.innerHTML = items.map(([k, l]) => `<button type="button" data-k="${k}" aria-pressed="${String(k) === String(value)}">${l}</button>`).join('');
    el.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      el.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      onChange(b.dataset.k);
    }));
  };
  DD.card = function ({ gate, title, controls = '', id, cls = 'c12' }) {
    return DD.h(`<div class="card ${cls}" ${id ? `id="${id}"` : ''}><div class="card-head"><div class="ttl">${gate ? `<span class="gate">${gate}</span>` : ''}<h3 class="card-title">${title}</h3></div><div class="card-ctl">${controls}</div></div><p class="headline"></p><div class="card-body"></div></div>`);
  };
  DD.calc = (html) => `<details class="calc"><summary>How it's calculated</summary><div class="body">${html}</div></details>`;
  DD.status = (st) => {
    const cls = { 'CONFIRMED': 'CONFIRMED', 'PARTLY': 'PARTLY', 'FEW DESIGNERS': 'FEW', 'NO CLEAR GAP': 'NOGAP', 'LIMITED DATA': 'LIMITED', 'WORTH WATCHING': 'WATCH' }[st] || 'NOGAP';
    return `<span class="status ${cls}">${st}</span>`;
  };
  DD.meter = n => `<span class="meter" role="img" aria-label="Evidence ${n} of 5">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span>`;

  /** "For analysts" drawers: per-card state, plus a tab-level Statistics switch. */
  DD.drawers = { A: new Map(), B: new Map(), C: new Map() };
  DD.analyst = function (tab, key, contentFn, afterFn) {
    const wrap = document.createElement('div');
    const open = DD.drawers[tab].has(key) ? DD.drawers[tab].get(key) : !!(DD.state[tab] && DD.state[tab].stats);
    const id = 'drw-' + tab + '-' + key.replace(/\W+/g, '-');
    wrap.innerHTML = `<button type="button" class="analyst-btn" aria-expanded="${open}" aria-controls="${id}">For analysts ${open ? '▾' : '▸'}</button><div class="drawer ${open ? 'open' : ''}" id="${id}"></div>`;
    const btn = wrap.firstElementChild, body = wrap.lastElementChild;
    const fill = () => { if (!body.dataset.filled) { body.innerHTML = contentFn(); body.dataset.filled = '1'; if (afterFn) requestAnimationFrame(() => afterFn(body)); } };
    if (open) fill();
    btn.addEventListener('click', () => {
      const now = btn.getAttribute('aria-expanded') !== 'true';
      DD.drawers[tab].set(key, now);
      btn.setAttribute('aria-expanded', String(now)); btn.textContent = `For analysts ${now ? '▾' : '▸'}`;
      if (now) fill();
      body.classList.toggle('open', now);
    });
    wrap.setOpen = (now) => { DD.drawers[tab].set(key, now); btn.setAttribute('aria-expanded', String(now)); btn.textContent = `For analysts ${now ? '▾' : '▸'}`; if (now) fill(); body.classList.toggle('open', now); };
    wrap.classList.add('analyst-wrap');
    return wrap;
  };
  DD.setAllDrawers = function (tab, open) {
    DD.state[tab].stats = open;
    document.querySelectorAll(`#tab-${tab} .analyst-wrap`).forEach(w => w.setOpen(open));
  };
  DD.table = (cols, rows, opts = {}) => `<div class="scroll"><table${opts.cls ? ` class="${opts.cls}"` : ''}><thead><tr>${cols.map(c => `<th>${c[1]}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr${r._hl ? ' class="hl"' : ''}>${cols.map(c => `<td>${c[2] ? c[2](r[c[0]], r) : DD.esc(r[c[0]] ?? '–')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
})();
