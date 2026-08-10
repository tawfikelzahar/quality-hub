// ─────────────────────────────────────────────────────────────────────────
// Descriptive Statistics — engine
// No external statistics dependency — same convention as DPMOCalculator's
// inverse-normal CDF and the Stability Study's Student-t/F machinery:
// implement the needed distribution functions locally so the tool stays
// self-contained with no new npm dependency.
// ─────────────────────────────────────────────────────────────────────────

export interface HistogramBin {
  x0: number
  x1: number
  count: number
}

export interface BoxPlotSummary {
  min: number
  q1: number
  median: number
  q3: number
  max: number
  lowerWhisker: number // lowest point within 1.5*IQR of Q1
  upperWhisker: number // highest point within 1.5*IQR of Q3
  outliers: number[]
}

export interface ConfidenceInterval {
  lower: number
  upper: number
}

export interface AndersonDarlingResult {
  statistic: number // adjusted A²*
  pValue: number
  normalAtAlpha05: boolean // p >= 0.05 → fail to reject normality
}

export interface DescriptiveResult {
  n: number
  mean: number
  stdev: number
  variance: number
  cv: number | null // % — null when mean is 0 (undefined)
  skewness: number | null
  kurtosis: number | null
  min: number
  q1: number
  median: number
  q3: number
  max: number
  iqr: number
  range: number
  ciMean: ConfidenceInterval | null
  ciMedian: ConfidenceInterval | null
  ciStdev: ConfidenceInterval | null
  andersonDarling: AndersonDarlingResult | null
  histogram: HistogramBin[]
  boxPlot: BoxPlotSummary
}

// ── Gamma / incomplete-beta machinery (Numerical Recipes style) ────────────
// Same formulation already used in lib/stability/calc.ts and
// app/api/gage-rr/route.ts — duplicated here so this tool has no cross-file
// runtime dependency (matches the project's per-tool self-containment).

function logGamma(x: number): number {
  const cof = [
    676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012,
    9.9843695780195716e-6, 1.5056327351493116e-7,
  ]
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x)
  x -= 1
  const t = x + 7.5
  let a = 0.99999999999980993
  for (let i = 0; i < cof.length; i++) a += cof[i] / (x + i + 1)
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a)
}

function betacf(x: number, a: number, b: number): number {
  const MAXIT = 200, EPS = 3e-9, FPMIN = 1e-30
  const qab = a + b, qap = a + 1, qam = a - 1
  let c = 1
  let d = 1 - (qab * x) / qap
  if (Math.abs(d) < FPMIN) d = FPMIN
  d = 1 / d
  let h = d
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2))
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d; h *= d * c
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2))
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < EPS) break
  }
  return h
}

function regularizedIncompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const bt = Math.exp(
    logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x)
  )
  if (x < (a + 1) / (a + b + 2)) return (bt * betacf(x, a, b)) / a
  return 1 - (bt * betacf(1 - x, b, a)) / b
}

function tTwoSidedCDF(t: number, df: number): number {
  if (df <= 0) return 0
  const x = df / (df + t * t)
  return 1 - regularizedIncompleteBeta(x, df / 2, 0.5)
}

/** Critical t value s.t. P(|T| <= tCrit) = confidence, via bisection. */
function tCritical(confidence: number, df: number): number {
  if (df <= 0) return 0
  let lo = 0, hi = 60
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2
    if (tTwoSidedCDF(mid, df) < confidence) lo = mid; else hi = mid
  }
  return (lo + hi) / 2
}

// ── Standard normal CDF and inverse CDF ─────────────────────────────────

/** Φ(z) — standard normal CDF via the erf approximation (Abramowitz & Stegun 7.1.26). */
function normalCDF(z: number): number {
  const sign = z < 0 ? -1 : 1
  const x = Math.abs(z) / Math.SQRT2
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911
  const t = 1 / (1 + p * x)
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x)
  return 0.5 * (1 + sign * y)
}

