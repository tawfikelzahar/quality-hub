// ─────────────────────────────────────────────────────────────────────────
// Linear regression by ordinary least squares — simple (1 predictor) and
// multiple (2–10). Server only: /api/regression calls it, ESLint keeps it
// out of the browser.
//
// Method (Montgomery, Peck & Vining, Introduction to Linear Regression
// Analysis, Ch. 2–4 and 6):
//  • predictors centred and scaled, then Householder QR — no normal
//    equations, so ill-conditioned data (NIST Longley) keeps its digits;
//    a predictor that is a linear combination of the others is refused
//  • t and F tests with exact distributions (lib/stats/dist.ts)
//  • per-predictor Adj SS = b² ÷ c_jj (F = t²), VIF = c_jj · Sxx_j
//  • R²(pred) from PRESS, standardized residual e / (S √(1 − h)),
//    Cook's D = r² h / (p (1 − h)), Durbin-Watson
//  • unusual observations as the leading packages document them:
//    |standardized residual| > 2 (R) · leverage > min(3p/n, 0.99) (X)
//  • normality of the residuals: Anderson-Darling (lib/stats/normal.ts,
//    the same test as SPC and Descriptive), normal plot on Benard ranks
//
// Checked in tests/golden/regression/check.mts against the NIST StRD
// certified values (Norris, Longley) and an independent OLS fit
// (statsmodels / scipy) for p-values, R²(pred), VIF, leverage, Cook's D,
// intervals and the residual normality test.
// ─────────────────────────────────────────────────────────────────────────

import { fSF, tQuantile, tTwoSidedP } from '../stats/dist'
import { andersonDarlingNormal, normInv } from '../stats/normal'

export const MAX_PREDICTORS = 10
export const MAX_ROWS = 5000

export interface CoefRow { term: string; coef: number; se: number; t: number; p: number; vif: number | null }
export interface AnovaRow { source: string; df: number; ss: number; ms: number | null; f: number | null; p: number | null }
export interface ResidRow {
  /** 1-based row number in the data */
  row: number
  y: number
  x: number[]
  fit: number
  resid: number
  stdResid: number
  leverage: number
  cook: number
  /** 'R' large residual · 'X' unusual X */
  flags: ('R' | 'X')[]
}
export interface Interval { fit: number; seFit: number; ciLo: number; ciHi: number; piLo: number; piHi: number }

export interface RegressionFit {
  n: number
  k: number
  yName: string
  xNames: string[]
  coefficients: CoefRow[]
  anova: AnovaRow[]
  s: number
  r2: number
  r2Adj: number
  r2Pred: number | null
  dfError: number
  fRegression: number
  pRegression: number
  tCrit: number
  residuals: ResidRow[]
  /** rows with a flag, largest |standardized residual| first */
  unusual: number[]
  leverageLimit: number
  normality: { A2adj: number; p: number } | null
  /** normal probability plot: residuals sorted, z from Benard ranks (i − 0.3)/(n + 0.4) */
  normalPlot: { z: number; resid: number }[]
  durbinWatson: number
  xMeans: number[]
  xMin: number[]
  xMax: number[]
  /** simple regression only: fit, 95% CI and PI across the range of X */
  band: ({ x: number } & Interval)[] | null
  prediction: (Interval & { x: number[]; beyondData: boolean }) | null
}

export type RegressionError =
  | { code: 'too-few'; need: number }
  | { code: 'y-constant' }
  | { code: 'x-constant'; name: string }
  | { code: 'collinear'; name: string }
  | { code: 'predictors' }

const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length

/**
 * y[i] and X[i][j] (row i, predictor j). `predict` = optional new X values.
 */
