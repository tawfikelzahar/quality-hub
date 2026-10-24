// ─────────────────────────────────────────────────────────────────────────
// Two-level full factorial analysis (2^k, full model). Server only:
// /api/doe calls it, ESLint keeps it out of the browser.
//
// Method (Montgomery, Design and Analysis of Experiments, Ch. 6):
//  • effect = contrast of the design-point means ÷ 2^(k−1)
//  • SS = r · contrast² ÷ 2^k · coefficient (coded units) = effect ÷ 2
//  • replicated (r ≥ 2): pure error from the replicates, F and t tests with
//    exact distributions, standardized effect = coef ÷ SE coef,
//    SE coef = √(MSE ÷ N), reference line t(1 − α/2, error df)
//  • one replicate: no error term, so the active effects come from Lenth's
//    pseudo standard error: s0 = 1.5 · median|effect|,
//    PSE = 1.5 · median{|effect| < 2.5 · s0}, ME = t(1 − α/2, m/3) · PSE
//    (Lenth 1989, the same steps and degrees of freedom the leading
//    statistical packages document for their effects plots)
//
// Checked in tests/golden/doe/check.mts against Montgomery Example 6.1
// (plasma etch, 2^3, 2 replicates) with SAS PROC GLM printed SS and p-values,
// and Example 6.2 (filtration rate, 2^4, 1 replicate: published effects,
// Lenth PSE = 2.625).
// ─────────────────────────────────────────────────────────────────────────

import { LETTERS, MAX_FACTORS, MIN_FACTORS, codedLevel, type FactorDef } from './design'
import { fSF, tQuantile, tTwoSidedP } from '../stats/dist'

export const DOE_ALPHA = 0.05

export interface DoeTerm {
  /** letters, e.g. "AC" */
  term: string
  /** factor indexes in the term */
  idx: number[]
  /** 1 = main effect, 2 = two-factor interaction … */
  order: number
  effect: number
  /** coded coefficient = effect / 2 */
  coef: number
  ss: number
  /** % of total SS */
  contribution: number
  /** replicated only */
  seCoef: number | null
  tValue: number | null
  fValue: number | null
  pValue: number | null
  /** the value the Pareto chart draws: |t| when replicated, |effect| otherwise */
  paretoValue: number
  significant: boolean
}

export interface DoeResult {
  k: number
  replicates: number
  runsPerReplicate: number
  totalRuns: number
  factors: FactorDef[]
  alpha: number
  /** 'anova' when there is pure error (r ≥ 2), 'lenth' for one replicate */
  method: 'anova' | 'lenth'
  /** main effects first, then two-factor interactions … (A, B, C, AB, AC, BC, ABC) */
  terms: DoeTerm[]
  error: { df: number; ss: number; ms: number } | null
  total: { df: number; ss: number }
  model: { df: number; ss: number; ms: number; fValue: number | null; pValue: number | null }
  grandMean: number
  /** √MSE, replicated only */
  s: number | null
  r2: number
  r2Adj: number | null
  r2Pred: number | null
  /** Lenth's method (one replicate) */
  lenth: { s0: number; pse: number; df: number; me: number } | null
  /** where the Pareto chart draws its line: t critical or Lenth's ME */
  paretoLine: number
  /** terms judged significant / active, largest first */
  significant: string[]
  mainEffects: { idx: number; low: number; high: number }[]
  /** mean response for each pair of factors: means[i][j], i = level of a (0 low, 1 high), j = level of b */
  interactions: { a: number; b: number; means: [[number, number], [number, number]] }[]
  /** fitted equation in the factors' own units */
  uncoded: { idx: number[]; coef: number }[]
}

export type DoeError = 'factors' | 'levels' | 'responses' | 'unequal' | 'no-variation' | 'zero-error'

const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/** All subsets of 0..k−1 except the empty one, main effects first, then by position (A, B, C, AB, AC, BC, ABC). */
function termIndexes(k: number): number[][] {
  const out: number[][] = []
  const walk = (start: number, size: number, cur: number[]) => {
    if (cur.length === size) { out.push([...cur]); return }
    for (let i = start; i < k; i++) { cur.push(i); walk(i + 1, size, cur); cur.pop() }
  }
  for (let size = 1; size <= k; size++) walk(0, size, [])
  return out
}

/**
 * responses[p] = the replicate values at design point p (standard order,
 * 0-based). Every point needs the same number of values.
 */
