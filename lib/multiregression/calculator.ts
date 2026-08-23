// ─────────────────────────────────────────────────────────────────────────
// Multiple Linear Regression — ordinary least squares for k predictors via
// the normal equations β = (XᵀX)⁻¹XᵀY. Same statistical conventions as
// lib/regression/calculator.ts (Simple Linear Regression) so the two tools
// report consistent numbers where the math overlaps (R², ANOVA, Anderson-
// Darling with the Stephens 1974 correction, Durbin-Watson).
// ─────────────────────────────────────────────────────────────────────────

import { transpose, multiply, multiplyVec, invert, type Matrix } from './matrix'

export interface MultiDataRow {
  y: number
  x: number[] // one value per predictor, same order as predictorNames
}

export interface CoefficientRow {
  term: string // 'Constant' or the predictor name
  coef: number
  se: number
  tStat: number
  pValue: number
  vif: number | null // null for the constant term
}

export interface AnovaRow {
  source: 'Regression' | 'Residual Error' | 'Total'
  df: number
  seqSS: number
  adjMS: number
  fStat: number | null
  pValue: number | null
}

export interface ResidualPoint {
  index: number
  y: number
  fitted: number
  residual: number
  standardizedResidual: number
}

export interface MultiRegressionResult {
  n: number
  k: number // number of predictors
  predictorNames: string[]
  coefficients: CoefficientRow[]
  anova: AnovaRow[]
  r2: number
  r2Adj: number
  se: number
  sse: number
  ssr: number
  sst: number
  dfResidual: number
  dfRegression: number
  residuals: ResidualPoint[]
  andersonDarling: { statistic: number; pValueApprox: string }
  durbinWatson: number
  covMatrix: Matrix // (XᵀX)⁻¹ · MSE — used for prediction interval math
  xtxInv: Matrix
  xMeans: number[]
}

export type MultiRegressionError =
  | 'insufficient-data'
  | 'too-many-predictors'
  | 'singular-matrix'
  | 'zero-variance-predictor'
  | 'zero-variance-y'

export function validateData(rows: MultiDataRow[], k: number): MultiRegressionError | null {
  if (rows.length < k + 2) return 'insufficient-data'
  if (k < 1) return 'insufficient-data'
  if (k > rows.length - 2) return 'too-many-predictors'

  const ys = rows.map((r) => r.y)
  if (new Set(ys).size < 2) return 'zero-variance-y'

  for (let j = 0; j < k; j++) {
    const col = rows.map((r) => r.x[j])
    if (new Set(col).size < 2) return 'zero-variance-predictor'
  }
  return null
}

