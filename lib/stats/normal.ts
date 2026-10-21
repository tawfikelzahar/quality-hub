// ─────────────────────────────────────────────────────────────────────────
// Standard normal distribution + Anderson-Darling normality test — single
// source of truth for the SPC Engine API, the shared SPC calculator
// (I-MR / X̄-R / X̄-S pages) and the Descriptive Statistics tool.
//
// normCDF uses Hart's double-precision algorithm (Hart 1968, as published
// by G. West, "Better approximations to cumulative normal functions",
// Wilmott 2005): absolute error < 1e-14 over the whole real line, and the
// lower tail is computed directly (no 1 − Φ cancellation), so PPM values in
// the tails match Minitab to the displayed 2 decimals. The previous
// Abramowitz–Stegun 7.1.26 approximation (error ~1.5e-7) was off by up to
// 0.07 PPM.
// ─────────────────────────────────────────────────────────────────────────

/** Φ(z), standard normal CDF. */
export function normCDF(z: number): number {
  if (Number.isNaN(z)) return NaN
  const x = Math.abs(z)
  let c: number
  if (x > 37) {
    c = 0
  } else {
    const e = Math.exp(-(x * x) / 2)
    if (x < 7.07106781186547) {
      let b = 3.52624965998911e-2 * x + 0.700383064443688
      b = b * x + 6.37396220353165
      b = b * x + 33.912866078383
      b = b * x + 112.079291497871
      b = b * x + 221.213596169931
      b = b * x + 220.206867912376
      c = e * b
      b = 8.83883476483184e-2 * x + 1.75566716318264
      b = b * x + 16.064177579207
      b = b * x + 86.7807322029461
      b = b * x + 296.564248779674
      b = b * x + 637.333633378831
      b = b * x + 793.826512519948
      b = b * x + 440.413735824752
      c = c / b
    } else {
      let b = x + 0.65
      b = x + 4 / b
      b = x + 3 / b
      b = x + 2 / b
      b = x + 1 / b
      c = e / b / 2.506628274631
    }
  }
  return z > 0 ? 1 - c : c
}

/** 1 − Φ(z) without cancellation in the upper tail. */
export function normSF(z: number): number {
  return normCDF(-z)
}

/** Φ⁻¹(p) — Acklam's algorithm with one Halley refinement step (≈1e-15). */
export function normInv(p: number): number {
  if (p <= 0) return -Infinity
  if (p >= 1) return Infinity
  const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00]
  const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01]
  const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00]
  const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00]
  const pLo = 0.02425, pHi = 1 - pLo
  let x: number
  if (p < pLo) {
    const q = Math.sqrt(-2 * Math.log(p))
    x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  } else if (p <= pHi) {
    const q = p - 0.5, r = q * q
    x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p))
    x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  }
  // Halley refinement
  const e = normCDF(x) - p
  const u = e * Math.sqrt(2 * Math.PI) * Math.exp((x * x) / 2)
  return x - u / (1 + (x * u) / 2)
}

export interface AndersonDarlingNormal {
  /** A² as Minitab displays it ("AD") */
  A2: number
  /** A²* = A²(1 + 0.75/n + 2.25/n²), used only for the p-value */
  A2adj: number
  p: number
  normal: boolean
}

/**
 * Anderson-Darling normality test (mean and SD estimated from the data).
 * p-value: D'Agostino & Stephens piecewise formula on the adjusted A²* —
 * the formula Minitab documents ("Normality test — methods and formulas").
 * Returns null below 8 points.
 */
export function andersonDarlingNormal(data: number[]): AndersonDarlingNormal | null {
  const n = data.length
  if (n < 8) return null
  const mu = data.reduce((a, b) => a + b, 0) / n
  const sd = Math.sqrt(data.reduce((s, x) => s + (x - mu) ** 2, 0) / (n - 1))
  if (!(sd > 0)) return { A2: 0, A2adj: 0, p: 1, normal: true }
  const sorted = [...data].sort((a, b) => a - b)
  let S = 0
  for (let i = 1; i <= n; i++) {
    const lo = normCDF((sorted[i - 1] - mu) / sd)
    const hiTail = normSF((sorted[n - i] - mu) / sd)
    S += (2 * i - 1) * (Math.log(Math.max(lo, 1e-300)) + Math.log(Math.max(hiTail, 1e-300)))
  }
  const A2 = -n - S / n
  const A2adj = A2 * (1 + 0.75 / n + 2.25 / (n * n))
  let p: number
  if (A2adj > 13) p = 0 // statsmodels normal_ad: p < 4.95e-31; the polynomial turns back up past ~307
  else if (A2adj >= 0.6) p = Math.exp(1.2937 - 5.709 * A2adj + 0.0186 * A2adj * A2adj)
  else if (A2adj >= 0.34) p = Math.exp(0.9177 - 4.279 * A2adj - 1.38 * A2adj * A2adj)
  else if (A2adj >= 0.2) p = 1 - Math.exp(-8.318 + 42.796 * A2adj - 59.938 * A2adj * A2adj)
  else p = 1 - Math.exp(-13.436 + 101.14 * A2adj - 223.73 * A2adj * A2adj)
  p = Math.min(1, Math.max(0, p))
  return { A2, A2adj, p, normal: p >= 0.05 }
}

/** p-value text the way Minitab prints it: "< 0.005" below 0.005, otherwise 3 decimals. */
export function formatPValue(p: number | null | undefined): string {
  if (p === null || p === undefined || !isFinite(p)) return '—'
  if (p < 0.005) return '< 0.005'
  return p.toFixed(3)
}

/** "p = 0.968" / "p < 0.005" — for sentences and labels. */
export function formatPEquals(p: number | null | undefined): string {
  const t = formatPValue(p)
  return t.startsWith('<') ? `p ${t}` : `p = ${t}`
}
