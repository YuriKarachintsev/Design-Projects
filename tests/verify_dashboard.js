// End-to-end check of dist/dashboard.html in headless Chromium, opened via file:// with the network disabled.
//   node tests/verify_dashboard.js [cases dir with builtin.csv]
// - clicks every tab, segmented toggle, chip, select option, checkbox, "For analysts" drawer (open and close),
//   Statistics On/Off, scenario, the A3 play button and an upload
// - checks that the statuses shown on the tab B board equal the engine's
// - screenshots every section at 1440 and 1024 px into screenshots/
// Exits non-zero on any console error or failed check.
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..'), FILE = 'file://' + path.join(ROOT, 'dist', 'dashboard.html');
const SHOTS = path.join(ROOT, 'screenshots');

(async () => {
  const cases = process.argv[2];
  const errors = [], blocked = [], failures = [], counts = {};
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, offline: true, acceptDownloads: true });
  await ctx.route('**/*', r => (/^(file|data|blob):/.test(r.request().url()) ? r.continue() : (blocked.push(r.request().url()), r.abort())));
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(FILE);
  await page.waitForFunction(() => window.DD && window.DD.data);
  const tab = async k => { await page.click(`#tabs button[data-tab="${k}"]`); await page.waitForTimeout(400); };
  const count = (k, n = 1) => { counts[k] = (counts[k] || 0) + n; };

  /** Click every button matching sel inside root, re-querying after each click (the DOM re-renders). */
  async function clickAll(rootSel, sel, label, wait = 120) {
    let i = 0;
    for (;;) {
      const els = await page.$$(`${rootSel} ${sel}`);
      if (i >= els.length) break;
      const el = els[i++];
      if (!(await el.isVisible())) continue;
      try { await el.click({ timeout: 3000 }); count(label); await page.waitForTimeout(wait); } catch (e) { /* re-rendered */ }
    }
  }
  async function cycleSelects(rootSel) {
    const n = (await page.$$(`${rootSel} select`)).length;
    for (let i = 0; i < n; i++) {
      const sels = await page.$$(`${rootSel} select`); if (!sels[i] || !(await sels[i].isVisible())) continue;
      const vals = await sels[i].$$eval('option', o => o.map(x => x.value));
      for (const v of vals) { const s = (await page.$$(`${rootSel} select`))[i]; if (!s) break; await s.selectOption(v); count('select options'); await page.waitForTimeout(120); }
      const s = (await page.$$(`${rootSel} select`))[i]; if (s) await s.selectOption(vals[0]);
    }
  }
  async function drawers(rootSel) {
    for (const want of ['true', 'false']) {
      const n = (await page.$$(`${rootSel} .analyst-btn`)).length;
      for (let i = 0; i < n; i++) { const b = (await page.$$(`${rootSel} .analyst-btn`))[i]; if (!b || !(await b.isVisible())) continue;
        if ((await b.getAttribute('aria-expanded')) !== want) { await b.click(); count(want === 'true' ? 'drawers opened' : 'drawers closed'); await page.waitForTimeout(150); } }
    }
  }

  // ---------------- tab A
  await tab('A');
  await clickAll('#tab-A', '.seg button', 'toggles');
  await clickAll('#tab-A', '#A-types .chip', 'type chips'); await clickAll('#tab-A', '#A-types .chip', 'type chips');
  await clickAll('#tab-A', '#A-regions .chip', 'region chips'); await clickAll('#tab-A', '#A-regions .chip', 'region chips');
  // period calendars: pick From = Mar 2020 and To = Jun 2022; To may not go before From
  async function pick(prefix, k, year, month) {
    await page.click(`#${prefix}-${k} .mp-btn`);
    await page.selectOption(`#${prefix}-${k} .mp-year`, String(year));
    await page.click(`#${prefix}-${k} .mp-grid button[data-m="${month - 1}"]`); count('calendar picks'); await page.waitForTimeout(250);
  }
  await pick('A', 'from', 2020, 3); await pick('A', 'to', 2022, 6);
  const per = await page.evaluate(() => [window.DD.fmt.ymIso(window.DD.state.A.from), window.DD.fmt.ymIso(window.DD.state.A.to)]);
  if (per.join() !== '2020-03,2022-06') failures.push('calendar pick gave ' + per);
  await page.click('#A-to .mp-btn');
  const toYears = await page.$$eval('#A-to .mp-year option', o => o.map(x => x.value));
  if (toYears[0] !== '2020') failures.push('To calendar offers years before From: ' + toYears[0]);
  await page.selectOption('#A-to .mp-year', '2020');
  const dis = await page.$$eval('#A-to .mp-grid button', b => b.map(x => x.disabled));
  if (!(dis[0] && dis[1] && !dis[2])) failures.push('To calendar allows months before From: ' + dis); else count('end-before-start blocked');
  await page.keyboard.press('Escape');
  await page.click('#A-from .mp-btn'); await page.selectOption('#A-from .mp-year', '2022');
  const disF = await page.$$eval('#A-from .mp-grid button', b => b.map(x => x.disabled));
  if (!(!disF[5] && disF[6])) failures.push('From calendar allows months after To: ' + disF); else count('start-after-end blocked');
  await page.keyboard.press('Escape');
  if (await page.$('#A-presets, #B-presets')) failures.push('period presets still present');
  for (const id of ['#A1-plan', '#A2-plan', '#A3-gap', '#A3-zero']) { await page.click(id); await page.click(id); count('checkboxes', 2); }
  await page.click('#A3-play'); await page.waitForTimeout(1500); await page.click('#A3-play'); count('play/pause', 2);
  await page.$eval('#A3-scrub', el => { el.value = 2; el.dispatchEvent(new Event('input')); });
  await page.click('#A-reset'); await page.waitForTimeout(400);
  // empty state
  for (const t of [1, 2, 3, 4]) await page.click(`#A-types .chip[data-t="${t}"]`);
  if (!(await page.isVisible('#A-empty'))) failures.push('tab A empty state not shown'); else count('empty state');
  await page.click('#A-reset2'); await page.waitForTimeout(400);

  // ---------------- tab B
  await tab('B');
  const boardStatus = await page.$$eval('#B-board .frow:not(.fhead) .st .status', els => els.map(e => e.textContent.trim()));
  const engineStatus = await page.evaluate(() => Object.values(window.DD.tabs.B.results).map(r => r.res.status));
  if (JSON.stringify(boardStatus.filter(s => s !== 'WORTH WATCHING')) !== JSON.stringify(engineStatus)) failures.push(`board statuses ${boardStatus} vs engine ${engineStatus}`);
  await page.click('#B-expand'); await page.waitForTimeout(800); count('expand all');
  for (const k of ['B1', 'B2', 'B3', 'B4', 'B5', 'B6']) { await clickAll(`#${k}-card`, '.seg button', 'toggles', 200); await cycleSelects(`#${k}-card`); }
  await page.fill('#B2-plan', '250'); await page.dispatchEvent('#B2-plan', 'change'); count('planned-hours input');
  await drawers('#tab-B');
  await page.click('#B-stats button[data-k="on"]'); await page.click('#B-stats button[data-k="off"]'); count('statistics switch', 2);
  await clickAll('#tab-B', '#B-data button', 'data toggle', 400);
  await pick('B', 'from', 2019, 1); await pick('B', 'to', 2024, 12);
  const perB = await page.evaluate(() => [window.DD.fmt.ymIso(window.DD.state.A.from), window.DD.fmt.ymIso(window.DD.state.A.to)]);
  if (perB.join() !== '2019-01,2024-12') failures.push('tab B calendar pick gave ' + perB);
  await page.click('#B-data button[data-k="all"]');
  await page.click('#B-expand'); count('collapse all');
  for (const k of ['B1', 'B3']) { await page.click(`#${k}-row`); await page.click(`#${k}-row`); count('accordion rows', 2); }

  // ---------------- tab C
  await tab('C'); await page.waitForTimeout(800);
  await clickAll('#tab-C', '#C-scen button', 'scenarios', 300);
  await clickAll('#tab-C', '.card .seg button', 'toggles', 300);
  await cycleSelects('#C1'); await cycleSelects('#M2');
  await page.click('#C-scen button[data-k="average"]');
  await clickAll('#tab-C', '.built-on', 'built-on chips', 300);
  await drawers('#tab-C');
  if (await page.$('#C-stats')) failures.push('tab C still has a Statistics switch');
  await page.click('#M2-start button[data-k="auto"]'); await page.click('#M2-shape button[data-k="auto"]');

  // ---------------- tab D: one upload and a reset
  await tab('D');
  if (cases && fs.existsSync(path.join(cases, 'builtin.csv'))) {
    await page.setInputFiles('#D-file', path.join(cases, 'builtin.csv')); await page.waitForTimeout(800);
    const msg = await page.textContent('#D-msg'); if (!/Data loaded/.test(msg)) failures.push('upload of built-in CSV failed'); else count('uploads');
    for (const k of ['A', 'B', 'C']) await tab(k);
    await tab('D'); await page.click('#D-reset'); await page.waitForTimeout(600); count('reset');
  }

  // ---------------- screenshots of every section at 1440 and 1024
  fs.mkdirSync(SHOTS, { recursive: true });
  fs.readdirSync(SHOTS).filter(f => f.endsWith('.png')).forEach(f => fs.unlinkSync(path.join(SHOTS, f)));
  for (const w of [1440, 1024]) {
    await page.setViewportSize({ width: w, height: 1000 });
    await page.goto('about:blank'); await page.goto(FILE + '#tab=A'); await page.waitForTimeout(1500);
    await page.addStyleTag({ content: '.bar { position: static !important; }' }); // sticky bars would cover section screenshots
    const shoot = async (sel, name) => { const el = await page.$(sel); if (!el) { failures.push('missing section ' + sel); return; } await el.scrollIntoViewIfNeeded(); await page.waitForTimeout(250); await el.screenshot({ path: path.join(SHOTS, `${name}_${w}.png`) }); count('screenshots'); };
    for (const [s, n] of [['#A-bar', 'A0_controls'], ['#A-kpi', 'A0_kpi'], ['#A1', 'A1'], ['#A2', 'A2'], ['#A3', 'A3'], ['#A5', 'A5'], ['#A4', 'A4']]) await shoot(s, n);
    await tab('B'); await page.evaluate(() => window.scrollTo(0, 0)); await shoot('#B-board', 'B0_board');
    await page.click('#B-expand'); await page.waitForTimeout(1500);
    for (const k of ['B1', 'B2', 'B3', 'B4', 'B5', 'B6']) await shoot(`#${k}-card`, k);
    await tab('C'); await page.waitForTimeout(1200);
    for (const k of ['M1', 'M2', 'C1', 'C2', 'C3', 'C4']) await shoot('#' + k, k);
    await tab('D'); await shoot('#tab-D', 'D');
  }
  // tablet/phone layout: no horizontal scroll at 1024 and 820
  for (const w of [1024, 820]) {
    await page.setViewportSize({ width: w, height: 1000 });
    for (const k of ['A', 'B', 'C', 'D']) { await tab(k); const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); if (over > 2) failures.push(`tab ${k} scrolls sideways at ${w}px (${over}px)`); }
  }
  await browser.close();
  console.log('Interactions:'); Object.entries(counts).forEach(([k, v]) => console.log('  ' + k.padEnd(22), v));
  console.log('Blocked network requests:', blocked.length);
  console.log('Console errors:', errors.length); errors.forEach(e => console.log('   ', e));
  console.log('Failures:', failures.length); failures.forEach(f => console.log('   ', f));
  process.exit(errors.length || failures.length || blocked.length ? 1 : 0);
})();
