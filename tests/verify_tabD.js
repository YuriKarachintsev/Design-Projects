// Tab D checks in headless Chromium, offline:  node tests/verify_tabD.js <cases dir>
// - both downloaded templates must pass; the built-in data exported to CSV must pass and give identical results
// - every bad_* file must fail with the corrupt message and leave the data unchanged
// - "Remember on this computer" survives a reload; reset restores the built-in data; zero console errors
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright');
(async () => {
  const cases = process.argv[2];
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, offline: true, acceptDownloads: true });
  await ctx.route('**/*', r => /^(file|data|blob):/.test(r.request().url()) ? r.continue() : r.abort());
  const p = await ctx.newPage(), errs = [], fails = [], log = [];
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + path.join(__dirname, '..', 'dist', 'dashboard.html') + '#tab=D');
  await p.waitForSelector('#D-file', { state: 'attached' });
  const fp = () => p.evaluate(() => { const D = window.DD, d = D.data; return JSON.stringify([d.all.length, d.valid.length, d.minYM, d.maxYM, D.perf,
    D.A.tabA(d, { from: d.minYM, to: d.maxYM, types: [1, 2, 3, 4], regions: ['North', 'East', 'South', 'West'], granularity: 'monthly', attribution: 'start' }, D.cfg)]); });
  const msg = () => p.$eval('#D-msg', e => ({ cls: (e.firstElementChild || {}).className || '', text: e.textContent.trim() }));
  const upload = async f => { await p.setInputFiles('#D-file', f); await p.waitForTimeout(400); return msg(); };
  const builtin = await fp();
  const CORRUPT = 'The data is corrupt: the file does not match the required format. Nothing was changed.';
  // templates
  for (const btn of ['#D-tpl-xlsx', '#D-tpl-csv']) {
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click(btn)]);
    const f = path.join(cases, dl.suggestedFilename()); await dl.saveAs(f);
    const m = await upload(f);
    const ok = m.cls.includes('ok') && m.text.startsWith('Data loaded: 3 projects');
    log.push([`template ${path.extname(f)}`, ok ? 'PASS (loaded 3 projects)' : 'FAIL ' + m.text]); if (!ok) fails.push(btn);
    for (const k of ['A', 'B', 'C', 'D']) { await p.click(`#tabs button[data-tab="${k}"]`); await p.waitForTimeout(500); }
    if (btn === '#D-tpl-xlsx') log.push(['all tabs with the 3-row file', errs.length ? 'ERRORS' : 'PASS (no errors)']);
    await p.click('#D-reset'); await p.waitForTimeout(300);
  }
  if (await fp() !== builtin) fails.push('reset did not restore built-in data');
  // built-in data as CSV
  let m = await upload(path.join(cases, 'builtin.csv'));
  const same = (await fp()) === builtin;
  log.push(['built-in data as CSV', m.cls.includes('ok') && same ? 'PASS (identical results)' : 'FAIL']); if (!(m.cls.includes('ok') && same)) fails.push('builtin.csv');
  await p.click('#D-reset'); await p.waitForTimeout(300);
  // broken files
  for (const f of fs.readdirSync(cases).filter(f => f.startsWith('bad_')).sort()) {
    const before = await fp();
    m = await upload(path.join(cases, f));
    const ok = m.cls.includes('err') && m.text.startsWith(CORRUPT) && (await fp()) === before;
    log.push([f, ok ? 'REJECTED, data unchanged' : 'NOT REJECTED: ' + m.text]); if (!ok) fails.push(f);
  }
  // remember on this computer
  await p.check('#D-remember');
  const tpl = fs.readdirSync(cases).find(f => f.endsWith('.csv') && f.startsWith('dashboard_template'));
  await upload(path.join(cases, tpl));
  await p.reload(); await p.waitForTimeout(800);
  const kept = await p.evaluate(() => window.DD.data.all.length);
  log.push(['remember + reload', kept === 3 ? 'PASS (uploaded data kept)' : 'FAIL ' + kept]); if (kept !== 3) fails.push('remember');
  await p.click('#tabs button[data-tab="D"]'); await p.click('#D-reset'); await p.reload(); await p.waitForTimeout(800);
  if ((await fp()) !== builtin) fails.push('reset + reload');
  else log.push(['reset + reload', 'PASS (built-in data back)']);
  await b.close();
  log.forEach(([a, r]) => console.log(a.padEnd(34), r));
  console.log('console errors:', errs.length); errs.forEach(e => console.log('  ', e));
  console.log('failures:', fails.length); fails.forEach(f => console.log('  ', f));
  process.exit(errs.length || fails.length ? 1 : 0);
})();
