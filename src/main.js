/* Boot: load the built-in data, build the tabs, route between them and keep the footer note current. */
(function () {
  const DD = window.DD, F = DD.fmt;
  function footer() {
    const d = DD.data, m = DD.meta, c = DD.cfg;
    const cfgRows = Object.entries(c).filter(([k]) => !['MAX_UPLOAD_MB', 'MAX_UPLOAD_ROWS'].includes(k)).map(([k, v]) => `<div>${k} = ${DD.esc(typeof v === 'object' ? JSON.stringify(v) : v)}</div>`).join('');
    document.getElementById('footer').innerHTML = `<details><summary>Data &amp; assumptions</summary>
      <p>${m.uploaded ? `Uploaded file <b>${DD.esc(m.file)}</b> (${DD.esc(m.when)})` : `Built-in file <b>${DD.esc(m.file)}</b>`}: ${F.n(d.all.length)} projects started ${F.ym(d.minYM)} – ${F.ym(d.maxYM)}.
      ${F.n(d.nZero)} projects have Actual = 0 (probably cancelled or not booked) and are left out of every ratio, test, model and of the Overview, leaving ${F.n(d.valid.length)}${c.ZERO_ACTUAL_IN_VOLUMES ? '; as opened projects they still count in the volume trends (M2) and workload shares (C2, C3)' : ''}.
      Hours = value ÷ the designer's hourly rate; the rate identifies the designer's home location (${Object.entries(c.LOCATION_BY_RATE).map(([r, l]) => `${r} ${l}`).join(', ')}). ${c.PARTIAL_YEAR} covers Jan–${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][c.PARTIAL_LAST_MONTH - 1]} only.
      Synthetic rows are illustrative; "Original only" switches use Source = Original. Results describe associations in observational data, not causes.</p>
      ${m.notes && m.notes.length ? `<details><summary>Notes sheet</summary><ul>${m.notes.map(n => `<li>${DD.esc(n)}</li>`).join('')}</ul></details>` : ''}
      <div class="cfg">${cfgRows}</div></details>`;
  }
  function show(tab) {
    DD.state.tab = tab;
    document.querySelectorAll('#tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    document.querySelectorAll('section.tab').forEach(s => s.classList.toggle('on', s.id === 'tab-' + tab));
    if (DD.tabs.A.stop && tab !== 'A') DD.tabs.A.stop();
    const t = DD.tabs[tab];
    if (t && !t.built) { t.build(); t.update(true); t.built = true; }
    else if (t && t.dirty) { t.build(); t.update(true); t.dirty = false; }
    DD.writeHash();
    requestAnimationFrame(() => DD.resizeAll());
  }
  DD.show = show;
  DD.on('data', () => {
    DD.clampPeriod();
    footer();
    ['A', 'B', 'C', 'D'].forEach(k => { const t = DD.tabs[k]; if (t) { t.built = false; } });
    show(DD.state.tab);
  });
  document.querySelectorAll('#tabs button').forEach(b => b.addEventListener('click', () => show(b.dataset.tab)));
  document.getElementById('tabs').addEventListener('keydown', e => {
    const order = ['A', 'B', 'C', 'D'], i = order.indexOf(DD.state.tab);
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { const n = order[(i + (e.key === 'ArrowRight' ? 1 : 3)) % 4]; show(n); document.querySelector(`#tabs button[data-tab="${n}"]`).focus(); }
  });
  DD.readHash();
  let raw = window.DD_DATA.rows, meta = { file: window.DD_DATA.file, notes: window.DD_DATA.notes, uploaded: false };
  try { const saved = localStorage.getItem('dd-dataset'); if (saved) { const s = JSON.parse(saved); raw = s.rows; meta = s.meta; } } catch (e) { /* storage unavailable */ }
  DD.setDataset(raw, meta);
})();