// ── Shared distribution approximations (same conventions as the Simple
// Linear Regression tool, kept local to avoid a cross-tool import that
// would couple the two independently-evolving lib folders). ──────────────
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1
  const ax = Math.abs(x)
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429
  const p = 0.3275911
  const t = 1 / (1 + p * ax)
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax)
  return sign * y
}
function normalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2))
}
function tDistTwoTailedPValue(t: number, df: number): number {
  const absT = Math.abs(t)
  const adj = (absT * (1 - 1 / (4 * df))) / Math.sqrt(1 + (absT * absT) / (2 * df))
  return Math.min(1, Math.max(0, 2 * (1 - normalCdf(adj))))
}
function fDistPValue(f: number, df1: number, df2: number): number {
  if (f <= 0) return 1
  const a = 2 / (9 * df1)
  const b = 2 / (9 * df2)
  const z = (Math.pow(f, 1 / 3) * (1 - b) - (1 - a)) / Math.sqrt(a + b * Math.pow(f, 2 / 3))
  return Math.min(1, Math.max(0, 1 - normalCdf(z)))
}
function andersonDarlingStat(standardized: number[]): { statistic: number; pValueApprox: string } {
  const n = standardized.length
  if (n < 3) return { statistic: 0, pValueApprox: 'n/a' }
  const sorted = [...standardized].sort((a, b) => a - b)
  const mean = sorted.reduce((s, v) => s + v, 0) / n
  const sd = Math.sqrt(sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1)) || 1
  let sum = 0
  for (let i = 0; i < n; i++) {
    const zi = (sorted[i] - mean) / sd
    const ziRev = (sorted[n - 1 - i] - mean) / sd
    const p1 = Math.min(Math.max(normalCdf(zi), 1e-12), 1 - 1e-12)
    const p2 = Math.min(Math.max(1 - normalCdf(ziRev), 1e-12), 1 - 1e-12)
    sum += (2 * i + 1) * (Math.log(p1) + Math.log(p2))
  }
  const a2 = -n - sum / n
  const aStar = a2 * (1 + 0.75 / n + 2.25 / (n * n))
  let pValueApprox: string
  if (aStar < 0.2) pValueApprox = '> 0.25'
  else if (aStar < 0.34) pValueApprox = '0.15 – 0.25'
  else if (aStar < 0.6) pValueApprox = '0.05 – 0.15'
  else if (aStar < 0.787) pValueApprox = '0.025 – 0.05'
  else if (aStar < 1.0) pValueApprox = '< 0.025'
  else pValueApprox = '< 0.01'
  return { statistic: aStar, pValueApprox }
}

export function runMultipleLinearRegression(
  rows: MultiDataRow[],
  predictorNames: string[],
): MultiRegressionResult {
  const n = rows.length
  const k = predictorNames.length

  // Design matrix X = [1, x1, x2, ..., xk] per row
  const X: Matrix = rows.map((r) => [1, ...r.x])
  const y = rows.map((r) => r.y)

  const Xt = transpose(X)
  const XtX = multiply(Xt, X)
  const xtxInv = invert(XtX) // throws 'singular-matrix' on perfectly collinear predictors
  const XtY = multiplyVec(Xt, y)
  const beta = multiplyVec(xtxInv, XtY) // [intercept, b1, b2, ..., bk]

  const yMean = y.reduce((s, v) => s + v, 0) / n
  const fitted = X.map((row) => row.reduce((s, v, j) => s + v * beta[j], 0))
  const residuals = y.map((yi, i) => yi - fitted[i])

  const sse = residuals.reduce((s, r) => s + r * r, 0)
  const sst = y.reduce((s, yi) => s + (yi - yMean) ** 2, 0)
  const ssr = sst - sse

  const dfRegression = k
  const dfResidual = n - k - 1
  const mse = sse / dfResidual
  const se = Math.sqrt(mse)

  const r2 = sst > 0 ? ssr / sst : 0
  const r2Adj = 1 - (1 - r2) * (n - 1) / dfResidual

  // Covariance matrix of beta: MSE * (XᵀX)⁻¹ — diagonal gives Var(beta_j)
  const covMatrix: Matrix = xtxInv.map((row) => row.map((v) => v * mse))
  const seCoef = covMatrix.map((row, i) => Math.sqrt(Math.max(row[i], 0)))

  // VIF per predictor: regress each X_j on the remaining predictors and
  // take 1/(1-R_j²). Skipped (VIF = 1, no collinearity signal) when k = 1
  // since there's nothing to be collinear with.
  const vifs: (number | null)[] = [null] // constant term has no VIF
  for (let j = 0; j < k; j++) {
    if (k === 1) {
      vifs.push(1)
      continue
    }
    const otherRows = rows.map((r) => ({
      y: r.x[j],
      x: r.x.filter((_, idx) => idx !== j),
    }))
    try {
      const sub = runMultipleLinearRegression(
        otherRows,
        predictorNames.filter((_, idx) => idx !== j),
      )
      const vif = sub.r2 >= 0.9999 ? Infinity : 1 / (1 - sub.r2)
      vifs.push(vif)
    } catch {
      vifs.push(Infinity)
    }
  }

  const tStats = beta.map((b, i) => b / (seCoef[i] || 1e-12))
  const coefficients: CoefficientRow[] = beta.map((b, i) => ({
    term: i === 0 ? 'Constant' : predictorNames[i - 1],
    coef: b,
    se: seCoef[i],
    tStat: tStats[i],
    pValue: tDistTwoTailedPValue(tStats[i], dfResidual),
    vif: vifs[i],
  }))

  const fStat = mse > 0 ? (ssr / dfRegression) / mse : 0
  const anovaPValue = fDistPValue(fStat, dfRegression, dfResidual)
  const anova: AnovaRow[] = [
    { source: 'Regression', df: dfRegression, seqSS: ssr, adjMS: ssr / dfRegression, fStat, pValue: anovaPValue },
    { source: 'Residual Error', df: dfResidual, seqSS: sse, adjMS: mse, fStat: null, pValue: null },
    { source: 'Total', df: n - 1, seqSS: sst, adjMS: NaN, fStat: null, pValue: null },
  ]

  // Leverage h_ii = x_i (XᵀX)⁻¹ x_iᵀ, used for standardized residuals
  const residualPoints: ResidualPoint[] = rows.map((r, i) => {
    const xi = X[i]
    const hRow = multiplyVec(xtxInv, xi)
    const h = xi.reduce((s, v, j) => s + v * hRow[j], 0)
    const denom = se * Math.sqrt(Math.max(1 - h, 1e-9))
    const standardizedResidual = denom > 0 ? residuals[i] / denom : 0
    return { index: i, y: r.y, fitted: fitted[i], residual: residuals[i], standardizedResidual }
  })

  const andersonDarling = andersonDarlingStat(residualPoints.map((r) => r.standardizedResidual))

  let dwNum = 0
  for (let i = 1; i < residuals.length; i++) {
    dwNum += (residuals[i] - residuals[i - 1]) ** 2
  }
  const durbinWatson = sse > 0 ? dwNum / sse : 0

  const xMeans = Array.from({ length: k }, (_, j) => rows.reduce((s, r) => s + r.x[j], 0) / n)

  return {
    n,
    k,
    predictorNames,
    coefficients,
    anova,
    r2,
    r2Adj,
    se,
    sse,
    ssr,
    sst,
    dfResidual,
    dfRegression,
    residuals: residualPoints,
    andersonDarling,
    durbinWatson,
    covMatrix,
    xtxInv,
    xMeans,
  }
}

