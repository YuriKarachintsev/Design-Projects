/* Statistics library for the dashboard: means, standard deviations, standard errors, the simple
 * two-group test of tab B (t-stat against the critical value 1.96, normal p-value, 95% CI) and OLS
 * with ordinary standard errors. Every test, confidence interval and range uses the normal
 * distribution (jStat). Runs in the browser and in Node for verification against
 * analysis/reference_stats.py. */
(function (root) {
  'use strict';
  const jStat = root.jStat || (typeof require === 'function' ? require('../vendor/jstat.min.js') : null);
  let CRIT = 1.96;                      // config CRITICAL_VALUE (5%, two-sided)
  const Z80 = 1.2815515655446004;       // normal value for an 80% range (z at 0.90)

  const sum = a => { let s = 0; for (const v of a) s += v; return s; };
  const mean = a => a.length ? sum(a) / a.length : NaN;
  const variance = a => { if (a.length < 2) return NaN; const m = mean(a); let s = 0; for (const v of a) s += (v - m) * (v - m); return s / (a.length - 1); };
  const sd = a => Math.sqrt(variance(a));
  const clamp01 = p => (Number.isFinite(p) ? Math.min(1, Math.max(0, p)) : p);
  const Phi = z => jStat.normal.cdf(z, 0, 1);
  const pValue = t => (Number.isFinite(t) ? clamp01(2 * (1 - Phi(Math.abs(t)))) : NaN);
  const normInv = p => jStat.normal.inv(p, 0, 1);
  const pChi2 = (x, df) => (Number.isFinite(x) && df > 0 ? clamp01(1 - jStat.chisquare.cdf(x, df)) : NaN);

  /** Empirical quantile, linear interpolation (numpy default). */
  function quantile(arr, p) {
    const a = arr.filter(Number.isFinite).sort((x, y) => x - y);
    if (!a.length) return NaN;
    const h = (a.length - 1) * p, lo = Math.floor(h), hi = Math.ceil(h);
    return a[lo] + (h - lo) * (a[hi] - a[lo]);
  }
  const median = a => quantile(a, 0.5);

  /** Mean, SD and SE of a sample. SE = s/√n, or √(p(1-p)/n) for a share of 0/1 values. */
  function describe(v, proportion) {
    const n = v.length, m = mean(v), s = sd(v);
    return { n, mean: m, sd: s, se: proportion ? Math.sqrt(m * (1 - m) / n) : s / Math.sqrt(n) };
  }

  /** The simple test: H0 difference = 0. SE_diff = √(SE₁² + SE₂²), t = diff / SE_diff,
   * p = 2(1 - Φ(|t|)), 95% CI = diff ± 1.96·SE_diff, reject if p < alpha. */
  function test(m1, se1, m2, se2, alpha = 0.05) {
    const diff = m1 - m2, seDiff = Math.sqrt(se1 * se1 + se2 * se2), t = diff / seDiff, p = pValue(t);
    return { diff, seDiff, t, crit: CRIT, p, lo: diff - CRIT * seDiff, hi: diff + CRIT * seDiff, reject: p < alpha };
  }

  /** Each group against the rest of the data. values / labels: one entry per unit.
   * Groups with n < minN are shown but not tested (limited). */
  function vsRest(values, labels, levels, opts = {}) {
    const minN = opts.minN || 30, alpha = opts.alpha || 0.05;
    return levels.filter(l => labels.some(x => x === l)).map(l => {
      const a = values.filter((_, i) => labels[i] === l), b = values.filter((_, i) => labels[i] !== l);
      const g = describe(a, opts.proportion), r = describe(b, opts.proportion);
      const out = { level: l, n: g.n, mean: g.mean, sd: g.sd, se: g.se, lo95: g.mean - CRIT * g.se, hi95: g.mean + CRIT * g.se,
        restN: r.n, restMean: r.mean, restSE: r.se, limited: g.n < minN };
      if (!out.limited && r.n >= 2) Object.assign(out, test(g.mean, g.se, r.mean, r.se, alpha));
      return out;
    });
  }

  /** Delta-method SE of a ratio of totals R = ΣA/ΣP: √(Σ(Aᵢ - R·Pᵢ)² / (n(n - 1))) / P̄. */
  function ratioSE(A, P) {
    const n = A.length, R = sum(A) / sum(P);
    if (n < 2) return { R, se: NaN, n };
    let s = 0; for (let i = 0; i < n; i++) s += (A[i] - R * P[i]) ** 2;
    return { R, se: Math.sqrt(s / (n * (n - 1))) / mean(P), n };
  }

  // ------------------------------------------------------------------ OLS
  function invert(A) {
    const n = A.length, M = A.map((row, i) => row.concat(Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))));
    for (let c = 0; c < n; c++) {
      let piv = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
      if (Math.abs(M[piv][c]) < 1e-12) throw new Error('singular matrix');
      [M[c], M[piv]] = [M[piv], M[c]];
      const d = M[c][c]; for (let j = 0; j < 2 * n; j++) M[c][j] /= d;
      for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c]; if (f) for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[c][j]; }
    }
    return M.map(row => row.slice(n));
  }
  /** OLS with ordinary standard errors SE = √(s²·(X'X)⁻¹), s² = SSE/(n - k). For each coefficient:
   * t-stat = b / SE, p from the normal distribution, 95% CI = b ± 1.96·SE, reject if p < alpha. */
  function ols(y, X, names, alpha = 0.05) {
    const n = y.length, k = X[0].length;
    const XtX = Array.from({ length: k }, () => new Array(k).fill(0)), Xty = new Array(k).fill(0);
    for (let i = 0; i < n; i++) { const xi = X[i]; for (let a = 0; a < k; a++) { Xty[a] += xi[a] * y[i]; for (let b = a; b < k; b++) XtX[a][b] += xi[a] * xi[b]; } }
    for (let a = 0; a < k; a++) for (let b = 0; b < a; b++) XtX[a][b] = XtX[b][a];
    const XtXi = invert(XtX);
    const b = XtXi.map(row => row.reduce((s, v, j) => s + v * Xty[j], 0));
    const fitted = X.map(xi => xi.reduce((s, v, j) => s + v * b[j], 0));
    const e = y.map((v, i) => v - fitted[i]);
    const sse = sum(e.map(v => v * v)), my = mean(y), sst = sum(y.map(v => (v - my) ** 2));
    const r2 = 1 - sse / sst, adjR2 = 1 - (1 - r2) * (n - 1) / (n - k), s2 = sse / (n - k);
    const se = XtXi.map((row, i) => Math.sqrt(row[i] * s2));
    const coefs = b.map((v, i) => { const t = v / se[i], p = pValue(t); return { name: names[i], b: v, se: se[i], t, crit: CRIT, p, lo: v - CRIT * se[i], hi: v + CRIT * se[i], reject: p < alpha }; });
    return { b, se, coefs, e, fitted, r2, adjR2, s2, resSD: Math.sqrt(s2), n, k, names, XtXi };
  }

  /** Variance inflation factors for the non-constant columns. */
  function vif(X, names) {
    const out = [];
    for (let j = 1; j < X[0].length; j++) {
      const y = X.map(r => r[j]), Zm = X.map(r => r.filter((_, c) => c !== j));
      try { out.push({ name: names[j], vif: 1 / (1 - ols(y, Zm, names.filter((_, c) => c !== j)).r2) }); } catch (e) { out.push({ name: names[j], vif: Infinity }); }
    }
    return out;
  }
  /** Breusch-Pagan (Koenker) test: n·R² of e² on X, compared with χ²(k - 1). */
  function breuschPagan(fit, X) {
    const LM = fit.n * ols(fit.e.map(v => v * v), X, fit.names).r2;
    return { LM, df: fit.k - 1, p: pChi2(LM, fit.k - 1) };
  }
  /** Cook's distance per observation. */
  function cooks(fit, X) {
    return X.map((xi, i) => {
      let h = 0; for (let a = 0; a < fit.k; a++) for (let c = 0; c < fit.k; c++) h += xi[a] * fit.XtXi[a][c] * xi[c];
      return fit.e[i] ** 2 / (fit.k * fit.s2) * h / (1 - h) ** 2;
    });
  }
  const durbinWatson = e => { let num = 0; for (let i = 1; i < e.length; i++) num += (e[i] - e[i - 1]) ** 2; return num / sum(e.map(v => v * v)); };
  const setCritical = c => { CRIT = c; };

  const api = { Z80, get CRIT() { return CRIT; }, setCritical, sum, mean, variance, sd, quantile, median, describe, test, vsRest, ratioSE,
    invert, ols, vif, breuschPagan, cooks, durbinWatson, Phi, pValue, normInv };
  root.DDStats = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
