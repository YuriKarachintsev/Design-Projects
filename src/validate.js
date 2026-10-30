/* Upload validation for tab D: a simple pass/fail gate with the same rules as build.py.
 * Input: a header row plus data rows (array of arrays) from SheetJS or the CSV parser.
 * Output: { ok: true, rows } with canonical rows, or { ok: false }. No per-row reports. */
(function () {
  'use strict';
  const DD = window.DD;
  const REQUIRED = ['Prj ID', 'Project Name', 'Project type', 'Region', 'Designer', 'Years of experience', 'Education',
    'Start date', 'Start month', 'Start year', 'Actual', 'Planned', 'Hourly rate'];
  const TYPES = ['System type 1', 'System type 2', 'System type 3', 'System type 4'];
  const REGIONS = ['North', 'East', 'South', 'West'];
  const EDUS = ['High school', 'Bachelor degree', 'Master degree'];
  const NUM = /^-?\d+(\.\d+)?([eE][-+]?\d+)?$/;
  const DATE = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/;
  class Corrupt extends Error {}
  const fail = () => { throw new Corrupt(); };
  const norm = h => String(h === null || h === undefined ? '' : h).trim().toLowerCase();
  const empty = v => v === null || v === undefined || (typeof v === 'number' && !Number.isFinite(v)) || (typeof v === 'string' && !v.trim());
  const num = v => {
    if (typeof v === 'number') return Number.isFinite(v) ? v : fail();
    const s = String(v).trim();
    return NUM.test(s) ? parseFloat(s) : fail();
  };
  const pad = n => String(n).padStart(2, '0');
  /** Excel serial (1900 system) or yyyy-mm-dd[ hh:mm[:ss]] text -> {y, m, d, H, M}. */
  function date(v, isExcel) {
    if (typeof v === 'number' && isExcel && window.XLSX) {
      const p = XLSX.SSF.parse_date_code(v);
      if (!p || !p.y) fail();
      return { y: p.y, m: p.m, d: p.d, H: p.H, M: p.M };
    }
    if (v instanceof Date && !isNaN(v)) return { y: v.getFullYear(), m: v.getMonth() + 1, d: v.getDate(), H: v.getHours(), M: v.getMinutes() };
    const m = DATE.exec(String(v).trim());
    if (!m) fail();
    const y = +m[1], mo = +m[2], d = +m[3], H = +(m[4] || 0), Mi = +(m[5] || 0), Se = +(m[6] || 0);
    const t = new Date(Date.UTC(y, mo - 1, d, H, Mi, Se));
    if (t.getUTCFullYear() !== y || t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d || H > 23 || Mi > 59 || Se > 59) fail();
    return { y, m: mo, d, H, M: Mi };
  }

  function validate(aoa, opts = {}) {
    try {
      aoa = (aoa || []).slice();
      while (aoa.length && (!aoa[aoa.length - 1] || aoa[aoa.length - 1].every(empty))) aoa.pop();
      if (aoa.length < 2 || aoa.length - 1 > DD.cfg.MAX_UPLOAD_ROWS) fail();
      const head = aoa[0].map(norm), col = {};
      head.forEach((h, i) => { if (h && col[h] === undefined) col[h] = i; });
      REQUIRED.forEach(r => { if (col[norm(r)] === undefined) fail(); });
      const src = col.source;
      const rates = Object.keys(DD.cfg.LOCATION_BY_RATE).map(Number);
      const ids = new Set(), prof = new Map(), rows = [];
      for (let i = 1; i < aoa.length; i++) {
        const rec = aoa[i];
        if (!rec || rec.every(empty)) fail();
        const g = {};
        REQUIRED.forEach(r => { const v = rec[col[norm(r)]]; if (empty(v)) fail(); g[r] = v; });
        const id = String(g['Prj ID']).trim();
        if (ids.has(id)) fail();
        ids.add(id);
        const type = String(g['Project type']).trim(), region = String(g.Region).trim(), edu = String(g.Education).trim();
        if (!TYPES.includes(type) || !REGIONS.includes(region) || !EDUS.includes(edu)) fail();
        const d = date(g['Start date'], opts.excel);
        const month = num(g['Start month']), year = num(g['Start year']);
        if (month !== d.m || year !== d.y) fail();
        const yrs = num(g['Years of experience']);
        if (!Number.isInteger(yrs) || yrs < 0 || yrs > 60) fail();
        const actual = num(g.Actual), planned = num(g.Planned), rate = num(g['Hourly rate']);
        if (actual < 0 || !(planned > 0) || !rates.includes(rate)) fail();
        const des = String(g.Designer).trim(), key = `${rate}|${edu}|${yrs}`;
        if (prof.has(des) && prof.get(des) !== key) fail();
        prof.set(des, key);
        const s = src !== undefined && !empty(rec[src]) ? String(rec[src]).trim() : 'Uploaded';
        rows.push({ id, name: String(g['Project Name']).trim(), type, region, designer: des, yrs, edu,
          date: `${d.y}-${pad(d.m)}-${pad(d.d)} ${pad(d.H)}:${pad(d.M)}`, month, year, actual, planned, rate, source: s });
      }
      if (!rows.length) fail();
      return { ok: true, rows };
    } catch (e) {
      if (e instanceof Corrupt) return { ok: false };
      return { ok: false, error: String(e) };
    }
  }

  /** Strict CSV parser: UTF-8, comma-separated, double-quoted fields, header in row 1. */
  function parseCSV(text) {
    const rows = []; let row = [], cur = '', q = false;
    text = text.replace(/^﻿/, '');
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
      else if (ch === '"') q = true;
      else if (ch === ',') { row.push(cur); cur = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; rows.push(row); row = []; }
      else cur += ch;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows.filter(r => !(r.length === 1 && r[0] === ''));
  }

  /** Read a File into rows. Resolves to { ok, rows } (never throws). */
  async function readFile(file) {
    const name = (file && file.name || '').toLowerCase();
    const ext = name.slice(name.lastIndexOf('.'));
    if (!file || file.size > DD.cfg.MAX_UPLOAD_MB * 1024 * 1024 || !['.xlsx', '.xls', '.csv'].includes(ext)) return { ok: false };
    try {
      if (ext === '.csv') return validate(parseCSV(await file.text()), { excel: false });
      const wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array', cellDates: false, raw: true });
      const sheet = wb.SheetNames.find(s => s.trim().toLowerCase() === 'sheet1') || wb.SheetNames[0];
      const aoa = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, raw: true, defval: null, blankrows: true });
      return validate(aoa, { excel: true });
    } catch (e) { return { ok: false }; }
  }

  DD.REQUIRED = REQUIRED;
  DD.validate = validate;
  DD.parseCSV = parseCSV;
  DD.readFile = readFile;
  DD.CORRUPT = 'The data is corrupt: the file does not match the required format. Nothing was changed.';
})();
