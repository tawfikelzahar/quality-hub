// ─────────────────────────────────────────────────────────────────────────
// I-MR / Xbar-R control-chart engine — pure client-side port of the
// variable-data branch of app/api/analyze/route.ts's runAnalysis().
//
// IMPORTANT: the formulas here are copied byte-for-byte from that route so
// a dataset run through /spc (server-side) and /imr-chart or /xbar-r-chart
// (client-side, this file) produces identical numbers. If you fix a bug or
// tune a formula here, port the same change back to app/api/analyze/route.ts
// — and vice versa — until the two are eventually unified onto one shared
// module. They are intentionally kept in separate files for now rather than
// having the new pages call the existing API, so the newer tools stay
// consistent with the rest of the app's client-side-calculation pattern
// (Regression, Multiple Regression, AQL, ICMSF) and avoid an unnecessary
// server round-trip for what is pure arithmetic.
// ─────────────────────────────────────────────────────────────────────────

import { nelsonRules, offsetViolations, testsFor, DEFAULT_TEST_SET, type NelsonViolation, type TestSet } from './nelson'
import { normCDF, normSF, normInv, andersonDarlingNormal } from '../stats/normal'
import { rangeChartLimits } from './constants'
export type { NelsonViolation, TestSet } from './nelson'

export interface AndersonDarlingResult {
  A2: number
  A2adj: number
  p: number
  normal: boolean
}

export interface DataAdequacy {
  n: number
  tier: 'low' | 'moderate' | 'adequate'
  label: string
}

export interface VariableChartResult {
  n: number
  mu: number
  sdOverall: number
  min: number
  max: number
  labels: number[]
  xbarVals: number[]
  rangeVals: (number | null)[]
  cl_x: number
  ucl_x: number
  lcl_x: number
  cl_r: number
  ucl_r: number
  lcl_r: number
  sigma: number
  violations_x: NelsonViolation[]
  violations_r: NelsonViolation[]
  ad: AndersonDarlingResult | null
  isNormal: boolean
  Cp: number | null
  Cpk: number | null
  Pp: number | null
  Ppk: number | null
  Cpm: number | null
  Z_USL_st: number | null
  Z_LSL_st: number | null
  Z_USL_lt: number | null
  Z_LSL_lt: number | null
  Z_bench_st: number | null
  Z_bench_lt: number | null
  sigLvl_st: number | null
  sigLvl_lt: number | null
  ppmD_st: { above: number; below: number; total: number } | null
  ppmD_lt: { above: number; below: number; total: number } | null
  N: number
  LSL: number | null
  USL: number | null
  dataAdequacy: DataAdequacy
}

function mean(arr: number[]) {
  return arr.reduce((a, b) => a + b, 0) / arr.length
}
function stdev(arr: number[], usePop = false) {
  const m = mean(arr)
  const denom = usePop ? arr.length : arr.length - 1
  return Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / denom)
}

// Normal CDF / inverse and Anderson-Darling live in lib/stats/normal.ts
// (shared with the API route and the Descriptive Statistics tool).
function andersonDarling(data: number[]): AndersonDarlingResult | null {
  return andersonDarlingNormal(data)
}

// Data Adequacy — practical guideline (not a statistical law) for how much
// confidence to place in a Capability/Stability read given the sample size.
function dataAdequacy(nIndividual: number): DataAdequacy {
  if (nIndividual < 30) return { n: nIndividual, tier: 'low', label: 'Insufficient Data — Low Confidence' }
  if (nIndividual < 100) return { n: nIndividual, tier: 'moderate', label: 'Limited Data — Moderate Confidence' }
  return { n: nIndividual, tier: 'adequate', label: 'Adequate Data' }
}

function lgamma(x: number): number {
  const g = 7
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7]
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x)
  x -= 1
  let a = c[0]
  const t = x + g + 0.5
  for (let i = 1; i < g + 2; i++) a += c[i] / (x + i)
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a)
}
function c4func(m: number) {
  if (m < 2) return 1
  return Math.sqrt(2 / (m - 1)) * Math.exp(lgamma(m / 2) - lgamma((m - 1) / 2))
}

function ppmDetailed(mu: number, sigma: number, LSL: number | null, USL: number | null) {
  const above = USL !== null ? normSF((USL - mu) / sigma) * 1e6 : 0
  const below = LSL !== null ? normCDF((LSL - mu) / sigma) * 1e6 : 0
  return { above, below, total: above + below }
}

function zToSigmaLevel(z: number, convention = 'direct') {
  return convention === 'sixsigma' ? z + 1.5 : z
}

