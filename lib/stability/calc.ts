// ─────────────────────────────────────────────────────────────────────────
// Stability Study — shelf-life estimation math (ICH Q1E style)
// No external statistics dependency — same convention as DPMOCalculator's
// own inverse-normal CDF (Acklam algorithm): implement the needed
// distribution functions locally so the tool has no new npm dependency.
// ─────────────────────────────────────────────────────────────────────────

export interface StabilityPoint {
  time: number; // months since t0
  value: number;
}

export interface BatchData {
  id: string;
  name: string;
  points: StabilityPoint[];
}

export interface RegressionResult {
  slope: number;
  intercept: number;
  r2: number;
  n: number;
  df: number; // n - 2
  seSlope: number;
  seIntercept: number;
  mse: number; // residual mean square (SSE / df)
  meanX: number;
  sxx: number; // sum (x - meanX)^2
}

/** Ordinary least squares linear regression: value = intercept + slope * time */
export function linearRegression(points: StabilityPoint[]): RegressionResult | null {
  const n = points.length;
  if (n < 2) return null;

  const meanX = points.reduce((s, p) => s + p.time, 0) / n;
  const meanY = points.reduce((s, p) => s + p.value, 0) / n;

  let sxx = 0, sxy = 0, syy = 0;
  for (const p of points) {
    const dx = p.time - meanX;
    const dy = p.value - meanY;
    sxx += dx * dx;
    sxy += dx * dy;
    syy += dy * dy;
  }
  if (sxx === 0) return null;

  const slope = sxy / sxx;
  const intercept = meanY - slope * meanX;

  let sse = 0;
  for (const p of points) {
    const pred = intercept + slope * p.time;
    sse += (p.value - pred) ** 2;
  }
  const df = n - 2;
  const mse = df > 0 ? sse / df : 0;
  const r2 = syy !== 0 ? 1 - sse / syy : 1;
  const seSlope = df > 0 ? Math.sqrt(mse / sxx) : 0;
  const seIntercept = df > 0 ? Math.sqrt(mse * (1 / n + meanX ** 2 / sxx)) : 0;

  return { slope, intercept, r2, n, df, seSlope, seIntercept, mse, meanX, sxx };
}

/**
 * Predicted mean response at time t, plus the two-sided confidence interval
 * for the regression line at that point (uses tCrit for the chosen
 * confidence level and residual df).
 */
export function predictionAt(reg: RegressionResult, t: number, tCrit: number) {
  const pred = reg.intercept + reg.slope * t;
  const sePred =
    reg.df > 0 ? Math.sqrt(reg.mse * (1 / reg.n + (t - reg.meanX) ** 2 / reg.sxx)) : 0;
  const halfWidth = tCrit * sePred;
  return { pred, lower: pred - halfWidth, upper: pred + halfWidth, sePred };
}

// ── Gamma / incomplete-beta machinery (Numerical Recipes style) ────────────

