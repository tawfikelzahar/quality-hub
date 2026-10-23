import { NextRequest, NextResponse } from 'next/server'
import { guardApi, CALC_LIMITS } from '@/lib/apiGuard'
import { normCDF, normSF, normInv, andersonDarlingNormal } from '@/lib/stats/normal'
import { rangeChartLimits } from '@/lib/spc/constants'
import { nelsonRules, offsetViolations, testsFor, isTestSet, DEFAULT_TEST_SET, type TestSet } from '@/lib/spc/nelson'

function mean(arr: number[]) { return arr.reduce((a, b) => a + b, 0) / arr.length }
function stdev(arr: number[], usePop = false) {
  const m = mean(arr)
  const denom = usePop ? arr.length : arr.length - 1
  return Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / denom)
}
// Normal CDF / inverse and Anderson-Darling: lib/stats/normal.ts (shared).
const andersonDarling = andersonDarlingNormal
// Data Adequacy — practical guideline (not a statistical law) for how much
// confidence to place in a Capability/Stability read given the sample size.
// Based on total INDIVIDUAL observations (not subgroup count): 30 individual
// points is not the same thing as 30 subgroups.
function dataAdequacy(nIndividual: number) {
  if (nIndividual < 30) return { n: nIndividual, tier: 'low' as const, label: 'Insufficient Data — Low Confidence' }
  if (nIndividual < 100) return { n: nIndividual, tier: 'moderate' as const, label: 'Limited Data — Moderate Confidence' }
  return { n: nIndividual, tier: 'adequate' as const, label: 'Adequate Data' }
}
function lgamma(x: number): number {
  const g = 7
  const c = [0.99999999999980993,676.5203681218851,-1259.1392167224028,771.32342877765313,-176.61502916214059,12.507343278686905,-0.13857109526572012,9.9843695780195716e-6,1.5056327351493116e-7]
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x)
  x -= 1; let a = c[0]; const t = x + g + 0.5
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
function zToSigmaLevel(z: number, convention = 'direct') { return convention === 'sixsigma' ? z + 1.5 : z }
function calcCpm(mu: number, sigma: number, LSL: number | null, USL: number | null, target: number | null) {
  if (target === null || LSL === null || USL === null) return null
  const tau = Math.sqrt(sigma ** 2 + (mu - target) ** 2)
  return (USL - LSL) / (6 * tau)
}
function runAnalysis({ data, N, LSL, USL, target, sigmaConvention, lastN, testSet }: {
  data: number[][]; N: number; LSL: number | null; USL: number | null;
  target: number | null; sigmaConvention: string; lastN: number; testSet: TestSet
}) {
  const filteredData = lastN ? data.slice(-Math.min(lastN, data.length)) : data
  const allVals = filteredData.flat()
  const n = filteredData.length
  const mu = mean(allVals), sdOverall = stdev(allVals)
  const labels = filteredData.map((_, i) => i + 1)
  const ad = andersonDarling(allVals)
  const isNormal = ad ? ad.normal : true
  let xbarVals: number[], rangeVals: (number | null)[], sigma: number, ucl_x: number, lcl_x: number, cl_x: number, ucl_r: number, lcl_r: number, cl_r: number
  if (N === 1) {
    xbarVals = filteredData.map(r => r[0])
    const mrs: number[] = []
    for (let i = 1; i < xbarVals.length; i++) mrs.push(Math.abs(xbarVals[i] - xbarVals[i - 1]))
    rangeVals = [null, ...mrs]
    const mrBar = mean(mrs)
    ;({ sigma, cl_x, ucl_x, lcl_x, cl_r, ucl_r, lcl_r } = rangeChartLimits(mean(xbarVals), mrBar, 1))
  } else {
    xbarVals = filteredData.map(r => mean(r))
    rangeVals = filteredData.map(r => Math.max(...r) - Math.min(...r)) as number[]
    const rBar = mean(rangeVals as number[])
    const k_sub = filteredData.length
    const totalSS = filteredData.reduce((acc, sg) => { const mu_sg = mean(sg); return acc + sg.reduce((s, x) => s + (x - mu_sg) ** 2, 0) }, 0)
    const totalDF = k_sub * (N - 1); const sp = Math.sqrt(totalSS / totalDF); const c4_val = c4func(totalDF + 1)
    // Chart limits: Minitab R̄ method; capability σ within: pooled SD / c4(df + 1)
    ;({ cl_x, ucl_x, lcl_x, cl_r, ucl_r, lcl_r } = rangeChartLimits(mean(xbarVals), rBar, N))
    sigma = sp / c4_val
  }
  // Zones use the sigma of the plotted statistic, i.e. one third of the
  // distance from the centre line to the plotted limit: sigma for the I chart,
  // sigma/sqrt(n) for the X-bar chart, d3*sigma for R/MR (Montgomery).
  // Which tests run comes from the test set (lib/spc/nelson.ts): Minitab
  // Assistant defaults unless the user picked "all Nelson tests".
  const violations_x = nelsonRules(xbarVals, cl_x, (ucl_x - cl_x) / 3, testsFor(N === 1 ? 'individuals' : 'xbar', testSet))
  const rangeValsClean = (rangeVals.filter(v => v !== null)) as number[]
  // MR #1 belongs to observation 2, so MR point numbers shift by one to match
  // the chart's x-axis labels.
  const violations_r = rangeValsClean.length > 2
    ? offsetViolations(nelsonRules(rangeValsClean, cl_r, (ucl_r - cl_r) / 3, testsFor('dispersion', testSet)), N === 1 ? 1 : 0)
    : []
  let Cp = null, Cpk = null, Pp = null, Ppk = null
  if (LSL !== null && USL !== null) {
    const range = USL - LSL
    Cp = range / (6 * sigma); Cpk = Math.min((USL - cl_x) / (3 * sigma), (cl_x - LSL) / (3 * sigma))
    Pp = range / (6 * sdOverall); Ppk = Math.min((USL - mu) / (3 * sdOverall), (mu - LSL) / (3 * sdOverall))
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
  // Z.Bench (industry-standard / Minitab convention): convert the COMBINED
  // two-tail defect probability back into a single Z, rather than taking
  // the worse of the two one-sided Z's. This keeps Z-bench consistent with
  // the Total PPM already shown on the page (both are now derived from the
  // exact same combined probability).
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
    ppmD_st, ppmD_lt, N, LSL, USL, dataAdequacy: dataAdequacy(allVals.length)
  }
}

