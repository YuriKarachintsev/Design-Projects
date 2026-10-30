/* Tab C · Prediction: the models (M1 project model, M2 trend model) and the 2027 forecasts (C1-C4). */
(function () {
  const DD = window.DD, A = DD.A, F = DD.fmt, cfg = DD.cfg;
  const root = () => document.getElementById('tab-C');
  const L = { m2Metric: 'revenue', m2Region: 'total', c1Size: 'typical', c1Designer: 'mix', c2By: 'region', c3By: 'region', c3Unit: 'hours', c4By: 'region' };
  const SC = [['pessimistic', 'Pessimistic'], ['average', 'Average'], ['optimistic', 'Optimistic']];
  const METRIC = { revenue: ['Revenue', 'money'], cost: ['Actual cost', 'money'], plannedHours: ['Planned hours', 'hours'], actualHours: ['Actual hours', 'hours'], projects: ['Projects', 'count'] };
  const fmtOf = k => (METRIC[k][1] === 'money' ? [F.moneyC, F.money] : METRIC[k][1] === 'hours' ? [F.hk, F.h] : [v => F.n(v), v => F.n(v)]);
  let M1, M2, WL, C4;
  const scen = () => DD.state.C.scenario, overrides = () => (DD.state.C.overrides = DD.state.C.overrides || {});
  const decision = c => (c.reject ? '<b>Reject</b>' : 'Do not reject');
  const chip = m => `<button type="button" class="built-on" data-to="${m}">Built on ${m}</button>`;
  const head = (gate, title, extra = '') => `<div class="card-head"><div class="ttl"><span class="gate">${gate}</span><h3 class="card-title">${title}</h3>${extra}</div><div class="card-ctl"></div></div><p class="headline"></p>`;

  function compute() {
    M1 = A.m1(DD.data, cfg, DD.perf.factors);
    M2 = A.m2(DD.data, cfg, overrides());
    WL = A.workload(DD.data, cfg, M2);
    C4 = A.c4(DD.data, cfg, M2);
  }

  // ================================================================ layout
  function build() {
    const el = root(), st = DD.state.C;
    el.innerHTML = `<div class="bar"><div class="bar-row">
        <div class="ctl"><span class="label">Forecast year</span><span class="data-chip" style="padding:4px 10px">${cfg.FORECAST_YEAR}</span></div>
        <div class="ctl"><span class="label">Scenario (drives C2–C4)</span><div id="C-scen"></div></div>
        <div class="ctl"><span class="label">Statistics</span><div id="C-stats"></div></div>
      </div><div class="summary-line" id="C-summary"></div></div>
      <div class="subhead"><h2 class="section-title">The models</h2><span class="rule"></span></div>
      <div class="grid"><div class="card c12" id="M1"></div></div>
      <div class="grid"><div class="card c12" id="M2"></div></div>
      <div class="subhead section-break"><h2 class="section-title">Forecasts ${cfg.FORECAST_YEAR}</h2><span class="rule"></span></div>
      <div class="grid"><div class="card c7" id="C1"></div><div class="card c5" id="C4"></div></div>
      <div class="grid"><div class="card c6" id="C2"></div><div class="card c6" id="C3"></div></div>`;
    DD.seg(el.querySelector('#C-scen'), SC, st.scenario, v => { st.scenario = v; DD.writeHash(); renderC2(); renderC3(); renderC4(); renderSummary(); });
    DD.seg(el.querySelector('#C-stats'), [['off', 'Off'], ['on', 'On']], st.stats ? 'on' : 'off', v => DD.setAllDrawers('C', v === 'on'));
    el.addEventListener('click', e => { const b = e.target.closest('.built-on'); if (b) document.getElementById(b.dataset.to).scrollIntoView({ behavior: DD.reducedMotion ? 'auto' : 'smooth', block: 'start' }); });
  }
  function update() {
    try { compute(); } catch (e) {
      root().querySelectorAll('.grid, .subhead').forEach(x => { x.style.display = 'none'; });
      root().querySelector('#C-summary').innerHTML = '';
      if (!root().querySelector('#C-empty')) root().insertAdjacentHTML('beforeend', `<div class="card empty" id="C-empty"><div class="big">Not enough data to predict</div>The models need completed projects (Actual &gt; 0) of several designers in several full years up to ${cfg.LAST_FULL_YEAR}. Load a larger file in tab D, or reset to the built-in data.</div>`);
      return;
    }
    renderSummary(); renderM1(); renderM2(); renderC1(); renderC2(); renderC3(); renderC4();
  }
  function renderSummary() {
    const m = M1.model;
    root().querySelector('#C-summary').innerHTML = `All sources (the original extract alone is incomplete) · M1 trained on <b>${F.n(m.rows.length)}</b> completed projects ≤ ${cfg.LAST_FULL_YEAR} · factors from tab B: <b>${DD.perf.factors.length ? DD.perf.factors.join(', ') : 'none'}</b> · scenario <b>${scen()}</b> · tests use critical value ${F.x(cfg.CRITICAL_VALUE, 2)} and the normal distribution`;
  }

  // ================================================================ M1
  function forestItems(m) {
    const pooledNote = m.des.pooled.length;
    return m.fit.coefs.filter(c => c.name !== 'Intercept').map(c => {
      if (c.name === 'ln(planned hours)') return { label: 'Plan +10%', value: Math.pow(1.1, c.b) - 1, lo: Math.pow(1.1, c.lo) - 1, hi: Math.pow(1.1, c.hi) - 1, t: c.t, p: c.p };
      const t = /^Type (\d)/.exec(c.name), n = t ? m.rows.filter(r => r.type === +t[1]).length : null;
      return { label: c.name.replace('Education: ', '').replace('Location: ', '').replace(' degree', '') + (t ? ' vs Type 1' : c.name.startsWith('Education') ? ` vs ${m.des.refs.edu.split(' ')[0]}` : c.name.startsWith('Location') ? ` vs ${m.des.refs.loc}` : ''),
        value: Math.exp(c.b) - 1, lo: Math.exp(c.lo) - 1, hi: Math.exp(c.hi) - 1, t: c.t, p: c.p, limited: t ? n < cfg.MIN_N : false };
    });
  }
  function equation(m) {
    const parts = m.fit.coefs.map((c, i) => {
      const v = F.x(Math.abs(c.b), 3), sign = c.b < 0 ? '−' : '+';
      if (c.name === 'Intercept') return F.x(c.b, 3);
      const term = c.name === 'ln(planned hours)' ? 'ln(planned h)' : c.name.replace('Education: ', '').replace('Location: ', '').replace('Type ', 'T').replace(' degree', '').replace(' school', 'School').replace(/\s/g, '');
      return `${sign} ${v}·${term}`;
    });
    return `ln(actual h) = ${parts.join(' ')} + designer adjustment`;
  }
  function renderM1() {
    const card = root().querySelector('#M1'), m = M1.model, bt = M1.backtest, b1 = m.fit.coefs.find(c => c.name === 'ln(planned hours)');
    card.innerHTML = head('M1', 'Project model', '<span class="feeds">· multiple linear regression · feeds C1</span>') +
      `<div class="grid" style="margin:0"><div class="c7"><div class="chart tall" id="M1-scatter"></div></div><div class="c5"><div class="label">What moves actual hours (95% CI)</div><div class="chart" id="M1-forest"></div>
        <p class="muted" style="font-size:12px">${m.des.pooled.length ? `Type ${m.des.pooled.join(', ')} (${m.des.pooled.map(t => m.des.counts[t - 1]).join(', ')} completed projects) is pooled into Type 1 — limited data. ` : ''}Dashed = limited data (fewer than ${cfg.MIN_N} projects); grey = the 95% CI crosses zero.</p></div></div>
      <div class="tiles"><div class="tile"><div class="label">R²</div><div class="v">${F.x(m.r2, 2)}</div><div class="s">${F.x(m.r2Designer, 2)} with the designer adjustment</div></div>
        <div class="tile"><div class="label">Single-project 80% range</div><div class="v">${F.x(m.rangeLo, 2)}× – ${F.x(m.rangeHi, 2)}×</div><div class="s">of the predicted median</div></div>
        <div class="tile"><div class="label">Backtest total error ${cfg.BACKTEST_LAST_TRAIN_YEAR + 1}–${cfg.LAST_FULL_YEAR}</div><div class="v">${F.pct(bt.m1.bias, true)}</div><div class="s">our plans ${F.pct(bt.plans.bias, true)} · n = ${F.n(bt.test)}</div></div>
        <div class="tile"><div class="label">Plan +10% gives</div><div class="v">${F.pct(Math.pow(1.1, b1.b) - 1, true)}</div><div class="s">actual hours (b1 = ${F.x(b1.b, 3)})</div></div></div>
      <div class="equation">${equation(m)}</div>` +
      DD.calc(`<code>ln(actual h) = b0 + b1·ln(planned h) + type terms + factor terms + designer adjustment</code>, fitted by OLS on ${F.n(m.rows.length)} completed projects (Actual &gt; 0, start ≤ ${cfg.LAST_FULL_YEAR}). Factor terms come from tab B: ${DD.perf.factors.join(', ') || 'none'}. Prediction: median = e^(x'b + u_d); expected value = median × e^(σ²/2) = median × ${F.x(m.meanFactor, 3)}; 80% range = e^(x'b + u_d ± 1.2816·σ), σ = ${F.x(m.sigma, 3)}.`);
    const sig = m.fit.coefs.filter(c => c.reject && !['Intercept', 'ln(planned hours)'].includes(c.name));
    card.querySelector('.headline').innerHTML = `Plans are the best single guide, but not exact: +10% on the plan adds only <span class="num">${F.pct(Math.pow(1.1, b1.b) - 1, true)}</span> actual hours, so big projects are over-planned more.` +
      (sig.length ? ` On the same plan, ${DD.list(sig.map(c => `${c.name.replace('Education: ', '').replace('Location: ', '').replace('Type', 'Type')} ${F.pct(Math.exp(c.b) - 1, true)}`))} (vs ${m.des.refs.edu.toLowerCase()}, ${m.des.refs.loc}, Type 1).` : '') +
      ` The model explains <span class="num">${F.pct(m.r2)}</span> of the variation in actual hours.`;
    requestAnimationFrame(() => { DD.charts.m1Scatter(card.querySelector('#M1-scatter'), m); DD.charts.bCoef(card.querySelector('#M1-forest'), forestItems(m), { n: m.rows.length }); });
    card.appendChild(DD.analyst('C', 'M1', () => m1Analyst(), body => {
      ['hist', 'qq', 'resid', 'groups'].forEach(k => { const e = body.querySelector('#M1-d-' + k); if (e) DD.charts[{ hist: 'm1Hist', qq: 'm1QQ', resid: 'm1Resid', groups: 'm1ResidGroups' }[k]](e, m); });
    }));
  }
  function m1Analyst() {
    const m = M1.model, b1 = m.fit.coefs.find(c => c.name === 'ln(planned hours)'), bt = M1.backtest;
    const coefRows = m.fit.coefs.map(c => ({ ...c, pct: c.name === 'ln(planned hours)' ? Math.pow(1.1, c.b) - 1 : Math.exp(c.b) - 1,
      reading: c.name === 'Intercept' ? 'baseline level' : c.name === 'ln(planned hours)' ? `+10% plan → ${F.pct(Math.pow(1.1, c.b) - 1, true)} actual` : `${F.pct(Math.exp(c.b) - 1, true)} hours vs reference${c.reject ? '' : ' (not proven)'}` }));
    const perf = DD.perf.tests.map(t => ({ ...t, fac: A.factorOf(t.level), inc: DD.perf.factors.includes(A.factorOf(t.level)) }));
    const dt = [...m.u.entries()].map(([d, v]) => ({ d, n: v.n, mean: v.mean, w: v.w, adj: Math.exp(v.u) - 1 })).sort((a, b) => b.n - a.n);
    const rob = M1.robust;
    return `<h4>1 · Specification</h4><p><code>ln(actual h) = b0 + b1·ln(planned h) + type terms + factor terms + designer adjustment + error</code>. Logs because hours run from ${F.n(Math.min(...m.rows.map(r => r.ah)))} to ${F.n(Math.max(...m.rows.map(r => r.ah)))}, errors are multiplicative, and b1 is an elasticity: +10% plan gives +(1.1^b1 − 1) = ${F.pct(Math.pow(1.1, b1.b) - 1, true)} actual. References: Type 1, ${m.des.refs.edu}, ${m.des.refs.loc}. Type terms only for types with ≥ ${cfg.MIN_PROJECTS} completed projects${m.des.pooled.length ? `; Type ${m.des.pooled.join(', ')} pooled into Type 1 (limited data)` : ''}.</p>
      <h4>2 · Coefficients (ordinary SEs, critical value ${F.x(cfg.CRITICAL_VALUE, 2)}, normal p-values)</h4>${DD.table([['name', 'Term'], ['b', 'Estimate', v => F.x(v, 4)], ['se', 'SE', v => F.x(v, 4)], ['t', 't-stat', v => F.x(v, 2)], ['crit', 'Critical', v => F.x(v, 2)], ['p', 'p-value', F.p], ['lo', '95% CI', (v, r) => `${F.x(r.lo, 3)} … ${F.x(r.hi, 3)}`], ['reject', 'Decision', (v, r) => decision(r)], ['pct', '% effect', v => F.pct(v, true)], ['reading', 'Plain reading']], coefRows)}
      <h4>3 · Factor selection (tab B, B1 performance "All together")</h4><p>A factor is included when at least one of its coefficients is rejected at 5%.</p>${DD.table([['level', 'Coefficient'], ['b', 'b', v => F.x(v, 4)], ['t', 't-stat', v => F.x(v, 2)], ['p', 'p-value', (v, r) => F.p(v) + (v >= 0.05 && v < 0.10 ? ' · borderline' : '')], ['reject', 'Decision', (v, r) => decision(r)], ['inc', 'Factor included', v => (v ? 'yes' : 'no')]], perf)}
      <h4>4 · Fit</h4><table><tr><th>n</th><th>Designers</th><th>R²</th><th>Adjusted R²</th><th>R² with designer adj.</th><th>Residual SD before</th><th>σ after</th><th>e^(σ²/2)</th></tr>
        <tr><td>${F.n(m.rows.length)}</td><td>${m.u.size}</td><td>${F.x(m.r2, 3)}</td><td>${F.x(m.adjR2, 3)}</td><td>${F.x(m.r2Designer, 3)}</td><td>${F.x(m.fit.resSD, 3)}</td><td>${F.x(m.sigma, 3)}</td><td>${F.x(m.meanFactor, 3)}</td></tr></table>
      <div class="grid" style="margin:8px 0"><div class="c6"><div class="label">Residuals and the fitted normal curve</div><div class="chart short" id="M1-d-hist"></div></div><div class="c6"><div class="label">Q-Q plot</div><div class="chart short" id="M1-d-qq"></div></div></div>
      <h4>5 · Designer adjustment</h4><p>σ²_within = ${F.x(m.sw, 4)}, σ²_between = ${F.x(m.sb, 4)} (floor 1e-4), shrink constant = σ²_within/σ²_between = ${F.x(m.kShrink, 2)}; u_d = mean_d × n_d / (n_d + ${F.x(m.kShrink, 2)}).</p>
      ${DD.table([['d', 'Designer'], ['n', 'n'], ['mean', 'Raw mean residual', v => F.x(v, 3)], ['w', 'Weight', v => F.x(v, 3)], ['adj', '% adjustment', v => F.pct(v, true)]], dt)}
      <h4>6 · Diagnostics</h4><div class="grid" style="margin:8px 0"><div class="c6"><div class="label">Residuals vs fitted</div><div class="chart short" id="M1-d-resid"></div></div><div class="c6"><div class="label">Residuals by type, education and location</div><div class="chart short" id="M1-d-groups"></div></div></div>
      <p>VIF: ${M1.vif.map(v => `${DD.esc(v.name)} ${F.x(v.vif, 2)}`).join(' · ')}. Breusch-Pagan p = ${F.p(M1.bp.p)} (χ² = ${F.x(M1.bp.LM, 1)}, df ${M1.bp.df}).</p>
      ${DD.table([['id', 'Top Cook\'s distance'], ['designer', 'Designer'], ['ph', 'Planned h', F.n], ['ah', 'Actual h', F.n], ['cook', 'Cook\'s D', v => F.x(v, 4)]], M1.cooks)}
      <h4>7 · Validation</h4><p>Backtest: train ≤ ${cfg.BACKTEST_LAST_TRAIN_YEAR} (n = ${F.n(bt.train)}), test ${cfg.BACKTEST_LAST_TRAIN_YEAR + 1}–${cfg.LAST_FULL_YEAR} (n = ${F.n(bt.test)}).</p>
      ${DD.table([['m', 'Method'], ['mae', 'MAE (h)', F.n], ['mdape', 'Median abs % error', v => F.pct(v)], ['bias', 'Total bias', v => F.pct(v, true)], ['coverage', '80% coverage', v => (v === null ? '–' : F.pct(v))]],
        [{ m: '(a) Our plans', ...bt.plans }, { m: `(b) Plan × historical realised PR (${F.x(bt.ratioValue, 3)})`, ...bt.ratio }, { m: '(c) M1 (expected value)', ...bt.m1, _hl: true }])}
      <p>Leave-one-designer-out MAE: ${F.h(M1.lodoMAE)} (n = ${F.n(M1.lodoN)}, each designer predicted as new with u = 0).</p>
      ${rob ? `<p>Robustness: refit on Original rows only (n = ${F.n(rob.n)}, R² ${F.x(rob.r2, 3)}).</p>${DD.table([['name', 'Term'], ['all', 'All sources', (v, r) => F.x(r.all, 3)], ['orig', 'Original only', (v, r) => F.x(r.orig, 3)]], m.fit.coefs.map(c => ({ name: c.name, all: c.b, orig: (rob.coefs.find(x => x.name === c.name) || {}).b })))}` : ''}
      <h4>8 · Caveats</h4><ul><li>Observational data: associations, not causes.</li><li>${F.n(DD.data.valid.filter(r => r.source !== 'Original').length)} rows are synthetic.</li><li>Projects by the same designer are not fully independent, so the SEs may be a little optimistic.</li>
        <li>Small types are pooled into Type 1.</li><li>The residuals are not perfectly normal, so the normal 80% range runs a little wide (backtest coverage ${F.pct(bt.m1.coverage)}).</li></ul>`;
  }

  // ================================================================ M2
  function m2Series() {
    const ov = overrides()[L.m2Metric];
    return L.m2Region === 'total' ? M2.metrics[L.m2Metric] : M2.series(L.m2Metric, L.m2Region, ov);
  }
  function renderM2() {
    const card = root().querySelector('#M2'), s = m2Series(), [fmt, full] = fmtOf(L.m2Metric), label = METRIC[L.m2Metric][0] + (L.m2Region === 'total' ? '' : ` · ${L.m2Region} projects`);
    const ov = overrides()[L.m2Metric] || {}, f = s.fit;
    card.innerHTML = head('M2', 'Trend model', '<span class="feeds">· simple linear regression on yearly totals · feeds C2 (planned hours) and C4 (revenue, projects)</span>') +
      `<div class="card-ctl" style="margin-bottom:8px"><span id="M2-metric"></span><select id="M2-region" aria-label="Region"><option value="total">All regions</option>${A.REGIONS.map(r => `<option value="${r}"${L.m2Region === r ? ' selected' : ''}>${r} projects</option>`).join('')}</select>
        <span class="label">Fit start</span><span id="M2-start"></span><span class="label">Shape</span><span id="M2-shape"></span></div>
      <div class="grid" style="margin:0"><div class="c8"><div class="chart tall" id="M2-chart"></div></div><div class="c4"><div class="label" style="margin-bottom:6px">Which line? (backtest)</div><div id="M2-bt"></div>
        <div class="tiles" style="grid-template-columns:1fr 1fr 1fr"><div class="tile"><div class="label">Slope per year</div><div class="v" style="font-size:18px">${f.shape === '% growth' ? F.pct(Math.exp(f.b) - 1, true) : F.signed(f.b, fmt)}</div><div class="s">t-stat ${F.x(f.slope.t, 1)}</div></div>
          <div class="tile"><div class="label">R²</div><div class="v" style="font-size:18px">${F.x(f.r2, 2)}</div><div class="s">n = ${f.n} points</div></div>
          <div class="tile"><div class="label">Typical swing</div><div class="v" style="font-size:18px">${f.shape === '% growth' ? '±' + F.pct(Math.exp(f.s) - 1) : '±' + fmt(f.s)}</div><div class="s">residual SE</div></div></div></div></div>
      <div class="equation">${f.shape === '% growth' ? `ln y = ${F.x(f.a, 4)} + ${F.x(f.b, 5)}·year  (growth e^b − 1 = ${F.pct(Math.exp(f.b) - 1, true)} a year)` : `y = ${fmt(f.my)} ${f.b < 0 ? '−' : '+'} ${fmt(Math.abs(f.b))} × (year − ${F.x(f.mx, 2)})`}  · fitted on ${s.chosen.start}–${cfg.LAST_FULL_YEAR} + ${cfg.PARTIAL_YEAR} estimate</div>` +
      DD.calc(`Points: full years ${s.chosen.start}–${cfg.LAST_FULL_YEAR}, plus ${cfg.PARTIAL_YEAR} annualised as value(Jan–${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][cfg.PARTIAL_LAST_MONTH - 1]}) ÷ its historical Jan–${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][cfg.PARTIAL_LAST_MONTH - 1]} share (${F.pct(s.series.share)}) = ${full(s.series.estimate)} (estimate). 80% prediction interval: ŷ ± 1.2816·s·√(1 + 1/n + (x0 − x̄)²/Σ(x − x̄)²). Scenarios: average = ŷ; optimistic = upper bound; pessimistic = the lower of the lower bound and the ${cfg.PARTIAL_YEAR} estimate ("growth stops").${cfg.ZERO_ACTUAL_IN_VOLUMES ? ' Volumes count every opened project, including the zero-actual ones.' : ''}`);
    card.querySelector('.headline').innerHTML = `${label} ${f.b >= 0 ? 'grows' : 'falls'} by about <span class="num">${f.shape === '% growth' ? F.pct(Math.exp(f.b) - 1, true) : F.signed(f.b, fmt)}</span> a year (${s.chosen.shape} from ${s.chosen.start}${s.overridden ? ', your choice' : ', best backtest'}); ${cfg.FORECAST_YEAR} is expected at <span class="num">${fmt(s.forecast.y)}</span> (80% range ${fmt(s.forecast.lo)} – ${fmt(s.forecast.hi)}).`;
    DD.seg(card.querySelector('#M2-metric'), Object.entries(METRIC).map(([k, v]) => [k, v[0]]), L.m2Metric, v => { L.m2Metric = v; renderM2(); });
    card.querySelector('#M2-region').addEventListener('change', e => { L.m2Region = e.target.value; renderM2(); });
    const setOv = (k, v) => { const o = Object.assign({ start: s.chosen.start, shape: s.chosen.shape }, overrides()[L.m2Metric] || {}); if (v === 'auto') { delete overrides()[L.m2Metric]; } else { o[k] = k === 'start' ? +v : v; overrides()[L.m2Metric] = o; } compute(); update(); };
    DD.seg(card.querySelector('#M2-start'), [['auto', 'Auto'], ...cfg.TREND_FIT_START_OPTIONS.map(y => [String(y), String(y)])], ov.start ? String(ov.start) : 'auto', v => setOv('start', v));
    DD.seg(card.querySelector('#M2-shape'), [['auto', 'Auto'], ...cfg.TREND_SHAPES.map(sh => [sh, sh])], ov.shape || 'auto', v => setOv('shape', v));
    card.querySelector('#M2-bt').innerHTML = `<div class="tbl-scroll"><table class="plain compact">${'<tr><th>Fit</th><th>' + cfg.LAST_FULL_YEAR + '</th><th>' + cfg.PARTIAL_YEAR + 'e</th><th>Mean</th></tr>'}${s.combos.map(c => `<tr class="${c === s.chosen ? 'hl' : ''}"><td>${c.shape === '% growth' ? '% growth' : 'Straight'} · ${c.start}${c === s.best ? ' ★' : ''}</td><td>${F.pct(c.errLast, true)}</td><td>${F.pct(c.errPartial, true)}</td><td>${F.pct(c.mape)}</td></tr>`).join('')}</table></div><p class="muted" style="font-size:12px">Backtest errors predicting ${cfg.LAST_FULL_YEAR} and the ${cfg.PARTIAL_YEAR} estimate. ★ lowest mean absolute error (default). Highlighted = in use.</p>`;
    requestAnimationFrame(() => DD.charts.m2Trend(card.querySelector('#M2-chart'), s, { fmt, fmtFull: full, label, scenario: scen() }));
    card.appendChild(DD.analyst('C', 'M2', () => m2Analyst(s, fmt, full)));
  }
  function m2Analyst(s, fmt, full) {
    const f = s.fit, fc = s.forecast, x0 = cfg.FORECAST_YEAR;
    const sl = f.slope, ce = f.centred;
    return `<h4>Specification</h4><p>${f.shape === '% growth' ? 'ln y = a + b·year (growth = e^b − 1)' : 'y = a + b·year'}, OLS on n = ${f.n} points (${s.chosen.start}–${cfg.LAST_FULL_YEAR} and the ${cfg.PARTIAL_YEAR} estimate).</p>
      <h4>Coefficients (critical value ${F.x(cfg.CRITICAL_VALUE, 2)}, normal p-values)</h4>${DD.table([['n', 'Term'], ['b', 'Estimate', v => F.x(v, 4)], ['se', 'SE', v => F.x(v, 4)], ['t', 't-stat', v => F.x(v, 2)], ['crit', 'Critical', () => F.x(cfg.CRITICAL_VALUE, 2)], ['p', 'p-value', F.p], ['lo', '95% CI', (v, r) => `${F.x(r.lo, 4)} … ${F.x(r.hi, 4)}`], ['dec', 'Decision', (v, r) => (r.p < cfg.ALPHA ? '<b>Reject</b>' : 'Do not reject')]],
        [{ n: 'Slope b (per year)', ...sl }, { n: `Intercept centred on ${F.x(f.mx, 1)}`, ...ce }])}
      <p>R² = ${F.x(f.r2, 3)}; residual SE s = ${F.x(f.s, 4)}; Durbin-Watson = ${F.x(s.dw, 2)} (indicative only with n &lt; 10). With only ${f.n} yearly points the normal band is about 13% narrower than a t-based one would be.</p>
      ${DD.table([['x', 'Year'], ['r', 'Residual', v => F.x(v, 4)]], f.xs.map((x, i) => ({ x: x === cfg.PARTIAL_YEAR ? x + 'e' : x, r: f.res[i] })))}
      <h4>Prediction interval for ${x0}</h4><p>ŷ ± 1.2816·s·√(1 + 1/n + (x0 − x̄)²/Σ(x − x̄)²) = ${F.x(f.a + f.b * x0, 4)} ± 1.2816 × ${F.x(f.s, 4)} × √(1 + 1/${f.n} + (${x0} − ${F.x(f.mx, 2)})²/${F.x(f.sxx, 2)}) = ${F.x(f.a + f.b * x0, 4)} ± ${F.x(1.2816 * fc.se, 4)}${f.shape === '% growth' ? ' (log scale, then exponentiated)' : ''} → ${full(fc.y)} (${full(fc.lo)} – ${full(fc.hi)}).</p>
      <h4>Annualisation</h4><p>${cfg.PARTIAL_YEAR} Jan–Sep = ${full(s.series.partial)}; historical Jan–Sep share ${cfg.FIRST_ANALYSIS_YEAR}–${cfg.LAST_FULL_YEAR} = ${F.pct(s.series.share)}; estimate = ${full(s.series.estimate)}.</p>
      <h4>Backtest</h4>${DD.table([['f', 'Fit'], ['errLast', `Predict ${cfg.LAST_FULL_YEAR}`, v => F.pct(v, true)], ['errPartial', `Predict ${cfg.PARTIAL_YEAR}e`, v => F.pct(v, true)], ['mape', 'Mean abs error', v => F.pct(v)]], s.combos.map(c => ({ ...c, f: `${c.shape} from ${c.start}`, _hl: c === s.chosen })))}
      <h4>Caveats</h4><ul><li>Few points; the line is an extrapolation.</li><li>The band covers normal year-to-year wobble, not a break in the trend — which is why the pessimistic scenario also includes "growth stops" at the ${cfg.PARTIAL_YEAR} level.</li></ul>`;
  }

  // ================================================================ C1
  function renderC1() {
    const card = root().querySelector('#C1'), ds = [...DD.data.designers.values()].sort((a, b) => a.name.localeCompare(b.name));
    const rows = A.c1(DD.data, cfg, M1, { size: L.c1Size, designer: L.c1Designer }), bt = M1.backtest;
    card.innerHTML = head('C1', 'Expected cost of a typical project', chip('M1')) +
      `<div class="card-ctl" style="margin-bottom:8px"><span id="C1-size"></span><select id="C1-des" aria-label="Designer"><option value="mix">Usual mix (${cfg.USUAL_MIX_FIRST_YEAR}–${cfg.LAST_FULL_YEAR})</option>
        <optgroup label="A location">${DD.data.locations.map(l => `<option value="loc:${l}"${L.c1Designer === 'loc:' + l ? ' selected' : ''}>${l} designers</option>`).join('')}</optgroup>
        <optgroup label="A single designer">${ds.map(d => `<option value="des:${DD.esc(d.name)}"${L.c1Designer === 'des:' + d.name ? ' selected' : ''}>${DD.esc(d.name)} (${d.loc})</option>`).join('')}</optgroup></select></div>
      <div class="chart" id="C1-chart" style="height:${rows.length * 64 + 70}px"></div>
      <div class="tbl-scroll">${DD.table([['type', 'Type', (v, r) => `<span style="color:${DD.TYPE_COL[v]}">■</span> Type ${v}${r.limited ? ' <span class="status LIMITED">LIMITED DATA</span>' : ''}`], ['plannedH', 'Planned h', F.n], ['hours', 'Expected h', F.n], ['cost', 'Expected cost', F.moneyC], ['lo', '80% range', (v, r) => `${F.moneyC(r.lo)} – ${F.moneyC(r.hi)}`], ['pctOfPlan', '% of plan', v => F.pct(v)], ['plan', 'Plan cost', F.moneyC], ['benchmark', 'Plan × realised PR', F.moneyC]], rows, { cls: 'plain' })}</div>
      <div class="data-chip" style="margin-top:10px;display:block">Track record (M1 backtest ${cfg.BACKTEST_LAST_TRAIN_YEAR + 1}–${cfg.LAST_FULL_YEAR}, n = ${F.n(bt.test)}): M1 total error <b>${F.pct(bt.m1.bias, true)}</b> · our plans ${F.pct(bt.plans.bias, true)} · plan × ratio ${F.pct(bt.ratio.bias, true)} · 80% range held ${F.pct(bt.m1.coverage)} of actuals</div>` +
      DD.calc(`For each type: planned hours = ${L.c1Size === 'average' ? 'mean' : 'median'} of its completed projects. Expected hours = Σ_d w_d × M1 expected value (median × e^(σ²/2)); expected cost = Σ_d w_d × expected hours_d × rate_d; 80% range from e^(±1.2816σ). Weights w_d = ${L.c1Designer === 'mix' ? `each designer's share of the type's projects in ${cfg.USUAL_MIX_FIRST_YEAR}–${cfg.LAST_FULL_YEAR} (all years if none)` : L.c1Designer.startsWith('loc:') ? 'each designer of the location by their number of completed projects' : 'the chosen designer'}. Benchmark = plan cost × the type's historical realised PR.`);
    const t1 = rows[0];
    card.querySelector('.headline').innerHTML = t1 ? `A typical Type ${t1.type} project (<span class="num">${F.n(t1.plannedH)}</span> planned hours) is expected to cost <span class="num">${F.moneyC(t1.cost)}</span>, ${F.pct(t1.pctOfPlan)} of its ${F.moneyC(t1.plan)} plan (80% range ${F.moneyC(t1.lo)} – ${F.moneyC(t1.hi)}). ` +
      (() => { const lo = rows.filter(r => !r.limited).sort((a, b) => a.pctOfPlan - b.pctOfPlan)[0]; return lo && lo !== t1 ? `Type ${lo.type} sits furthest below plan (${F.pct(lo.pctOfPlan)}).` : ''; })() : '';
    DD.seg(card.querySelector('#C1-size'), [['typical', 'Typical'], ['average', 'Average']], L.c1Size, v => { L.c1Size = v; renderC1(); });
    card.querySelector('#C1-des').addEventListener('change', e => { L.c1Designer = e.target.value; renderC1(); });
    requestAnimationFrame(() => DD.charts.c1Range(card.querySelector('#C1-chart'), rows));
    card.appendChild(DD.analyst('C', 'C1', () => `<h4>Formulas</h4><p>median_d = e^(x'b + u_d); expected_d = median_d × ${F.x(M1.model.meanFactor, 4)}; range_d = median_d × [${F.x(M1.model.rangeLo, 4)}, ${F.x(M1.model.rangeHi, 4)}]. Experience is taken at ${cfg.FORECAST_YEAR}.</p>
      ${DD.table([['type', 'Type'], ['n', 'n'], ['designers', 'Designers in mix'], ['plannedH', 'Planned h', v => F.x(v, 1)], ['hours', 'Expected h', v => F.x(v, 1)], ['cost', 'Expected cost', F.money], ['lo', 'P10 cost', F.money], ['hi', 'P90 cost', F.money], ['plan', 'Plan cost', F.money], ['typePR', 'Realised PR', v => F.x(v, 3)], ['benchmark', 'Benchmark', F.money]], rows)}`));
  }

  // ================================================================ C2 / C3
  function cellsBy(by) {
    const out = new Map();
    ['pessimistic', 'average', 'optimistic'].forEach(sc => WL.cells[sc].forEach(c => {
      const k = by === 'region' ? c.region : c.designer;
      if (!out.has(k)) out.set(k, { label: by === 'region' ? `${k} projects` : k, loc: c.loc, n: 0, flag: false, pessimistic: {}, average: {}, optimistic: {} });
      const o = out.get(k), s = o[sc];
      ['planned', 'actual', 'variance', 'money'].forEach(f => { s[f] = (s[f] || 0) + c[f]; });
      if (sc === 'average') { o.n = by === 'designer' ? c.n : o.n + c.n; if (by === 'designer') o.flag = c.n < cfg.MIN_DESIGNER_PROJECTS; }
    }));
    if (by === 'region') out.forEach((o, k) => { o.n = DD.data.valid.filter(r => r.region === k && r.year <= cfg.LAST_FULL_YEAR).length; });
    return [...out.values()];
  }
  function renderC2() {
    const card = root().querySelector('#C2'), sc = scen(), items = cellsBy(L.c2By).map(o => ({ ...o, planned: o[sc].planned, actual: o[sc].actual, pess: o.pessimistic.actual, opt: o.optimistic.actual }));
    const P = M2.metrics.plannedHours.scenarios[sc], act = items.reduce((s, i) => s + i.actual, 0);
    const lead = items.slice().sort((a, b) => b.actual - a.actual)[0];
    card.innerHTML = head('C2', `Workload ${cfg.FORECAST_YEAR}`, chip('M2')) + `<div class="card-ctl" style="margin-bottom:8px"><span id="C2-by"></span></div><div class="chart" id="C2-chart"></div>` +
      DD.calc(`Planned hours ${cfg.FORECAST_YEAR} = the M2 forecast of planned hours for the ${sc} scenario (${F.h(P)}). It is split by each designer × project-region cell's share of planned hours over ${cfg.WORKLOAD_SHARE_FIRST_YEAR}–${cfg.PARTIAL_YEAR}. Expected actual hours = planned share × PR_d*, with PR_d* = w·PR_d + (1 − w)·PR_dept, w = n_d / (n_d + ${cfg.SHRINK_K_PROJECTS}) (completed projects ≤ ${cfg.LAST_FULL_YEAR}; PR_dept = ${F.x(WL.dept, 3)}). Whiskers: pessimistic – optimistic.`);
    card.querySelector('.headline').innerHTML = `${cfg.FORECAST_YEAR} (${sc}): <span class="num">${F.hk(P)}</span> planned hours should need about <span class="num">${F.hk(act)}</span> actual hours (${DD.varSpan(act - P, F.hk, true)} vs plan). ${lead ? `${DD.esc(lead.label)}: the largest share (${F.hk(lead.actual)}).` : ''}`;
    DD.seg(card.querySelector('#C2-by'), [['region', 'By region'], ['designer', 'By designer']], L.c2By, v => { L.c2By = v; renderC2(); });
    requestAnimationFrame(() => DD.charts.c2Workload(card.querySelector('#C2-chart'), items, { byDesigner: L.c2By === 'designer', colorOf: r => (L.c2By === 'designer' ? DD.locCol(r.loc) : '#6F7A88') }));
    card.appendChild(DD.analyst('C', 'C2', () => `<h4>Intermediate numbers (${sc})</h4>${DD.table([['label', L.c2By === 'region' ? 'Region' : 'Designer'], ['planned', 'Planned h', F.n], ['actual', 'Expected actual h', F.n], ['pess', 'Pessimistic', F.n], ['opt', 'Optimistic', F.n], ['n', 'n']], items.sort((a, b) => b.actual - a.actual))}
      <h4>Designer PR (shrunk)</h4>${DD.table([['d', 'Designer'], ['n', 'n'], ['pr', 'Realised PR', v => F.x(v, 3)], ['w', 'w', v => F.x(v, 3)], ['prs', 'PR*', v => F.x(v, 3)]], [...WL.shrink.map.entries()].map(([d, v]) => ({ d, ...v })).sort((a, b) => b.n - a.n))}`));
  }
  function renderC3() {
    const card = root().querySelector('#C3'), sc = scen(), money = L.c3Unit === 'money';
    const items = cellsBy(L.c3By).map(o => ({ ...o, hours: o[sc].variance, money: o[sc].money, value: money ? o[sc].money : o[sc].variance }));
    const H = items.reduce((s, i) => s + i.hours, 0), Mn = items.reduce((s, i) => s + i.money, 0);
    const over = cellsBy('designer').filter(o => o[sc].variance > 0);
    card.innerHTML = head('C3', `Expected overrun / underrun ${cfg.FORECAST_YEAR}`, chip('M2')) + `<div class="card-ctl" style="margin-bottom:8px"><span id="C3-by"></span><span id="C3-unit"></span></div><div class="chart" id="C3-chart"></div>
      ${L.c3By === 'designer' ? `<p class="muted" style="font-size:12px">◌ fewer than ${cfg.MIN_DESIGNER_PROJECTS} completed projects: their PR leans on the department value.</p>` : ''}` +
      DD.calc(`Hours = planned share × (PR_d* − 1); money = hours × the designer's rate. Negative = underrun (hours not needed, margin gained, ▲ slate); positive = overrun (▼ wine).`);
    card.querySelector('.headline').innerHTML = `${cfg.FORECAST_YEAR} (${sc}): expected ${H < 0 ? 'underrun' : 'overrun'} of ${DD.varSpan(-H, F.hk)} (${DD.varSpan(-Mn, F.moneyC)} margin) in total. ${over.length ? `Only ${DD.list(over.map(o => `${DD.esc(o.label)} (${F.signed(o[sc].variance, F.n)} h)`))} ${over.length > 1 ? 'are' : 'is'} expected to overrun.` : 'Nobody is expected to overrun.'}`;
    DD.seg(card.querySelector('#C3-by'), [['region', 'By region'], ['designer', 'By designer']], L.c3By, v => { L.c3By = v; renderC3(); });
    DD.seg(card.querySelector('#C3-unit'), [['hours', 'Hours'], ['money', 'Money']], L.c3Unit, v => { L.c3Unit = v; renderC3(); });
    requestAnimationFrame(() => DD.charts.c3Diverging(card.querySelector('#C3-chart'), items, { byDesigner: L.c3By === 'designer', money }));
    card.appendChild(DD.analyst('C', 'C3', () => `<h4>Intermediate numbers (${sc})</h4>${DD.table([['label', L.c3By === 'region' ? 'Region' : 'Designer'], ['hours', 'Hours vs plan', v => F.signed(v, F.n)], ['money', 'Money', v => F.signed(v, F.money)], ['n', 'n']], items.slice().sort((a, b) => a.hours - b.hours))}`));
  }

  // ================================================================ C4
  function renderC4() {
    const card = root().querySelector('#C4'), sc = scen(), s = C4.scenarios, cur = s[sc], others = SC.filter(([k]) => k !== sc);
    const lastRows = A.volumeRows(DD.data, cfg).filter(r => r.year > cfg.LAST_FULL_YEAR - cfg.COST_RATIO_YEARS && r.year <= cfg.LAST_FULL_YEAR);
    const items = (L.c4By === 'region' ? C4.shares.region.map(x => ({ label: `${x.key} projects`, share: x.share, color: '#6F7A88', n: lastRows.filter(r => r.region === x.key).length }))
      : C4.shares.type.map(x => ({ label: `Type ${x.key}`, share: x.share, color: DD.TYPE_COL[x.key], n: lastRows.filter(r => r.type === x.key).length }))).map(x => ({ ...x, value: cur.revenue * x.share, lo: s.pessimistic.revenue * x.share, hi: s.optimistic.revenue * x.share }));
    const tile = (lab, f, key, extra) => `<div class="tile big"><div class="label">${lab}</div><div class="v">${f(cur[key])}${extra ? extra(cur) : ''}</div><div class="s">${others.map(([k, l]) => `${l.slice(0, 4)}. ${f(s[k][key])}`).join(' · ')}</div></div>`;
    card.innerHTML = head('C4', `Revenue ${cfg.FORECAST_YEAR}`, chip('M2')) +
      `<div class="tiles" style="grid-template-columns:1fr 1fr">${tile('Revenue', F.moneyC, 'revenue')}${tile('Actual cost', F.moneyC, 'cost')}${tile('Margin', F.moneyC, 'margin', c => ` <span style="font-size:15px">${F.pct(c.marginPct)}</span>`)}${tile('Projects', v => F.n(v), 'projects')}</div>
      <div class="chart short" id="C4-trend"></div><div class="card-ctl" style="margin:8px 0"><span class="label">Breakdown</span><span id="C4-by"></span></div><div class="chart" id="C4-break" style="height:${items.length * 40 + 30}px"></div>` +
      DD.calc(`Revenue = the M2 revenue forecast (${sc}). Actual cost = revenue × the cost/revenue ratio of ${C4.ratioYears[0]}–${C4.ratioYears[1]} (${F.pct(C4.ratio)}). Margin = revenue − cost. Projects = the M2 project-count forecast. Breakdown = last-3-year revenue shares.`);
    card.querySelector('.headline').innerHTML = `${cfg.FORECAST_YEAR} (${sc}): revenue <span class="num">${F.moneyC(cur.revenue)}</span> (80% range ${F.moneyC(C4.range.revenue[0])} – ${F.moneyC(C4.range.revenue[1])}), cost ${F.moneyC(cur.cost)}, margin ${DD.varSpan(cur.margin, F.moneyC)} (${F.pct(cur.marginPct)}) on about ${F.n(cur.projects)} projects (${F.n(C4.range.projects[0])}–${F.n(C4.range.projects[1])}).`;
    DD.seg(card.querySelector('#C4-by'), [['region', 'By project region'], ['type', 'By project type']], L.c4By, v => { L.c4By = v; renderC4(); });
    requestAnimationFrame(() => {
      DD.charts.m2Trend(card.querySelector('#C4-trend'), M2.metrics.revenue, { fmt: F.moneyC, fmtFull: F.money, label: 'Revenue', scenario: sc, compact: true });
      DD.charts.c4Breakdown(card.querySelector('#C4-break'), items);
    });
    card.appendChild(DD.analyst('C', 'C4', () => `<h4>Scenarios</h4>${DD.table([['k', 'Scenario'], ['revenue', 'Revenue', F.money], ['cost', 'Cost', F.money], ['margin', 'Margin', F.money], ['marginPct', 'Margin %', v => F.pct(v)], ['projects', 'Projects', v => F.x(v, 1)]], SC.map(([k, l]) => ({ k: l, ...s[k], _hl: k === sc })))}
      <p>Cost/revenue ratio ${C4.ratioYears[0]}–${C4.ratioYears[1]} = ${F.x(C4.ratio, 4)} (projects with Actual &gt; 0). Pessimistic revenue = min(lower 80% bound ${F.money(M2.metrics.revenue.forecast.lo)}, ${cfg.PARTIAL_YEAR} estimate ${F.money(M2.metrics.revenue.growthStops)}).</p>
      ${DD.table([['label', 'Breakdown'], ['share', 'Share', v => F.pct(v)], ['value', 'Revenue', F.money], ['lo', 'Pessimistic', F.money], ['hi', 'Optimistic', F.money]], items)}`));
  }

  DD.tabs.C = { build, update, L };
})();