/** Predicts Y for a new set of predictor values, with 95% CI (mean
 * response) and PI (single new observation) — same convention as the
 * Simple Linear Regression tool's predictAt(). */
export function predictAt(result: MultiRegressionResult, xNew: number[], tCrit95: number) {
  const beta = result.coefficients.map((c) => c.coef)
  const xVec = [1, ...xNew]
  const fitted = xVec.reduce((s, v, j) => s + v * beta[j], 0)

  // Var(fitted) = x0 (XᵀX)⁻¹ x0ᵀ * MSE = x0 · covMatrix · x0ᵀ
  const mse = result.se * result.se
  const xtxInvRow = xVec.map((_, i) =>
    xVec.reduce((s, v, j) => s + v * result.xtxInv[i][j], 0),
  )
  const leverageTerm = xVec.reduce((s, v, i) => s + v * xtxInvRow[i], 0)
  const seFit = Math.sqrt(Math.max(leverageTerm, 0) * mse)
  const sePred = Math.sqrt(Math.max(leverageTerm, 0) * mse + mse)

  return {
    fitted,
    ciLow: fitted - tCrit95 * seFit,
    ciHigh: fitted + tCrit95 * seFit,
    piLow: fitted - tCrit95 * sePred,
    piHigh: fitted + tCrit95 * sePred,
  }
}

export { tCritical95 } from '../regression/calculator'
