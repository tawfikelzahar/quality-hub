// ─────────────────────────────────────────────────────────────────────────
// Design of Experiments — Full Factorial 2^k analysis engine.
//
// Standard textbook formulation (Montgomery, "Design and Analysis of
// Experiments", Ch. 6), matching what Minitab/JMP report for a two-level
// full factorial: coded (-1/+1) design matrix in standard (Yates) order,
// contrasts -> effects -> sums of squares, then an ANOVA using pooled
// replication error. The effect/SS formulas here were verified numerically
// against Montgomery's published 2^4 filtration-rate example (Ch. 6) —
// every effect value (A=21.625, AC=-18.125, AD=16.625, D=14.625, C=9.875,
// B=3.125, BC=2.375, AB=0.125, etc.) matched to the last decimal — and
// against a hand-checkable 2^2 example, before being wired into this file.
//
// Shares the same normal/F-distribution approximations used in
// lib/regression/calculator.ts, so p-values read consistently across the
// whole app.
// ─────────────────────────────────────────────────────────────────────────

export const MIN_FACTORS = 2
export const MAX_FACTORS = 5
export const MAX_RUN_LABEL_FACTORS = 5

export interface FactorDef {
  name: string // e.g. "A", "B" — or a custom label like "Temperature"
  low: number
  high: number
}

export interface DesignRow {
  runOrder: number // 1-indexed physical run order (after optional randomization)
  standardOrder: number // 1-indexed Yates standard order (fixed reference order)
  coded: Record<string, 1 | -1> // e.g. { A: -1, B: 1 }
  actual: Record<string, number> // decoded to the factor's real low/high units
  replicate: number // which replicate (1..r) this row belongs to
}

export interface EffectRow {
  term: string // e.g. "A", "AB", "ABC"
  factors: string[]
  contrast: number
  effect: number
  ss: number
}

export interface AnovaRow {
  source: string
  df: number
  ss: number
  ms: number
  fStat: number | null
  pValue: number | null
}

export interface DoeResult {
  factors: FactorDef[]
  k: number
  replicates: number
  runsPerReplicate: number // 2^k
  totalRuns: number
  designMatrix: DesignRow[]
  effects: EffectRow[] // sorted by |effect| descending
  anova: AnovaRow[]
  grandMean: number
  sst: number
  sse: number
  dfError: number
  mse: number
  r2: number
  r2Adj: number
  /** Regression equation coefficients in CODED units: intercept + sum(coef_i * x_i) */
  regressionCoded: { term: string; coefficient: number }[]
}

export type DoeError =
  | 'too-few-factors'
  | 'too-many-factors'
  | 'invalid-levels'
  | 'missing-responses'
  | 'no-replication'

export function validateFactors(factors: FactorDef[]): DoeError | null {
  if (factors.length < MIN_FACTORS) return 'too-few-factors'
  if (factors.length > MAX_FACTORS) return 'too-many-factors'
  for (const f of factors) {
    if (!Number.isFinite(f.low) || !Number.isFinite(f.high) || f.low === f.high) {
      return 'invalid-levels'
    }
  }
  return null
}

/**
 * Builds the coded (+-1) design matrix in standard/Yates order for k
 * factors, replicated `replicates` times. Standard order: the first factor
 * alternates fastest (period 2), the second alternates every 2 rows, etc.
 * — the same convention used in Minitab's "Standard Order" column and in
 * the textbook contrast-table derivation verified above.
 */
export function buildDesignMatrix(factors: FactorDef[], replicates: number): DesignRow[] {
  const k = factors.length
  const runsPerRep = Math.pow(2, k)
  const rows: DesignRow[] = []

  let runOrder = 1
  for (let rep = 1; rep <= replicates; rep++) {
    for (let run = 0; run < runsPerRep; run++) {
      const coded: Record<string, 1 | -1> = {}
      const actual: Record<string, number> = {}
      factors.forEach((f, idx) => {
        const bit = Math.floor(run / Math.pow(2, idx)) % 2
        const level: 1 | -1 = bit === 0 ? -1 : 1
        coded[f.name] = level
        actual[f.name] = level === -1 ? f.low : f.high
      })
      rows.push({
        runOrder: runOrder++,
        standardOrder: run + 1 + rep * 0, // standard order repeats each replicate block; see note below
        coded,
        actual,
        replicate: rep,
      })
    }
  }

  // Standard order is really "which of the 2^k coded combinations this is",
  // repeated once per replicate block — fix up numbering explicitly rather
  // than relying on the loop arithmetic above (kept the loop simple/clear).
  rows.forEach((row, i) => {
    row.standardOrder = (i % runsPerRep) + 1
  })

  return rows
}

/** Fisher-Yates shuffle of run order only (standardOrder / coded / actual
 * values are untouched) — used for the optional "randomize run order"
 * checkbox, since real experiments should not be run in standard order. */
export function randomizeRunOrder(rows: DesignRow[]): DesignRow[] {
  const shuffled = [...rows]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled.map((row, i) => ({ ...row, runOrder: i + 1 }))
}

function allCombinations(names: string[]): string[][] {
  const result: string[][] = []
  const n = names.length
  for (let mask = 1; mask < (1 << n); mask++) {
    const combo: string[] = []
    for (let i = 0; i < n; i++) if (mask & (1 << i)) combo.push(names[i])
    result.push(combo)
  }
  return result
}

