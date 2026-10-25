// ─────────────────────────────────────────────────────────────────────────
// Exact t and F distributions through the regularized incomplete beta
// function (Numerical Recipes, 3rd ed., 6.4 — same machinery as
// lib/stability/calc.ts); chi-square through the incomplete gamma (6.2);
// the binomial with p = 1/2 for the median interval. Server-side formulas: ESLint keeps this file out
// of the browser bundle.
//
// Checked in tests/golden/doe/check.mts against SAS PROC GLM printed
// p-values (F with 1 and 5 df) and the t quantile t(0.975, 5) = 2.5706.
// ─────────────────────────────────────────────────────────────────────────

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
  const MAXIT = 300, EPS = 1e-14, FPMIN = 1e-300
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

/** I_x(a, b) */
export function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const bt = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x))
  if (x < (a + 1) / (a + b + 2)) return (bt * betacf(x, a, b)) / a
  return 1 - (bt * betacf(1 - x, b, a)) / b
}

/** Upper tail P(F > f) for F(d1, d2). Computed from the small side so tiny p-values keep their digits. */
export function fSF(f: number, d1: number, d2: number): number {
  if (!(f > 0)) return 1
  return incompleteBeta(d2 / (d2 + d1 * f), d2 / 2, d1 / 2)
}

/** Two-sided p-value P(|T| > |t|) for Student t with df degrees of freedom. */
export function tTwoSidedP(t: number, df: number): number {
  return incompleteBeta(df / (df + t * t), df / 2, 0.5)
}

/** Quantile t(p, df) for p in (0.5, 1), by bisection on the two-sided tail. */
export function tQuantile(p: number, df: number): number {
  const tail = 2 * (1 - p)
  let lo = 0, hi = 1000
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2
    if (tTwoSidedP(mid, df) > tail) lo = mid; else hi = mid
  }
  return (lo + hi) / 2
}

// ── Chi-square and binomial (Descriptive: StDev and median intervals) ──────

/** Regularized lower incomplete gamma P(a, x) (Numerical Recipes 6.2: series below a + 1, continued fraction above). */
export function lowerGammaP(a: number, x: number): number {
  if (x <= 0) return 0
  const gln = logGamma(a)
  if (x < a + 1) {
    let ap = a, sum = 1 / a, del = sum
    for (let n = 0; n < 1000; n++) {
      ap += 1; del *= x / ap; sum += del
      if (Math.abs(del) < Math.abs(sum) * 1e-15) break
    }
    return sum * Math.exp(-x + a * Math.log(x) - gln)
  }
  const FPMIN = 1e-300
  let b = x + 1 - a, c = 1 / FPMIN, d = 1 / b, h = d
  for (let i = 1; i < 1000; i++) {
    const an = -i * (i - a)
    b += 2
    d = an * d + b; if (Math.abs(d) < FPMIN) d = FPMIN
    c = b + an / c; if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < 1e-15) break
  }
  return 1 - Math.exp(-x + a * Math.log(x) - gln) * h
}

/** Quantile of the chi-square distribution with df degrees of freedom, P(X ≤ q) = p. */
export function chiSquareQuantile(p: number, df: number): number {
  let lo = 0, hi = Math.max(10, df * 10)
  while (lowerGammaP(df / 2, hi / 2) < p) hi *= 2
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2
    if (lowerGammaP(df / 2, mid / 2) < p) lo = mid; else hi = mid
  }
  return (lo + hi) / 2
}

/** Binomial CDF P(W ≤ k), W ~ Bin(n, 0.5), from log-gamma terms (exact to rounding for any n). */
export function binomHalfCDF(k: number, n: number): number {
  if (k < 0) return 0
  if (k >= n) return 1
  const lgn = logGamma(n + 1)
  let s = 0
  for (let i = 0; i <= k; i++) s += Math.exp(lgn - logGamma(i + 1) - logGamma(n - i + 1) - n * Math.LN2)
  return Math.min(1, s)
}