function runAttributeAnalysis({ data, attrType, fixedN, sigmaConvention, testSet }: {
  data: number[][]; attrType: string; fixedN: number; sigmaConvention: string; testSet: TestSet
}) {
  if (!Array.isArray(data) || data.length < 5) throw new Error('At least 5 rows required.')
  const conv = sigmaConvention || 'direct'
  let pts: number[], clVal: number, ucl: number, lcl: number, chartLabel: string, dpm: number, sigmaLvl: number, metric: number, metricLabel: string
  if (attrType === 'p') {
    const pVals = data.map(r => r[1] / r[0]); const totalD = data.reduce((s, r) => s + r[1], 0); const totalN = data.reduce((s, r) => s + r[0], 0)
    const pBar = totalD / totalN; const nBar = totalN / data.length
    pts = pVals; clVal = pBar; ucl = Math.min(1, pBar + 3 * Math.sqrt(pBar * (1 - pBar) / nBar)); lcl = Math.max(0, pBar - 3 * Math.sqrt(pBar * (1 - pBar) / nBar))
    dpm = pBar * 1e6; metric = pBar; metricLabel = 'p̄ (Proportion Defective)'; chartLabel = 'p-Chart'
    sigmaLvl = pBar > 0 ? zToSigmaLevel(normInv(1 - pBar), conv) : Infinity
  } else if (attrType === 'np') {
    const dVals = data.map(r => r[0]); const dBar = mean(dVals); const pBar = dBar / fixedN
    pts = dVals; clVal = dBar; ucl = dBar + 3 * Math.sqrt(dBar * (1 - pBar)); lcl = Math.max(0, dBar - 3 * Math.sqrt(dBar * (1 - pBar)))
    dpm = pBar * 1e6; metric = pBar; metricLabel = 'p̄ (from np̄/n)'; chartLabel = `np-Chart (n=${fixedN})`
    sigmaLvl = pBar > 0 ? zToSigmaLevel(normInv(1 - pBar), conv) : Infinity
  } else if (attrType === 'c') {
    const cVals = data.map(r => r[0]); const cBar = mean(cVals)
    pts = cVals; clVal = cBar; ucl = cBar + 3 * Math.sqrt(cBar); lcl = Math.max(0, cBar - 3 * Math.sqrt(cBar))
    dpm = cBar * 1e6; metric = cBar; metricLabel = 'c̄ (Avg Defects/Unit)'; chartLabel = 'c-Chart'
    sigmaLvl = zToSigmaLevel(normInv(1 - Math.min(0.9999, cBar / 1e6)), conv)
  } else {
    const uVals = data.map(r => r[1] / r[0]); const totalC = data.reduce((s, r) => s + r[1], 0); const totalN = data.reduce((s, r) => s + r[0], 0)
    const uBar = totalC / totalN; const nBar = totalN / data.length
    pts = uVals; clVal = uBar; ucl = uBar + 3 * Math.sqrt(uBar / nBar); lcl = Math.max(0, uBar - 3 * Math.sqrt(uBar / nBar))
    dpm = uBar * 1e6; metric = uBar; metricLabel = 'ū (Avg Defects/Unit)'; chartLabel = 'u-Chart'
    sigmaLvl = zToSigmaLevel(normInv(1 - Math.min(0.9999, uBar)), conv)
  }
  const violations = nelsonRules(pts, clVal, (ucl - clVal) / 3, testsFor('attribute', testSet))
  return { pts, clVal, ucl, lcl, labels: pts.map((_, i) => i + 1), chartLabel, dpm, sigmaLvl, metric, metricLabel, violations, dataAdequacy: dataAdequacy(data.length) }
}