// ── Normal / F-distribution helpers (same approximations as lib/regression) ──
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1
  const ax = Math.abs(x)
  const a1 = 0.254829592
  const a2 = -0.284496736
  const a3 = 1.421413741
  const a4 = -1.453152027
  const a5 = 1.061405429
  const p = 0.3275911
  const t = 1 / (1 + p * ax)
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax)
  return sign * y
}

function normalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2))
}

/** Wilson-Hilferty cube-root normal approximation of the F distribution —
 * same closed-form approach used in lib/regression/calculator.ts, avoiding
 * a full incomplete-beta implementation while staying accurate for the
 * df ranges typical of a factorial study's replication error. */
function fDistPValue(f: number, df1: number, df2: number): number {
  if (f <= 0) return 1
  if (df2 <= 0) return NaN
  const a = 2 / (9 * df1)
  const b = 2 / (9 * df2)
  const z =
    (Math.pow(f, 1 / 3) * (1 - b) - (1 - a)) / Math.sqrt(a + b * Math.pow(f, 2 / 3))
  const p = 1 - normalCdf(z)
  return Math.min(1, Math.max(0, p))
}

/**
 * Runs the full analysis: effects (via Yates contrasts on design-point
 * means), ANOVA (using pooled within-design-point replication error when
 * replicates > 1), R², and the coded regression equation.
 *
 * `responses` must have one array of replicate values per design point, in
 * STANDARD order (same order as buildDesignMatrix's first `2^k` rows),
 * i.e. responses[i] = the replicate values observed at design point i+1.
 */
export function runFullFactorial(factors: FactorDef[], responses: number[][]): DoeResult {
  const k = factors.length
  const runsPerRep = Math.pow(2, k)
  if (responses.length !== runsPerRep) {
    throw new Error(`Expected ${runsPerRep} design points, got ${responses.length}`)
  }
  const replicates = responses[0]?.length ?? 0
  const totalRuns = runsPerRep * replicates

  // coded matrix for the 2^k design points (no replication needed here —
  // effects are computed on the per-point means)
  const codedPoints: Record<string, 1 | -1>[] = []
  for (let run = 0; run < runsPerRep; run++) {
    const point: Record<string, 1 | -1> = {}
    factors.forEach((f, idx) => {
      const bit = Math.floor(run / Math.pow(2, idx)) % 2
      point[f.name] = bit === 0 ? -1 : 1
    })
    codedPoints.push(point)
  }

  const pointMeans = responses.map((reps) => reps.reduce((s, v) => s + v, 0) / reps.length)
  const grandMean = pointMeans.reduce((s, v) => s + v, 0) / runsPerRep

  const names = factors.map((f) => f.name)
  const combos = allCombinations(names)

  const effects: EffectRow[] = combos.map((combo) => {
    const contrast = codedPoints.reduce((sum, point, i) => {
      const sign = combo.reduce((s, name) => s * point[name], 1)
      return sum + sign * pointMeans[i]
    }, 0)
    const effect = contrast / (runsPerRep / 2)
    // SS scaled by replicate count: SS = r * contrast^2 / 2^k
    const ss = replicates > 0 ? (replicates * contrast * contrast) / runsPerRep : (contrast * contrast) / runsPerRep
    return { term: combo.join(''), factors: combo, contrast, effect, ss }
  })

  effects.sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect))

  // Total sum of squares over ALL individual observations (not point means)
  const allValues = responses.flat()
  const overallMean = allValues.reduce((s, v) => s + v, 0) / allValues.length
  const sst = allValues.reduce((s, v) => s + (v - overallMean) ** 2, 0)

  // Pure replication error: sum of squared deviations from each design
  // point's own mean, pooled across all points.
  let sse = 0
  responses.forEach((reps, i) => {
    const m = pointMeans[i]
    reps.forEach((v) => (sse += (v - m) ** 2))
  })
  const dfError = runsPerRep * (replicates - 1)
  const mse = dfError > 0 ? sse / dfError : NaN

  const anova: AnovaRow[] = effects.map((e) => {
    const df = 1
    const ms = e.ss / df
    const fStat = dfError > 0 ? ms / mse : null
    const pValue = fStat !== null ? fDistPValue(fStat, df, dfError) : null
    return { source: e.term, df, ss: e.ss, ms, fStat, pValue }
  })

  if (dfError > 0) {
    anova.push({ source: 'Error', df: dfError, ss: sse, ms: mse, fStat: null, pValue: null })
  }
  anova.push({ source: 'Total', df: totalRuns - 1, ss: sst, ms: NaN, fStat: null, pValue: null })

  const ssModel = effects.reduce((s, e) => s + e.ss, 0)
  const r2 = sst > 0 ? ssModel / sst : 0
  const dfModel = effects.length
  const r2Adj =
    dfError > 0 && totalRuns - dfModel - 1 > 0
      ? 1 - (1 - r2) * (totalRuns - 1) / (totalRuns - dfModel - 1)
      : r2

  // Coded regression equation: coefficient = effect / 2 (standard convention
  // for a 2-level factorial fit in coded units)
  const regressionCoded: { term: string; coefficient: number }[] = [
    { term: 'Intercept', coefficient: grandMean },
    ...effects.map((e) => ({ term: e.term, coefficient: e.effect / 2 })),
  ]

  const designMatrix = buildDesignMatrix(factors, replicates)

  return {
    factors,
    k,
    replicates,
    runsPerReplicate: runsPerRep,
    totalRuns,
    designMatrix,
    effects,
    anova,
    grandMean,
    sst,
    sse,
    dfError,
    mse,
    r2,
    r2Adj,
    regressionCoded,
  }
}

