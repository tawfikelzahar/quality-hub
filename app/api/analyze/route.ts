import { NextRequest, NextResponse } from 'next/server'

function mean(arr: number[]) { return arr.reduce((a, b) => a + b, 0) / arr.length }
function stdev(arr: number[], usePop = false) {
  const m = mean(arr)
  const denom = usePop ? arr.length : arr.length - 1
  return Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / denom)
}
// Standard normal CDF — Abramowitz & Stegun 7.1.26 approximation.
// Kept byte-for-byte identical to lib/descriptive/stats.ts's normalCDF so
// the SPC Engine and the Descriptive Statistics tool produce the exact
// same Anderson-Darling result on the same data.
function normCDF(z: number) {
  const sign = z < 0 ? -1 : 1
  const x = Math.abs(z) / Math.SQRT2
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911
  const t = 1 / (1 + p * x)
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x)
  return 0.5 * (1 + sign * y)
}
// Anderson-Darling normality test — identical formulation (adjustment,
// thresholds, clamping) to lib/descriptive/stats.ts's andersonDarlingTest.
function andersonDarling(data: number[]) {
  const n = data.length
  if (n < 8) return null // matches the Descriptive Statistics tool's minimum
  const mu = mean(data), sd = stdev(data)
  if (sd === 0) return { A2: 0, A2adj: 0, p: 1, normal: true }
  const sorted = [...data].sort((a, b) => a - b)
  let S = 0
  for (let i = 1; i <= n; i++) {
    const z1 = normCDF((sorted[i - 1] - mu) / sd)
    const z2 = normCDF((sorted[n - i] - mu) / sd)
    S += (2 * i - 1) * (Math.log(Math.max(z1, 1e-300)) + Math.log(Math.max(1 - z2, 1e-300)))
  }
  const A2raw = -n - S / n
  const A2 = A2raw * (1 + 0.75 / n + 2.25 / (n * n))
  let p: number
  if (A2 >= 0.6) p = Math.exp(1.2937 - 5.709 * A2 + 0.0186 * A2 * A2)
  else if (A2 >= 0.34) p = Math.exp(0.9177 - 4.279 * A2 - 1.38 * A2 * A2)
  else if (A2 >= 0.2) p = 1 - Math.exp(-8.318 + 42.796 * A2 - 59.938 * A2 * A2)
  else p = 1 - Math.exp(-13.436 + 101.14 * A2 - 223.73 * A2 * A2)
  p = Math.min(1, Math.max(0, p))
  return { A2: A2raw, A2adj: A2, p, normal: p >= 0.05 }
}
function nelsonRules(points: number[], cl: number, sigma: number) {
  const n = points.length
  const violations: { rule: number; label: string; points: number[]; desc: string }[] = []
  const z = points.map(p => (p - cl) / sigma)
  const r1pts: number[] = []
  z.forEach((v, i) => { if (Math.abs(v) > 3) r1pts.push(i + 1) })
  if (r1pts.length > 0) violations.push({ rule: 1, label: 'Beyond 3σ', points: r1pts, desc: 'Point(s) beyond control limits.' })
  for (let i = 8; i < n; i++) {
    const run = z.slice(i - 8, i + 1)
    if (run.every(v => v > 0) || run.every(v => v < 0)) { violations.push({ rule: 2, label: '9 in a row — one side', points: [i - 7, i + 1], desc: 'Process shift detected.' }); break }
  }
  for (let i = 5; i < n; i++) {
    const run = points.slice(i - 5, i + 1)
    let inc = true, dec = true
    for (let j = 1; j < run.length; j++) { if (run[j] <= run[j - 1]) inc = false; if (run[j] >= run[j - 1]) dec = false }
    if (inc || dec) { violations.push({ rule: 3, label: '6 in a row — trend', points: [i - 4, i + 1], desc: 'Systematic trend detected.' }); break }
  }
  for (let i = 2; i < n; i++) {
    const run = z.slice(i - 2, i + 1)
    if (run.filter(v => v > 2).length >= 2 || run.filter(v => v < -2).length >= 2) { violations.push({ rule: 5, label: '2 of 3 beyond 2σ', points: [i - 1, i + 1], desc: 'Large shift possible.' }); break }
  }
  for (let i = 4; i < n; i++) {
    const run = z.slice(i - 4, i + 1)
    if (run.filter(v => v > 1).length >= 4 || run.filter(v => v < -1).length >= 4) { violations.push({ rule: 6, label: '4 of 5 beyond 1σ', points: [i - 3, i + 1], desc: 'Moderate shift.' }); break }
  }
  return violations
}
const SPC_CONST: Record<number, { A2: number; D3: number; D4: number }> = {
  2:{A2:1.880,D3:0,D4:3.267},3:{A2:1.023,D3:0,D4:2.574},4:{A2:0.729,D3:0,D4:2.282},
  5:{A2:0.577,D3:0,D4:2.114},6:{A2:0.483,D3:0,D4:2.004},7:{A2:0.419,D3:0.076,D4:1.924},
  8:{A2:0.373,D3:0.136,D4:1.864},9:{A2:0.337,D3:0.184,D4:1.816},10:{A2:0.308,D3:0.223,D4:1.777}
}
function getConst(n: number) {
  const keys = Object.keys(SPC_CONST).map(Number).sort((a, b) => a - b)
  for (const k of keys) if (k >= n) return SPC_CONST[k]
  return SPC_CONST[10]
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
  const above = USL !== null ? (1 - normCDF((USL - mu) / sigma)) * 1e6 : 0
  const below = LSL !== null ? normCDF((LSL - mu) / sigma) * 1e6 : 0
  return { above, below, total: above + below }
}
function zToSigmaLevel(z: number, convention = 'direct') { return convention === 'sixsigma' ? z + 1.5 : z }
function calcCpm(mu: number, sigma: number, LSL: number | null, USL: number | null, target: number | null) {
  if (target === null || LSL === null || USL === null) return null
  const tau = Math.sqrt(sigma ** 2 + (mu - target) ** 2)
  return (USL - LSL) / (6 * tau)
}
function normInv(p: number): number {
  if (p <= 0) return -Infinity; if (p >= 1) return Infinity
  const a=[-3.969683028665376e+01,2.209460984245205e+02,-2.759285104469687e+02,1.383577518672690e+02,-3.066479806614716e+01,2.506628277459239e+00]
  const b=[-5.447609879822406e+01,1.615858368580409e+02,-1.556989798598866e+02,6.680131188771972e+01,-1.328068155288572e+01]
  const c=[-7.784894002430293e-03,-3.223964580411365e-01,-2.400758277161838e+00,-2.549732539343734e+00,4.374664141464968e+00,2.938163982698783e+00]
  const d=[7.784695709041462e-03,3.224671290700398e-01,2.445134137142996e+00,3.754408661907416e+00]
  const p_lo=0.02425,p_hi=1-p_lo; let q,r
  if(p<p_lo){q=Math.sqrt(-2*Math.log(p));return(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1)}
  else if(p<=p_hi){q=p-0.5;r=q*q;return(((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q/(((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1)}
  else{q=Math.sqrt(-2*Math.log(1-p));return-(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1)}
}

function runAnalysis({ data, N, LSL, USL, target, sigmaConvention, lastN }: {
  data: number[][]; N: number; LSL: number | null; USL: number | null;
  target: number | null; sigmaConvention: string; lastN: number
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
    const mrBar = mean(mrs); sigma = mrBar / 1.128; cl_x = mean(xbarVals)
    ucl_x = cl_x + 3 * sigma; lcl_x = cl_x - 3 * sigma; cl_r = mrBar; ucl_r = 3.267 * mrBar; lcl_r = 0
  } else {
    xbarVals = filteredData.map(r => mean(r))
    rangeVals = filteredData.map(r => Math.max(...r) - Math.min(...r)) as number[]
    const rBar = mean(rangeVals as number[])
    const C = getConst(N); const k_sub = filteredData.length
    const totalSS = filteredData.reduce((acc, sg) => { const mu_sg = mean(sg); return acc + sg.reduce((s, x) => s + (x - mu_sg) ** 2, 0) }, 0)
    const totalDF = k_sub * (N - 1); const sp = Math.sqrt(totalSS / totalDF); const c4_val = c4func(totalDF + 1)
    sigma = sp / c4_val; cl_x = mean(xbarVals); ucl_x = cl_x + C.A2 * rBar; lcl_x = cl_x - C.A2 * rBar
    cl_r = rBar; ucl_r = C.D4 * rBar; lcl_r = C.D3 * rBar
  }
  const violations_x = nelsonRules(xbarVals, cl_x, sigma)
  const rangeValsClean = (rangeVals.filter(v => v !== null)) as number[]
  const violations_r = rangeValsClean.length > 2 ? nelsonRules(rangeValsClean, cl_r, cl_r * 0.5) : []
  let Cp = null, Cpk = null, Pp = null, Ppk = null
  if (LSL !== null && USL !== null) {
    const range = USL - LSL
    if (isNormal) { Cp = range / (6 * sigma); Cpk = Math.min((USL - cl_x) / (3 * sigma), (cl_x - LSL) / (3 * sigma)) }
    Pp = range / (6 * sdOverall); Ppk = Math.min((USL - mu) / (3 * sdOverall), (mu - LSL) / (3 * sdOverall))
  } else if (LSL !== null) {
    if (isNormal) Cpk = (cl_x - LSL) / (3 * sigma)
    Ppk = (mu - LSL) / (3 * sdOverall)
  } else if (USL !== null) {
    if (isNormal) Cpk = (USL - cl_x) / (3 * sigma)
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
  const totalP_st = (Z_USL_st !== null ? 1 - normCDF(Z_USL_st) : 0) + (Z_LSL_st !== null ? 1 - normCDF(Z_LSL_st) : 0)
  const totalP_lt = (Z_USL_lt !== null ? 1 - normCDF(Z_USL_lt) : 0) + (Z_LSL_lt !== null ? 1 - normCDF(Z_LSL_lt) : 0)
  const Z_bench_st = (Z_USL_st !== null || Z_LSL_st !== null) ? normInv(1 - totalP_st) : null
  const Z_bench_lt = (Z_USL_lt !== null || Z_LSL_lt !== null) ? normInv(1 - totalP_lt) : null
  const sigLvl_st = Z_bench_st !== null ? Z_bench_st : null
  const sigLvl_lt = Z_bench_lt !== null ? zToSigmaLevel(Z_bench_lt, conv) : null
  const ppmD_st = (LSL !== null || USL !== null) ? ppmDetailed(cl_x, sigma, LSL, USL) : null
  const ppmD_lt = (LSL !== null || USL !== null) ? ppmDetailed(mu, sdOverall, LSL, USL) : null
  return {
    n: allVals.length, mu, sdOverall, min: Math.min(...allVals), max: Math.max(...allVals),
    labels, xbarVals, rangeVals, cl_x, ucl_x, lcl_x, cl_r, ucl_r, lcl_r, sigma,
    violations_x, violations_r, ad, isNormal, Cp, Cpk, Pp, Ppk, Cpm,
    Z_USL_st, Z_LSL_st, Z_USL_lt, Z_LSL_lt, Z_bench_st, Z_bench_lt, sigLvl_st, sigLvl_lt,
    ppmD_st, ppmD_lt, N, LSL, USL
  }
}

function runAttributeAnalysis({ data, attrType, fixedN, sigmaConvention }: {
  data: number[][]; attrType: string; fixedN: number; sigmaConvention: string
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
  const violations = nelsonRules(pts, clVal, (ucl - clVal) / 3)
  return { pts, clVal, ucl, lcl, labels: pts.map((_, i) => i + 1), chartLabel, dpm, sigmaLvl, metric, metricLabel, violations }
}

export async function POST(request: NextRequest) {
  // ملحوظة: الحساب نفسه (analyze) مبقاش محتاج تسجيل دخول — الأداة بقت
  // متاحة لأي زائر. تسجيل الدخول مطلوب بس وقت الـ Save أو الـ Excel/PDF
  // export (اتعمل جوه SPCEngine.tsx مش هنا).
  try {
    const body = await request.json()
    if (body.mode === 'attribute') {
      const { data, attrType, fixedN, sigmaConvention } = body
      const result = runAttributeAnalysis({ data, attrType: attrType || 'p', fixedN: fixedN || 100, sigmaConvention })
      return NextResponse.json({ mode: 'attribute', ...result })
    }
    const { data, N, LSL, USL, target, sigmaConvention, lastN } = body
    if (!data || !Array.isArray(data) || data.length < 3) {
      return NextResponse.json({ error: 'Please provide at least 3 rows of valid data.' }, { status: 400 })
    }
    const result = runAnalysis({ data, N: N || 1, LSL: LSL ?? null, USL: USL ?? null, target: target ?? null, sigmaConvention, lastN })
    return NextResponse.json(result)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: 'Calculation error: ' + message }, { status: 500 })
  }
}