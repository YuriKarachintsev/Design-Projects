// Screenshot sections of dist/dashboard.html offline.  node tests/shoot.js <tab> <width> [outdir]
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright');
(async () => {
  const [tab = 'A', width = '1440', out = path.join(__dirname, '..', 'screenshots')] = process.argv.slice(2);
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: +width, height: 1000 }, offline: true, deviceScaleFactor: 1 });
  await ctx.route('**/*', r => r.request().url().startsWith('file://') || r.request().url().startsWith('data:') || r.request().url().startsWith('blob:') ? r.continue() : r.abort());
  const p = await ctx.newPage(), errs = [];
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + path.join(__dirname, '..', 'dist', 'dashboard.html') + '#tab=' + tab);
  await p.waitForTimeout(1500);
  const secs = await p.$$eval(`#tab-${tab} > .bar, #tab-${tab} > div > .board, #tab-${tab} .card[id], #tab-${tab} > .findings, #tab-${tab} > .subhead`, els => els.map(e => e.id || e.className));
  await p.screenshot({ path: path.join(out, `${tab}_full_${width}.png`), fullPage: true });
  console.log('errors:', errs.length); errs.forEach(e => console.log('  ', e));
  await b.close();
})();