export async function POST(request: NextRequest) {
  const refused = guardApi(request, { bucket: 'analyze', ...CALC_LIMITS })
  if (refused) return refused

  // ملحوظة: الحساب نفسه (analyze) مبقاش محتاج تسجيل دخول — الأداة بقت
  // متاحة لأي زائر. تسجيل الدخول مطلوب بس وقت الـ Save أو الـ Excel/PDF
  // export (اتعمل جوه SPCEngine.tsx مش هنا).
  try {
    const body = await request.json()
    if (body.mode === 'attribute') {
      const { data, attrType, fixedN, sigmaConvention } = body
      const testSet: TestSet = isTestSet(body.testSet) ? body.testSet : DEFAULT_TEST_SET
      const result = runAttributeAnalysis({ data, attrType: attrType || 'p', fixedN: fixedN || 100, sigmaConvention, testSet })
      return NextResponse.json({ mode: 'attribute', testSet, ...result })
    }
    const { data, N, LSL, USL, target, sigmaConvention, lastN } = body
    if (!data || !Array.isArray(data) || data.length < 3) {
      return NextResponse.json({ error: 'Please provide at least 3 rows of valid data.' }, { status: 400 })
    }
    const testSet: TestSet = isTestSet(body.testSet) ? body.testSet : DEFAULT_TEST_SET
    const result = runAnalysis({ data, N: N || 1, LSL: LSL ?? null, USL: USL ?? null, target: target ?? null, sigmaConvention, lastN, testSet })
    return NextResponse.json({ ...result, testSet })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: 'Calculation error: ' + message }, { status: 500 })
  }
}