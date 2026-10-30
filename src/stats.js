/* Statistics library for the dashboard (standard-error method, normal distribution only).
 * Runs in the browser and in Node (for verification against analysis/reference_stats.py).
 * Distributions (normal, chi-square) come from jStat; there is no t distribution anywhere. */
(function (root) {
  'use strict';
  const jStat = root.jStat || (typeof require === 'function' ? require('../vendor/jstat.min.js') : null);
  const Z = 1.96;               // 95% two-sided critical value (config Z_CRIT)
  const Z80 = 1.2815515655446004; // z(0.90), for 80% ranges

  const sum = a => { let s = 0; for (const v of a) s += v; return s; };
  const mean = a => a.length ? sum(a) / a.length : NaN;
  const variance = (a, ddof = 1) => { if (a.length - ddof <= 0) return NaN; const m = mean(a); let s = 0; for (const v of a) s += (v - m) * (v - m); return s / (a.length - ddof); };
  const sd = a => Math.sqrt(variance(a));
  function clamp01(p) { return Number.isFinite(p) ? Math.min(1, Math.max(0, p)) : p; }
  const Phi = z => jStat.normal.cdf(z, 0, 1);
  const pNorm = z => Number.isFinite(z) ? clamp01(2 * (1 - Phi(Math.abs(z)))) : NaN;   // two-sided
  const pChi2 = (x, df) => Number.isFinite(x) && df > 0 ? clamp01(1 - jStat.chisquare.cdf(x, df)) : NaN;
  const normInv = p => jStat.normal.inv(p, 0, 1);

  /** Empirical quantile, linear interpolation (numpy default / type 7). */
  function quantile(arr, p) {
    const a = arr.filter(Number.isFinite).sort((x, y) => x - y);
    if (!a.length) return NaN;
    const h = (a.length - 1) * p, lo = Math.floor(h), hi = Math.ceil(h);
    return a[lo] + (h - lo) * (a[hi] - a[lo]);
  }
  const median = a => quantile(a, 0.5);

  /** Holm step-down adjustment. */
  function holm(ps) {
    const m = ps.length, order = ps.map((p, i) => i).sort((i, j) => ps[i] - ps[j]);
    const adj = new Array(m); let run = 0;
    order.forEach((i, k) => { run = Math.max(run, Math.min(1, (m - k) * ps[i])); adj[i] = run; });
    return adj;
  }

  // ------------------------------------------------------------------ linear algebra
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
  const matMul = (A, B) => A.map(row => B[0].map((_, j) => row.reduce((s, v, k) => s + v * B[k][j], 0)));

  /** OLS. X: rows of predictors (include a constant if wanted). With clusters, the covariance is
   * CR1 cluster-robust: G/(G-1)·(n-1)/(n-k)·(X'X)⁻¹ M (X'X)⁻¹. Inference uses the normal distribution:
   * z = b / SE, p = 2(1 - Φ(|z|)), 95% CI = b ± 1.96·SE. */
  function ols(y, X, names, clusters) {
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
    let V, G = null;
    if (clusters) {
      const groups = new Map();
      clusters.forEach((g, i) => { if (!groups.has(g)) groups.set(g, new Array(k).fill(0)); const s = groups.get(g); for (let a = 0; a < k; a++) s[a] += X[i][a] * e[i]; });
      G = groups.size;
      const meat = Array.from({ length: k }, () => new Array(k).fill(0));
      groups.forEach(s => { for (let a = 0; a < k; a++) for (let c = 0; c < k; c++) meat[a][c] += s[a] * s[c]; });
      const c = G / (G - 1) * (n - 1) / (n - k);
      V = matMul(matMul(XtXi, meat), XtXi).map(row => row.map(v => v * c));
    } else V = XtXi.map(row => row.map(v => v * s2));
    const se = V.map((row, i) => Math.sqrt(row[i]));
    const coefs = b.map((v, i) => { const z = v / se[i]; return { name: names[i], b: v, se: se[i], z, p: pNorm(z), lo: v - Z * se[i], hi: v + Z * se[i] }; });
    return { b, V, se, coefs, e, fitted, r2, adjR2, s2, resSD: Math.sqrt(s2), n, k, G, names, XtXi };
  }

  /** Wald χ² test that the selected coefficients are all zero: χ² = b'(V)⁻¹b, df = number of coefficients. */
  function waldChi2(b, V, idx) {
    const q = idx.length;
    if (!q) return { chi2: NaN, df: 0, p: NaN };
    const rb = idx.map(i => b[i]), inv = invert(idx.map(i => idx.map(j => V[i][j])));
    let w = 0; for (let a = 0; a < q; a++) for (let c = 0; c < q; c++) w += rb[a] * inv[a][c] * rb[c];
    return { chi2: w, df: q, p: pChi2(w, q) };
  }
  /** Wald χ² test that k means are all equal (contrasts against the last mean), df = k - 1. */
  function waldEqual(m, V) {
    const k = m.length;
    if (k < 2) return { chi2: NaN, df: 0, p: NaN };
    const R = Array.from({ length: k - 1 }, (_, i) => m.map((_, j) => (j === i ? 1 : j === k - 1 ? -1 : 0)));
    const rb = R.map(r => r.reduce((s, v, j) => s + v * m[j], 0));
    const RVR = R.map(r1 => R.map(r2 => { let s = 0; for (let a = 0; a < k; a++) for (let c = 0; c < k; c++) s += r1[a] * V[a][c] * r2[c]; return s; }));
    let inv; try { inv = invert(RVR); } catch (e) { return { chi2: NaN, df: k - 1, p: NaN }; }
    let w = 0; for (let a = 0; a < k - 1; a++) for (let c = 0; c < k - 1; c++) w += rb[a] * inv[a][c] * rb[c];
    return { chi2: w, df: k - 1, p: pChi2(w, k - 1) };
  }
  /** Two-group z test: z = (a - b) / √(V_aa + V_bb - 2V_ab). */
  function zDiff(m, V, i, j) {
    const diff = m[i] - m[j], se = Math.sqrt(V[i][i] + V[j][j] - 2 * V[i][j]), z = diff / se;
    return { diff, se, z, p: pNorm(z), lo: diff - Z * se, hi: diff + Z * se };
  }

  /** Group means with both standard-error versions.
   * values: numbers; labels: group of each value; levels: group order; clusters: designer of each value.
   * proportion: use √(p̂(1-p̂)/n) as the project SE. Designer SE = CR1 from OLS on group indicators. */
  function groupMeans(values, labels, levels, clusters, opts = {}) {
    const present = levels.filter(l => labels.some(x => x === l));
    const groups = present.map(l => {
      const v = values.filter((_, i) => labels[i] === l);
      const n = v.length, m = mean(v), s = n > 1 ? sd(v) : NaN;
      return { level: l, n, mean: m, sd: s, seP: opts.proportion ? Math.sqrt(m * (1 - m) / n) : s / Math.sqrt(n),
        nDesigners: clusters ? new Set(clusters.filter((_, i) => labels[i] === l)).size : null };
    });
    const k = groups.length;
    const Vp = groups.map((g, i) => groups.map((_, j) => (i === j ? g.seP * g.seP : 0)));
    let Vd = null;
    if (clusters && k) {
      const idx = values.map((_, i) => present.indexOf(labels[i])), keep = idx.map(i => i >= 0);
      const X = [], y = [], cl = [];
      values.forEach((v, i) => { if (keep[i]) { X.push(present.map((_, j) => (j === idx[i] ? 1 : 0))); y.push(v); cl.push(clusters[i]); } });
      try { Vd = ols(y, X, present, cl).V; } catch (e) { Vd = null; }
      if (Vd) groups.forEach((g, i) => { g.seD = Math.sqrt(Vd[i][i]); });
    }
    return { groups, Vp, Vd };
  }

  /** Delta-method SE of a ratio of totals R = ΣA/ΣP: √(Σ(Aᵢ - R·Pᵢ)² / (n(n-1))) / P̄. */
  function ratioSE(A, P) {
    const n = A.length, R = sum(A) / sum(P);
    if (n < 2) return { R, se: NaN };
    let s = 0; for (let i = 0; i < n; i++) s += (A[i] - R * P[i]) ** 2;
    return { R, se: Math.sqrt(s / (n * (n - 1))) / mean(P) };
  }

  /** Variance inflation factors for the non-constant columns. */
  function vif(X, names) {
    const k = X[0].length, out = [];
    for (let j = 1; j < k; j++) {
      const y = X.map(r => r[j]), Zm = X.map(r => r.filter((_, c) => c !== j));
      try { const f = ols(y, Zm, names.filter((_, c) => c !== j)); out.push({ name: names[j], vif: 1 / (1 - f.r2) }); } catch (e) { out.push({ name: names[j], vif: Infinity }); }
    }
    return out;
  }
  /** Breusch-Pagan (Koenker) test: n·R² of e² on X, χ² with k - 1 df. */
  function breuschPagan(fit, X) {
    const aux = ols(fit.e.map(v => v * v), X, fit.names), LM = fit.n * aux.r2;
    return { LM, df: fit.k - 1, p: pChi2(LM, fit.k - 1) };
  }
  /** Cook's distance per observation. */
  function cooks(fit, X) {
    return X.map((xi, i) => {
      let h = 0; for (let a = 0; a < fit.k; a++) for (let c = 0; c < fit.k; c++) h += xi[a] * fit.XtXi[a][c] * xi[c];
      return fit.e[i] ** 2 / (fit.k * fit.s2) * h / (1 - h) ** 2;
    });
  }
  /** Seeded generator (mulberry32); kept for any resampling needs. */
  function rng(seed) {
    let a = seed >>> 0;
    return function () { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const durbinWatson = e => { let num = 0; for (let i = 1; i < e.length; i++) num += (e[i] - e[i - 1]) ** 2; return num / sum(e.map(v => v * v)); };

  const api = { Z, Z80, sum, mean, variance, sd, quantile, median, holm, invert, ols, waldChi2, waldEqual, zDiff, groupMeans, ratioSE,
    vif, breuschPagan, cooks, rng, durbinWatson, Phi, pNorm, pChi2, normInv };
  root.DDStats = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
