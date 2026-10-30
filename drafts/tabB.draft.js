/* Tab B · Hypotheses: a findings board with one accordion card per question (B1-B6). */
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
  let rows = [], opt = {};
  const typeOpts = (id, v) => `<select id="${id}" aria-label="Project type"><option value="all"${v === 'all' ? ' selected' : ''}>All types</option>${[1, 2, 3, 4].map(t => `<option value="${t}"${String(v) === String(t) ? ' selected' : ''}>Type ${t}</option>`).join('')}</select>`;
  const steps = (h0, p, st, extra = '') => `<div class="label" style="margin-top:14px">How we tested it</div><ol class="steps">
    <li>Starting assumption (null hypothesis): ${h0}</li><li>We checked how often chance alone would produce a gap this big${extra}.</li>
    <li>Result: ${DD.chance(p)}. ${DD.status(st)} ${statusWords(st)}</li></ol>`;
  const statusWords = st => ({ 'CONFIRMED': 'The gap is real, not normal variation.', 'PARTLY': 'Some parts of the question are confirmed, others are not.', 'FEW DESIGNERS': 'It shows up when we count projects, but not when we count designers, so a few people could be behind it.', 'NO CLEAR GAP': 'The differences are within normal variation.', 'LIMITED DATA': 'There is too little data in the group in focus to judge.' }[st] || '');
  const kw = (k, label = 'Kruskal-Wallis') => k && DD.ok(k.p) ? `${label}: H = ${F.x(k.H)}, df = ${k.df}, p = ${F.p(k.p)}, ε² = ${F.x(k.eps2, 3)} (N = ${k.N})` : `${label}: not computable`;
  const keyTable = (cols, data) => `<table class="keynums"><thead><tr>${cols.map(c => `<th>${c[1]}</th>`).join('')}</tr></thead><tbody>${data.map(r => `<tr>${cols.map(c => `<td>${c[2] ? c[2](r[c[0]], r) : DD.esc(r[c[0]])}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const limitedBadge = '<span class="status LIMITED" style="margin-left:6px">LIMITED DATA</span>';
  const isLimited = (n, nd) => n < cfg.MIN_PROJECTS || (nd !== undefined && nd < cfg.MIN_DESIGNERS);

  // ================================================================ B1
  function B1() {
    const s = Q.B1, res = A.b1(rows, DD.data, { ...opt, view: s.view, metric: s.metric, factor: s.factor }, cfg);
    const out = res.output, perf = res.performance, names = { experience: 'experience', education: 'education', location: 'location' };
    const mLabel = { revenue: 'revenue per year', hours: 'hours per year', projects: 'projects per year' }[s.metric];
    const mFmt = s.metric === 'revenue' ? F.moneyC : s.metric === 'hours' ? F.n : v => F.x(v, 1), mFull = s.metric === 'revenue' ? F.money : s.metric === 'hours' ? F.h : v => F.x(v, 1);
    const conf = res.parts.filter(p => p.p < cfg.ALPHA).map(p => names[p.key]);
    let answer, mini = [], gap = '–', chart, keys, h0, decP, analyst, extra = '';
    const view = s.view === 'output' ? `a designer's ${mLabel}` : 'how many hours designers need compared with the plan';
    if (s.view === 'output') {
      const grp = s.factor === 'location' ? out.location.groups : out.education.groups;
      if (s.factor === 'experience' || s.factor === 'all') {
        const bands = A.bandLabels(cfg.EXPERIENCE_BANDS);
        mini = bands.map((b, i) => { const ds = out.designers.filter(d => A.expBand(d.yrs, cfg.EXPERIENCE_BANDS) === i); return { label: b.replace(' yrs', ''), full: b, value: DD.S.median(ds.map(d => d.value)) || 0, text: mFull(DD.S.median(ds.map(d => d.value))), n: `${ds.length} designers` }; });
      } else mini = grp.map(g => ({ label: g.level.split(' ')[0], full: g.level, value: g.median || 0, text: mFull(g.median), n: `${g.nDesigners} designers`, color: s.factor === 'location' ? DD.locCol(g.level) : DD.INK }));
      const vals = mini.filter(m => DD.ok(m.value) && m.value > 0);
      if (vals.length > 1) { const hi = vals.reduce((a, b) => (b.value > a.value ? b : a)), lo = vals.reduce((a, b) => (b.value < a.value ? b : a)); gap = `${mFmt(hi.value - lo.value)} <span class="muted">${hi.full} vs ${lo.full}</span>`; }
      if (s.factor === 'experience') {
        chart = el => DD.charts.bScatter(el, out.designers.map(d => ({ designer: d.designer, x: d.yrs, y: d.value, loc: d.loc, n: d.years })), { xName: 'Years of experience (2026)', yName: mLabel, xLabel: 'Years of experience', yLabel: mLabel, fmt: mFmt, fmtFull: mFull });
        decP = out.experience.p; h0 = `${view} does not rise or fall with experience.`;
        const dir = out.experience.rho > 0 ? 'rises' : 'falls';
        answer = `${decP < cfg.ALPHA ? 'Yes' : 'No clear link'}: ${mLabel} ${dir} slightly with experience, ${decP < cfg.ALPHA ? 'and the trend is real' : 'but the trend could easily be chance'}.`;
      } else if (s.factor === 'all') {
        const j = out.joint;
        chart = el => DD.charts.bForest(el, j ? j.coefs.map(c => ({ label: c.name.replace('Experience (years)', 'Experience +1 year'), pct: Math.exp(c.b) - 1, lo: Math.exp(c.lo) - 1, hi: Math.exp(c.hi) - 1 })) : [], { xName: `% difference in ${mLabel} (95% range)` });
        decP = Math.min(...res.parts.map(p => p.p)); h0 = `once the other two are taken into account, none of experience, education or location changes ${view}.`;
        answer = conf.length ? `Partly: taken together, ${DD.list(conf)} ${conf.length > 1 ? 'make' : 'makes'} a real difference to ${mLabel}.` : `No: taken together, experience, education and location do not clearly change ${mLabel} (they explain ${F.pct(j ? j.r2 : NaN)} of the differences between the ${j ? j.n : '–'} designers).`;
      } else {
        const t = out[s.factor];
        chart = el => DD.charts.bStrip(el, t.groups.map(g => ({ level: g.level, median: g.median, points: out.designers.filter(d => (s.factor === 'location' ? d.loc : d.edu) === g.level).map(d => ({ designer: d.designer, v: d.value, n: d.years })) })),
          { colorOf: (g, p) => DD.locCol(out.designers.find(d => d.designer === p.designer).loc), yName: mLabel, yLabel: mLabel, fmt: mFmt, fmtFull: mFull });
        decP = t.p; h0 = `${view} is the same whatever the designer's ${s.factor}.`;
        const hi = t.groups.slice().sort((a, b) => b.median - a.median)[0];
        answer = `${decP < cfg.ALPHA ? 'Yes' : 'No clear gap'}: ${hi.level}${s.factor === 'location' ? ' designers' : ''} have the highest median (${mFull(hi.median)} a year), ${decP < cfg.ALPHA ? 'and the gap is real' : 'but the differences are within normal variation'}.`;
      }
      keys = s.factor === 'experience' || s.factor === 'all' ? keyTable([['level', 'Experience'], ['v', mLabel, v => mFull(v)], ['nd', 'Designers']], A.bandLabels(cfg.EXPERIENCE_BANDS).map((b, i) => { const ds = out.designers.filter(d => A.expBand(d.yrs, cfg.EXPERIENCE_BANDS) === i); return { level: b, v: DD.S.median(ds.map(d => d.value)), nd: ds.length }; }))
        : keyTable([['level', s.factor === 'location' ? 'Location' : 'Education'], ['median', `Median ${mLabel}`, v => mFull(v)], ['n', 'Projects', v => F.n(v)], ['nDesigners', 'Designers', (v, r) => v + (r.nDesigners < cfg.MIN_DESIGNERS ? limitedBadge : '')]],
          out[s.factor].groups.map(g => ({ ...g, n: rows.filter(r => (s.factor === 'location' ? r.loc : r.edu) === g.level && out.years.includes(r.year)).length })));
      extra = ', counting designers (one value each), not projects';
      analyst = () => `<h4>Formal hypotheses</h4><p>H0: the distribution of designer mean annual ${mLabel} is the same across groups (or ρ = 0). H1: at least one group differs (ρ ≠ 0).</p>
        <h4>Unit and tests</h4><p>Unit = designer-year: full calendar years ${out.years[0]}–${out.years[out.years.length - 1]} in the period while the designer was active (career start = ${cfg.EXPERIENCE_AS_OF} − years of experience). One mean per designer (n = ${out.designers.length}). Rank-based tests because output is skewed.</p>
        <table><tr><th>Factor</th><th>Test</th><th>Statistic</th><th>p</th><th>Effect size</th><th>n designers</th></tr>
        <tr><td>Education</td><td>Kruskal-Wallis</td><td>H = ${F.x(out.education.H)}</td><td>${F.p(out.education.p)}</td><td>ε² = ${F.x(out.education.eps2, 3)}</td><td>${out.education.N}</td></tr>
        <tr><td>Location</td><td>Kruskal-Wallis</td><td>H = ${F.x(out.location.H)}</td><td>${F.p(out.location.p)}</td><td>ε² = ${F.x(out.location.eps2, 3)}</td><td>${out.location.N}</td></tr>
        <tr><td>Experience</td><td>Spearman</td><td>ρ = ${F.x(out.experience.rho, 3)}</td><td>${F.p(out.experience.p)}</td><td>ρ = ${F.x(out.experience.rho, 3)}</td><td>${out.experience.n}</td></tr></table>
        ${out.joint ? `<h4>All together: OLS of log(mean annual ${mLabel})</h4><p>Reference levels: ${out.joint.refEdu}, ${out.joint.refLoc}. n = ${out.joint.n} designers, R² = ${F.x(out.joint.r2, 3)}.</p>
        ${DD.table([['name', 'Term'], ['b', 'Estimate', v => F.x(v, 4)], ['se', 'SE', v => F.x(v, 4)], ['t', 't', v => F.x(v, 2)], ['p', 'p', F.p], ['pct', '% effect', (v, r) => F.pct(Math.exp(r.b) - 1, true)]], out.joint.coefs)}
        <table><tr><th>Joint F-test</th><th>F</th><th>df</th><th>p</th></tr>${['education', 'location', 'experience'].map(k => `<tr><td>${k}</td><td>${F.x(out.joint.tests[k].F)}</td><td>${out.joint.tests[k].df1}, ${out.joint.tests[k].df2}</td><td>${F.p(out.joint.tests[k].p)}</td></tr>`).join('')}</table>` : ''}`;
    } else {
      const sg = perf.single;
      if (s.factor === 'experience') {
        chart = el => DD.charts.bScatter(el, sg.experience.points.map(p => ({ ...p, y: p.y })), { log: true, xName: 'Median experience at project start (years)', yName: 'Median PR', xLabel: 'Experience at start', yLabel: 'Median PR', fmt: v => F.x(v, 2), fmtFull: F.pr });
        decP = sg.experience.designer.p; h0 = 'designers need the same hours relative to plan whatever their experience.';
        answer = `${decP < cfg.ALPHA ? 'Yes' : 'No clear link'}: experience at project start ${decP < cfg.ALPHA ? 'changes' : 'does not clearly change'} how many hours a designer needs compared with the plan.`;
        mini = sg.experience.groups.map(g => ({ label: g.level.replace(' yrs', ''), full: g.level, value: g.medianPR * 100, text: F.n(g.medianPR * 100) + ' h per 100 h', n: g.n }));
        keys = keyTable([['level', 'Experience at start'], ['medianPR', 'Hours per 100 planned', v => F.n(v * 100)], ['n', 'Projects'], ['nDesigners', 'Designers']], sg.experience.groups);
      } else if (s.factor === 'all') {
        const j = perf.joint;
        const coefs = j ? j.coefs.filter(c => /^(Education|Location|Experience)/.test(c.name)) : [];
        chart = el => DD.charts.bForest(el, coefs.map(c => { const m = /Experience/.test(c.name) ? 10 : 1; return { label: /Experience/.test(c.name) ? 'Experience +10 years' : c.name, pct: Math.exp(m * c.b) - 1, lo: Math.exp(m * c.lo) - 1, hi: Math.exp(m * c.hi) - 1 }; }), { xName: '% more actual hours for the same plan (95% range)' });
        decP = Math.min(...res.parts.map(p => p.p)); h0 = 'once project size, project type and the other factors are taken into account, a factor does not change how many hours designers need.';
        const eff = coefs.filter(c => c.name.startsWith('Education')).map(c => `${c.name.replace('Education: ', '')} ${F.pct(Math.exp(c.b) - 1, true)}`);
        answer = conf.length ? `${conf.length === 3 ? 'Yes' : 'Partly'}: on the same plan, ${DD.list(conf)} ${conf.length > 1 ? 'change' : 'changes'} the hours needed${conf.includes('education') ? ` (vs ${j.refs.edu.toLowerCase()}: ${eff.join(', ')})` : ''}; ${['experience', 'education', 'location'].filter(k => !conf.includes(k)).join(' and ') || 'nothing else'} ${conf.length === 2 ? 'does' : 'do'} not clearly.` : 'No: none of experience, education or location clearly changes the hours needed on the same plan.';
        mini = ['education', 'location', 'experience'].map(k => ({ label: k.slice(0, 3), full: k, value: j ? Math.min(5, -Math.log10(Math.max(j.tests[k].p, 1e-5))) : 0, text: `evidence ${A.meter(j ? j.tests[k].p : NaN)}/5`, n: j ? j.n : '–' }));
        keys = keyTable([['f', 'Factor'], ['p', 'Evidence', (v) => DD.meter(A.meter(v))], ['inc', 'Used in M1']], ['education', 'location', 'experience'].map(k => ({ f: k, p: j ? j.tests[k].p : NaN, inc: DD.perf.factors.includes(k) ? 'yes' : 'no' })));
      } else {
        const t = sg[s.factor], key = s.factor === 'location' ? 'loc' : 'edu';
        chart = el => DD.charts.bStrip(el, t.groups.map(g => ({ level: g.level, median: DD.S.median(g.designerMedians.map(x => x.v)), points: g.designerMedians })),
          { colorOf: (g, p) => DD.locCol((DD.data.designers.get(p.designer) || {}).loc), log: true, yName: 'Designer median PR', yLabel: 'Median PR', fmt: v => F.x(v, 2), fmtFull: F.pr, refLine: 1, refLabel: 'plan' });
        decP = t.designer.p; h0 = `designers need the same hours relative to plan whatever their ${s.factor}.`;
        const hi = t.groups.slice().sort((a, b) => b.medianPR - a.medianPR)[0], lo = t.groups.slice().sort((a, b) => a.medianPR - b.medianPR)[0];
        const st1 = A.status([{ p: t.designer.p, pProject: t.project.p, alpha: cfg.ALPHA }]);
        answer = st1 === 'CONFIRMED' ? `Yes: ${hi.level} designers need the most hours (${F.n(hi.medianPR * 100)} per 100 planned) and ${lo.level} the fewest (${F.n(lo.medianPR * 100)}).`
          : st1 === 'FEW DESIGNERS' ? `Only counting projects: ${hi.level} designers need ${F.n(hi.medianPR * 100)} hours per 100 planned vs ${F.n(lo.medianPR * 100)} for ${lo.level}, but per designer the gap is within normal variation.`
            : `No clear gap: hours per 100 planned range from ${F.n(lo.medianPR * 100)} (${lo.level}) to ${F.n(hi.medianPR * 100)} (${hi.level}), within normal variation.`;
        mini = t.groups.map(g => ({ label: g.level.split(' ')[0], full: g.level, value: g.medianPR * 100, text: F.n(g.medianPR * 100) + ' h per 100 h', n: g.n, color: s.factor === 'location' ? DD.locCol(g.level) : DD.INK }));
        keys = keyTable([['level', s.factor === 'location' ? 'Location' : 'Education'], ['medianPR', 'Hours per 100 planned', v => F.n(v * 100)], ['n', 'Projects'], ['nDesigners', 'Designers', (v, r) => v + (isLimited(r.n, r.nDesigners) ? limitedBadge : '')]], t.groups);
      }
      const vals = mini.filter(m => DD.ok(m.value));
      if (s.factor !== 'all' && vals.length > 1) { const hi = vals.reduce((a, b) => (b.value > a.value ? b : a)), lo = vals.reduce((a, b) => (b.value < a.value ? b : a)); gap = `${F.n(hi.value - lo.value)} h per 100 planned <span class="muted">${hi.full} vs ${lo.full}</span>`; }
      if (s.factor === 'all' && perf.joint) { const c = perf.joint.coefs.filter(c => c.name.startsWith('Education')).sort((a, b) => b.b - a.b)[0]; gap = c ? `${F.pct(Math.exp(c.b) - 1, true)} hours <span class="muted">${c.name.replace('Education: ', '')} vs ${perf.joint.refs.edu}</span>` : '–'; }
      extra = s.factor === 'all' ? ', allowing for each designer\'s projects being related' : ', counting designers (one median each, designers with at least ' + cfg.MIN_DESIGNER_PROJECTS + ' projects), not projects';
      analyst = () => {
        const j = perf.joint;
        return `<h4>Formal hypotheses</h4><p>H0: log PR has the same distribution across groups / the factor's coefficients are all 0. H1: at least one group differs / one coefficient ≠ 0.</p>
        <h4>Single factors</h4><table><tr><th>Factor</th><th>By project</th><th>By designer (n ≥ ${cfg.MIN_DESIGNER_PROJECTS})</th></tr>
        ${['education', 'location'].map(k => `<tr><td>${k}</td><td>${kw(sg[k].project, 'KW on log PR')}</td><td>${kw(sg[k].designer, 'KW on designer medians')}</td></tr>`).join('')}
        <tr><td>experience</td><td>${kw(sg.experience.project, 'KW across bands')}</td><td>Spearman ρ = ${F.x(sg.experience.designer.rho, 3)}, p = ${F.p(sg.experience.designer.p)} (n = ${sg.experience.designer.n})</td></tr></table>
        ${j ? `<h4>All together (same form as M1)</h4><p>ln(actual h) = b0 + b1·ln(planned h) + type terms + education + location + experience at start; designer-clustered CR1 standard errors, t with G − 1 = ${j.G - 1} df. Reference levels: Type ${j.baseType}${j.pooled.length ? ` (Type ${j.pooled.join(', ')} pooled, fewer than ${cfg.MIN_PROJECTS} projects)` : ''}, ${j.refs.edu}, ${j.refs.loc}. n = ${j.n} projects, ${j.G} designers, R² = ${F.x(j.r2, 3)}.</p>
        ${DD.table([['name', 'Term'], ['b', 'Estimate', v => F.x(v, 4)], ['se', 'Clustered SE', v => F.x(v, 4)], ['t', 't', v => F.x(v, 2)], ['p', 'p', F.p], ['lo', '95% CI', (v, r) => `${F.x(r.lo, 3)} … ${F.x(r.hi, 3)}`], ['pct', '% effect', (v, r) => F.pct(Math.exp(r.b) - 1, true)]], j.coefs)}
        <table><tr><th>Joint Wald F</th><th>F</th><th>df</th><th>p</th><th>Into M1?</th></tr>${['education', 'location', 'experience'].map(k => `<tr><td>${k}</td><td>${F.x(j.tests[k].F)}</td><td>${j.tests[k].df1}, ${j.tests[k].df2}</td><td>${F.p(j.tests[k].p)}${j.tests[k].p >= cfg.ALPHA && j.tests[k].p < 0.1 ? ' (borderline)' : ''}</td><td>${j.tests[k].p < cfg.ALPHA ? 'yes' : 'no'}</td></tr>`).join('')}</table>` : ''}`;
      };
    }
    return { answer, mini, gap, status: res.status, meter: res.meter, decP, chart, keys, h0, extra, analyst,
      controls: `<span id="B1-view"></span>${s.view === 'output' ? '<span id="B1-metric"></span>' : ''}<span id="B1-factor"></span>`,
      wire: el => {
        DD.seg(el.querySelector('#B1-view'), [['output', 'Output'], ['performance', 'Performance']], s.view, v => { s.view = v; refreshQ('B1'); });
        if (s.view === 'output') DD.seg(el.querySelector('#B1-metric'), [['revenue', 'Revenue'], ['hours', 'Hours'], ['projects', 'Projects per year']], s.metric, v => { s.metric = v; refreshQ('B1'); });
        DD.seg(el.querySelector('#B1-factor'), [['experience', 'Experience'], ['education', 'Education'], ['location', 'Location'], ['all', 'All together']], s.factor, v => { s.factor = v; refreshQ('B1'); });
      },
      calc: `Output: designer mean annual ${mLabel} over the full years the designer was active. Performance: PR = actual hours ÷ planned hours; designer value = median PR of their projects (designers with at least ${cfg.MIN_DESIGNER_PROJECTS} projects). All together: <code>ln(actual h) = b0 + b1·ln(planned h) + type + education + location + experience</code>; % effect = e<sup>b</sup> − 1.` };
  }

  // ================================================================ B2
  function B2() {
    const s = Q.B2, res = A.b2(rows, DD.data, { type: s.type, plannedH: s.planned }, cfg);
    const gs = res.groups.filter(g => g.n).map(g => ({ ...g, limited: isLimited(g.n, g.nDesigners) }));
    const hi = gs.slice().sort((a, b) => b.per100 - a.per100)[0], lo = gs.slice().sort((a, b) => a.per100 - b.per100)[0];
    const f = s.planned / 100;
    const answer = !gs.length ? 'No projects in this selection.' : res.status === 'CONFIRMED' ? `No: a ${F.n(s.planned)}-hour project takes about ${F.n(lo.per100 * f)} h with ${lo.level} designers but ${F.n(hi.per100 * f)} h with ${hi.level} designers.`
      : res.status === 'FEW DESIGNERS' ? `Only counting projects: a ${F.n(s.planned)}-hour project takes ${F.n(lo.per100 * f)} h (${lo.level}) to ${F.n(hi.per100 * f)} h (${hi.level}); per designer the gap is within normal variation.`
        : `Yes, broadly: a ${F.n(s.planned)}-hour project takes ${F.n(lo.per100 * f)} h (${lo.level}) to ${F.n(hi.per100 * f)} h (${hi.level}) — differences within normal variation.`;
    return { answer, status: res.status, meter: res.meter, decP: res.designer.p,
      mini: gs.map(g => ({ label: g.level[0], full: g.level, value: g.per100, text: F.n(g.per100) + ' h per 100 h', n: g.n, color: DD.locCol(g.level), limited: g.limited })),
      gap: hi ? `${F.n((hi.per100 - lo.per100))} h per 100 planned <span class="muted">${hi.level} vs ${lo.level}</span>` : '–',
      chart: el => DD.charts.b2Bars(el, gs, s.planned),
      keys: keyTable([['level', 'Location'], ['per100', 'Hours per 100 planned', v => F.n(v)], ['expected', `For ${F.n(s.planned)} h`, (v, r) => F.h(r.per100 * f)], ['n', 'Projects'], ['nDesigners', 'Designers', (v, r) => v + (r.limited ? limitedBadge : '')]], gs),
      h0: 'a project of the same planned size takes the same actual hours whichever location its designer works from.', extra: `, counting designers (one median each, at least ${cfg.MIN_DESIGNER_PROJECTS} projects), not projects`,
      analyst: () => `<h4>Formal hypotheses</h4><p>H0: the distribution of PR (actual ÷ planned hours) is the same across designer locations. H1: at least one location differs.</p>
        <h4>Tests</h4><p>Deciding test counts designers (location is constant per designer): ${kw(res.designer, 'Kruskal-Wallis on designer median PR')}, ${res.nDesigners} designers. Reference, by project: ${kw(res.project, 'Kruskal-Wallis on PR')}.</p>
        ${DD.table([['level', 'Location'], ['per100', 'Median ×100', v => F.x(v, 1)], ['q1', 'Q1 ×100', v => F.x(v, 1)], ['q3', 'Q3 ×100', v => F.x(v, 1)], ['n', 'n projects'], ['nDesigners', 'n designers']], gs)}`,
      controls: `${typeOpts('B2-type', s.type)}<label class="label" for="B2-plan" style="margin-left:6px">Planned hours</label><input type="number" id="B2-plan" min="1" step="10" value="${s.planned}" style="width:80px">`,
      wire: el => { el.querySelector('#B2-type').addEventListener('change', e => { s.type = e.target.value; refreshQ('B2'); }); el.querySelector('#B2-plan').addEventListener('change', e => { s.planned = Math.max(1, +e.target.value || 100); refreshQ('B2'); }); },
      calc: `Hours per 100 planned hours = median PR × 100 (PR = actual hours ÷ planned hours), by the designer's home location. Bars scale this to the planned size you enter; whiskers show the middle half of projects (25th–75th percentile).` };
  }

  // ================================================================ B3
  function B3() {
    const s = Q.B3, res = A.b3(rows, DD.data, { type: s.type }, cfg);
    const ds = res.designers, lo = ds[0], hi = ds[ds.length - 1];
    const locs = res.locations.filter(l => l.nDesigners);
    const bestLoc = locs.slice().sort((a, b) => a.median - b.median)[0], worstLoc = locs.slice().sort((a, b) => b.median - a.median)[0];
    const desOK = res.desTest.p < cfg.ALPHA, locOK = res.locTest.p < cfg.ALPHA;
    const answer = !ds.length ? 'Too few designers in this selection.' : `${desOK ? 'The designer' : 'Neither clearly'}${desOK && !locOK ? ', not the location' : desOK && locOK ? ' and the location' : ''}: a planned hour costs from ${F.rateN(lo.cpph)} (${lo.designer}) to ${F.rateN(hi.cpph)} (${hi.designer})${locOK ? '' : `, while location medians (${F.rateN(bestLoc.median)}–${F.rateN(worstLoc.median)}) are within normal variation`}.`;
    let chart, decP = s.compare === 'designers' ? res.desTest.p : res.locTest.p, h0, extra;
    if (s.compare === 'designers') { chart = el => DD.charts.b3Ranked(el, ds); h0 = 'every designer delivers a planned hour at the same cost.'; extra = ''; }
    else if (s.compare === 'drives') { chart = el => { el.style.height = '120px'; DD.chartFor(el).resize(); DD.charts.b3Share(el, res.shares); }; h0 = 'differences in cost per planned hour come from rates and hours vs plan in no particular proportion.'; extra = ''; }
    else { chart = el => DD.charts.bStrip(el, locs.map(l => ({ level: l.level, median: l.median, rate: l.rate, points: ds.filter(d => d.loc === l.level).map(d => ({ designer: d.designer, v: d.cpph, n: d.n })) })), { rate: true, colorOf: g => DD.locCol(g.level), yName: 'Cost per planned hour', yLabel: 'Cost per planned hour', fmt: F.rateN, fmtFull: F.rate }); h0 = 'every location delivers a planned hour at the same cost.'; extra = `, counting designers (one value each, at least ${cfg.MIN_DESIGNER_PROJECTS} projects), not projects`; }
    const keys = s.compare === 'designers' ? keyTable([['designer', 'Designer'], ['cpph', 'Cost / planned h', F.rateN], ['rate', 'Rate', F.rateN], ['n', 'Projects']], ds.slice(0, 6).concat(ds.length > 6 ? [{ designer: '…', cpph: NaN, rate: NaN, n: '' }] : []).concat(ds.length > 6 ? ds.slice(-3) : []))
      : keyTable([['level', 'Location'], ['median', 'Median cost / planned h', F.rateN], ['rate', 'List rate', F.rateN], ['n', 'Projects'], ['nDesigners', 'Designers', (v, r) => v + (isLimited(r.n, r.nDesigners) ? limitedBadge : '')]], locs);
    const driveNote = `<p class="muted" style="margin-top:8px">Location accounts for <b class="num">${F.pct(res.locationShare)}</b> of the differences between designers.</p>`;
    return { answer, status: res.status, meter: res.meter, decP,
      mini: ds.length ? [{ label: 'min', full: `${lo.designer} (cheapest)`, value: lo.cpph, text: F.rate(lo.cpph), n: lo.n }, ...locs.map(l => ({ label: l.level[0], full: l.level + ' median', value: l.median, text: F.rate(l.median), n: l.n, color: DD.locCol(l.level) })), { label: 'max', full: `${hi.designer} (dearest)`, value: hi.cpph, text: F.rate(hi.cpph), n: hi.n }] : [],
      gap: ds.length ? `${F.rateN(hi.cpph - lo.cpph)} per planned h <span class="muted">${hi.designer} vs ${lo.designer}</span>` : '–',
      chart, keys: keys + (s.compare === 'drives' ? driveNote : ''), h0, extra,
      analyst: () => `<h4>Formal hypotheses</h4><p>Designers: H0 cost per planned hour (rate × PR) has the same distribution for every designer. Locations: H0 designer cost per planned hour has the same distribution across locations.</p>
        <h4>Tests</h4><p>${kw(res.desTest, 'Designers: Kruskal-Wallis on project rate × PR')} (${ds.length} designers with ≥ ${cfg.MIN_DESIGNER_PROJECTS} projects${res.excluded.length ? `; left out: ${res.excluded.map(e => `${e.designer} (n = ${e.n})`).join(', ')}` : ''}).</p>
        <p>${kw(res.locTest, 'Locations, deciding: Kruskal-Wallis on designer values')}. Reference by project: ${kw(res.locProj, 'Kruskal-Wallis')}.</p>
        <h4>What drives cost</h4><p>Across designers, log(cost per planned hour) = log(rate) + log(realised PR). Variance shares: realised PR ${F.pct(res.shares.performance)}, rate ${F.pct(res.shares.rate)} (shares of var(log rate) + var(log PR)). Location η² on log cost per planned hour: ${F.x(res.locationShare, 3)}.</p>
        ${DD.table([['designer', 'Designer'], ['loc', 'Location'], ['rate', 'Rate'], ['rpr', 'Realised PR', v => F.x(v, 3)], ['cpph', 'Cost / planned h', v => F.x(v, 2)], ['n', 'n']], ds)}`,
      controls: `<span id="B3-cmp"></span>${typeOpts('B3-type', s.type)}`,
      wire: el => { DD.seg(el.querySelector('#B3-cmp'), [['locations', 'Locations'], ['designers', 'Designers'], ['drives', 'What drives cost']], s.compare, v => { s.compare = v; refreshQ('B3'); }); el.querySelector('#B3-type').addEventListener('change', e => { s.type = e.target.value; refreshQ('B3'); }); },
      calc: `Cost per planned hour = hourly rate × realised PR, where realised PR = Σ actual hours ÷ Σ planned hours of the designer's projects (lower is better). Only designers with at least ${cfg.MIN_DESIGNER_PROJECTS} projects are compared. "What drives cost" splits the differences between designers into their hours vs plan and their rate.` };
  }

  // ================================================================ B4
  function B4() {
    const s = Q.B4, res = A.b4(rows, DD.data, { mode: s.mode, groupBy: s.groupBy, type: s.type }, cfg);
    const gs = res.groups.filter(g => g.n), focus = res.focus, word = focus === 'Overrun' ? 'overrun' : 'underrun';
    const hi = gs.slice().sort((a, b) => b.shares[focus] - a.shares[focus])[0], lo = gs.slice().sort((a, b) => a.shares[focus] - b.shares[focus])[0];
    const unit = res.by === 'loc' ? ' designers' : ' projects';
    const money = g => focus === 'Overrun' ? g.overMoney : g.underMoney;
    const answer = !gs.length ? 'No projects in this selection.' : res.status === 'CONFIRMED' ? `${hi.level}${unit}: ${F.pct(hi.shares[focus])} of projects ${word} (${focus === 'Overrun' ? 'costing' : 'freeing'} ${F.moneyC(money(hi))}) vs ${F.pct(lo.shares[focus])} for ${lo.level}.`
      : res.status === 'FEW DESIGNERS' ? `${hi.level}${unit} ${word} most often (${F.pct(hi.shares[focus])} vs ${F.pct(lo.shares[focus])} for ${lo.level}), but individual designers within each location differ so much that it is not proven.`
        : `Nowhere clearly: ${word} shares run from ${F.pct(lo.shares[focus])} (${lo.level}) to ${F.pct(hi.shares[focus])} (${hi.level}), within normal variation.`;
    return { answer, status: res.status, meter: res.meter, decP: res.by === 'loc' ? res.designerTest.p : res.chi.p,
      mini: gs.map(g => ({ label: g.level[0], full: g.level + unit, value: g.shares[focus] * 100, text: F.pct(g.shares[focus]), n: g.n, color: res.by === 'loc' ? DD.locCol(g.level) : (focus === 'Overrun' ? DD.OVER : DD.UNDER) })),
      gap: hi ? `${F.x((hi.shares[focus] - lo.shares[focus]) * 100, 1)} pts <span class="muted">${hi.level} vs ${lo.level}</span>` : '–',
      chart: el => DD.charts.b4Stacked(el, res),
      keys: keyTable([['level', res.by === 'loc' ? 'Location' : 'Region'], ['share', `${focus} share`, (v, r) => F.pct(r.shares[focus])], ['money', focus === 'Overrun' ? 'Money lost' : 'Money gained', (v, r) => DD.varSpan(focus === 'Overrun' ? -r.overMoney : r.underMoney, F.moneyC)], ['n', 'Projects'], ['nDesigners', 'Designers', (v, r) => v + (isLimited(r.n, r.nDesigners) ? limitedBadge : '')]], gs),
      h0: `the mix of overruns, on-plan projects and underruns is the same in every ${res.by === 'loc' ? 'designer location' : 'project region'}.`, extra: res.by === 'loc' ? `, counting designers (each designer's ${word} share, at least ${cfg.MIN_DESIGNER_PROJECTS} projects), not projects` : '',
      analyst: () => `<h4>Formal hypotheses</h4><p>H0: outcome class (underrun / on plan / overrun at ±${F.pct(cfg.ON_PLAN_TOLERANCE)}) is independent of ${res.by === 'loc' ? 'designer location' : 'project region'}. H1: the class mix differs.</p>
        <h4>Tests</h4><p>Pearson chi-square on class counts: χ² = ${F.x(res.chi.chi2)}, df = ${res.chi.df}, p = ${F.p(res.chi.p)}, Cramér's V = ${F.x(res.chi.V, 3)}, n = ${res.chi.n}.</p>
        ${res.designerTest ? `<p>Deciding (location is constant per designer): ${kw(res.designerTest, `Kruskal-Wallis on designers' ${word} shares`)}.</p>` : '<p>Project region varies within designers, so the project-level chi-square decides.</p>'}
        ${DD.table([['level', 'Group'], ['u', 'Underrun', (v, r) => r.counts.Underrun], ['o', 'On plan', (v, r) => r.counts['On plan']], ['v', 'Overrun', (v, r) => r.counts.Overrun], ['n', 'n']], gs)}`,
      controls: `<span id="B4-mode"></span><span id="B4-by"></span>${typeOpts('B4-type', s.type)}`,
      wire: el => { DD.seg(el.querySelector('#B4-mode'), [['over', 'Overruns'], ['under', 'Underruns']], s.mode, v => { s.mode = v; refreshQ('B4'); }); DD.seg(el.querySelector('#B4-by'), [['loc', 'Designer location'], ['region', 'Project region']], s.groupBy, v => { s.groupBy = v; refreshQ('B4'); }); el.querySelector('#B4-type').addEventListener('change', e => { s.type = e.target.value; refreshQ('B4'); }); },
      calc: `Overrun: PR above ${F.x(1 + cfg.ON_PLAN_TOLERANCE, 2)}; underrun: PR below ${F.x(1 - cfg.ON_PLAN_TOLERANCE, 2)}; otherwise on plan. Money lost = Σ (actual − planned) over overruns; money gained = Σ (planned − actual) over underruns. Dots show each designer's own share.` };
  }

  // ================================================================ B5
  function B5() {
    const s = Q.B5, res = A.b5(rows, DD.data, { ...opt, metric: s.metric, type: s.type }, cfg);
    const word = s.metric === 'margin' ? 'margin' : 'revenue';
    const regs = res.regions.slice().sort((a, b) => b.median - a.median), lead = regs[0], last = regs[regs.length - 1];
    const notProven = regs.filter(r => r.level !== res.leader && !res.proven.includes(r.level)).map(r => r.level);
    const answer = !res.years.length ? 'The period contains no full calendar year.' : res.status === 'LIMITED DATA' ? `${res.leader} leads, but the period has only ${res.years.length} full year${res.years.length > 1 ? 's' : ''}: too few to judge.` :
      res.status === 'CONFIRMED' ? `${res.leader}: a typical year brings ${F.moneyC(lead.median)} of ${word}. ${res.proven.length ? `It is proven ahead of ${DD.list(res.proven)}` : 'Its lead over each single region is not proven'}${notProven.length && res.proven.length ? `; its lead over ${DD.list(notProven)} is not proven` : ''}.`
        : `No clear leader: typical yearly ${word} ranges from ${F.moneyC(last.median)} (${last.level}) to ${F.moneyC(lead.median)} (${lead.level}), within normal variation.`;
    return { answer, status: res.status, meter: res.meter, decP: res.kw.p,
      mini: regs.map(r => ({ label: r.level[0], full: r.level, value: r.median, text: F.money(r.median), n: r.n, color: r.level === res.leader ? DD.INK : '#C9C6BE' })),
      gap: regs.length ? `${F.moneyC(lead.median - last.median)} a year <span class="muted">${lead.level} vs ${last.level}</span>` : '–',
      chart: el => { DD.charts.b5Totals(el, res); const y = el.nextElementSibling; if (y) { y.style.display = ''; DD.charts.b5Yearly(y, res); } }, chartExtra: '<div class="label" style="margin-top:10px">Each year, per region (dark = winner of the year)</div>',
      keys: keyTable([['level', 'Region'], ['median', `Typical yearly ${word}`, F.moneyC], ['total', 'Total', F.moneyC], ['n', 'Projects'], ['wins', 'Years won', (v, r) => res.winners.filter(w => w.region === r.level).length]], regs),
      h0: `every project region brings the same ${word} in a typical year.`, extra: `, counting full calendar years (${res.years.length ? res.years[0] + '–' + res.years[res.years.length - 1] : 'none'})`,
      analyst: () => `<h4>Formal hypotheses</h4><p>H0: yearly ${word} totals have the same distribution in every region. H1: at least one region differs.</p>
        <h4>Tests</h4><p>Unit = the region's total per full calendar year (n = ${res.years.length} years per region). ${kw(res.kw, 'Kruskal-Wallis')}. Pairwise Mann-Whitney U (normal approximation with continuity correction), Holm-adjusted:</p>
        ${DD.table([['a', 'A'], ['b', 'B'], ['U', 'U', v => F.x(v, 1)], ['rbc', 'Rank-biserial r', v => F.x(v, 3)], ['p', 'p', F.p], ['pHolm', 'p (Holm)', F.p]], res.pairs)}`,
      controls: `<span id="B5-metric"></span>${typeOpts('B5-type', s.type)}`,
      wire: el => { DD.seg(el.querySelector('#B5-metric'), [['revenue', 'Revenue'], ['margin', 'Margin']], s.metric, v => { s.metric = v; refreshQ('B5'); }); el.querySelector('#B5-type').addEventListener('change', e => { s.type = e.target.value; refreshQ('B5'); }); },
      calc: `For each project region, ${word} is summed per full calendar year inside the period (${s.metric === 'margin' ? 'margin = revenue − actual cost' : 'revenue = Planned'}). The bar is the median year; dots are the individual years.` };
  }

  // ================================================================ B6
  function B6() {
    const s = Q.B6, res = A.b6(rows, DD.data, {}, cfg);
    const ts = res.types, lead = ts.find(t => t.type === res.leader), byRev = ts.slice().sort((a, b) => b.rev - a.rev)[0];
    let st = res.status; const watch = res.watching;
    const answer = !ts.length ? 'No projects.' : `${st === 'CONFIRMED' ? `Type ${lead.type}` : `No type is proven better`}: Type ${lead.type} keeps the most margin (${F.pct(lead.marginPct)}, range ${F.pct(lead.range[0])}–${F.pct(lead.range[1])}) on ${lead.n} projects${watch ? ' — worth watching, the range overlaps the others' : ''}; Type ${byRev.type} is the core volume (${F.moneyC(byRev.rev)} revenue at ${F.pct(byRev.marginPct)}).`;
    const charts = { portfolio: el => { el.style.height = '420px'; DD.chartFor(el).resize(); DD.charts.b6Portfolio(el, res); }, margin: el => DD.charts.b6Bars(el, res), trend: el => DD.charts.b6Trend(el, res) };
    return { answer, status: st, watch, meter: res.meter, decP: res.kw.p,
      mini: ts.map(t => ({ label: 'T' + t.type, full: 'Type ' + t.type, value: t.marginPct * 100, text: F.pct(t.marginPct), n: t.n, color: DD.TYPE_COL[t.type], limited: t.limited })),
      gap: ts.length > 1 ? (() => { const ok = ts.filter(t => !t.limited); const hi = ok.reduce((a, b) => (b.marginPct > a.marginPct ? b : a)), lo = ok.reduce((a, b) => (b.marginPct < a.marginPct ? b : a)); return `${F.x((hi.marginPct - lo.marginPct) * 100, 1)} pts margin <span class="muted">T${hi.type} vs T${lo.type}</span>`; })() : '–',
      chart: charts[s.view],
      keys: keyTable([['type', 'Type', (v, r) => `<span style="color:${DD.TYPE_COL[v]}">■</span> Type ${v}${r.limited ? limitedBadge : ''}`], ['n', 'Projects'], ['rev', 'Revenue', F.moneyC], ['marginPct', 'Margin % (range)', (v, r) => `${F.pct(v)} <span class="muted">${F.pct(r.range[0])}–${F.pct(r.range[1])}</span>`],
        ['marginPerProject', 'Margin / project', F.moneyC], ['overShare', 'Overrun share', v => F.pct(v)], ['earned', 'Earned / hour worked', F.rateN]], ts),
      h0: 'every project type keeps the same share of its revenue as margin.', extra: ` (types with at least ${cfg.MIN_DESIGNER_PROJECTS} projects)`,
      analyst: () => `<h4>Formal hypotheses</h4><p>H0: project margin % (1 − actual ÷ planned) has the same distribution for each type. H1: at least one type differs.</p>
        <h4>Tests</h4><p>${kw(res.kw, 'Kruskal-Wallis on project margin %')}; tested types: ${res.testedTypes.map(t => 'T' + t).join(', ')}. Ranges: 90% percentile bootstrap of the type's margin % (Σ margin ÷ Σ revenue), ${cfg.BOOTSTRAP_N} resamples of projects, seed ${cfg.RANDOM_SEED}. "Worth watching" = leader has fewer than 30 projects and its range overlaps another type's.</p>
        ${DD.table([['type', 'Type'], ['n', 'n'], ['nDesigners', 'Designers'], ['marginPct', 'Margin %', v => F.pct(v)], ['lo', '5%', (v, r) => F.pct(r.range[0])], ['hi', '95%', (v, r) => F.pct(r.range[1])]], ts)}`,
      controls: '<span id="B6-view"></span>',
      wire: el => DD.seg(el.querySelector('#B6-view'), [['portfolio', 'Portfolio'], ['margin', 'Margin per project'], ['trend', 'Trend']], s.view, v => { s.view = v; refreshQ('B6'); }),
      calc: `Margin = revenue − actual cost; margin % = margin ÷ revenue (clients pay the planned amount, so an underrun is margin gained). Bubble size = revenue. Horizontal line = 90% range of margin % from ${cfg.BOOTSTRAP_N} resamples of the type's projects (dashed below 20 projects). Dashed lines = department values.` };
  }
  const FN = { B1, B2, B3, B4, B5, B6 };

  // ================================================================ rendering
  function build() {
    const el = root(), d = DD.data, st = DD.state;
    const years = []; for (let y = A.ymYear(d.minYM); y <= A.ymYear(d.maxYM); y++) years.push(y);
    el.innerHTML = `<div class="bar"><div class="bar-row">
        <div class="ctl"><span class="label">Period (shared with Overview)</span><div style="display:flex;gap:6px;align-items:center"><input type="month" id="B-from" aria-label="From"><span class="muted">–</span><input type="month" id="B-to" aria-label="To"></div></div>
        <div class="ctl"><span class="label">Presets</span><div class="presets" id="B-presets"><button class="chip" data-p="all">All</button>${years.filter(y => y >= DD.cfg.FIRST_ANALYSIS_YEAR).map(y => `<button class="chip" data-p="from${y}">From ${y}</button>`).join('')}</div></div>
        <div class="ctl"><span class="label">Data</span><div id="B-data"></div></div>
        <div class="ctl"><span class="label">Statistics</span><div id="B-stats"></div></div>
        <div class="ctl"><span class="label">&nbsp;</span><button class="btn" id="B-expand">Expand all</button></div>
      </div><div class="summary-line" id="B-summary"></div></div>
      <div class="findings" id="B-board"></div>
      <div class="legend-line">${['CONFIRMED', 'PARTLY', 'FEW DESIGNERS', 'NO CLEAR GAP', 'LIMITED DATA'].map(s => DD.status(s)).join(' ')} <span>Evidence ${DD.meter(3)} = how rarely chance alone gives a gap this big.</span> <span>No clear gap means not proven different, not proven equal.</span></div>`;
    const board = el.querySelector('#B-board');
    Object.keys(FN).forEach(k => {
      board.insertAdjacentHTML('beforeend', `<div class="frow" id="${k}-row" role="button" tabindex="0" aria-expanded="false" aria-controls="${k}-card">
        <span class="gate">${k}</span><div><div class="q">${QUESTIONS[k]}</div><div class="a"></div></div>
        <div class="hide-sm"><span class="label col-label">The data</span><div class="chart mini" id="${k}-mini"></div></div>
        <div class="hide-sm"><span class="label col-label">Gap</span><span class="num gap" style="font-size:12.5px"></span></div>
        <div class="hide-sm"><span class="label col-label">Evidence</span><span class="mtr"></span></div>
        <div><span class="label col-label">Status</span><span class="st"></span></div><span class="chev" aria-hidden="true">›</span></div>
        <div class="fcard" id="${k}-card" role="region" aria-labelledby="${k}-row"></div>`);
      const row = board.querySelector(`#${k}-row`);
      const toggle = () => setOpen(k, row.getAttribute('aria-expanded') !== 'true');
      row.addEventListener('click', toggle);
      row.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
    });
    DD.seg(el.querySelector('#B-data'), [['all', `All ${DD.fmt.n(d.valid.length)}`], ['original', 'Original only']], st.B.source, v => { st.B.source = v; update(); });
    DD.seg(el.querySelector('#B-stats'), [['off', 'Off'], ['on', 'On']], st.B.stats ? 'on' : 'off', v => { DD.setAllDrawers('B', v === 'on'); });
    el.querySelector('#B-expand').addEventListener('click', e => { const all = Object.keys(FN).every(k => st.B.open.includes(k)); Object.keys(FN).forEach(k => setOpen(k, !all)); e.target.textContent = all ? 'Expand all' : 'Collapse all'; });
    const parse = v => { const m = /^(\d{4})-(\d{2})$/.exec(v); return m ? A.ym(+m[1], +m[2]) : null; };
    el.querySelector('#B-from').addEventListener('change', e => { const v = parse(e.target.value); if (v !== null) { st.A.from = v; DD.clampPeriod(); DD.tabs.A.dirty = true; update(); } });
    el.querySelector('#B-to').addEventListener('change', e => { const v = parse(e.target.value); if (v !== null) { st.A.to = v; DD.clampPeriod(); DD.tabs.A.dirty = true; update(); } });
    el.querySelectorAll('#B-presets button').forEach(b => b.addEventListener('click', () => { const p = b.dataset.p; st.A.from = p === 'all' ? d.minYM : Math.max(d.minYM, A.ym(+p.slice(4), 1)); st.A.to = d.maxYM; DD.tabs.A.dirty = true; update(); }));
  }
  function setOpen(k, open) {
    const st = DD.state.B, row = root().querySelector(`#${k}-row`), card = root().querySelector(`#${k}-card`);
    st.open = open ? [...new Set(st.open.concat(k))] : st.open.filter(x => x !== k);
    row.setAttribute('aria-expanded', String(open));
    card.classList.toggle('open', open);
    if (open) { renderCard(k); }
  }
  const results = {};
  function refreshQ(k) { results[k] = FN[k](); renderRow(k); renderCard(k); }
  function renderRow(k) {
    const r = results[k], row = root().querySelector(`#${k}-row`);
    row.querySelector('.a').innerHTML = r.answer;
    row.querySelector('.gap').innerHTML = r.gap;
    row.querySelector('.mtr').innerHTML = DD.meter(r.meter);
    row.querySelector('.st').innerHTML = DD.status(r.status) + (r.watch ? ' ' + DD.status('WORTH WATCHING') : '');
    if (r.mini.length) DD.charts.bMini(row.querySelector('.chart.mini'), r.mini);
  }
  function renderCard(k) {
    const card = root().querySelector(`#${k}-card`);
    if (!card.classList.contains('open')) return;
    const r = results[k];
    card.innerHTML = `<div class="card-head" style="margin-top:14px"><div class="ttl"><span class="gate">${k}</span><h3 class="card-title">${QUESTIONS[k]}</h3></div><div class="card-ctl">${r.controls}</div></div>
      <p class="headline">${r.answer}</p>
      <div class="bcard-grid"><div><div class="chart" id="${k}-chart"></div>${r.chartExtra ? r.chartExtra + `<div class="chart" id="${k}-chart2" style="height:260px"></div>` : ''}${DD.calc(r.calc)}</div>
        <div><div class="label" style="margin-bottom:6px">Key numbers</div>${r.keys}${steps(r.h0, r.decP, r.status, r.extra)}</div></div>`;
    r.wire(card);
    card.appendChild(DD.analyst('B', k, r.analyst));
    requestAnimationFrame(() => r.chart(card.querySelector(`#${k}-chart`)));
  }
  function update() {
    const st = DD.state, el = root();
    DD.clampPeriod();
    opt = { from: st.A.from, to: st.A.to, source: st.B.source };
    rows = A.rowsB(DD.data, opt);
    el.querySelector('#B-from').value = F.ymIso(st.A.from); el.querySelector('#B-to').value = F.ymIso(st.A.to);
    el.querySelector('#B-summary').innerHTML = `${F.ym(st.A.from)} – ${F.ym(st.A.to)} · ${st.B.source === 'original' ? 'Original rows only' : 'All sources'} · <b>${F.n(rows.length)}</b> projects · <b>${new Set(rows.map(r => r.designer)).size}</b> designers · Overview's type and region filters do not apply here`;
    Object.keys(FN).forEach(k => { try { results[k] = FN[k](); } catch (e) { results[k] = { answer: 'Not enough data in this selection to answer.', mini: [], gap: '–', status: 'LIMITED DATA', meter: 1, decP: NaN, chart: () => {}, keys: '', h0: '', analyst: () => '', controls: '', wire: () => {}, calc: '' }; } renderRow(k); });
    st.B.open.forEach(k => { root().querySelector(`#${k}-row`).setAttribute('aria-expanded', 'true'); root().querySelector(`#${k}-card`).classList.add('open'); renderCard(k); });
    DD.writeHash();
  }
  DD.tabs.B = { build, update, results, Q, setOpen, refreshQ };
})();
