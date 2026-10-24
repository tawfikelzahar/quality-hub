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

export { STORAGE_CONDITIONS } from './options';

// ─────────────────────────────────────────────────────────────────────────
// Full ICH Q1E analysis for /api/stability (24 Oct 2026, approved by Tawfik)
// ─────────────────────────────────────────────────────────────────────────
// • Confidence bound: one-sided at the chosen level when one acceptance
//   limit is given; two-sided (each side (1 + level) / 2) when both are
//   given — ICH Q1E, as implemented in JMP's Stability Analysis.
//   The earlier version used the two-sided t for a single limit, i.e. a
//   one-sided 97.5% bound, which shortened every shelf life.
// • Model (α = 0.25): equal slopes first; if they differ → each batch on its
//   own line (worst batch). If slopes are common → equal intercepts; if they
//   differ → common slope with an intercept per batch (worst batch, pooled
//   MSE); otherwise one line through all data.
// Checked against expirest (CRAN, LeBlond et al. 2011 data) and the JMP
// Stability example — tests/golden/stability/check.mts.
// ─────────────────────────────────────────────────────────────────────────

export type StabilityModel = 'single' | 'pooled' | 'common-slope' | 'separate';

export interface StabilityInput {
  batches: { name: string; points: StabilityPoint[] }[];
  lower: number | null;
  upper: number | null;
  /** confidence level, 0–1 (e.g. 0.95) */
  confidence: number;
}

export interface StabilityBatchOut {
  name: string;
  n: number;
  /** own regression (descriptive) */
  slope: number;
  intercept: number;
  r2: number;
  /** line used by the chosen model for this batch */
  modelSlope: number;
  modelIntercept: number;
  /** shelf life of this batch under the chosen model (null: not reached within the search range) */
  shelfLife: number | null;
  extrapolated: boolean;
}

export interface StabilityResult {
  model: StabilityModel | null;
  sided: 'one' | 'two';
  tCrit: number;
  df: number;
  maxObserved: number;
  poolability: PoolabilityResult | null;
  batches: StabilityBatchOut[];
  /** one line through all data (shown for reference even when not chosen) */
  pooled: { slope: number; intercept: number; r2: number; shelfLife: number | null; extrapolated: boolean } | null;
  recommended: number | null;
  /** batch that sets the shelf life (null when one line is used) */
  limiting: string | null;
  extrapolated: boolean;
  /** confidence bound of the line that sets the shelf life, for the chart */
  bound: { t: number; lower: number | null; upper: number | null }[];
}

const SEARCH_MAX = 120;

/** First time in [0, SEARCH_MAX] where the bound reaches a limit (fine grid, then bisection). */
function firstCrossing(crosses: (t: number) => boolean): number | null {
  if (crosses(0)) return 0;
  const step = 0.05;
  let prev = 0;
  for (let t = step; t <= SEARCH_MAX + 1e-9; t += step) {
    if (crosses(t)) {
      let lo = prev, hi = t;
      for (let i = 0; i < 60; i++) {
        const mid = (lo + hi) / 2;
        if (crosses(mid)) hi = mid; else lo = mid;
      }
      return hi;
    }
    prev = t;
  }
  return null;
}

interface Line {
  a: number;
  b: number;
  /** variance factor of the fitted mean at t, without σ²: 1/n + (t − x̄)²/Sxx */
  v: (t: number) => number;
  mse: number;
  df: number;
}