function logGamma(x: number): number {
  const cof = [
    676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012,
    9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  x -= 1;
  const t = x + 7.5;
  let a = 0.99999999999980993;
  for (let i = 0; i < cof.length; i++) a += cof[i] / (x + i + 1);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

function betacf(x: number, a: number, b: number): number {
  const MAXIT = 200, EPS = 3e-9, FPMIN = 1e-30;
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

function regularizedIncompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(
    logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x)
  );
  if (x < (a + 1) / (a + b + 2)) return (bt * betacf(x, a, b)) / a;
  return 1 - (bt * betacf(1 - x, b, a)) / b;
}

/** Two-sided Student-t CDF: P(|T| <= t) for `df` degrees of freedom. */
function tTwoSidedCDF(t: number, df: number): number {
  if (df <= 0) return 0;
  const x = df / (df + t * t);
  return 1 - regularizedIncompleteBeta(x, df / 2, 0.5);
}

/** Critical t value s.t. P(|T| <= tCrit) = confidence, via bisection. */
export function tCritical(confidence: number, df: number): number {
  if (df <= 0) return 0;
  let lo = 0, hi = 60;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (tTwoSidedCDF(mid, df) < confidence) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/** F-distribution CDF via the regularized incomplete beta function. */
function fCDF(f: number, d1: number, d2: number): number {
  if (f <= 0) return 0;
  const x = (d1 * f) / (d1 * f + d2);
  return regularizedIncompleteBeta(x, d1 / 2, d2 / 2);
}

export type TrendDirection = 'decreasing' | 'increasing';

/**
 * Time (months) at which the one-sided confidence bound on the regression
 * line first crosses the given specification limit — the standard ICH Q1E
 * shelf-life determination. `maxObservedMonth` marks the last real data
 * point, used only to flag whether the result required extrapolation.
 */
export function findShelfLife(
  reg: RegressionResult,
  tCrit: number,
  specLimit: number,
  direction: TrendDirection,
  maxObservedMonth: number,
  maxSearchMonths = 120
): { shelfLifeMonths: number | null; extrapolated: boolean } {
  const boundAt = (t: number) => {
    const { lower, upper } = predictionAt(reg, t, tCrit);
    return direction === 'decreasing' ? lower : upper;
  };
  const crosses = (t: number) =>
    direction === 'decreasing' ? boundAt(t) <= specLimit : boundAt(t) >= specLimit;

  if (crosses(0)) return { shelfLifeMonths: 0, extrapolated: false };
  if (!crosses(maxSearchMonths)) return { shelfLifeMonths: null, extrapolated: false };

  let lo = 0, hi = maxSearchMonths;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (crosses(mid)) hi = mid; else lo = mid;
  }
  return { shelfLifeMonths: hi, extrapolated: hi > maxObservedMonth };
}

// ── Poolability (ANCOVA-style) test across batches ──────────────────────
// Per ICH Q1E: test equality of slopes first, then (if slopes are common)
// equality of intercepts. Conventionally uses a liberal alpha (0.25) so the
// test isn't underpowered with the small sample sizes typical of stability
// studies.

export interface PoolabilityResult {
  slopesF: number;
  slopesDf1: number;
  slopesDf2: number;
  slopesP: number;
  slopesPoolable: boolean;
  interceptsF: number;
  interceptsDf1: number;
  interceptsDf2: number;
  interceptsP: number;
  interceptsPoolable: boolean;
  fullyPoolable: boolean;
}

export function poolabilityTest(
  batches: BatchData[],
  alpha = 0.25
): PoolabilityResult | null {
  const k = batches.length;
  if (k < 2) return null;

  const regs = batches.map((b) => linearRegression(b.points));
  if (regs.some((r) => !r)) return null;
  const validRegs = regs as RegressionResult[];

  let sseIndividual = 0, dfIndividual = 0;
  let sxxTotal = 0, sxyTotal = 0, syyTotal = 0, nTotal = 0;

  for (const r of validRegs) {
    const sseI = r.mse * r.df;
    sseIndividual += sseI;
    dfIndividual += r.df;
    sxxTotal += r.sxx;
    sxyTotal += r.slope * r.sxx;
    syyTotal += sseI + r.slope ** 2 * r.sxx;
    nTotal += r.n;
  }
  if (dfIndividual <= 0 || sxxTotal === 0) return null;

  // Model: common slope, separate intercepts
  const sse2 = syyTotal - sxyTotal ** 2 / sxxTotal;
  const df2 = nTotal - k - 1;
  if (df2 <= 0) return null;

  const dfNumSlopes = k - 1;
  const fSlopes = (sse2 - sseIndividual) / dfNumSlopes / (sseIndividual / dfIndividual);
  const pSlopes = 1 - fCDF(Math.max(fSlopes, 0), dfNumSlopes, dfIndividual);

  // Model: single fully-pooled line through all points combined
  const allPoints = batches.flatMap((b) => b.points);
  const pooledReg = linearRegression(allPoints);
  if (!pooledReg || pooledReg.df <= 0) return null;
  const sse3 = pooledReg.mse * pooledReg.df;

  const dfNumIntercepts = k - 1;
  const fIntercepts = (sse3 - sse2) / dfNumIntercepts / (sse2 / df2);
  const pIntercepts = 1 - fCDF(Math.max(fIntercepts, 0), dfNumIntercepts, df2);

  const slopesPoolable = pSlopes > alpha;
  const interceptsPoolable = pIntercepts > alpha;

  return {
    slopesF: fSlopes, slopesDf1: dfNumSlopes, slopesDf2: dfIndividual, slopesP: pSlopes,
    slopesPoolable,
    interceptsF: fIntercepts, interceptsDf1: dfNumIntercepts, interceptsDf2: df2, interceptsP: pIntercepts,
    interceptsPoolable,
    fullyPoolable: slopesPoolable && interceptsPoolable,
  };
}

// ── Common ICH storage conditions (informational label only) ──────────────
export const STORAGE_CONDITIONS = [
  { key: 'long-term', label: 'Long-term — 25°C / 60% RH' },
  { key: 'intermediate', label: 'Intermediate — 30°C / 65% RH' },
  { key: 'accelerated', label: 'Accelerated — 40°C / 75% RH' },
  { key: 'custom', label: 'Custom' },
] as const;
