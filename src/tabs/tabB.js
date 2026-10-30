/* Tab B · Data Analysis: simple standard-error tests (each group vs the rest, critical value 1.96). */
(function () {
  const DD = window.DD, A = DD.A, F = DD.fmt, cfg = DD.cfg;
  const root = () => document.getElementById('tab-B');
  const Q = {
    B1: { view: 'output', metric: 'revenue', factor: 'experience' },
    B2: { type: 'all', planned: 100 },
    B3: { compare: 'locations', type: 'all' },
    B4: { mode: 'over', groupBy: 'loc', type: 'all' },
    B5: { metric: 'revenue', type: 'all' },
    B6: { view: 'portfolio' },
  };
  const QUESTIONS = {
    B1: 'Do experience, education or location drive a designer\'s output?',
    B2: 'Does a same-size project take the same hours in every location?',
    B3: 'Who delivers a planned hour cheapest: location or designer?',
    B4: 'Where do overruns and underruns happen most?',
    B5: 'Which region brings the most revenue in bulk?',
    B6: 'Which project type should we grow?',
  };
  let rows = [], opt = {}, picker = null;
  const results = {};

  // ---------------------------------------------------------------- shared helpers
  const typeSelect = (id, v) => `<select id="${id}" aria-label="Project type"><option value="all"${v === 'all' ? ' selected' : ''}>All types</option>${[1, 2, 3, 4].map(t => `<option value="${t}"${String(v) === String(t) ? ' selected' : ''}>Type ${t}</option>`).join('')}</select>`;
  const limitedBadge = '<span class="status LIMITED" style="margin-left:6px">LIMITED DATA</span>';
  const decision = t => (t.limited || !DD.ok(t.p) ? 'not tested (n < ' + cfg.MIN_N + ')' : t.reject ? '<b>Reject H0</b>' : 'Do not reject H0');
  /** Measure descriptions: how to show a mean, a difference and an SE. */
  const MEASURE = {
    money: { val: v => F.moneyC(v), full: v => F.money(v), diff: d => F.signed(d, F.moneyC), se: v => F.moneyC(v) },
    hours: { val: v => F.n(v) + ' h', full: v => F.h(v), diff: d => F.signed(d, v => F.n(v) + ' h'), se: v => F.n(v) + ' h' },
    count: { val: v => F.x(v, 1), full: v => F.x(v, 2), diff: d => F.signed(d, v => F.x(v, 2)), se: v => F.x(v, 2) },
    share: { val: v => F.pct(v), full: v => F.pct(v), diff: d => F.signed(d * 100, v => F.x(v, 1) + ' pts'), se: v => F.x(v * 100, 1) + ' pts' },
    log: { val: v => F.x(v, 2), full: v => F.x(v, 3), diff: d => `${F.signed(d, v => F.x(v, 3))} ln (≈ ${F.pct(Math.exp(d) - 1, true)})`, se: v => F.x(v, 3) + ' ln' },
    margin: { val: v => F.pct(v), full: v => F.pct(v), diff: d => F.signed(d * 100, v => F.x(v, 1) + ' pts'), se: v => F.x(v * 100, 1) + ' pts' },
  };
  /** Group rows for CI plots: back-transform log measures (geometric means) and apply a display scale. */
  function ciGroups(tests, { log, scale = 1, color, label, rate }) {
    const tr = v => (log ? Math.exp(v) : v) * scale;
    return tests.map(t => ({ level: t.level, label: label ? label(t) : String(t.level), n: t.n, nDesigners: t.nDesigners, value: tr(t.mean), lo: tr(t.lo95), hi: tr(t.hi95), limited: t.limited,
      color: color ? color(t) : DD.INK, rate: rate ? rate(t) : undefined }));
  }
  function strip(h, m, extraNote = '') {
    if (!h) return `<div class="teststrip muted">No group has at least ${cfg.MIN_N} units, so nothing can be tested here.${extraNote}</div>`;
    return `<div class="teststrip" role="note"><div class="label" style="margin-bottom:6px">Test result · ${DD.esc(h.title)}</div>
      <span>Difference <b>${m.diff(h.diff)}</b></span><span>SE <b>${m.se(h.seDiff)}</b></span><span>t-stat <b>${F.x(h.t, 2)}</b></span><span>critical value <b>${F.x(h.crit, 2)}</b></span>
      <span>p-value <b>${F.p(h.p)}</b></span><span>95% CI <b>[${m.diff(h.lo)}, ${m.diff(h.hi)}]</b></span><span class="decision ${h.reject ? 'rej' : ''}">→ ${h.reject ? 'Reject H0' : 'Do not reject H0'}</span>${extraNote}</div>`;
  }
  function howTested(h0, h) {
    const res = !h ? 'Nothing could be tested.' : h.reject ? `The headline gap is ${F.x(Math.abs(h.t), 2)} standard errors, beyond 1.96, so we reject the starting assumption. Chance alone would give a gap this big ${DD.chance(h.p)}.`
      : `The headline gap is ${F.x(Math.abs(h.t), 2)} standard errors, within ±1.96, so we do not reject the starting assumption. Chance alone gives a gap this big ${DD.chance(h.p)}.`;
    return `<div class="label" style="margin-top:16px">How we tested it</div><div class="how-grid"><ol class="steps">
      <li>Starting assumption (null hypothesis): ${h0}</li><li>We measured the gap in standard errors (t-stat) and compared it with the critical value ${F.x(DD.S.CRIT, 2)}.</li>
      <li>A gap beyond ${F.x(DD.S.CRIT, 2)} standard errors happens by chance less than 1 time in 20, so we reject the starting assumption. ${res}</li></ol>
      <div class="chart normal" aria-label="Normal curve with the t-stat marked"></div></div>`;
  }
  function fullTable(tests, m, opts = {}) {
    const cols = [['level', opts.groupLabel || 'Group', (v, r) => DD.esc(r.title || v) + (r.limited ? limitedBadge : '')], ['n', 'n', F.n],
      ['mean', 'Mean', v => m.full(v)], ...(opts.noSD ? [] : [['sd', 'SD', v => (DD.ok(v) ? m.se(v) : '–')]]), ['se', 'SE', v => m.se(v)],
      ['diff', opts.diffLabel || 'Difference vs rest', v => (DD.ok(v) ? m.diff(v) : '–')], ['seDiff', 'SE of difference', v => (DD.ok(v) ? m.se(v) : '–')],
      ['t', 't-stat', v => (DD.ok(v) ? F.x(v, 2) : '–')], ['crit', 'Critical', v => (DD.ok(v) ? F.x(v, 2) : '–')], ['p', 'p-value', v => (DD.ok(v) ? F.p(v) : '–')],
      ['lo', '95% CI', (v, r) => (DD.ok(v) ? `[${m.diff(r.lo)}, ${m.diff(r.hi)}]` : '–')], ['reject', 'Decision', (v, r) => decision(r)]];
    return DD.table(cols, tests);
  }
  const FORMULAS = `<h4>Formulas</h4><p><code>SE = s / √n</code> (share: <code>√(p(1 − p)/n)</code>; aggregate margin %: <code>√(Σ(Aᵢ − R·Pᵢ)² / (n(n − 1))) / P̄</code>, R = ΣA/ΣP).
    <code>SE_diff = √(SE₁² + SE₂²)</code>, <code>t-stat = (mean₁ − mean₂) / SE_diff</code> (regression: <code>b / SE(b)</code>), critical value ${cfg.CRITICAL_VALUE},
    <code>p = 2·(1 − Φ(|t|))</code> with Φ the standard normal distribution, <code>95% CI = difference ± ${cfg.CRITICAL_VALUE}·SE_diff</code>. Reject H0 if p &lt; ${cfg.ALPHA}.</p>`;
  const CAVEATS = (extra = '') => `<h4>Caveats</h4><ul><li>Projects by the same designer are not independent: a designer with many projects weighs heavily, and the SEs may be optimistic. Education, location and rate are constant per designer, so only ${DD.data.designers.size} designers carry that information.</li>
    <li>Testing several groups at 5% each carries some chance of a false alarm.</li><li>The normal approximation needs n ≥ ${cfg.MIN_N}; smaller groups are shown but not tested.</li>${extra}</ul>`;
  const named = (t, title) => Object.assign({}, t, { title });
  function headOf(res, title) { return res.head ? named(res.head, title(res.head)) : null; }
  const restWord = l => `the rest`;
  /** Generated sentence for each-vs-rest results. */
  function groupAnswer(tests, { fmtVal, noun = '', higher = 'higher', lower = 'lower', what }) {
    const tested = tests.filter(t => DD.ok(t.p)), rej = tested.filter(t => t.reject);
    const lim = tests.filter(t => t.limited);
    if (!tested.length) return `Too few units to test: every group has fewer than ${cfg.MIN_N}.`;
    if (!rej.length) {
      const s = tested.slice().sort((a, b) => a.mean - b.mean);
      return `No clear gap: ${what} runs from ${fmtVal(s[0].mean)} (${s[0].level}${noun}) to ${fmtVal(s[s.length - 1].mean)} (${s[s.length - 1].level}${noun}), within normal variation.${lim.length ? ` ${lim.map(t => t.level).join(', ')}: limited data.` : ''}`;
    }
    const parts = rej.map(t => `<b>${DD.esc(t.level)}${noun}</b> ${t.diff > 0 ? higher : lower} than the rest (${fmtVal(t.mean)} vs ${fmtVal(t.restMean)})`);
    return `Yes: ${DD.list(parts)}.${lim.length ? ` ${lim.map(t => t.level).join(', ')}: limited data, not tested.` : ''}`;
  }
  const coefAnswer = (tests, fmtEff, ctx) => {
    const rej = tests.filter(t => t.reject);
    return rej.length ? `Yes, ${ctx}: ${DD.list(rej.map(t => `<b>${DD.esc(t.level.replace('Education: ', '').replace('Location: ', ''))}</b> ${fmtEff(t)}`))}; the other terms are within normal variation.`
      : `No clear effect ${ctx}: every coefficient is within normal variation.`;
  };
  const gapText = (groups, fmt, unit = '') => {
    const g = groups.filter(x => DD.ok(x.value));
    if (g.length < 2) return '–';
    const hi = g.reduce((a, b) => (b.value > a.value ? b : a)), lo = g.reduce((a, b) => (b.value < a.value ? b : a));
    return `${fmt(hi.value - lo.value)}${unit} <span class="muted">${DD.esc(hi.label)} vs ${DD.esc(lo.label)}</span>`;
  };

  // ================================================================ B1
  function B1() {
    const s = Q.B1, res = A.b1(rows, DD.data, { ...opt, view: s.view, factor: s.factor, metric: s.metric }, cfg);
    const out = s.view === 'output';
    const mLabel = out ? { revenue: 'revenue per year', hours: 'hours per year', projects: 'projects per year' }[s.metric] : 'typical PR (actual ÷ planned hours)';
    const m = out ? MEASURE[{ revenue: 'money', hours: 'hours', projects: 'count' }[s.metric]] : MEASURE.log;
    const vfmt = out ? m.val : v => F.x(v, 2), vfull = out ? m.full : v => F.x(v, 3);
    let chart, groups = [], answer, mini, h0, gap = '–', head, tableHtml, groupLabel = 'Group';
    const locCol = t => DD.locCol(t.level);
    if (s.factor === 'education' || s.factor === 'location') {
      groups = ciGroups(res.tests, { log: !out, color: s.factor === 'location' ? locCol : null, label: t => t.level + (s.factor === 'location' ? '' : '') });
      const overall = out ? DD.S.mean(res.units.map(u => u.value)) : Math.exp(DD.S.mean(rows.map(r => Math.log(r.pr))));
      chart = el => DD.charts.bCIPlot(el, groups, { fmt: vfmt, fmtFull: vfull, ref: overall, refLabel: 'Overall', axisName: mLabel, valueName: out ? 'Mean' : 'Typical PR', floor: out ? 0 : undefined });
      answer = groupAnswer(res.tests, { what: mLabel, fmtVal: v => (out ? vfmt(v) : F.x(Math.exp(v), 2)), noun: s.factor === 'location' ? ' designers' : '', higher: out ? 'bring more' : 'need more hours vs plan', lower: out ? 'bring less' : 'need fewer hours vs plan' });
      mini = groups; gap = gapText(groups, out ? vfmt : v => F.x(v, 2), out ? '' : ' PR');
      head = headOf(res, t => `${t.level} vs the rest`);
      h0 = `the ${s.factor === 'location' ? 'designer location' : 'education group'} in focus has the same mean ${out ? mLabel : 'ln PR'} as the rest of the ${out ? 'designer-years' : 'projects'}.`;
      groupLabel = s.factor === 'location' ? 'Location' : 'Education';
      tableHtml = fullTable(res.tests.map(t => ({ ...t, title: t.level })), m, { groupLabel });
    } else if (s.factor === 'experience') {
      const c = res.tests[0];
      if (out) chart = el => DD.charts.bScatterFit(el, res.points.map(u => ({ x: u.exp, y: u.value, loc: u.loc, label: `${u.designer} · ${u.year}`, n: 1 })), res.fit, { scale: 10, small: true, xName: 'Years of experience in that year', yName: mLabel, xLabel: 'Experience', yLabel: mLabel, fmt: vfmt, fmtFull: vfull });
      else chart = el => DD.charts.bScatterFit(el, res.points.map(p => ({ x: p.x, y: p.y, loc: p.loc, label: p.designer, n: p.n })), res.fit, { scale: 10, log: true, back: Math.exp, xName: 'Median experience at project start (years)', yName: 'Typical PR', xLabel: 'Experience', yLabel: 'Typical PR', fmt: v => F.x(v, 2), fmtFull: v => F.x(v, 3) });
      const eff = out ? `${m.diff(c.b)} ${mLabel.replace(' per year', '')} a year per 10 years of experience` : `${F.pct(Math.exp(c.b) - 1, true)} hours vs plan per 10 years of experience`;
      answer = c.reject ? `Yes: ${eff}, beyond normal variation.` : `No clear link: ${eff}, within normal variation.`;
      mini = [{ label: '+10 yrs', value: out ? c.b : Math.exp(c.b) - 1, lo: out ? c.lo : Math.exp(c.lo) - 1, hi: out ? c.hi : Math.exp(c.hi) - 1, n: res.n }];
      gap = out ? `${m.diff(c.b)} <span class="muted">per 10 years</span>` : `${F.pct(Math.exp(c.b) - 1, true)} <span class="muted">per 10 years</span>`;
      head = named(c, 'slope per 10 years of experience');
      h0 = `the slope is 0: ${out ? mLabel : 'ln PR'} does not change with experience.`;
      tableHtml = fullTable([{ ...c, title: c.name, mean: c.b, n: res.n, sd: NaN }], out ? m : MEASURE.log, { groupLabel: 'Term', diffLabel: 'Coefficient b', noSD: true });
    } else {
      const tests = res.tests;
      const items = tests.map(t => out ? { label: t.level, value: t.b, lo: t.lo, hi: t.hi, t: t.t, p: t.p } : { label: t.level.replace('Experience at start (years)', 'Experience +1 year'), value: Math.exp(t.b) - 1, lo: Math.exp(t.lo) - 1, hi: Math.exp(t.hi) - 1, t: t.t, p: t.p });
      chart = el => DD.charts.bCoef(el, items, out ? { fmt: v => F.signed(v, vfmt), xName: `Effect on ${mLabel} (95% CI)`, n: res.n } : { xName: '% more hours for the same plan (95% CI)', n: res.n });
      answer = out ? coefAnswer(tests, t => `${t.b > 0 ? 'brings more' : 'brings less'} (${F.signed(t.b, vfmt)} a year vs ${t.level.startsWith('Education') ? res.refs.edu : t.level.startsWith('Location') ? res.refs.loc : 'per 10 years'})`, 'holding the others fixed')
        : coefAnswer(tests, t => `${F.pct(Math.exp(t.b) - 1, true)} hours for the same plan`, `with project size and type held fixed (vs ${res.refs.edu}, ${res.refs.loc})`);
      mini = items.map(i => ({ ...i, label: i.label.split(': ').pop().split(' ')[0].slice(0, 6) }));
      const top = tests.slice().sort((a, b) => Math.abs(b.t) - Math.abs(a.t))[0];
      gap = top ? (out ? `${F.signed(top.b, vfmt)} <span class="muted">${DD.esc(top.level)}</span>` : `${F.pct(Math.exp(top.b) - 1, true)} <span class="muted">${DD.esc(top.level)}</span>`) : '–';
      head = top ? named(top, top.level) : null;
      h0 = 'each coefficient is 0: the term does not change the outcome when the others are held fixed.';
      tableHtml = fullTable((out ? tests : res.allCoefs).map(t => ({ ...t, title: t.level, mean: t.b, n: res.n, sd: NaN })), out ? m : MEASURE.log, { groupLabel: 'Term', diffLabel: 'Coefficient b', noSD: true });
    }
    const miniItems = mini.map(g => ({ label: (g.label || '').split(' ')[0], full: g.label, value: g.value, lo: g.lo, hi: g.hi, limited: g.limited, color: g.color, n: g.n, text: out || s.factor === 'all' || s.factor === 'experience' ? String(F.x(g.value, 2)) : F.x(g.value, 2), ciText: `${F.x(g.lo, 2)} – ${F.x(g.hi, 2)}` }));
    return { res, answer, gap, mini: miniItems, chart, head, m: s.factor === 'education' || s.factor === 'location' ? m : (out ? m : MEASURE.log), h0, tableHtml,
      controls: `<span id="B1-view"></span>${out ? '<span id="B1-metric"></span>' : ''}<span id="B1-factor"></span>`,
      wire: el => {
        DD.seg(el.querySelector('#B1-view'), [['output', 'Output'], ['performance', 'Performance']], s.view, v => { s.view = v; refreshQ('B1'); });
        if (out) DD.seg(el.querySelector('#B1-metric'), [['revenue', 'Revenue'], ['hours', 'Hours'], ['projects', 'Projects per year']], s.metric, v => { s.metric = v; refreshQ('B1'); });
        DD.seg(el.querySelector('#B1-factor'), [['experience', 'Experience'], ['education', 'Education'], ['location', 'Location'], ['all', 'All together']], s.factor, v => { s.factor = v; refreshQ('B1'); });
      },
      calc: out ? `Unit = designer-year: each full calendar year (${res.years[0]}–${res.years[res.years.length - 1]}) in which the designer was active (career start = ${cfg.EXPERIENCE_AS_OF} − years of experience); n = ${res.n}. Value = the designer's ${mLabel.replace(' per year', '')} in that year. Mean = Σ values ÷ n; 95% CI = mean ± 1.96 × SE.`
        : `PR = actual hours ÷ planned hours per project. Typical PR = geometric mean = e^(mean of ln PR). All together: <code>ln(actual h) = b0 + b1·ln(planned h) + type + education + location + experience</code>; % effect = e^b − 1.`,
      analyst: () => `<h4>Hypotheses</h4><p>H0: ${h0} H1: it differs.</p><h4>Full test table</h4>${tableHtml}${FORMULAS}${CAVEATS(out ? '<li>Designer-years of the same designer are related, which the simple test ignores.</li>' : '')}` };
  }

  // ================================================================ B2
  function B2() {
    const s = Q.B2, res = A.b2(rows, DD.data, { type: s.type, plannedH: s.planned }, cfg);
    const groups = ciGroups(res.tests, { log: true, scale: s.planned, color: t => DD.locCol(t.level), label: t => t.level });
    const fmtH = v => F.n(v) + ' h';
    return { res, groups, m: MEASURE.log,
      answer: groupAnswer(res.tests, { what: `a ${F.n(s.planned)}-hour project`, fmtVal: v => fmtH(s.planned * Math.exp(v)), noun: ' designers', higher: 'take more hours', lower: 'take fewer hours' }),
      gap: gapText(groups, v => F.n(v) + ' h', ` per ${F.n(s.planned)} planned`),
      mini: groups.map(g => ({ label: g.label[0], full: g.label, value: g.value, lo: g.lo, hi: g.hi, color: g.color, limited: g.limited, n: g.n, text: fmtH(g.value), ciText: `${fmtH(g.lo)} – ${fmtH(g.hi)}` })),
      chart: el => DD.charts.bCIPlot(el, groups, { fmt: v => F.n(v), fmtFull: fmtH, ref: s.planned, refLabel: `Plan ${F.n(s.planned)} h`, axisName: `Typical actual hours for ${F.n(s.planned)} planned`, valueName: 'Typical hours' }),
      head: headOf(res, t => `${t.level} vs the rest`),
      h0: 'a project of the same planned size takes the same typical hours with designers from the location in focus as with everyone else (same mean ln PR).',
      tableHtml: fullTable(res.tests.map(t => ({ ...t, title: t.level })), MEASURE.log, { groupLabel: 'Location' }),
      controls: `${typeSelect('B2-type', s.type)}<label class="label" for="B2-plan" style="margin-left:6px">Planned hours</label><input type="number" id="B2-plan" min="1" step="10" value="${s.planned}" style="width:84px">`,
      wire: el => { el.querySelector('#B2-type').addEventListener('change', e => { s.type = e.target.value; refreshQ('B2'); }); el.querySelector('#B2-plan').addEventListener('change', e => { s.planned = Math.max(1, +e.target.value || 100); refreshQ('B2'); }); },
      calc: `Typical hours = planned hours × geometric-mean PR, where geometric-mean PR = e^(mean of ln PR) of the location's projects. Whiskers = 95% CI = e^(mean ± 1.96·SE) × planned hours. Dashed line = the plan.`,
      analyst: () => `<h4>Hypotheses</h4><p>H0: mean ln PR of the location equals that of all other locations. H1: it differs.</p><h4>Full test table</h4>${fullTable(res.tests.map(t => ({ ...t, title: t.level })), MEASURE.log, { groupLabel: 'Location' })}${FORMULAS}${CAVEATS()}` };
  }

  // ================================================================ B3
  function B3() {
    const s = Q.B3, res = A.b3(rows, DD.data, { type: s.type }, cfg);
    const fmtR = v => F.rateN(v), fullR = v => F.rate(v);
    const locG = ciGroups(res.locations, { log: true, color: t => DD.locCol(t.level), rate: t => t.rate });
    const desG = ciGroups(res.designers.slice().sort((a, b) => a.mean - b.mean), { log: true, color: t => DD.locCol(t.loc), rate: t => t.rate });
    let chart, head, tableHtml, answer, m = MEASURE.log, h0;
    const des = res.desSummary, loc = res.locSummary;
    const tested = res.designers.filter(t => DD.ok(t.p)).sort((a, b) => a.mean - b.mean);
    const desTxt = tested.length ? `${des.nRejected} of ${tested.length} designers with at least ${cfg.MIN_N} projects differ from the rest (from ${fmtR(Math.exp(tested[0].mean))} for ${tested[0].level} to ${fmtR(Math.exp(tested[tested.length - 1].mean))} for ${tested[tested.length - 1].level})` : 'no designer has enough projects to test';
    const locRej = res.locations.filter(t => t.reject);
    const locTxt = locRej.length ? `${DD.list(locRej.map(t => `${t.level} ${t.diff > 0 ? 'dearer' : 'cheaper'} (${fmtR(Math.exp(t.mean))})`))} than the rest` : 'no location differs from the rest';
    answer = `${des.nRejected && locRej.length ? 'Both' : des.nRejected ? 'Mainly the designer' : locRej.length ? 'Mainly the location' : 'Neither clearly'}: ${desTxt}; by location, ${locTxt}.`;
    if (s.compare === 'designers') {
      chart = el => DD.charts.bCIPlot(el, desG, { horizontal: true, rate: true, fmt: fmtR, fmtFull: fullR, ref: res.overall, refLabel: 'Department', axisName: 'Typical cost per planned hour', valueName: 'Typical cost / planned h' });
      head = headOf(des, t => `${t.level} vs the rest of the department`); h0 = 'the designer in focus has the same typical cost per planned hour as the rest of the department.';
      tableHtml = fullTable(res.designers.slice().sort((a, b) => a.mean - b.mean).map(t => ({ ...t, title: t.level })), m, { groupLabel: 'Designer' });
    } else if (s.compare === 'drives') {
      chart = el => { el.style.height = '110px'; DD.chartFor(el).resize(); DD.charts.b3Share(el, res.shares, res.nDriveDesigners); };
      head = null; h0 = 'descriptive view: no test.';
      tableHtml = `<p>Across the ${res.nDriveDesigners} designers with at least ${cfg.MIN_DESIGNER_PROJECTS} projects: log cost per planned hour = log rate + log realised PR. Shares of var(log rate) + var(log PR): realised PR ${F.pct(res.shares.performance)}, rate ${F.pct(res.shares.rate)}. Location η² on log cost per planned hour: ${F.x(res.locationShare, 3)}.</p>`;
    } else {
      chart = el => DD.charts.bCIPlot(el, locG, { rate: true, fmt: fmtR, fmtFull: fullR, ref: res.overall, refLabel: 'Department', axisName: 'Typical cost per planned hour', valueName: 'Typical cost / planned h' });
      head = headOf(loc, t => `${t.level} vs the rest`); h0 = 'designers from the location in focus deliver a planned hour at the same typical cost as the rest.';
      tableHtml = fullTable(res.locations.map(t => ({ ...t, title: t.level })), m, { groupLabel: 'Location' });
    }
    const miniG = s.compare === 'designers' ? desG.filter(g => !g.limited) : locG;
    return { res, answer, m, chart, head, h0, tableHtml,
      gap: s.compare === 'designers' ? gapText(desG.filter(g => !g.limited), fmtR, ' per planned h') : gapText(locG, fmtR, ' per planned h'),
      mini: miniG.map(g => ({ label: g.label.slice(0, 3), full: g.label, value: g.value, lo: g.lo, hi: g.hi, color: g.color, n: g.n, text: fullR(g.value), ciText: `${fmtR(g.lo)} – ${fmtR(g.hi)}` })),
      extraBelow: s.compare === 'drives' ? `<p class="headline" style="margin-top:6px">Location accounts for <span class="num">${F.pct(res.locationShare)}</span> of the differences between designers.</p>` : '',
      controls: `<span id="B3-cmp"></span>${typeSelect('B3-type', s.type)}`,
      wire: el => { DD.seg(el.querySelector('#B3-cmp'), [['locations', 'Locations'], ['designers', 'Designers'], ['drives', 'What drives cost']], s.compare, v => { s.compare = v; refreshQ('B3'); }); el.querySelector('#B3-type').addEventListener('change', e => { s.type = e.target.value; refreshQ('B3'); }); },
      calc: `Cost per planned hour of a project = hourly rate × PR (lower is better). Typical value = e^(mean of ln(rate × PR)). Hollow circles / ticks = list rate. Designers with fewer than ${cfg.MIN_N} projects are shown as limited data and not tested. "What drives cost" splits the differences between designers into their hours vs plan and their rate (descriptive).`,
      analyst: () => `<h4>Hypotheses</h4><p>H0: ${h0} H1: it differs.</p><h4>Full test table</h4>${tableHtml}${FORMULAS}${CAVEATS()}` };
  }

  // ================================================================ B4
  function B4() {
    const s = Q.B4, res = A.b4(rows, DD.data, { mode: s.mode, groupBy: s.groupBy, type: s.type }, cfg);
    const word = res.focus === 'Overrun' ? 'overrun' : 'underrun', unit = res.by === 'loc' ? ' designers' : ' projects';
    const groups = ciGroups(res.tests, { color: t => (res.by === 'loc' ? DD.locCol(t.level) : res.focus === 'Overrun' ? DD.OVER : DD.UNDER), label: t => t.level });
    return { res, groups, m: MEASURE.share,
      answer: groupAnswer(res.tests, { what: `the ${word} share`, fmtVal: v => F.pct(v), noun: unit, higher: `${word} more often`, lower: `${word} less often` }),
      gap: gapText(groups, v => F.x(v * 100, 1) + ' pts'),
      mini: groups.map(g => ({ label: g.label[0], full: g.label + unit, value: g.value, lo: g.lo, hi: g.hi, color: g.color, n: g.n, text: F.pct(g.value), ciText: `${F.pct(g.lo)} – ${F.pct(g.hi)}` })),
      chart: el => { DD.charts.bCIPlot(el, groups, { fmt: v => F.pct(v), fmtFull: v => F.pct(v), ref: res.overall, refLabel: 'All projects', axisName: `${res.focus} share`, valueName: `${res.focus} share`, floor: 0 }); const m2 = el.parentElement.querySelector('.chart2'); if (m2) DD.charts.b4Mix(m2, res.mix, res.by); },
      chart2: true, chart2Label: 'Outcome mix and money (▲ margin gained, ▼ margin lost)',
      head: headOf(res, t => `${t.level}${unit} vs the rest`),
      h0: `the ${word} share in the ${res.by === 'loc' ? 'designer location' : 'project region'} in focus equals the share in the rest.`,
      tableHtml: fullTable(res.tests.map(t => ({ ...t, title: t.level })), MEASURE.share, { groupLabel: res.by === 'loc' ? 'Location' : 'Region' }),
      controls: `<span id="B4-mode"></span><span id="B4-by"></span>${typeSelect('B4-type', s.type)}`,
      wire: el => { DD.seg(el.querySelector('#B4-mode'), [['over', 'Overruns'], ['under', 'Underruns']], s.mode, v => { s.mode = v; refreshQ('B4'); }); DD.seg(el.querySelector('#B4-by'), [['loc', 'Designer location'], ['region', 'Project region']], s.groupBy, v => { s.groupBy = v; refreshQ('B4'); }); el.querySelector('#B4-type').addEventListener('change', e => { s.type = e.target.value; refreshQ('B4'); }); },
      calc: `Overrun: PR above ${F.x(1 + cfg.ON_PLAN_TOLERANCE, 2)}; underrun: below ${F.x(1 - cfg.ON_PLAN_TOLERANCE, 2)}; otherwise on plan. Share p = projects in the class ÷ projects in the group; SE = √(p(1 − p)/n). Margin lost = Σ(actual − planned) over overruns; margin gained = Σ(planned − actual) over underruns.`,
      analyst: () => `<h4>Hypotheses</h4><p>H0: the ${word} share of the group equals the share of all other projects. H1: it differs.</p><h4>Full test table</h4>${fullTable(res.tests.map(t => ({ ...t, title: t.level })), MEASURE.share, { groupLabel: res.by === 'loc' ? 'Location' : 'Region', noSD: true })}${FORMULAS}${CAVEATS()}` };
  }

  // ================================================================ B5
  function B5() {
    const s = Q.B5, res = A.b5(rows, DD.data, { ...opt, metric: s.metric, type: s.type }, cfg);
    const word = s.metric === 'margin' ? 'margin' : 'revenue';
    const groups = ciGroups(res.tests, { label: t => t.level, color: t => (t.reject ? DD.INK : DD.INK2) });
    groups.forEach(g => { g.limited = false; });
    const tested = res.tests.filter(t => DD.ok(t.p)), lead = tested.slice().sort((a, b) => b.mean - a.mean)[0];
    const rej = tested.filter(t => t.reject);
    const answer = !res.years.length ? 'The period contains no full calendar year.' : rej.length ? `${lead ? `<b>${lead.level}</b> leads with ${F.moneyC(lead.mean)} of ${word} in a typical year. ` : ''}Proven different from the other regions: ${DD.list(rej.map(t => `${t.level} (${t.diff > 0 ? 'above' : 'below'}, ${F.moneyC(t.mean)} vs ${F.moneyC(t.restMean)})`))} — indicative: ${res.years.length} years.`
      : `No clear gap between regions in yearly ${word} (indicative: ${res.years.length} years).`;
    return { res, groups, m: MEASURE.money, answer, indicative: res.indicative,
      gap: gapText(groups, F.moneyC, ' a year'),
      mini: groups.map(g => ({ label: g.label[0], full: g.label, value: g.value, lo: g.lo, hi: g.hi, color: g.color, n: `${res.years.length} years`, text: F.money(g.value), ciText: `${F.moneyC(g.lo)} – ${F.moneyC(g.hi)}` })),
      chart: el => { DD.charts.bCIPlot(el, groups, { fmt: F.moneyC, fmtFull: F.money, ref: res.overall, refLabel: 'All regions', axisName: `Mean yearly ${word}`, valueName: `Mean yearly ${word}` }); const m2 = el.parentElement.querySelector('.chart2'); if (m2) DD.charts.b5Yearly(m2, res); },
      chart2: true, chart2Label: 'Each year, per region (dark = winner of the year)',
      head: headOf(res, t => `${t.level} vs the other regions`),
      h0: `the region's mean yearly ${word} equals the mean of the other regions' yearly totals.`,
      tableHtml: fullTable(res.tests.map(t => ({ ...t, title: t.level })), MEASURE.money, { groupLabel: 'Region' }),
      controls: `<span id="B5-metric"></span>${typeSelect('B5-type', s.type)}<span class="status WATCH">${DD.esc(res.indicative)}</span>`,
      wire: el => { DD.seg(el.querySelector('#B5-metric'), [['revenue', 'Revenue'], ['margin', 'Margin']], s.metric, v => { s.metric = v; refreshQ('B5'); }); el.querySelector('#B5-type').addEventListener('change', e => { s.type = e.target.value; refreshQ('B5'); }); },
      calc: `Unit = the region's total ${word} per full calendar year in the period (${res.years.length ? res.years[0] + '–' + res.years[res.years.length - 1] : 'none'}). Mean and SE = s/√years per region; each region is compared with the other regions' yearly totals. With only ${res.years.length} years per region the result is indicative.`,
      analyst: () => `<h4>Hypotheses</h4><p>H0: ${'the region\'s mean yearly total equals that of the other regions'}. H1: it differs.</p><h4>Full test table</h4>${fullTable(res.tests.map(t => ({ ...t, title: t.level })), MEASURE.money, { groupLabel: 'Region' })}${FORMULAS}${CAVEATS(`<li>Only ${res.years.length} yearly totals per region: the normal approximation is rough (indicative only), an explicit exception to n ≥ ${cfg.MIN_N}.</li>`)}` };
  }

  // ================================================================ B6
  function B6() {
    const s = Q.B6, res = A.b6(rows, DD.data, {}, cfg);
    const ts = res.types, groups = ts.map(t => ({ level: t.type, label: `Type ${t.type}`, n: t.n, value: t.mean, lo: t.lo95, hi: t.hi95, limited: t.limited, color: DD.TYPE_COL[t.type] }));
    const lead = ts.find(t => t.type === res.leader), core = ts.slice().sort((a, b) => b.rev - a.rev)[0];
    const rej = ts.filter(t => t.reject);
    const answer = !ts.length ? 'No projects.' : `${rej.length ? `Yes: ${DD.list(rej.map(t => `Type ${t.type} ${t.diff > 0 ? 'keeps more' : 'keeps less'} margin than the rest (${F.pct(t.mean)} vs ${F.pct(t.restMean)})`))}.` : 'No type is proven better.'} Type ${lead.type} has the highest margin (${F.pct(lead.mean)}, 95% CI ${F.pct(lead.lo95)}–${F.pct(lead.hi95)}) on ${lead.n} projects${lead.limited ? ' — limited data' : ''}${res.watching ? ', worth watching' : ''}; Type ${core.type} is the core volume (${F.moneyC(core.rev)} revenue at ${F.pct(core.mean)}).`;
    const charts = { portfolio: el => { el.style.height = '440px'; DD.chartFor(el).resize(); DD.charts.b6Portfolio(el, res); }, margin: el => DD.charts.b6Bars(el, res), trend: el => DD.charts.b6Trend(el, res) };
    const keys = DD.table([['type', 'Type', (v, r) => `<span style="color:${DD.TYPE_COL[v]}">■</span> Type ${v}${r.limited ? limitedBadge : ''}`], ['n', 'Projects', F.n], ['rev', 'Revenue', F.moneyC],
      ['mean', 'Margin % (95% CI)', (v, r) => `${F.pct(v)} <span class="muted">${F.pct(r.lo95)}–${F.pct(r.hi95)}</span>`], ['marginPerProject', 'Margin / project', F.moneyC], ['overShare', 'Overrun share', v => F.pct(v)], ['earned', 'Earned / hour worked', F.rateN]], ts, { cls: 'keynums' });
    return { res, groups, m: MEASURE.margin, answer, watch: res.watching, keysExtra: keys,
      gap: gapText(groups.filter(g => !g.limited), v => F.x(v * 100, 1) + ' pts'),
      mini: groups.map(g => ({ label: 'T' + g.level, full: g.label, value: g.value, lo: g.lo, hi: g.hi, color: g.color, limited: g.limited, n: g.n, text: F.pct(g.value), ciText: `${F.pct(g.lo)} – ${F.pct(g.hi)}` })),
      chart: charts[s.view], head: headOf(res, t => `Type ${t.type} vs the rest`),
      h0: 'the aggregate margin % of the type in focus equals that of all other projects.',
      tableHtml: fullTable(ts.map(t => ({ ...t, title: `Type ${t.type}`, sd: NaN })), MEASURE.margin, { groupLabel: 'Type', noSD: true }),
      controls: '<span id="B6-view"></span>',
      wire: el => DD.seg(el.querySelector('#B6-view'), [['portfolio', 'Portfolio'], ['margin', 'Margin per project'], ['trend', 'Trend']], s.view, v => { s.view = v; refreshQ('B6'); }),
      calc: `Margin = revenue − actual cost; aggregate margin % = 1 − ΣActual ÷ ΣPlanned (clients pay the planned amount, so an underrun is margin gained). SE by the delta method: √(Σ(Aᵢ − R·Pᵢ)² / (n(n − 1))) / P̄. The line through each bubble is the 95% CI (dashed below ${cfg.MIN_N} projects). Bubble size = revenue; dashed lines = department values.`,
      analyst: () => `<h4>Hypotheses</h4><p>H0: the type's aggregate margin % equals that of all other projects. H1: it differs.</p><h4>Full test table</h4>${fullTable(ts.map(t => ({ ...t, title: `Type ${t.type}`, sd: NaN })), MEASURE.margin, { groupLabel: 'Type', noSD: true })}${FORMULAS}${CAVEATS('<li>"Worth watching": a limited type leads and its CI overlaps the others.</li>')}` };
  }
  const FN = { B1, B2, B3, B4, B5, B6 };

  // ================================================================ rendering
  function build() {
    const el = root(), d = DD.data, st = DD.state;
    el.innerHTML = `<div class="bar"><div class="bar-row">
        <div class="ctl"><span class="label">Period (shared with Overview)</span><div id="B-period"></div></div>
        <div class="ctl"><span class="label">Data</span><div id="B-data"></div></div>
        <div class="ctl"><span class="label">Statistics</span><div id="B-stats"></div></div>
        <div class="ctl"><span class="label">&nbsp;</span><button class="btn" id="B-expand">Expand all</button></div>
      </div><div class="summary-line" id="B-summary"></div></div>
      <div class="findings" id="B-board">
        <div class="frow fhead" aria-hidden="true"><span></span><span class="label">Question · answer</span><span class="label hide-sm">The data (95% CI)</span><span class="label hide-sm">Gap</span><span class="label hide-sm">Evidence</span><span class="label">Status</span><span></span></div>
      </div>
      <div class="legend-line">${['CONFIRMED', 'NO CLEAR GAP', 'LIMITED DATA'].map(s => DD.status(s)).join(' ')} <span>Evidence ${DD.meter(3)} from the smallest p-value.</span> <span>No clear gap means not proven different, not proven equal.</span></div>`;
    const board = el.querySelector('#B-board');
    Object.keys(FN).forEach(k => {
      board.insertAdjacentHTML('beforeend', `<div class="frow" id="${k}-row" role="button" tabindex="0" aria-expanded="false" aria-controls="${k}-card">
        <span class="gate">${k}</span><div><div class="q">${QUESTIONS[k]}</div><div class="a"></div></div>
        <div class="hide-sm"><div class="chart mini" id="${k}-mini"></div></div>
        <div class="hide-sm"><span class="num gap" style="font-size:12.5px"></span></div>
        <div class="hide-sm"><span class="mtr"></span></div>
        <div><span class="st"></span></div><span class="chev" aria-hidden="true">›</span></div>
        <div class="fcard" id="${k}-card" role="region" aria-labelledby="${k}-row"></div>`);
      const row = board.querySelector(`#${k}-row`), toggle = () => setOpen(k, row.getAttribute('aria-expanded') !== 'true');
      row.addEventListener('click', toggle);
      row.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
    });
    DD.seg(el.querySelector('#B-data'), [['all', `All ${F.n(d.valid.length)}`], ['original', 'Original only']], st.B.source, v => { st.B.source = v; update(); });
    DD.seg(el.querySelector('#B-stats'), [['off', 'Off'], ['on', 'On']], st.B.stats ? 'on' : 'off', v => DD.setAllDrawers('B', v === 'on'));
    el.querySelector('#B-expand').addEventListener('click', e => { const all = Object.keys(FN).every(k => st.B.open.includes(k)); Object.keys(FN).forEach(k => setOpen(k, !all)); e.target.textContent = all ? 'Expand all' : 'Collapse all'; });
    picker = DD.periodPicker(el.querySelector('#B-period'), 'B', (f, t) => { st.A.from = f; st.A.to = t; DD.tabs.A.dirty = true; update(); });
  }
  function setOpen(k, open) {
    const st = DD.state.B, row = root().querySelector(`#${k}-row`), card = root().querySelector(`#${k}-card`);
    st.open = open ? [...new Set(st.open.concat(k))] : st.open.filter(x => x !== k);
    row.setAttribute('aria-expanded', String(open));
    card.classList.toggle('open', open);
    if (open) renderCard(k);
  }
  function refreshQ(k) { results[k] = safe(k); renderRow(k); renderCard(k); }
  function safe(k) {
    try { return FN[k](); } catch (e) {
      console.warn('Tab B', k, e);
      return { res: { status: 'LIMITED DATA', meter: 1 }, answer: 'Not enough data in this selection to answer.', mini: [], gap: '–', chart: () => {}, head: null, h0: '–', tableHtml: '', controls: '', wire: () => {}, calc: '', analyst: () => '', m: MEASURE.count };
    }
  }
  function renderRow(k) {
    const r = results[k], row = root().querySelector(`#${k}-row`);
    row.querySelector('.a').innerHTML = r.answer;
    row.querySelector('.gap').innerHTML = r.gap;
    row.querySelector('.mtr').innerHTML = DD.meter(r.res.meter);
    row.querySelector('.st').innerHTML = DD.status(r.res.status) + (r.watch ? ' ' + DD.status('WORTH WATCHING') : '') + (r.indicative ? `<div class="label" style="margin-top:4px">${DD.esc(r.indicative)}</div>` : '');
    const mini = row.querySelector('.chart.mini');
    if (r.mini && r.mini.length) DD.charts.bMiniCI(mini, r.mini); else { const c = echarts.getInstanceByDom(mini); if (c) c.clear(); }
  }
  function renderCard(k) {
    const card = root().querySelector(`#${k}-card`);
    if (!card.classList.contains('open')) return;
    const r = results[k], h = r.head;
    card.innerHTML = `<div class="card-head" style="margin-top:16px"><div class="ttl"><span class="gate">${k}</span><h3 class="card-title">${QUESTIONS[k]}</h3></div><div class="card-ctl">${r.controls}</div></div>
      <p class="headline">${r.answer}</p>
      <div class="bcard-grid"><div><div class="chart main"></div>${r.chart2 ? `<div class="label" style="margin-top:12px">${r.chart2Label}</div><div class="chart chart2" style="height:${k === 'B5' ? 280 : 240}px"></div>` : ''}${r.extraBelow || ''}${r.keysExtra ? `<div class="label" style="margin:14px 0 6px">Key numbers</div><div class="tbl-scroll">${r.keysExtra}</div>` : ''}${DD.calc(r.calc)}</div>
        <div>${strip(h, r.m)}${howTested(r.h0, h)}</div></div>`;
    r.wire(card);
    card.appendChild(DD.analyst('B', k, r.analyst));
    requestAnimationFrame(() => {
      r.chart(card.querySelector('.chart.main'));
      const nc = card.querySelector('.chart.normal');
      if (nc && h) DD.charts.bNormal(nc, h.t, h.crit); else if (nc) nc.style.display = 'none';
    });
  }
  function update() {
    const st = DD.state, el = root();
    DD.clampPeriod();
    opt = { from: st.A.from, to: st.A.to, source: st.B.source };
    rows = A.rowsB(DD.data, opt);
    picker.set(st.A.from, st.A.to, DD.data.minYM, DD.data.maxYM);
    el.querySelector('#B-summary').innerHTML = `${F.ym(st.A.from)} – ${F.ym(st.A.to)} · ${st.B.source === 'original' ? 'Original rows only' : 'All sources'} · <b>${F.n(rows.length)}</b> projects · <b>${new Set(rows.map(r => r.designer)).size}</b> designers · each group tested against the rest at critical value ${F.x(cfg.CRITICAL_VALUE, 2)} · Overview's type and region filters do not apply here`;
    Object.keys(FN).forEach(k => { results[k] = safe(k); renderRow(k); });
    st.B.open.forEach(k => { root().querySelector(`#${k}-row`).setAttribute('aria-expanded', 'true'); root().querySelector(`#${k}-card`).classList.add('open'); renderCard(k); });
    DD.writeHash();
  }
  DD.tabs.B = { build, update, results, Q, setOpen, refreshQ };
})();
