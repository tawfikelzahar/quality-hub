// ─────────────────────────────────────────────────────────────────────────
// Descriptive Statistics — engine (server only: /api/descriptive).
//
// Methods as the leading statistical packages document them for the
// Graphical Summary / Display Descriptive Statistics:
//  • quartiles at position (n + 1)p with linear interpolation (Minitab;
//    Hyndman & Fan type 6), clamped to the smallest and largest value
//  • skewness G1 = n / ((n − 1)(n − 2)) · Σ((x − x̄)/s)³ and kurtosis
//    G2 (the bias-corrected pair, same as Excel SKEW / KURT)
//  • CI for the mean: t(1 − α/2, n − 1) · s / √n
//  • CI for StDev: √((n − 1)s² / χ²) with exact chi-square quantiles
//  • CI for the median: Hettmansperger & Sheather (1986) interpolated
//    order statistics — the method Minitab cites for this interval
//  • Anderson-Darling: lib/stats/normal.ts (shared with SPC)
// Checked in tests/golden/descriptive/reference.mts against SciPy
// (stats.skew/kurtosis bias=False, numpy percentile 'weibull', chi2.ppf,
// mstats.median_cihs). tests/golden/descriptive/check.mts compares with
// Minitab once its printed results are added.
// ─────────────────────────────────────────────────────────────────────────
import { andersonDarlingNormal } from '../stats/normal'
import { tQuantile, chiSquareQuantile, binomHalfCDF } from '../stats/dist'

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

// ── Core descriptive statistics ─────────────────────────────────────────

function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

/** Quartile at position (n + 1)p with linear interpolation (type 6), clamped to the data range. */
function percentile(sorted: number[], p: number): number {
  const n = sorted.length
  const w = (n + 1) * p
  if (w <= 1) return sorted[0]
  if (w >= n) return sorted[n - 1]
  const y = Math.floor(w)
  const z = w - y
  return sorted[y - 1] + z * (sorted[y] - sorted[y - 1])
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
 * Anderson-Darling normality test — shared implementation in
 * lib/stats/normal.ts. `statistic` is A² as Minitab displays it ("AD");
 * the p-value is computed from the sample-size-adjusted A²*.
 */
function andersonDarlingTest(sorted: number[], _m: number, s: number): AndersonDarlingResult | null {
  if (sorted.length < 8 || s <= 0) return null
  const r = andersonDarlingNormal(sorted)
  if (!r) return null
  return { statistic: r.A2, pValue: r.p, normalAtAlpha05: r.normal }
}

/**
 * CI for the median — Hettmansperger & Sheather (1986), interpolated order
 * statistics (same steps as NIST Dataplot and SciPy mstats.median_cihs):
 * k from the binomial(n, ½) so that the coverage γk of (x(k), x(n−k+1))
 * is at least 1 − α and γk+1 is below it, then
 * I = (γk − (1 − α)) / (γk − γk+1), λ = (n − k) I / (k + (n − 2k) I),
 * lower = λ x(k+1) + (1 − λ) x(k), upper = λ x(n−k) + (1 − λ) x(n−k+1).
 */
function medianCI(sorted: number[], confidence: number): ConfidenceInterval | null {
  const n = sorted.length
  const alpha = 1 - confidence
  const gamma = (k: number) => binomHalfCDF(n - k, n) - binomHalfCDF(k - 1, n)
  // largest k ≥ 1 whose interval still covers 1 − α
  let k = 0
  while (k + 1 <= n / 2 && gamma(k + 1) >= 1 - alpha) k++
  if (k < 1) return null // too few points: even (min, max) covers less than 1 − α
  const gk = gamma(k)
  const gk1 = gamma(k + 1)
  const I = gk - gk1 > 0 ? (gk - (1 - alpha)) / (gk - gk1) : 0
  const lam = ((n - k) * I) / (k + (n - 2 * k) * I)
  const x = (i: number) => sorted[i - 1]
  return { lower: lam * x(k + 1) + (1 - lam) * x(k), upper: lam * x(n - k) + (1 - lam) * x(n - k + 1) }
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
    const sumZ3 = sorted.reduce((s, v) => s + ((v - m) / stdev) ** 3, 0)
    skewness = (n / ((n - 1) * (n - 2))) * sumZ3
    if (Math.abs(skewness) < 1e-12) skewness = 0 // rounding noise on symmetric data
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
          const tCrit = tQuantile(1 - (1 - confidence) / 2, n - 1)
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