function calcCpm(mu: number, sigma: number, LSL: number | null, USL: number | null, target: number | null) {
  if (target === null || LSL === null || USL === null) return null
  const tau = Math.sqrt(sigma ** 2 + (mu - target) ** 2)
  return (USL - LSL) / (6 * tau)
}

export type VariableChartError = 'insufficient-data'

export function validateVariableData(data: number[][]): VariableChartError | null {
  if (!Array.isArray(data) || data.length < 3) return 'insufficient-data'
  return null
}

/**
 * Runs the I-MR (N = 1) or Xbar-R (N > 1) analysis, mirroring
 * app/api/analyze/route.ts's runAnalysis() exactly — same inputs, same
 * outputs, same formulas — but computed entirely in the browser.
 */
export function runVariableChartAnalysis({
  data, N, LSL, USL, target, sigmaConvention, lastN, testSet = DEFAULT_TEST_SET,
}: {
  data: number[][]
  N: number
  LSL: number | null
  USL: number | null
  target: number | null
  sigmaConvention: string
  lastN?: number
  /** which tests for special causes to run — see lib/spc/nelson.ts */
  testSet?: TestSet
}): VariableChartResult {
  const filteredData = lastN ? data.slice(-Math.min(lastN, data.length)) : data
  const allVals = filteredData.flat()
  const mu = mean(allVals), sdOverall = stdev(allVals)
  const labels = filteredData.map((_, i) => i + 1)
  const ad = andersonDarling(allVals)
  const isNormal = ad ? ad.normal : true

  let xbarVals: number[], rangeVals: (number | null)[], sigma: number
  let ucl_x: number, lcl_x: number, cl_x: number, ucl_r: number, lcl_r: number, cl_r: number

  if (N === 1) {
    xbarVals = filteredData.map((r) => r[0])
    const mrs: number[] = []
    for (let i = 1; i < xbarVals.length; i++) mrs.push(Math.abs(xbarVals[i] - xbarVals[i - 1]))
    rangeVals = [null, ...mrs]
    const mrBar = mean(mrs)
    ;({ sigma, cl_x, ucl_x, lcl_x, cl_r, ucl_r, lcl_r } = rangeChartLimits(mean(xbarVals), mrBar, 1))
  } else {
    xbarVals = filteredData.map((r) => mean(r))
    rangeVals = filteredData.map((r) => Math.max(...r) - Math.min(...r))
    const rBar = mean(rangeVals as number[])
    const k_sub = filteredData.length
    const totalSS = filteredData.reduce((acc, sg) => {
      const mu_sg = mean(sg)
      return acc + sg.reduce((s, x) => s + (x - mu_sg) ** 2, 0)
    }, 0)
    const totalDF = k_sub * (N - 1)
    const sp = Math.sqrt(totalSS / totalDF)
    const c4_val = c4func(totalDF + 1)
    // Chart limits: Minitab R̄ method (σ̂ = R̄/d2). Capability σ within:
    // pooled SD / c4(df + 1), Minitab's default for capability analysis.
    ;({ cl_x, ucl_x, lcl_x, cl_r, ucl_r, lcl_r } = rangeChartLimits(mean(xbarVals), rBar, N))
    sigma = sp / c4_val
  }

  // Zones use the sigma of the plotted statistic (one third of centre-to-limit):
  // sigma for I, sigma/sqrt(n) for X-bar, d3*sigma for R/MR (Montgomery).
  const violations_x = nelsonRules(xbarVals, cl_x, (ucl_x - cl_x) / 3, testsFor(N === 1 ? 'individuals' : 'xbar', testSet))
  const rangeValsClean = rangeVals.filter((v): v is number => v !== null)
  // MR #1 is observation 2, so MR point numbers shift by one.
  const violations_r = rangeValsClean.length > 2
    ? offsetViolations(nelsonRules(rangeValsClean, cl_r, (ucl_r - cl_r) / 3, testsFor('dispersion', testSet)), N === 1 ? 1 : 0)
    : []

  let Cp = null, Cpk = null, Pp = null, Ppk = null
  if (LSL !== null && USL !== null) {
    const range = USL - LSL
    Cp = range / (6 * sigma); Cpk = Math.min((USL - cl_x) / (3 * sigma), (cl_x - LSL) / (3 * sigma))
    Pp = range / (6 * sdOverall)
    Ppk = Math.min((USL - mu) / (3 * sdOverall), (mu - LSL) / (3 * sdOverall))
  } else if (LSL !== null) {
    Cpk = (cl_x - LSL) / (3 * sigma)
    Ppk = (mu - LSL) / (3 * sdOverall)
  } else if (USL !== null) {
    Cpk = (USL - cl_x) / (3 * sigma)
    Ppk = (USL - mu) / (3 * sdOverall)
  }

  const Cpm = calcCpm(mu, sdOverall, LSL, USL, target)
  const conv = sigmaConvention || 'direct'

  let Z_USL_st = null, Z_LSL_st = null, Z_USL_lt = null, Z_LSL_lt = null
  if (USL !== null) { Z_USL_st = (USL - cl_x) / sigma; Z_USL_lt = (USL - mu) / sdOverall }
  if (LSL !== null) { Z_LSL_st = (cl_x - LSL) / sigma; Z_LSL_lt = (mu - LSL) / sdOverall }

  const totalP_st = (Z_USL_st !== null ? normSF(Z_USL_st) : 0) + (Z_LSL_st !== null ? normSF(Z_LSL_st) : 0)
  const totalP_lt = (Z_USL_lt !== null ? normSF(Z_USL_lt) : 0) + (Z_LSL_lt !== null ? normSF(Z_LSL_lt) : 0)
  const Z_bench_st = (Z_USL_st !== null || Z_LSL_st !== null) ? -normInv(totalP_st) : null
  const Z_bench_lt = (Z_USL_lt !== null || Z_LSL_lt !== null) ? -normInv(totalP_lt) : null
  const sigLvl_st = Z_bench_st !== null ? Z_bench_st : null
  const sigLvl_lt = Z_bench_lt !== null ? zToSigmaLevel(Z_bench_lt, conv) : null
  const ppmD_st = (LSL !== null || USL !== null) ? ppmDetailed(cl_x, sigma, LSL, USL) : null
  const ppmD_lt = (LSL !== null || USL !== null) ? ppmDetailed(mu, sdOverall, LSL, USL) : null

  return {
    n: allVals.length, mu, sdOverall, min: Math.min(...allVals), max: Math.max(...allVals),
    labels, xbarVals, rangeVals, cl_x, ucl_x, lcl_x, cl_r, ucl_r, lcl_r, sigma,
    violations_x, violations_r, ad, isNormal, Cp, Cpk, Pp, Ppk, Cpm,
    Z_USL_st, Z_LSL_st, Z_USL_lt, Z_LSL_lt, Z_bench_st, Z_bench_lt, sigLvl_st, sigLvl_lt,
    ppmD_st, ppmD_lt, N, LSL, USL, dataAdequacy: dataAdequacy(allVals.length),
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Xbar-S — same overall approach as the Xbar-R branch above (subgrouped
// data, pooled sigma, Nelson Rules, capability, Anderson-Darling), but the
// dispersion chart tracks the subgroup standard deviation (S) instead of
// the range (R). This is the standard alternative for larger subgroups
// (n ≥ 9, lib/spc/chartChoice.ts) where S is a statistically more efficient
// estimator of spread than R. Control limits use the A3/B3/B4 constants
// (derived here from c4func, matching the AIAG/Montgomery reference
// tables) rather than the A2/D3/D4 constants used for R-charts.
// ─────────────────────────────────────────────────────────────────────────

export function runXbarSAnalysis({
  data, N, LSL, USL, target, sigmaConvention, lastN, testSet = DEFAULT_TEST_SET,
}: {
  data: number[][]
  N: number
  LSL: number | null
  USL: number | null
  target: number | null
  sigmaConvention: string
  lastN?: number
  /** which tests for special causes to run — see lib/spc/nelson.ts */
  testSet?: TestSet
}): VariableChartResult {
  const filteredData = lastN ? data.slice(-Math.min(lastN, data.length)) : data
  const allVals = filteredData.flat()
  const mu = mean(allVals), sdOverall = stdev(allVals)
  const labels = filteredData.map((_, i) => i + 1)
  const ad = andersonDarling(allVals)
  const isNormal = ad ? ad.normal : true

  const xbarVals = filteredData.map((r) => mean(r))
  const sVals: (number | null)[] = filteredData.map((r) => stdev(r))
  const sBar = mean(sVals as number[])

  const c4val = c4func(N)
  const A3 = 3 / (c4val * Math.sqrt(N))
  const B3 = Math.max(0, 1 - (3 * Math.sqrt(1 - c4val * c4val)) / c4val)
  const B4 = 1 + (3 * Math.sqrt(1 - c4val * c4val)) / c4val

  const cl_x = mean(xbarVals)
  const ucl_x = cl_x + A3 * sBar
  const lcl_x = cl_x - A3 * sBar
  const cl_r = sBar
  const ucl_r = B4 * sBar
  const lcl_r = B3 * sBar

  // Pooled within-subgroup sigma, same convention as the Xbar-R branch:
  // pool the sums of squares across all subgroups, then bias-correct with
  // c4 evaluated at the pooled degrees of freedom + 1.
  const k_sub = filteredData.length
  const totalSS = filteredData.reduce((acc, sg) => {
    const mu_sg = mean(sg)
    return acc + sg.reduce((s, x) => s + (x - mu_sg) ** 2, 0)
  }, 0)
  const totalDF = k_sub * (N - 1)
  const sp = Math.sqrt(totalSS / totalDF)
  const sigma = sp / c4func(totalDF + 1)

  // Zones from the plotted limits: sigma/sqrt(n) for X-bar; S chart tests 1-4 only.
  const violations_x = nelsonRules(xbarVals, cl_x, (ucl_x - cl_x) / 3, testsFor('xbar', testSet))
  const sValsClean = sVals.filter((v): v is number => v !== null)
  const violations_r = sValsClean.length > 2
    ? nelsonRules(sValsClean, cl_r, (ucl_r - cl_r) / 3, testsFor('dispersion', testSet))
    : []

  let Cp = null, Cpk = null, Pp = null, Ppk = null
  if (LSL !== null && USL !== null) {
    const range = USL - LSL
    Cp = range / (6 * sigma); Cpk = Math.min((USL - cl_x) / (3 * sigma), (cl_x - LSL) / (3 * sigma))
    Pp = range / (6 * sdOverall)
    Ppk = Math.min((USL - mu) / (3 * sdOverall), (mu - LSL) / (3 * sdOverall))
  } else if (LSL !== null) {
    Cpk = (cl_x - LSL) / (3 * sigma)
    Ppk = (mu - LSL) / (3 * sdOverall)
  } else if (USL !== null) {
    Cpk = (USL - cl_x) / (3 * sigma)
    Ppk = (USL - mu) / (3 * sdOverall)
  }

  const Cpm = calcCpm(mu, sdOverall, LSL, USL, target)
  const conv = sigmaConvention || 'direct'

  let Z_USL_st = null, Z_LSL_st = null, Z_USL_lt = null, Z_LSL_lt = null
  if (USL !== null) { Z_USL_st = (USL - cl_x) / sigma; Z_USL_lt = (USL - mu) / sdOverall }
  if (LSL !== null) { Z_LSL_st = (cl_x - LSL) / sigma; Z_LSL_lt = (mu - LSL) / sdOverall }

  const totalP_st = (Z_USL_st !== null ? normSF(Z_USL_st) : 0) + (Z_LSL_st !== null ? normSF(Z_LSL_st) : 0)
  const totalP_lt = (Z_USL_lt !== null ? normSF(Z_USL_lt) : 0) + (Z_LSL_lt !== null ? normSF(Z_LSL_lt) : 0)
  const Z_bench_st = (Z_USL_st !== null || Z_LSL_st !== null) ? -normInv(totalP_st) : null
  const Z_bench_lt = (Z_USL_lt !== null || Z_LSL_lt !== null) ? -normInv(totalP_lt) : null
  const sigLvl_st = Z_bench_st !== null ? Z_bench_st : null
  const sigLvl_lt = Z_bench_lt !== null ? zToSigmaLevel(Z_bench_lt, conv) : null
  const ppmD_st = (LSL !== null || USL !== null) ? ppmDetailed(cl_x, sigma, LSL, USL) : null
  const ppmD_lt = (LSL !== null || USL !== null) ? ppmDetailed(mu, sdOverall, LSL, USL) : null

  return {
    n: allVals.length, mu, sdOverall, min: Math.min(...allVals), max: Math.max(...allVals),
    labels, xbarVals, rangeVals: sVals, cl_x, ucl_x, lcl_x, cl_r, ucl_r, lcl_r, sigma,
    violations_x, violations_r, ad, isNormal, Cp, Cpk, Pp, Ppk, Cpm,
    Z_USL_st, Z_LSL_st, Z_USL_lt, Z_LSL_lt, Z_bench_st, Z_bench_lt, sigLvl_st, sigLvl_lt,
    ppmD_st, ppmD_lt, N, LSL, USL, dataAdequacy: dataAdequacy(allVals.length),
  }
}
