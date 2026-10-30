/* Tab D · Data: upload a new dataset (pass/fail validation), templates, reset to built-in data. */
(function () {
  const DD = window.DD, F = DD.fmt;
  const root = () => document.getElementById('tab-D');
  let message = null; // { kind: 'ok' | 'err', html }
  let rememberPref = null; // the checkbox choice, kept across rebuilds

  const FORMAT = [
    ['Prj ID', 'Text or number', 'Unique for every row'],
    ['Project Name', 'Text', 'Not empty'],
    ['Project type', 'Text', 'System type 1, System type 2, System type 3 or System type 4'],
    ['Region', 'Text', 'North, East, South or West (the project\'s region)'],
    ['Designer', 'Text', 'Each designer has a single hourly rate, education and years of experience'],
    ['Years of experience', 'Whole number', '0 – 60, measured as of ' + DD.cfg.EXPERIENCE_AS_OF],
    ['Education', 'Text', 'High school, Bachelor degree or Master degree'],
    ['Start date', 'Date', 'An Excel date, or yyyy-mm-dd / yyyy-mm-dd hh:mm in CSV'],
    ['Start month', 'Whole number', 'Equals the month of Start date'],
    ['Start year', 'Whole number', 'Equals the year of Start date'],
    ['Actual', 'Number', `≥ 0, cost in ${DD.cfg.CURRENCY}`],
    ['Planned', 'Number', `> 0, cost in ${DD.cfg.CURRENCY}`],
    ['Hourly rate', 'Number', 'One of ' + Object.keys(DD.cfg.LOCATION_BY_RATE).join(', ')],
    ['Source', 'Text (optional)', 'Original, Synthetic, Synthetic top-up …; missing → "Uploaded"'],
  ];
  const EXAMPLE = [
    ['ID9001', 'Harbour Gate Terminal Upgrade', 'System type 1', 'North', 'Example Designer A', 12, 'Bachelor degree', '2026-01-15 09:30', 1, 2026, 18250.5, 21000, 74, 'Uploaded'],
    ['ID9002', 'Ridgeway Cargo Hall Extension', 'System type 2', 'East', 'Example Designer B', 25, 'Master degree', '2026-02-03 14:00', 2, 2026, 9800, 9800, 86, 'Uploaded'],
    ['ID9003', 'Lakeside Apron Lighting', 'System type 3', 'South', 'Example Designer A', 12, 'Bachelor degree', '2026-03-20 08:15', 3, 2026, 0, 6400, 74, 'Uploaded'],
  ];
  const HEADER = DD.REQUIRED.concat(['Source']);

  function chip() {
    const d = DD.data, m = DD.meta;
    return m.uploaded ? `<span class="label" style="display:block">Current data</span><b>${DD.esc(m.file)}</b> · ${F.n(d.all.length)} projects · uploaded ${DD.esc(m.when)}`
      : `<span class="label" style="display:block">Current data</span><b>${DD.esc(m.file)}</b> (built in) · ${F.n(d.all.length)} projects · ${F.ym(d.minYM)} – ${F.ym(d.maxYM)}`;
  }

  function build() {
    const el = root();
    if (rememberPref === null) { rememberPref = false; try { rememberPref = !!localStorage.getItem('dd-dataset'); } catch (e) { /* storage unavailable */ } }
    const remembered = rememberPref;
    el.innerHTML = `
      <div class="subhead" style="margin-top:24px"><span class="gate">D</span><h2 class="section-title">Load a new dataset</h2><span class="rule"></span></div>
      <div class="grid">
        <div class="card c7">
          <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between"><div class="data-chip" id="D-chip" style="display:block;line-height:1.6">${chip()}</div>
            <button class="btn" id="D-reset" ${DD.meta.uploaded ? '' : 'disabled'}>Reset to built-in data</button></div>
          <div id="D-msg" aria-live="polite">${message ? `<div class="msg ${message.kind}" role="${message.kind === 'err' ? 'alert' : 'status'}">${message.html}</div>` : ''}</div>
          <div class="drop" id="D-drop" style="margin-top:16px">
            <div style="font:600 18px var(--f-title);letter-spacing:.1em;text-transform:uppercase">Drop a file here</div>
            <p class="muted" style="margin:6px 0 14px">.xlsx, .xls or .csv · up to ${DD.cfg.MAX_UPLOAD_MB} MB and ${F.n(DD.cfg.MAX_UPLOAD_ROWS)} rows</p>
            <label class="btn ink" for="D-file" style="display:inline-block">Upload file</label><input type="file" id="D-file" accept=".xlsx,.xls,.csv" class="sr-only">
          </div>
          <label style="display:block;margin-top:12px;font-size:13px"><input type="checkbox" id="D-remember" ${remembered ? 'checked' : ''} style="vertical-align:-2px;margin-right:6px">Remember on this computer <span class="muted">· kept in this browser only; the dashboard works without it</span></label>
          <p class="muted" style="font-size:13px;margin-top:14px">The file is checked against the required format below. If it passes, every tab is updated: the Overview filters are reset, and the tests and models are recalculated from the new rows. If anything does not match, nothing changes. Projects with Actual = 0 are kept in the file but left out of ratios, tests and models.</p>
        </div>
        <div class="card c5">
          <div class="card-head"><div class="ttl"><h3 class="card-title">Templates</h3></div></div>
          <p class="muted" style="font-size:13px">The header row and 3 example rows, ready to fill in.</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="D-tpl-xlsx">Download template (.xlsx)</button><button class="btn" id="D-tpl-csv">Download template (.csv)</button></div>
          <div class="label" style="margin:18px 0 6px">File rules</div>
          <ul style="font-size:13px;margin:0;padding-left:18px;color:var(--ink-2)">
            <li>.xlsx / .xls: the sheet named "Sheet1" if present, otherwise the first sheet.</li>
            <li>.csv: UTF-8, comma-separated, header in row 1, dot as decimal separator.</li>
            <li>Max ${DD.cfg.MAX_UPLOAD_MB} MB, max ${F.n(DD.cfg.MAX_UPLOAD_ROWS)} rows, at least 1 data row.</li>
            <li>Headers must match exactly, ignoring upper/lower case and surrounding spaces; any order; extra columns are ignored.</li>
            <li>No empty cell in a required column.</li>
          </ul>
        </div>
      </div>
      <div class="card" id="D-format">
        <div class="card-head"><div class="ttl"><h3 class="card-title">Required format</h3></div></div>
        <div class="tbl-scroll"><table class="plain"><thead><tr><th>Column</th><th style="text-align:left">Type</th><th style="text-align:left">Rule</th></tr></thead><tbody>
        ${FORMAT.map(([c, t, r]) => `<tr><td><b>${c}</b></td><td style="text-align:left;font-family:var(--f-body)">${t}</td><td style="text-align:left;font-family:var(--f-body);white-space:normal">${DD.esc(r)}</td></tr>`).join('')}
        </tbody></table></div>
      </div>`;
    wire();
  }

  function wire() {
    const el = root(), drop = el.querySelector('#D-drop'), input = el.querySelector('#D-file');
    input.addEventListener('change', () => { if (input.files[0]) load(input.files[0]); input.value = ''; });
    ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', e => { const f = e.dataTransfer && e.dataTransfer.files[0]; if (f) load(f); });
    el.querySelector('#D-reset').addEventListener('click', resetBuiltIn);
    el.querySelector('#D-remember').addEventListener('change', e => { rememberPref = e.target.checked; remember(rememberPref); });
    el.querySelector('#D-tpl-csv').addEventListener('click', () => download('dashboard_template.csv', new Blob(['﻿' + [HEADER].concat(EXAMPLE).map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' })));
    el.querySelector('#D-tpl-xlsx').addEventListener('click', () => {
      const ws = XLSX.utils.aoa_to_sheet([HEADER].concat(EXAMPLE.map(r => r.map((v, i) => (i === 7 ? toSerial(v) : v)))));
      Object.keys(ws).filter(k => /^H\d+$/.test(k) && k !== 'H1').forEach(k => { ws[k].z = 'yyyy-mm-dd hh:mm'; });
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
      download('dashboard_template.xlsx', new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    });
  }
  const csvCell = v => { const s = String(v); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  /** 'yyyy-mm-dd hh:mm' -> Excel serial date (1900 system). */
  function toSerial(s) { const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(s); return (Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) - Date.UTC(1899, 11, 30)) / 864e5; }
  function download(name, blob) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  async function load(file) {
    const res = await DD.readFile(file);
    if (!res.ok) {
      message = { kind: 'err', html: `${DD.CORRUPT} <a href="#" id="D-to-format">See the required format</a>.` };
      showMessage();
      return;
    }
    const when = new Date();
    const meta = { file: file.name, uploaded: true, when: `${when.toISOString().slice(0, 10)} ${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}`, notes: [] };
    applyDataset(res.rows, meta);
    const d = DD.data;
    message = { kind: 'ok', html: `Data loaded: ${F.n(d.all.length)} projects, ${F.ym(d.minYM)} – ${F.ym(d.maxYM)} start dates. All tabs updated.` };
    if (rememberPref) remember(true);
    build();
  }
  function applyDataset(rows, meta) {
    const st = DD.state.A;
    Object.assign(st, { from: null, to: null, types: [1, 2, 3, 4], regions: ['North', 'East', 'South', 'West'], gran: 'monthly', attr: 'start' });
    DD.state.B.open = [];
    DD.setDataset(rows, meta); // recomputes everything and rebuilds the tabs on next view
  }
  function resetBuiltIn() {
    rememberPref = false;
    remember(false);
    applyDataset(window.DD_DATA.rows, { file: window.DD_DATA.file, notes: window.DD_DATA.notes, uploaded: false });
    message = { kind: 'ok', html: `Built-in data restored: ${F.n(DD.data.all.length)} projects. All tabs updated.` };
    build();
  }
  function remember(on) {
    try {
      if (on && DD.meta.uploaded) localStorage.setItem('dd-dataset', JSON.stringify({ rows: DD.raw, meta: DD.meta }));
      else if (!on) localStorage.removeItem('dd-dataset');
    } catch (e) {
      message = { kind: 'err', html: 'This browser could not store the file (storage is off or full). The data stays loaded for this session.' };
      showMessage();
    }
  }
  function showMessage() {
    const box = root().querySelector('#D-msg');
    box.innerHTML = message ? `<div class="msg ${message.kind}" role="${message.kind === 'err' ? 'alert' : 'status'}">${message.html}</div>` : '';
    const link = box.querySelector('#D-to-format');
    if (link) link.addEventListener('click', e => { e.preventDefault(); root().querySelector('#D-format').scrollIntoView({ behavior: DD.reducedMotion ? 'auto' : 'smooth' }); });
  }

  DD.tabs.D = { build, update() {}, load, resetBuiltIn };
})();