/** Inverse standard normal CDF (Acklam's algorithm) — same formulation as DPMOCalculator. */
function normSInv(p: number): number {
  if (p <= 0) return -6
  if (p >= 1) return 6

  const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00]
  const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01]
  const cc = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00]
  const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00]

  const pLow = 0.02425
  const pHigh = 1 - pLow

  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p))
    return (((((cc[0] * q + cc[1]) * q + cc[2]) * q + cc[3]) * q + cc[4]) * q + cc[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  } else if (p <= pHigh) {
    const q = p - 0.5
    const r = q * q
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p))
    return -(((((cc[0] * q + cc[1]) * q + cc[2]) * q + cc[3]) * q + cc[4]) * q + cc[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  }
}

/**
 * Chi-square quantile via the Wilson–Hilferty approximation. Good to
 * ~3 significant figures for df >= 5, adequate for a two-sided 95% StDev
 * CI in a quality-engineering context (not used for hard pass/fail gates).
 */
function chiSquareQuantile(p: number, df: number): number {
  const z = normSInv(p)
  const term = 1 - 2 / (9 * df) + z * Math.sqrt(2 / (9 * df))
  return df * Math.pow(term, 3)
}

// ── Core descriptive statistics ─────────────────────────────────────────

function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

/** Percentile via linear interpolation (Excel PERCENTILE.INC / R type-7 — the common convention). */
function percentile(sorted: number[], p: number): number {
  const n = sorted.length
  if (n === 1) return sorted[0]
  const idx = p * (n - 1)
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}

function sturgesBinCount(n: number): number {
  return Math.max(1, Math.ceil(Math.log2(n) + 1))
}

function buildHistogram(sorted: number[], min: number, max: number): HistogramBin[] {
  const n = sorted.length
  const k = sturgesBinCount(n)
  const range = max - min
  const width = range > 0 ? range / k : 1
  const bins: HistogramBin[] = Array.from({ length: k }, (_, i) => ({
    x0: min + i * width,
    x1: min + (i + 1) * width,
    count: 0,
  }))
  if (range === 0) {
    bins[0].count = n
    return bins
  }
  for (const v of sorted) {
    let idx = Math.floor((v - min) / width)
    if (idx >= k) idx = k - 1 // include the max value in the last bin
    if (idx < 0) idx = 0
    bins[idx].count++
  }
  return bins
}

function buildBoxPlot(sorted: number[], q1: number, median: number, q3: number): BoxPlotSummary {
  const iqr = q3 - q1
  const lowerFence = q1 - 1.5 * iqr
  const upperFence = q3 + 1.5 * iqr
  const inFence = sorted.filter((v) => v >= lowerFence && v <= upperFence)
  const lowerWhisker = inFence.length ? Math.min(...inFence) : sorted[0]
  const upperWhisker = inFence.length ? Math.max(...inFence) : sorted[sorted.length - 1]
  const outliers = sorted.filter((v) => v < lowerFence || v > upperFence)
  return {
    min: sorted[0],
    q1,
    median,
    q3,
    max: sorted[sorted.length - 1],
    lowerWhisker,
    upperWhisker,
    outliers,
  }
}

/**
 * Anderson-Darling normality test.
 * A² computed against the fitted normal(mean, stdev), then adjusted for
 * sample size (Stephens, 1974) and converted to an approximate p-value via
 * the standard piecewise formula (D'Agostino & Stephens, "Goodness-of-Fit
 * Techniques") — the same approximation used by most stats packages when
 * an exact table lookup isn't available.
 */
function andersonDarlingTest(sorted: number[], m: number, s: number): AndersonDarlingResult | null {
  const n = sorted.length
  if (n < 8 || s <= 0) return null // unreliable / undefined below ~8 points

  const z = sorted.map((v) => (v - m) / s)
  let sum = 0
  for (let i = 0; i < n; i++) {
    const cdfLow = normalCDF(z[i])
    const cdfHigh = normalCDF(z[n - 1 - i])
    // Clamp to avoid log(0) from floating-point saturation at the tails.
    const lnLow = Math.log(Math.max(cdfLow, 1e-300))
    const ln1MinusHigh = Math.log(Math.max(1 - cdfHigh, 1e-300))
    sum += (2 * (i + 1) - 1) * (lnLow + ln1MinusHigh)
  }
  const aSquared = -n - sum / n
  const aStar = aSquared * (1 + 0.75 / n + 2.25 / (n * n))

  let p: number
  if (aStar >= 0.6) {
    p = Math.exp(1.2937 - 5.709 * aStar + 0.0186 * aStar * aStar)
  } else if (aStar >= 0.34) {
    p = Math.exp(0.9177 - 4.279 * aStar - 1.38 * aStar * aStar)
  } else if (aStar >= 0.2) {
    p = 1 - Math.exp(-8.318 + 42.796 * aStar - 59.938 * aStar * aStar)
  } else {
    p = 1 - Math.exp(-13.436 + 101.14 * aStar - 223.73 * aStar * aStar)
  }
  p = Math.min(1, Math.max(0, p))

  return { statistic: aStar, pValue: p, normalAtAlpha05: p >= 0.05 }
}