export function analyzeStability(input: StabilityInput): StabilityResult | null {
  const batches = input.batches.filter((b) => b.points.length >= 2);
  if (batches.length === 0) return null;
  const two = input.lower !== null && input.upper !== null;
  const sideLevel = two ? (1 + input.confidence) / 2 : input.confidence;
  /** t for a one-sided bound at sideLevel */
  const tCache = new Map<number, number>();
  const tFor = (df: number) => {
    if (df <= 0) return 0;
    let v = tCache.get(df);
    if (v === undefined) { v = tCritical(2 * sideLevel - 1, df); tCache.set(df, v); }
    return v;
  };
  const maxObserved = Math.max(...batches.flatMap((b) => b.points.map((p) => p.time)));

  const own = batches.map((b) => linearRegression(b.points));
  if (own.some((r) => !r)) return null;
  const regs = own as RegressionResult[];
  const all = batches.flatMap((b) => b.points);
  const pooledReg = linearRegression(all);
  const poolability = batches.length >= 2 ? poolabilityTest(batches as BatchData[]) : null;

  // model choice
  let model: StabilityModel;
  if (batches.length === 1) model = 'single';
  else if (!poolability) model = 'separate';
  else if (!poolability.slopesPoolable) model = 'separate';
  else if (!poolability.interceptsPoolable) model = 'common-slope';
  else model = 'pooled';

  const lineFromReg = (r: RegressionResult): Line => ({
    a: r.intercept, b: r.slope, mse: r.mse, df: r.df,
    v: (t) => 1 / r.n + (t - r.meanX) ** 2 / r.sxx,
  });

  let lines: Line[];
  if (model === 'pooled') {
    lines = [lineFromReg(pooledReg as RegressionResult)];
  } else if (model === 'common-slope') {
    let sxx = 0, sxy = 0, N = 0;
    const stats = batches.map((b) => {
      const n = b.points.length;
      const mx = b.points.reduce((s, p) => s + p.time, 0) / n;
      const my = b.points.reduce((s, p) => s + p.value, 0) / n;
      for (const p of b.points) { sxx += (p.time - mx) ** 2; sxy += (p.time - mx) * (p.value - my); }
      N += n;
      return { n, mx, my, pts: b.points };
    });
    const slope = sxy / sxx;
    let sse = 0;
    for (const s of stats) for (const p of s.pts) sse += (p.value - s.my - slope * (p.time - s.mx)) ** 2;
    const df = N - batches.length - 1;
    const mse = df > 0 ? sse / df : 0;
    lines = stats.map((s) => ({ a: s.my - slope * s.mx, b: slope, mse, df, v: (t: number) => 1 / s.n + (t - s.mx) ** 2 / sxx }));
  } else {
    lines = regs.map(lineFromReg);
  }

  const lowerAt = (l: Line, t: number) => l.a + l.b * t - tFor(l.df) * Math.sqrt(l.mse * l.v(t));
  const upperAt = (l: Line, t: number) => l.a + l.b * t + tFor(l.df) * Math.sqrt(l.mse * l.v(t));
  const life = (l: Line): number | null => {
    if (input.lower === null && input.upper === null) return null;
    return firstCrossing((t) =>
      (input.lower !== null && lowerAt(l, t) <= input.lower) || (input.upper !== null && upperAt(l, t) >= input.upper));
  };
  const lives = lines.map(life);

  const out: StabilityBatchOut[] = batches.map((b, i) => {
    const line = model === 'pooled' ? lines[0] : lines[i];
    const sl = model === 'pooled' ? lives[0] : lives[i];
    return {
      name: b.name, n: b.points.length, slope: regs[i].slope, intercept: regs[i].intercept, r2: regs[i].r2,
      modelSlope: line.b, modelIntercept: line.a, shelfLife: sl, extrapolated: sl !== null && sl > maxObserved,
    };
  });

  let recommended: number | null = null;
  let limiting: string | null = null;
  let limitLine: Line = lines[0];
  if (model === 'pooled' || model === 'single') {
    recommended = lives[0];
    limitLine = lines[0];
    limiting = model === 'single' ? batches[0].name : null;
  } else {
    lives.forEach((v, i) => {
      if (v !== null && (recommended === null || v < recommended)) { recommended = v; limiting = batches[i].name; limitLine = lines[i]; }
    });
  }

  const pooledLife = pooledReg ? life(lineFromReg(pooledReg)) : null;
  const tEnd = Math.max(maxObserved * 1.15, (recommended ?? 0) * 1.15, 6);
  const bound = Array.from({ length: 61 }, (_, i) => {
    const t = (tEnd * i) / 60;
    return {
      t,
      lower: input.lower !== null ? lowerAt(limitLine, t) : null,
      upper: input.upper !== null ? upperAt(limitLine, t) : null,
    };
  });

  return {
    model, sided: two ? 'two' : 'one', tCrit: tFor(limitLine.df), df: limitLine.df, maxObserved, poolability,
    batches: out,
    pooled: pooledReg ? { slope: pooledReg.slope, intercept: pooledReg.intercept, r2: pooledReg.r2, shelfLife: pooledLife, extrapolated: pooledLife !== null && pooledLife > maxObserved } : null,
    recommended, limiting, extrapolated: recommended !== null && (recommended as number) > maxObserved, bound,
  };
}