export function fitRegression(yName: string, xNames: string[], y: number[], X: number[][], predict?: number[] | null): RegressionFit | RegressionError {
  const n = y.length
  const k = xNames.length
  if (k < 1 || k > MAX_PREDICTORS) return { code: 'predictors' }
  if (n < k + 2) return { code: 'too-few', need: k + 2 }
  const yBar = mean(y)
  const sst = y.reduce((a, v) => a + (v - yBar) ** 2, 0)
  if (!(sst > 0)) return { code: 'y-constant' }

  const xMeans = xNames.map((_, j) => mean(X.map(r => r[j])))
  const sxx = xNames.map((_, j) => X.reduce((a, r) => a + (r[j] - xMeans[j]) ** 2, 0))
  for (let j = 0; j < k; j++) if (!(sxx[j] > 0)) return { code: 'x-constant', name: xNames[j] }

  // centred, unit-length columns
  const scale = sxx.map(Math.sqrt)
  const Z = X.map(r => r.map((v, j) => (v - xMeans[j]) / scale[j]))
  const yc = y.map(v => v - yBar)

  // Householder QR of Z (n × k): R upper triangular, Qᵀ applied to yc
  const A = Z.map(r => [...r])
  const qty = [...yc]
  const R: number[][] = Array.from({ length: k }, () => new Array(k).fill(0))
  for (let j = 0; j < k; j++) {
    let norm = 0
    for (let i = j; i < n; i++) norm += A[i][j] ** 2
    norm = Math.sqrt(norm)
    // columns have length 1, so an absolute tolerance is a relative one here
    if (norm < 1e-10) return { code: 'collinear', name: xNames[j] }
    const alpha = A[j][j] > 0 ? -norm : norm
    const v = new Array(n).fill(0)
    v[j] = A[j][j] - alpha
    for (let i = j + 1; i < n; i++) v[i] = A[i][j]
    const vv = v.reduce((a, x) => a + x * x, 0)
    if (vv > 0) {
      for (let c = j; c < k; c++) {
        let d = 0
        for (let i = j; i < n; i++) d += v[i] * A[i][c]
        const f = (2 * d) / vv
        for (let i = j; i < n; i++) A[i][c] -= f * v[i]
      }
      let d = 0
      for (let i = j; i < n; i++) d += v[i] * qty[i]
      const f = (2 * d) / vv
      for (let i = j; i < n; i++) qty[i] -= f * v[i]
    }
    for (let c = j; c < k; c++) R[j][c] = A[j][c]
  }
  // Rinv (upper triangular)
  const Rinv: number[][] = Array.from({ length: k }, () => new Array(k).fill(0))
  for (let i = k - 1; i >= 0; i--) {
    Rinv[i][i] = 1 / R[i][i]
    for (let c = i + 1; c < k; c++) {
      let s = 0
      for (let m = i + 1; m <= c; m++) s += R[i][m] * Rinv[m][c]
      Rinv[i][c] = -s / R[i][i]
    }
  }
  // g = R⁻¹ Qᵀy (scaled slopes) · Cz = (ZᵀZ)⁻¹ = R⁻¹ R⁻ᵀ
  const g = Rinv.map(row => row.reduce((a, v, c) => a + v * (c < k ? qty[c] : 0), 0))
  const Cz = Rinv.map((_, i) => Rinv.map((__, c) => { let s = 0; for (let m = 0; m < k; m++) s += Rinv[i][m] * Rinv[c][m]; return s }))

  const slopes = g.map((v, j) => v / scale[j])
  const b0 = yBar - slopes.reduce((a, b, j) => a + b * xMeans[j], 0)
  const fits = X.map(r => b0 + r.reduce((a, v, j) => a + v * slopes[j], 0))
  const resid = y.map((v, i) => v - fits[i])
  const sse = resid.reduce((a, e) => a + e * e, 0)
  const dfE = n - k - 1
  const mse = sse / dfE
  const s = Math.sqrt(mse)
  const ssr = sst - sse
  const tCrit = tQuantile(0.975, dfE)

  // leverage in the centred model: h = 1/n + zᵀ Cz z
  const quad = (z: number[]) => z.reduce((a, zi, i) => a + zi * z.reduce((b, zc, c) => b + Cz[i][c] * zc, 0), 0)
  const lev = Z.map(z => 1 / n + quad(z))

  // coefficients: Var(b_j) = MSE · Cz_jj / scale_j² · Var(b0) = MSE (1/n + m' C m) with C in original units
  const zMean = xMeans.map((m, j) => -m / scale[j])
  const coefficients: CoefRow[] = [
    (() => {
      const se = Math.sqrt(mse * (1 / n + quad(zMean)))
      const t = b0 / se
      return { term: 'Constant', coef: b0, se, t, p: tTwoSidedP(t, dfE), vif: null }
    })(),
    ...slopes.map((b, j) => {
      const se = Math.sqrt((mse * Cz[j][j]) / sxx[j])
      const t = b / se
      return { term: xNames[j], coef: b, se, t, p: tTwoSidedP(t, dfE), vif: k > 1 ? Cz[j][j] : null }
    }),
  ]

  const fReg = ssr / k / mse
  const pReg = fSF(fReg, k, dfE)
  const anova: AnovaRow[] = [
    { source: 'Regression', df: k, ss: ssr, ms: ssr / k, f: fReg, p: pReg },
    ...coefficients.slice(1).map(c => {
      const ss = c.t * c.t * mse
      return { source: c.term, df: 1, ss, ms: ss, f: c.t * c.t, p: c.p }
    }),
    { source: 'Error', df: dfE, ss: sse, ms: mse, f: null, p: null },
    { source: 'Total', df: n - 1, ss: sst, ms: null, f: null, p: null },
  ]

  const p = k + 1
  const leverageLimit = Math.min((3 * p) / n, 0.99)
  const residuals: ResidRow[] = y.map((yi, i) => {
    const h = lev[i]
    const stdResid = resid[i] / (s * Math.sqrt(1 - h))
    const flags: ('R' | 'X')[] = []
    if (Math.abs(stdResid) > 2) flags.push('R')
    if (h > leverageLimit) flags.push('X')
    return { row: i + 1, y: yi, x: X[i], fit: fits[i], resid: resid[i], stdResid, leverage: h, cook: (stdResid * stdResid * h) / (p * (1 - h)), flags }
  })
  const unusual = residuals.filter(r => r.flags.length).sort((a, b) => Math.abs(b.stdResid) - Math.abs(a.stdResid)).map(r => r.row)

  const press = resid.reduce((a, e, i) => a + (e / (1 - lev[i])) ** 2, 0)
  const r2Pred = lev.every(h => h < 1 - 1e-12) ? 1 - press / sst : null

  const ad = andersonDarlingNormal(resid)
  const sorted = [...resid].sort((a, b) => a - b)
  const normalPlot = sorted.map((e, i) => ({ z: normInv((i + 1 - 0.3) / (n + 0.4)), resid: e }))

  let dw = 0
  for (let i = 1; i < n; i++) dw += (resid[i] - resid[i - 1]) ** 2

  const interval = (x0: number[]): Interval => {
    const fit = b0 + x0.reduce((a, v, j) => a + v * slopes[j], 0)
    const h0 = 1 / n + quad(x0.map((v, j) => (v - xMeans[j]) / scale[j]))
    const seFit = s * Math.sqrt(h0)
    const sePred = s * Math.sqrt(1 + h0)
    return { fit, seFit, ciLo: fit - tCrit * seFit, ciHi: fit + tCrit * seFit, piLo: fit - tCrit * sePred, piHi: fit + tCrit * sePred }
  }
  const xMin = xNames.map((_, j) => Math.min(...X.map(r => r[j])))
  const xMax = xNames.map((_, j) => Math.max(...X.map(r => r[j])))
  const band = k === 1
    ? Array.from({ length: 41 }, (_, i) => { const x = xMin[0] + ((xMax[0] - xMin[0]) * i) / 40; return { x, ...interval([x]) } })
    : null
  let prediction: RegressionFit['prediction'] = null
  if (predict && predict.length === k && predict.every(Number.isFinite)) {
    const h0 = 1 / n + quad(predict.map((v, j) => (v - xMeans[j]) / scale[j]))
    prediction = { x: predict, ...interval(predict), beyondData: h0 > Math.max(...lev) }
  }

  return {
    n, k, yName, xNames, coefficients, anova, s,
    r2: ssr / sst, r2Adj: 1 - mse / (sst / (n - 1)), r2Pred,
    dfError: dfE, fRegression: fReg, pRegression: pReg, tCrit,
    residuals, unusual, leverageLimit,
    normality: ad ? { A2adj: ad.A2adj, p: ad.p } : null,
    normalPlot, durbinWatson: sse > 0 ? dw / sse : 0,
    xMeans, xMin, xMax, band, prediction,
  }
}