/** 95% CI for the median via the order-statistic (binomial) method. */
function medianCI(sorted: number[], confidence: number): ConfidenceInterval | null {
  const n = sorted.length
  if (n < 6) return null // too few points for a meaningful nonparametric CI
  const z = normSInv(1 - (1 - confidence) / 2)
  const j = Math.floor(n / 2 - (z * Math.sqrt(n)) / 2)
  const k = Math.ceil(n / 2 + 1 + (z * Math.sqrt(n)) / 2)
  const lo = Math.max(1, j)
  const hi = Math.min(n, k)
  if (lo >= hi) return null
  return { lower: sorted[lo - 1], upper: sorted[hi - 1] }
}

export function computeDescriptiveStats(raw: number[], confidence = 0.95): DescriptiveResult {
  const data = raw.filter((v) => Number.isFinite(v))
  const sorted = [...data].sort((a, b) => a - b)
  const n = sorted.length
  if (n === 0) throw new Error('No valid numeric data provided.')

  const m = mean(sorted)
  const variance = n > 1 ? sorted.reduce((s, v) => s + (v - m) ** 2, 0) / (n - 1) : 0
  const stdev = Math.sqrt(variance)
  const cv = m !== 0 ? (stdev / Math.abs(m)) * 100 : null

  let skewness: number | null = null
  if (n >= 3 && stdev > 0) {
    const g1 = sorted.reduce((s, v) => s + ((v - m) / stdev) ** 3, 0) / n
    skewness = (Math.sqrt(n * (n - 1)) / (n - 2)) * g1
  }

  let kurtosis: number | null = null
  if (n >= 4 && stdev > 0) {
    const sumP4 = sorted.reduce((s, v) => s + ((v - m) / stdev) ** 4, 0)
    kurtosis =
      ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * sumP4 -
      (3 * (n - 1) ** 2) / ((n - 2) * (n - 3))
  }

  const min = sorted[0]
  const max = sorted[n - 1]
  const q1 = percentile(sorted, 0.25)
  const median = percentile(sorted, 0.5)
  const q3 = percentile(sorted, 0.75)
  const iqr = q3 - q1
  const range = max - min

  const ciMean: ConfidenceInterval | null =
    n >= 2 && stdev > 0
      ? (() => {
          const tCrit = tCritical(confidence, n - 1)
          const halfWidth = tCrit * (stdev / Math.sqrt(n))
          return { lower: m - halfWidth, upper: m + halfWidth }
        })()
      : null

  const ciMedianVal = medianCI(sorted, confidence)

  const ciStdev: ConfidenceInterval | null =
    n >= 2 && stdev > 0
      ? (() => {
          const df = n - 1
          const alpha = 1 - confidence
          const chiUpper = chiSquareQuantile(1 - alpha / 2, df)
          const chiLower = chiSquareQuantile(alpha / 2, df)
          if (chiUpper <= 0 || chiLower <= 0) return null
          return {
            lower: Math.sqrt((df * variance) / chiUpper),
            upper: Math.sqrt((df * variance) / chiLower),
          }
        })()
      : null

  const andersonDarling = andersonDarlingTest(sorted, m, stdev)
  const histogram = buildHistogram(sorted, min, max)
  const boxPlot = buildBoxPlot(sorted, q1, median, q3)

  return {
    n, mean: m, stdev, variance, cv, skewness, kurtosis,
    min, q1, median, q3, max, iqr, range,
    ciMean, ciMedian: ciMedianVal, ciStdev,
    andersonDarling, histogram, boxPlot,
  }
}
