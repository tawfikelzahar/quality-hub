// Server only: ESLint keeps this file out of the browser (eslint.config.mjs).
import { normInv } from '../stats/normal'
import { nelsonRules, testsFor, type TestSet } from './nelson'

// ─────────────────────────────────────────────────────────────────────────
// Attribute control charts: p, np, c, u (SPC Engine, /api/analyze).
//
// Centre lines: p̄ = Σd / Σn · n̄p · c̄ · ū = Σc / Σn (Montgomery).
// Limits use each subgroup's own size, as specialised statistical software
// does: UCLᵢ / LCLᵢ = p̄ ± 3√(p̄(1 − p̄)/nᵢ) for p, ū ± 3√(ū/nᵢ) for u, with
// LCL ≥ 0 (and UCL ≤ 1 for p). Equal sizes give one straight pair of lines.
// With unequal sizes the limits step, and the tests for special causes run
// on the standardized points zᵢ = (xᵢ − centre) / σᵢ against 0 ± 3 (Minitab
// labels such charts "Tests performed with unequal sample sizes").
// Checked against Minitab on tests/golden/attribute (A1–A6): equal sizes
// limits and tests identical; unequal sizes the stepped limit of the last
// subgroup (A2 0.0764 · A5 2.556 / 0.108) and Test 1.
// ─────────────────────────────────────────────────────────────────────────

export type AttrType = 'p' | 'np' | 'c' | 'u'

/** Data adequacy — practical guideline for how much confidence to place in the read */
export function dataAdequacy(nIndividual: number) {
  if (nIndividual < 30) return { n: nIndividual, tier: 'low' as const, label: 'Insufficient Data — Low Confidence' }
  if (nIndividual < 100) return { n: nIndividual, tier: 'moderate' as const, label: 'Limited Data — Moderate Confidence' }
  return { n: nIndividual, tier: 'adequate' as const, label: 'Adequate Data' }
}

const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length
const zToSigmaLevel = (z: number, convention = 'direct') => (convention === 'sixsigma' ? z + 1.5 : z)

export function runAttributeAnalysis({ data, attrType, fixedN, sigmaConvention, testSet }: {
  data: number[][]; attrType: string; fixedN: number; sigmaConvention: string; testSet: TestSet
}) {
  if (!Array.isArray(data) || data.length < 5) throw new Error('At least 5 rows required.')
  const conv = sigmaConvention || 'direct'
  let pts: number[]
  let clVal: number
  /** σ of each plotted point */
  let sig: number[]
  let capOne = false
  let chartLabel: string, dpm: number, sigmaLvl: number, metric: number, metricLabel: string

  if (attrType === 'p') {
    const totalD = data.reduce((s, r) => s + r[1], 0)
    const totalN = data.reduce((s, r) => s + r[0], 0)
    const pBar = totalD / totalN
    pts = data.map(r => r[1] / r[0]); clVal = pBar; capOne = true
    sig = data.map(r => Math.sqrt(pBar * (1 - pBar) / r[0]))
    dpm = pBar * 1e6; metric = pBar; metricLabel = 'p̄ (Proportion Defective)'; chartLabel = 'p-Chart'
    sigmaLvl = pBar > 0 ? zToSigmaLevel(normInv(1 - pBar), conv) : Infinity
  } else if (attrType === 'np') {
    const dVals = data.map(r => r[0]); const dBar = mean(dVals); const pBar = dBar / fixedN
    pts = dVals; clVal = dBar
    sig = dVals.map(() => Math.sqrt(dBar * (1 - pBar)))
    dpm = pBar * 1e6; metric = pBar; metricLabel = 'p̄ (from np̄/n)'; chartLabel = `np-Chart (n=${fixedN})`
    sigmaLvl = pBar > 0 ? zToSigmaLevel(normInv(1 - pBar), conv) : Infinity
  } else if (attrType === 'c') {
    const cVals = data.map(r => r[0]); const cBar = mean(cVals)
    pts = cVals; clVal = cBar
    sig = cVals.map(() => Math.sqrt(cBar))
    dpm = cBar * 1e6; metric = cBar; metricLabel = 'c̄ (Avg Defects/Unit)'; chartLabel = 'c-Chart'
    sigmaLvl = zToSigmaLevel(normInv(1 - Math.min(0.9999, cBar / 1e6)), conv)
  } else {
    const totalC = data.reduce((s, r) => s + r[1], 0)
    const totalN = data.reduce((s, r) => s + r[0], 0)
    const uBar = totalC / totalN
    pts = data.map(r => r[1] / r[0]); clVal = uBar
    sig = data.map(r => Math.sqrt(uBar / r[0]))
    dpm = uBar * 1e6; metric = uBar; metricLabel = 'ū (Avg Defects/Unit)'; chartLabel = 'u-Chart'
    sigmaLvl = zToSigmaLevel(normInv(1 - Math.min(0.9999, uBar)), conv)
  }

  const uclPoints = sig.map(s => (capOne ? Math.min(1, clVal + 3 * s) : clVal + 3 * s))
  const lclPoints = sig.map(s => Math.max(0, clVal - 3 * s))
  const stepped = sig.some(s => Math.abs(s - sig[0]) > 1e-12 * Math.max(1, sig[0]))
  const tests = testsFor('attribute', testSet)
  const violations = stepped
    ? nelsonRules(pts.map((v, i) => (sig[i] > 0 ? (v - clVal) / sig[i] : 0)), 0, 1, tests)
    : nelsonRules(pts, clVal, sig[0], tests)
  const last = pts.length - 1
  return {
    pts, clVal,
    // Single values: the limits of the last subgroup (what the software prints
    // beside a stepped chart); equal sizes: the one pair of limits
    ucl: uclPoints[last], lcl: lclPoints[last],
    ...(stepped ? { uclPoints, lclPoints, stepped: true as const } : {}),
    labels: pts.map((_, i) => i + 1), chartLabel, dpm, sigmaLvl, metric, metricLabel, violations,
    dataAdequacy: dataAdequacy(data.length),
  }
}
