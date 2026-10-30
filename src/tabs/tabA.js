/* Tab A · Overview (descriptive statistics). */
(function () {
  const DD = window.DD, A = DD.A, F = DD.fmt;
  const root = () => document.getElementById('tab-A');
  const local = { a1Sort: 'hours', a1Plan: false, a2Metric: 'hours', a2Cum: true, a2Plan: false, a2Layout: 'combined', a3Sort: 'revenue', a3Gap: false, a3HideZero: true,
    a3Frame: null, a3Playing: false, a5View: 'cpph', a4Basis: 'project', a4Metric: 'revenue' };
  let timer = null;

  function build() {
    const el = root(), d = DD.data;
    const years = []; for (let y = A.ymYear(d.minYM); y <= A.ymYear(d.maxYM); y++) years.push(y);
    el.innerHTML = `
      <div class="bar" id="A-bar">
        <div class="bar-row">
          <div class="ctl"><span class="label">Period</span><div style="display:flex;gap:6px;align-items:center"><label class="sr-only" for="A-from">From</label><input type="month" id="A-from"><span class="muted">–</span><label class="sr-only" for="A-to">To</label><input type="month" id="A-to"></div></div>
          <div class="ctl"><span class="label">Presets</span><div class="presets" id="A-presets">
            <button class="chip" data-p="all">All</button><button class="chip" data-p="l12">Last 12 months</button><button class="chip" data-p="ytd">YTD</button>
            ${years.map(y => `<button class="chip" data-p="y${y}">${y}</button>`).join('')}</div></div>
          <div class="ctl"><span class="label">Project type</span><div class="chips" id="A-types"></div></div>
          <div class="ctl"><span class="label">Project region</span><div class="chips" id="A-regions"></div></div>
          <div class="ctl"><span class="label">Granularity</span><div id="A-gran"></div></div>
          <div class="ctl"><span class="label">Attribute</span><div id="A-attr"></div></div>
          <div class="ctl"><span class="label">&nbsp;</span><button class="btn" id="A-reset">Reset all filters</button></div>
        </div>
        <div class="brush" id="A-brush" aria-label="Timeline of monthly project starts; drag to select the period"></div>
        <div class="summary-line" id="A-summary"></div>
      </div>
      <div id="A-empty" class="card empty" style="display:none"><div class="big">No projects here</div>Nothing matches these filters. Widen the period, switch a project type or region back on, or <button class="btn" id="A-reset2">reset all filters</button>.</div>
      <div id="A-body">
        <div class="board" id="A-kpi" aria-live="polite"></div>
        <div class="grid">
          <div class="card c7" id="A1"></div>
          <div class="card c5" id="A2"></div>
        </div>
        <div class="grid">
          <div class="card c7" id="A3"></div>
          <div class="card c5" id="A5"></div>
        </div>
        <div class="grid"><div class="card c12" id="A4"></div></div>
      </div>`;
    // cards
    const head = (gate, title, ctl) => `<div class="card-head"><div class="ttl"><span class="gate">${gate}</span><h3 class="card-title">${title}</h3></div><div class="card-ctl">${ctl}</div></div><p class="headline"></p>`;
    el.querySelector('#A1').innerHTML = head('A1', 'Hours by designer', `<span id="A1-sort"></span><label class="chip"><input type="checkbox" id="A1-plan"> Planned marker</label>`) +
      `<div class="chart" id="A1-chart"></div>` + DD.calc(`Bar length = <code>Σ actual hours</code> per designer in the period, split by project type (actual hours = Actual ÷ hourly rate). The marker shows <code>Σ planned hours</code> (Planned ÷ rate). PR = actual ÷ planned hours. The chip beside each name is the hourly rate, shaded by the designer's home location.`);
    el.querySelector('#A2').innerHTML = head('A2', 'Cumulative by project type', `<span id="A2-metric"></span><span id="A2-cum"></span><span id="A2-layout"></span><label class="chip"><input type="checkbox" id="A2-plan"> Show plan</label>`) +
      `<div class="chart" id="A2-chart"></div>` + DD.calc(`Revenue = Planned (what the client pays). Actual cost = Actual. Margin = Revenue − Actual cost. Hours = value ÷ hourly rate. "Show plan" draws planned hours against actual hours, and revenue against actual cost (dashed). Small multiples give each type its own scale so Types 3 and 4 stay readable.`);
    el.querySelector('#A3').innerHTML = head('A3', 'Year to date: revenue vs actual cost', `<span id="A3-sort"></span><label class="chip"><input type="checkbox" id="A3-gap"> Gap only</label><label class="chip"><input type="checkbox" id="A3-zero" checked> Hide zero</label>`) +
      `<div style="display:flex;gap:10px;align-items:center;margin:2px 0 6px"><button class="btn ink" id="A3-play" aria-label="Play">▶ Play</button><input type="range" id="A3-scrub" min="0" max="0" value="0" style="flex:1" aria-label="Animation step"><span class="label" id="A3-step"></span></div>` +
      `<div class="chart" id="A3-chart"></div>` + DD.calc(`For the year of the To date: year to date = 1 January to the To month. Bar = YTD actual cost; dark tick = YTD revenue (= Planned). End label = margin = revenue − actual cost, and margin % = margin ÷ revenue (▲ slate = margin gained, ▼ wine = margin lost). Play animates month by month (year by year with Yearly granularity). Tooltip growth compares revenue with the same months of the previous year.`);
    el.querySelector('#A5').innerHTML = head('A5', 'Rate efficiency', `<span id="A5-view"></span>`) +
      `<div class="chart" id="A5-chart"></div>` + DD.calc(`Realised PR = Σ actual hours ÷ Σ planned hours of the designer's projects in the period. <code>Cost per planned hour = rate × realised PR</code> (lower is better). <code>Earned per hour worked = rate ÷ realised PR</code> (higher is better). Hollow dot = list rate. Dashed line = department value (Σ actual cost ÷ Σ planned hours, or Σ revenue ÷ Σ actual hours). Designers with fewer than ${DD.cfg.MIN_DESIGNER_PROJECTS} projects are greyed out.`);
    el.querySelector('#A4').innerHTML = head('A4', 'Regional comparison of output', `<span id="A4-basis"></span><span id="A4-metric"></span>`) +
      `<div class="tiles" id="A4-cards"></div><div class="grid" style="margin-bottom:0"><div class="c5"><div class="label" style="margin-bottom:4px">Designer home location → project region</div><div class="chart tall" id="A4-sankey"></div></div><div class="c7"><div class="label" style="margin-bottom:4px">Designers (grouped by home location) × project region</div><div class="chart" id="A4-heat"></div></div></div>` +
      DD.calc(`Project region = where the project is. Designer home location comes from the hourly rate (${Object.entries(DD.cfg.LOCATION_BY_RATE).map(([r, l]) => `${r} ${l}`).join(', ')}). Share = the region's part of the total. Margin % = (revenue − actual cost) ÷ revenue. Sparklines show yearly totals within the period.`);
    wire();
  }

  function wire() {
    const st = DD.state.A, el = root();
    const types = el.querySelector('#A-types');
    types.innerHTML = [1, 2, 3, 4].map(t => `<button class="chip" data-t="${t}" aria-pressed="${st.types.includes(t)}"><span class="sw" style="background:${DD.TYPE_COL[t]}"></span>Type ${t}</button>`).join('');
    types.querySelectorAll('button').forEach(b => b.addEventListener('click', () => toggleType(+b.dataset.t)));
    const regs = el.querySelector('#A-regions');
    regs.innerHTML = ['North', 'East', 'South', 'West'].map(r => `<button class="chip" data-r="${r}" aria-pressed="${st.regions.includes(r)}" title="${r}">${r[0]}</button>`).join('');
    regs.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      const r = b.dataset.r; st.regions = st.regions.includes(r) ? st.regions.filter(x => x !== r) : st.regions.concat(r); b.setAttribute('aria-pressed', String(st.regions.includes(r))); update();
    }));
    DD.seg(el.querySelector('#A-gran'), [['monthly', 'Monthly'], ['yearly', 'Yearly']], st.gran, v => { st.gran = v; local.a3Frame = null; update(); });
    DD.seg(el.querySelector('#A-attr'), [['start', 'Start month'], ['spread', 'Spread over duration']], st.attr, v => { st.attr = v; update(); });
    const from = el.querySelector('#A-from'), to = el.querySelector('#A-to');
    const parse = v => { const m = /^(\d{4})-(\d{2})$/.exec(v); return m ? A.ym(+m[1], +m[2]) : null; };
    from.addEventListener('change', () => { const v = parse(from.value); if (v !== null) { st.from = v; DD.clampPeriod(); update(true); } });
    to.addEventListener('change', () => { const v = parse(to.value); if (v !== null) { st.to = v; DD.clampPeriod(); local.a3Frame = null; update(true); } });
    el.querySelectorAll('#A-presets button').forEach(b => b.addEventListener('click', () => {
      const p = b.dataset.p, d = DD.data;
      if (p === 'all') { st.from = d.minYM; st.to = d.maxYM; }
      else if (p === 'l12') { st.to = d.maxYM; st.from = Math.max(d.minYM, d.maxYM - 11); }
      else if (p === 'ytd') { st.to = d.maxYM; st.from = A.ym(A.ymYear(d.maxYM), 1); }
      else { const y = +p.slice(1); st.from = Math.max(d.minYM, A.ym(y, 1)); st.to = Math.min(d.maxYM, A.ym(y, 12)); }
      local.a3Frame = null; update(true);
    }));
    const reset = () => { Object.assign(st, { from: DD.data.minYM, to: DD.data.maxYM, types: [1, 2, 3, 4], regions: ['North', 'East', 'South', 'West'], gran: 'monthly', attr: 'start' }); local.a3Frame = null; build(); update(true); };
    el.querySelector('#A-reset').addEventListener('click', reset);
    el.querySelector('#A-reset2').addEventListener('click', reset);
    DD.seg(el.querySelector('#A1-sort'), [['hours', 'Hours'], ['name', 'Name'], ['rate', 'Rate']], local.a1Sort, v => { local.a1Sort = v; renderA1(); });
    el.querySelector('#A1-plan').addEventListener('change', e => { local.a1Plan = e.target.checked; renderA1(); });
    DD.seg(el.querySelector('#A2-metric'), [['hours', 'Hours'], ['revenue', 'Revenue'], ['cost', 'Actual cost'], ['margin', 'Margin']], local.a2Metric, v => { local.a2Metric = v; renderA2(); });
    DD.seg(el.querySelector('#A2-cum'), [['1', 'Cumulative'], ['0', 'Per period']], local.a2Cum ? '1' : '0', v => { local.a2Cum = v === '1'; renderA2(); });
    DD.seg(el.querySelector('#A2-layout'), [['combined', 'Combined'], ['multiples', 'Small multiples']], local.a2Layout, v => { local.a2Layout = v; renderA2(); });
    el.querySelector('#A2-plan').addEventListener('change', e => { local.a2Plan = e.target.checked; renderA2(); });
    DD.seg(el.querySelector('#A3-sort'), [['revenue', 'Revenue'], ['cost', 'Cost'], ['margin', 'Margin'], ['marginPct', 'Margin %']], local.a3Sort, v => { local.a3Sort = v; renderA3(); });
    el.querySelector('#A3-gap').addEventListener('change', e => { local.a3Gap = e.target.checked; renderA3(); });
    el.querySelector('#A3-zero').addEventListener('change', e => { local.a3HideZero = e.target.checked; renderA3(); });
    el.querySelector('#A3-play').addEventListener('click', togglePlay);
    el.querySelector('#A3-scrub').addEventListener('input', e => { stop(); local.a3Frame = +e.target.value; renderA3(); });
    DD.seg(el.querySelector('#A5-view'), [['cpph', 'Cost per planned hour'], ['earned', 'Earned per hour worked']], local.a5View, v => { local.a5View = v; renderA5(); });
    DD.seg(el.querySelector('#A4-basis'), [['project', 'Project region'], ['home', 'Designer home location']], local.a4Basis, v => { local.a4Basis = v; renderA4(); });
    DD.seg(el.querySelector('#A4-metric'), [['ah', 'Hours'], ['revenue', 'Revenue'], ['cost', 'Actual cost'], ['margin', 'Margin'], ['projects', 'Projects']], local.a4Metric, v => { local.a4Metric = v; renderA4(); });
  }

  function toggleType(t, on) {
    const st = DD.state.A;
    const want = on === undefined ? !st.types.includes(t) : on;
    st.types = want ? [...new Set(st.types.concat(t))].sort() : st.types.filter(x => x !== t);
    root().querySelectorAll('#A-types button').forEach(b => b.setAttribute('aria-pressed', String(st.types.includes(+b.dataset.t))));
    update();
  }

  let M = null, rowsF = null;
  function update(periodChanged) {
    const st = DD.state.A, el = root();
    DD.clampPeriod();
    el.querySelector('#A-from').value = F.ymIso(st.from);
    el.querySelector('#A-to').value = F.ymIso(st.to);
    if (periodChanged || !el.querySelector('#A-brush')._init) { DD.charts.brush(el.querySelector('#A-brush'), DD.data, st.from, st.to, (f, t) => { st.from = f; st.to = t; local.a3Frame = null; update(); }); el.querySelector('#A-brush')._init = true; }
    rowsF = DD.data.valid.filter(r => st.types.includes(r.type) && st.regions.includes(r.region));
    M = A.tabA(DD.data, { from: st.from, to: st.to, types: st.types, regions: st.regions, granularity: st.gran, attribution: st.attr, regionBasis: local.a4Basis === 'home' ? 'home' : 'project' }, DD.cfg);
    el.querySelector('#A-summary').innerHTML = `${F.ym(st.from)} – ${F.ym(st.to)} · ${st.types.length === 4 ? 'All types' : st.types.length ? 'Types ' + st.types.join(', ') : 'No types'} · ${st.regions.length === 4 ? 'All regions' : st.regions.length ? st.regions.join(', ') : 'No regions'} · <b>${F.n(M.n)}</b> projects · <b>${M.nDesigners}</b> designers${st.attr === 'spread' ? ' · hours and money spread over each project\'s planned duration' : ''}`;
    const empty = M.n === 0 && !M.a1.length;
    el.querySelector('#A-empty').style.display = empty ? '' : 'none';
    el.querySelector('#A-body').style.display = empty ? 'none' : '';
    DD.writeHash();
    if (empty) return;
    renderKPI(); renderA1(); renderA2(); renderA3(); renderA5(); renderA4();
  }

  function renderKPI() {
    const k = M.kpi, p = M.prev, st = DD.state.A;
    const len = st.to - st.from + 1;
    const d = (cur, prev, kind) => {
      if (!p || !DD.ok(prev) || !DD.ok(cur) || (kind !== 'pp' && prev === 0)) return '–';
      const ch = kind === 'pp' ? cur - prev : cur / prev - 1;
      const txt = kind === 'pp' ? `${ch >= 0 ? '+' : '−'}${Math.abs(ch * 100).toFixed(1)} pts` : F.pct(ch, true);
      return `<span class="${ch >= 0 ? 'up' : 'down'}">${txt}</span> vs prev. ${len} mo`;
    };
    DD.charts.kpiBoard(root().querySelector('#A-kpi'), [
      { label: 'Actual hours', text: F.n(k.ah), delta: d(k.ah, p && p.ah) },
      { label: 'Revenue', text: F.moneyC(k.rev), delta: d(k.rev, p && p.rev) },
      { label: 'Actual cost', text: F.moneyC(k.cost), delta: d(k.cost, p && p.cost) },
      { label: `Margin · ${F.pct(k.marginPct)}`, text: F.moneyC(k.margin), delta: d(k.margin, p && p.margin) },
      { label: 'Projects', text: F.n(k.projects), delta: d(k.projects, p && p.projects) },
      { label: 'Active designers', text: F.n(k.designers), delta: d(k.designers, p && p.designers) },
      { label: 'Median PR', text: F.pr(k.medianPR), delta: d(k.medianPR, p && p.medianPR) },
      { label: '% over plan', text: F.pct(k.overShare), delta: d(k.overShare, p && p.overShare, 'pp') },
    ]);
  }

  function renderA1() {
    const st = DD.state.A, card = root().querySelector('#A1');
    const a1 = M.a1.map(d => ({ ...d, plannedShown: d.planned }));
    const rows = DD.charts.a1Designers(card.querySelector('#A1-chart'), a1, { types: st.types, sort: local.a1Sort, planMarker: local.a1Plan, onLegend: (t, on) => toggleType(t, on) });
    const tot = rows.reduce((s, r) => s + r.shown, 0), top = rows.slice().sort((a, b) => b.shown - a.shown);
    const top5 = top.slice(0, 5).reduce((s, r) => s + r.shown, 0);
    card.querySelector('.headline').innerHTML = top.length ? `<b>${DD.esc(top[0].designer)}</b> logged the most hours (<span class="num">${F.h(top[0].shown)}</span>, ${F.pct(top[0].shown / tot)} of the total); the top five designers did <span class="num">${F.pct(top5 / tot)}</span> of all ${F.n(tot)} hours.` : '';
  }

  function renderA2() {
    const st = DD.state.A, card = root().querySelector('#A2');
    const per = M.a2.periods, gran = M.a2.gran;
    const counts = per.map(p => rowsF.filter(r => r.ym >= st.from && r.ym <= st.to && (gran === 'yearly' ? A.ymYear(r.ym) === p : r.ym === p)).length);
    DD.charts.a2Cumulative(card.querySelector('#A2-chart'), { ...M.a2, counts }, { metric: local.a2Metric, cumulative: local.a2Cum, showPlan: local.a2Plan, layout: local.a2Layout, types: st.types });
    const key = { hours: 'ah', revenue: 'rev', cost: 'cost', margin: 'margin' }[local.a2Metric];
    const tot = t => { const s = M.a2.byType[t]; const sm = a => a.reduce((x, y) => x + y, 0); return key === 'margin' ? sm(s.rev) - sm(s.cost) : sm(s[key]); };
    const totals = st.types.map(t => ({ t, v: tot(t) })), all = totals.reduce((s, x) => s + x.v, 0);
    const lead = totals.slice().sort((a, b) => b.v - a.v)[0];
    const label = { hours: 'actual hours', revenue: 'revenue', cost: 'actual cost', margin: 'margin' }[local.a2Metric];
    let extra = '';
    if (local.a2Metric === 'hours') { const ph = st.types.reduce((s, t) => s + M.a2.byType[t].ph.reduce((x, y) => x + y, 0), 0); extra = ` Actual hours ran <span class="num">${F.pct(Math.abs(all / ph - 1))}</span> ${all < ph ? 'below' : 'above'} plan.`; }
    if (local.a2Metric === 'cost') { const rv = st.types.reduce((s, t) => s + M.a2.byType[t].rev.reduce((x, y) => x + y, 0), 0); extra = ` Cost was <span class="num">${F.pct(all / rv)}</span> of revenue.`; }
    card.querySelector('.headline').innerHTML = lead && all ? `Type ${lead.t} brings <span class="num">${F.pct(lead.v / all)}</span> of ${label} in the period (${local.a2Metric === 'hours' ? F.h(lead.v) : F.moneyC(lead.v)}).${extra}` : 'No output in this selection.';
  }

  // ---- A3 frames
  function a3Frames() {
    const st = DD.state.A;
    const yr = A.ymYear(st.to), mTo = A.ymMonth(st.to);
    const frames = [];
    const acc = (y, mEnd, yStart) => {
      const o = new Map();
      rowsF.forEach(r => A.allocation(r, st.attr, DD.cfg).forEach(([m, wt]) => {
        if (A.ymYear(m) !== y || A.ymMonth(m) > mEnd || A.ymMonth(m) < (yStart || 1)) return;
        if (!o.has(r.designer)) o.set(r.designer, { rev: 0, cost: 0, n: 0 });
        const v = o.get(r.designer); v.rev += r.rev * wt; v.cost += r.cost * wt;
      }));
      rowsF.forEach(r => { if (r.year === y && r.month <= mEnd && o.has(r.designer)) o.get(r.designer).n++; });
      return o;
    };
    const mk = (cur, prev) => [...new Set([...DD.data.designers.keys()])].map(dn => {
      const v = cur.get(dn) || { rev: 0, cost: 0, n: 0 }, pv = prev.get(dn);
      return { designer: dn, rev: v.rev, cost: v.cost, n: v.n, margin: v.rev - v.cost, marginPct: v.rev ? (v.rev - v.cost) / v.rev : NaN, prevRev: pv ? pv.rev : 0 };
    });
    const MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    if (st.gran === 'yearly') {
      for (let y = A.ymYear(st.from); y <= yr; y++) {
        const me = y === yr ? mTo : 12;
        frames.push({ label: me === 12 ? `${y}` : `Jan–${MN[me - 1]} ${y}`, prevLabel: me === 12 ? `${y - 1}` : `Jan–${MN[me - 1]} ${y - 1}`, watermark: String(y), rows: mk(acc(y, me), acc(y - 1, me)) });
      }
    } else {
      for (let m = 1; m <= mTo; m++) frames.push({ label: `YTD Jan–${MN[m - 1]} ${yr}`, prevLabel: `Jan–${MN[m - 1]} ${yr - 1}`, watermark: `${MN[m - 1].toUpperCase()} ${yr}`, rows: mk(acc(yr, m), acc(yr - 1, m)) });
    }
    return frames;
  }
  let frames = [];
  function renderA3() {
    const card = root().querySelector('#A3');
    frames = a3Frames();
    if (local.a3Frame === null || local.a3Frame >= frames.length) local.a3Frame = frames.length - 1;
    const scrub = card.querySelector('#A3-scrub'); scrub.max = frames.length - 1; scrub.value = local.a3Frame;
    const f = frames[local.a3Frame];
    card.querySelector('#A3-step').textContent = f.label;
    const rows = DD.charts.a3Race(card.querySelector('#A3-chart'), f, { sort: local.a3Sort, gapOnly: local.a3Gap, hideZero: local.a3HideZero, playing: local.a3Playing });
    const R = rows.reduce((s, r) => s + r.rev, 0), C = rows.reduce((s, r) => s + r.cost, 0);
    const best = rows.slice().sort((a, b) => b.margin - a.margin)[0], neg = rows.filter(r => r.margin < 0);
    const pr = rows.reduce((s, r) => s + r.prevRev, 0);
    card.querySelector('.headline').innerHTML = rows.length ? `${f.label}: revenue <span class="num">${F.moneyC(R)}</span> against actual cost <span class="num">${F.moneyC(C)}</span>, a margin of ${DD.varSpan(R - C, F.moneyC)} (${F.pct((R - C) / R)}). ` +
      `${best ? `${DD.esc(best.designer)} leads with ${F.moneyC(best.margin)}` : ''}${neg.length ? `; ${neg.length} designer${neg.length > 1 ? 's are' : ' is'} below cost` : '; nobody is below cost'}.` +
      (pr ? ` Revenue is ${F.pct(R / pr - 1, true)} vs ${f.prevLabel}.` : '') : 'No revenue in this year yet.';
  }
  function togglePlay() {
    if (local.a3Playing) return stop();
    local.a3Playing = true;
    const btn = root().querySelector('#A3-play'); btn.textContent = '❚❚ Pause'; btn.setAttribute('aria-label', 'Pause');
    if (local.a3Frame >= frames.length - 1) local.a3Frame = -1;
    const step = () => { local.a3Frame++; renderA3(); if (local.a3Frame >= frames.length - 1) stop(); };
    step();
    timer = setInterval(step, DD.reducedMotion ? 1200 : 900);
  }
  function stop() {
    clearInterval(timer); timer = null; local.a3Playing = false;
    const btn = root().querySelector('#A3-play'); if (btn) { btn.textContent = '▶ Play'; btn.setAttribute('aria-label', 'Play'); }
  }

  function renderA5() {
    const card = root().querySelector('#A5'), view = local.a5View, md = DD.cfg.MIN_DESIGNER_PROJECTS;
    DD.charts.a5Dumbbell(card.querySelector('#A5-chart'), M.a5, { view });
    const ok = M.a5.rows.filter(r => r.n >= md);
    let h = '';
    if (ok.length) {
      if (view === 'cpph') {
        const best = ok.slice().sort((a, b) => a.cpph - b.cpph)[0];
        const worse = ok.filter(r => r.rate < best.rate).sort((a, b) => b.cpph - a.cpph)[0];
        h = worse ? `Lowest rate is not lowest cost: <b>${DD.esc(worse.designer)}</b> at <span class="num">${F.rateN(worse.rate)}/h</span> costs <span class="num">${F.rateN(worse.cpph)}</span> per planned hour; <b>${DD.esc(best.designer)}</b> at <span class="num">${F.rateN(best.rate)}/h</span> costs <span class="num">${F.rateN(best.cpph)}</span>.`
          : `<b>${DD.esc(best.designer)}</b> delivers a planned hour cheapest: <span class="num">${F.rateN(best.cpph)}</span> at a list rate of <span class="num">${F.rateN(best.rate)}/h</span> (department ${F.rateN(M.a5.dept.cpph)}).`;
      } else {
        const best = ok.slice().sort((a, b) => b.earned - a.earned)[0], worst = ok.slice().sort((a, b) => a.earned - b.earned)[0];
        h = `<b>${DD.esc(best.designer)}</b> earns the most per hour worked: <span class="num">${F.rateN(best.earned)}</span> on a list rate of <span class="num">${F.rateN(best.rate)}/h</span>; <b>${DD.esc(worst.designer)}</b> earns <span class="num">${F.rateN(worst.earned)}</span> on <span class="num">${F.rateN(worst.rate)}/h</span>.`;
      }
    }
    card.querySelector('.headline').innerHTML = h;
  }

  function renderA4() {
    const st = DD.state.A, card = root().querySelector('#A4'), metric = local.a4Metric, basis = local.a4Basis === 'home' ? 'loc' : 'region';
    const val = { ah: r => r.ah, revenue: r => r.rev, cost: r => r.cost, margin: r => r.margin, projects: () => 1 }[metric];
    const isMoney = ['revenue', 'cost', 'margin'].includes(metric);
    const fmt = isMoney ? F.moneyC : metric === 'ah' ? F.hk : F.n, fmtFull = isMoney ? F.money : metric === 'ah' ? F.h : F.n;
    const label = { ah: 'Actual hours', revenue: 'Revenue', cost: 'Actual cost', margin: 'Margin', projects: 'Projects' }[metric];
    const inP = rowsF.filter(r => r.ym >= st.from && r.ym <= st.to);
    const groups = basis === 'loc' ? DD.data.locations : ['North', 'East', 'South', 'West'];
    const years = [...new Set(inP.map(r => r.year))].sort();
    const total = inP.reduce((s, r) => s + val(r), 0);
    const cards = groups.map(g => { const rr = inP.filter(r => r[basis] === g), rev = rr.reduce((s, r) => s + r.rev, 0), cost = rr.reduce((s, r) => s + r.cost, 0), v = rr.reduce((s, r) => s + val(r), 0);
      return { region: g, value: v, share: total ? v / total : NaN, marginPct: rev ? (rev - cost) / rev : NaN, years, spark: years.map(y => rr.filter(r => r.year === y).reduce((s, r) => s + val(r), 0)), yearN: years.map(y => rr.filter(r => r.year === y).length) }; });
    DD.charts.a4Cards(card.querySelector('#A4-cards'), cards, { basis, fmt, fmtFull, label });
    const flows = new Map(), cells = new Map();
    inP.forEach(r => { const k = r.loc + '|' + r.region; const f = flows.get(k) || { from: r.loc, to: r.region, value: 0, n: 0 }; f.value += val(r); f.n++; flows.set(k, f);
      const ck = r.designer + '|' + r.region; const c = cells.get(ck) || { v: 0, n: 0 }; c.v += val(r); c.n++; cells.set(ck, c); });
    DD.charts.a4Sankey(card.querySelector('#A4-sankey'), [...flows.values()].map(f => ({ ...f, value: metric === 'margin' ? Math.max(0, f.value) : f.value })), { label: metric === 'margin' ? 'Margin (positive flows)' : label, fmtFull });
    DD.charts.a4Heatmap(card.querySelector('#A4-heat'), cells, [...DD.data.designers.values()].filter(d => inP.some(r => r.designer === d.name)), { label, fmt, fmtFull, diverging: metric === 'margin' });
    const lead = cards.slice().sort((a, b) => b.value - a.value)[0];
    const home = inP.length ? inP.filter(r => r.loc === r.region).reduce((s, r) => s + val(r), 0) / total : NaN;
    card.querySelector('.headline').innerHTML = lead && total ? `${lead.region} ${basis === 'loc' ? 'designers produce' : 'projects bring'} the most ${label.toLowerCase()}: <span class="num">${fmt(lead.value)}</span> (${F.pct(lead.share)}). Only <span class="num">${F.pct(home)}</span> of it is done by a designer whose home location matches the project's region.` : '';
  }

  DD.tabs.A = { build, update, stop, show: () => { DD.resizeAll(); } };
})();