export function analyzeFactorial(factors: FactorDef[], responses: number[][], alpha = DOE_ALPHA): DoeResult | DoeError {
  const k = factors.length
  if (k < MIN_FACTORS || k > MAX_FACTORS) return 'factors'
  if (factors.some(f => !Number.isFinite(f.low) || !Number.isFinite(f.high) || f.low === f.high)) return 'levels'
  const P = 2 ** k
  if (responses.length !== P || responses.some(r => r.length === 0 || r.some(v => !Number.isFinite(v)))) return 'responses'
  const r = responses[0].length
  if (responses.some(x => x.length !== r)) return 'unequal'

  const N = P * r
  const means = responses.map(x => x.reduce((a, v) => a + v, 0) / r)
  const grandMean = means.reduce((a, v) => a + v, 0) / P
  const sst = responses.flat().reduce((a, v) => a + (v - grandMean) ** 2, 0)
  if (!(sst > 1e-12 * Math.max(1, grandMean * grandMean))) return 'no-variation'

  const sse = responses.reduce((a, x, p) => a + x.reduce((b, v) => b + (v - means[p]) ** 2, 0), 0)
  const dfE = P * (r - 1)
  const replicated = dfE > 0
  if (replicated && !(sse > 1e-12 * sst)) return 'zero-error'
  const mse = replicated ? sse / dfE : NaN
  const seCoef = replicated ? Math.sqrt(mse / N) : null
  const tCrit = replicated ? tQuantile(1 - alpha / 2, dfE) : null

  const terms: DoeTerm[] = termIndexes(k).map(idx => {
    let contrast = 0
    for (let p = 0; p < P; p++) contrast += idx.reduce((s, i) => s * codedLevel(p, i), 1) * means[p]
    const effect = contrast / (P / 2)
    const coef = effect / 2
    const ss = (r * contrast * contrast) / P
    const tValue = seCoef ? coef / seCoef : null
    const pValue = tValue !== null ? tTwoSidedP(tValue, dfE) : null
    return {
      term: idx.map(i => LETTERS[i]).join(''), idx, order: idx.length, effect, coef, ss,
      contribution: (ss / sst) * 100,
      seCoef, tValue, fValue: tValue !== null ? tValue * tValue : null, pValue,
      paretoValue: tValue !== null ? Math.abs(tValue) : Math.abs(effect),
      significant: pValue !== null ? pValue < alpha : false,
    }
  })

  let lenth: DoeResult['lenth'] = null
  if (!replicated) {
    const abs = terms.map(t => Math.abs(t.effect))
    const s0 = 1.5 * median(abs)
    const kept = abs.filter(a => a < 2.5 * s0)
    const pse = 1.5 * median(kept.length ? kept : abs)
    const df = terms.length / 3
    const me = tQuantile(1 - alpha / 2, df) * pse
    lenth = { s0, pse, df, me }
    for (const t of terms) t.significant = pse > 0 && Math.abs(t.effect) > me
  }

  const ssModel = sst - sse
  const dfModel = P - 1
  const model = {
    df: dfModel, ss: ssModel, ms: ssModel / dfModel,
    fValue: replicated ? ssModel / dfModel / mse : null,
    pValue: replicated ? fSF(ssModel / dfModel / mse, dfModel, dfE) : null,
  }
  const r2 = ssModel / sst
  // every point has leverage 1/r in the full model, so PRESS = SSE · (r / (r − 1))²
  const r2Pred = replicated ? 1 - (sse * (r / (r - 1)) ** 2) / sst : null
  const r2Adj = replicated ? 1 - (sse / dfE) / (sst / (N - 1)) : null

  const mainEffects = factors.map((_, i) => {
    let lo = 0, hi = 0
    for (let p = 0; p < P; p++) { if (codedLevel(p, i) < 0) lo += means[p]; else hi += means[p] }
    return { idx: i, low: lo / (P / 2), high: hi / (P / 2) }
  })
  const interactions: DoeResult['interactions'] = []
  for (let a = 0; a < k; a++) for (let b = a + 1; b < k; b++) {
    const sum = [[0, 0], [0, 0]]
    for (let p = 0; p < P; p++) sum[codedLevel(p, a) < 0 ? 0 : 1][codedLevel(p, b) < 0 ? 0 : 1] += means[p]
    const q = P / 4
    interactions.push({ a, b, means: [[sum[0][0] / q, sum[0][1] / q], [sum[1][0] / q, sum[1][1] / q]] })
  }

  // uncoded: x = (X − centre) / half-range, expand every coded product
  const centre = factors.map(f => (f.low + f.high) / 2)
  const half = factors.map(f => (f.high - f.low) / 2)
  const acc = new Map<string, number>()
  const add = (idx: number[], v: number) => { const key = idx.join(','); acc.set(key, (acc.get(key) ?? 0) + v) }
  add([], grandMean)
  for (const t of terms) {
    const n = t.idx.length
    for (let mask = 0; mask < 1 << n; mask++) {
      const keep: number[] = []
      let v = t.coef
      t.idx.forEach((i, j) => {
        if (mask & (1 << j)) { keep.push(i); v /= half[i] } else v *= -centre[i] / half[i]
      })
      add(keep, v)
    }
  }
  const uncoded = [[] as number[], ...terms.map(t => t.idx)].map(idx => ({ idx, coef: acc.get(idx.join(',')) ?? 0 }))

  const significant = terms.filter(t => t.significant).sort((a, b) => b.paretoValue - a.paretoValue).map(t => t.term)

  return {
    k, replicates: r, runsPerReplicate: P, totalRuns: N, factors, alpha,
    method: replicated ? 'anova' : 'lenth',
    terms,
    error: replicated ? { df: dfE, ss: sse, ms: mse } : null,
    total: { df: N - 1, ss: sst },
    model, grandMean,
    s: replicated ? Math.sqrt(mse) : null,
    r2, r2Adj, r2Pred, lenth,
    paretoLine: replicated ? (tCrit as number) : (lenth as NonNullable<typeof lenth>).me,
    significant, mainEffects, interactions, uncoded,
  }
}

/** Prediction from the uncoded equation (used by the golden test). */
export function predictUncoded(res: DoeResult, x: number[]): number {
  return res.uncoded.reduce((a, u) => a + u.coef * u.idx.reduce((p, i) => p * x[i], 1), 0)
}
