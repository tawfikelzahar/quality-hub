// ─────────────────────────────────────────────────────────────────────────
// Exact t and F distributions through the regularized incomplete beta
// function (Numerical Recipes, 3rd ed., 6.4 — same machinery as
// lib/stability/calc.ts). Server-side formulas: ESLint keeps this file out
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
