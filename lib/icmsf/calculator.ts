import {
  ICMSF_CASES,
  getIcmsfCase,
  getIcmsfCaseByNumber,
  type ConditionEffect,
  type HazardLevel,
  type IcmsfCase,
} from './tables';

// ─────────────────────────────────────────────────────────────────────────
// METHODOLOGY SOURCE
// ─────────────────────────────────────────────────────────────────────────
// Operating Characteristic (OC) curve for 2-class attributes plans:
// "OC curves for attributes plans are normally computed assuming an
// infinite lot size and using the binomial distribution."
//   — NAP 372 (National Academies Press, 1985), Chapter 6, "Operating
//   Characteristic Curves" section, https://www.ncbi.nlm.nih.gov/books/NBK216671/
//
// Pa(p) = probability of accepting a lot with true defective proportion p,
// for a plan with sample size n and acceptance number c:
//
//   Pa(p) = sum_{i=0}^{c} C(n, i) * p^i * (1-p)^(n-i)
//
// i.e. the probability that at most c of n independently drawn sample
// units are "defective" (2-class: count > m). This is the same binomial
// acceptance-sampling formula already used for the AQL/ISO 2859-1 tool's
// underlying theory, applied here with ICMSF's n/c instead of ISO's.
//
// 3-class plans do not have a single OC curve (the source explains their
// probability of acceptance is a *surface*, plotted against both the
// proportion defective AND the proportion marginally acceptable — no
// closed 2D curve). This tool computes the OC curve only for 2-class
// plans (Cases 10–15, where m acts as the sole pass/fail boundary and a
// 2-class binomial model applies exactly). For 3-class plans (Cases 1–9)
// the tool reports n/c/m/M and lets the person reason about m vs M
// directly, rather than presenting an unverified/approximate 3-class
// surface calculation.
// ─────────────────────────────────────────────────────────────────────────

export interface Limits {
  m: number | null;
  M: number | null;
}

export interface ResolvedIcmsfPlan {
  icmsfCase: IcmsfCase;
  limits: Limits;
  /** True only for 2-class plans (Cases 10–15), where an OC curve can be computed */
  ocCurveAvailable: boolean;
}

/**
 * Step 1: Hazard level + conditions-of-use -> ICMSF Case (Table 6-1 lookup).
 */
export function resolveCase(hazardLevel: HazardLevel, conditionEffect: ConditionEffect): IcmsfCase {
  return getIcmsfCase(hazardLevel, conditionEffect);
}

/**
 * Step 2: Case + user-supplied m/M -> a resolved plan ready for display
 * and (for 2-class cases) OC curve computation.
 *
 * m/M are never invented by this tool — they must come from the person's
 * own applicable standard (Codex, EOS, a client spec, or their own
 * historical data). For a 2-class plan (Cases 10–15) only m is used, and
 * M may be left null.
 */
export function resolvePlan(caseNumber: number, limits: Limits): ResolvedIcmsfPlan {
  const icmsfCase = getIcmsfCaseByNumber(caseNumber);
  return {
    icmsfCase,
    limits,
    ocCurveAvailable: icmsfCase.planClass === 2,
  };
}

function factorial(num: number): number {
  let result = 1;
  for (let i = 2; i <= num; i++) result *= i;
  return result;
}

function binomialCoefficient(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  // Use the symmetric smaller side to keep intermediate factorials manageable
  const kEff = Math.min(k, n - k);
  let coeff = 1;
  for (let i = 0; i < kEff; i++) {
    coeff = (coeff * (n - i)) / (i + 1);
  }
  return coeff;
}

/**
 * Probability of acceptance Pa(p) for a 2-class plan (n, c) at true
 * defective proportion p (0..1). Binomial model — see METHODOLOGY SOURCE
 * above.
 */
export function probabilityOfAcceptance(n: number, c: number, p: number): number {
  if (p <= 0) return 1;
  if (p >= 1) return c >= n ? 1 : 0;
  let pa = 0;
  for (let i = 0; i <= c; i++) {
    const coeff = binomialCoefficient(n, i);
    pa += coeff * Math.pow(p, i) * Math.pow(1 - p, n - i);
  }
  // Clamp for floating-point drift at the extremes
  return Math.min(1, Math.max(0, pa));
}

export interface OcCurvePoint {
  /** True proportion defective in the lot, 0..1 */
  p: number;
  /** Probability the plan accepts a lot at that true defective proportion */
  pa: number;
}

/**
 * Generates OC curve points for a 2-class plan across p = 0..1.
 * `resolution` controls point density (default: every 1%).
 */
export function generateOcCurve(n: number, c: number, resolution = 0.01): OcCurvePoint[] {
  const points: OcCurvePoint[] = [];
  for (let p = 0; p <= 1 + 1e-9; p += resolution) {
    const clampedP = Math.min(1, p);
    points.push({ p: clampedP, pa: probabilityOfAcceptance(n, c, clampedP) });
  }
  return points;
}

/**
 * Consumer's risk point: probability of accepting a lot at a given
 * defective proportion (e.g. "if 10% of the lot is contaminated, what's
 * the chance this plan still accepts it?"). Thin wrapper for UI clarity.
 */
export function consumerRiskAt(n: number, c: number, defectiveProportion: number): number {
  return probabilityOfAcceptance(n, c, defectiveProportion);
}

export { ICMSF_CASES, factorial };

// ─────────────────────────────────────────────────────────────────────────
// EXTENDED RISK ANALYSIS — Three-class OC surface (for 3-class Cases 1–9)
// ─────────────────────────────────────────────────────────────────────────
// IMPORTANT — READ BEFORE MODIFYING
//
// This section computes an acceptance-probability curve for 3-class plans
// (Cases 1–9), something the ICMSF/NAP methodology above explicitly does
// NOT provide as a single curve (see METHODOLOGY SOURCE at the top of this
// file, and ocCurveUnavailable3Class in messages.ts). It is included here
// as a SEPARATE, CLEARLY-LABELLED supplementary risk-analysis feature —
// never presented as part of ICMSF Table 6-1 or Codex CAC/GL 21 itself.
//
// Unlike Table 6-1's Case lookup (which is a fixed reference table with no
// numerical computation involved), a 3-class OC curve requires assuming a
// statistical distribution for the lot's true contamination level. This
// tool assumes the standard choice for quantitative (enumeration) results:
// the concentration is lognormally distributed (normal on the log10
// scale) — the same assumption used throughout quantitative microbiology
// risk assessment (ICMSF's own "Microorganisms in Foods 7", and Codex's
// risk-assessment guidance documents).
//
// METHODOLOGY SOURCE: WHO/FAO FOSTAT tool ("FOS-2016_1"), the companion
// spreadsheet to "Statistical Aspects of Microbiological Criteria Related
// to Foods: A Risk Manager's Guide" (FAO/WHO Microbiological Risk
// Assessment Series No. 24, 2016) — the reference implementation used by
// international food-safety regulators for exactly this calculation.
// Every formula below is transcribed cell-by-cell from that spreadsheet's
// "Three-class Concentration" and "Two-class Concentration" sheets, and
// independently cross-verified in Node.js against the spreadsheet's own
// cached values (see calculator verification notes in project history).
//
// This is NOT part of ICMSF Table 6-1 or Codex CAC/GL 21. It requires an
// additional input (SD — the standard deviation of concentration on the
// log10 scale) that Table 6-1 itself never asks for, because Table 6-1
// only ever defines the accept/reject rule (n, c, m, M), not the lot's
// underlying contamination distribution.
// ─────────────────────────────────────────────────────────────────────────

/** Abramowitz & Stegun 7.1.26 erf approximation, |error| <= 1.5e-7 — same
 * implementation used in lib/regression/calculator.ts, kept identical here
 * so normal-distribution results are consistent app-wide. */
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * ax);
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
  return sign * y;
}

function stdNormalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

/** Excel NORMDIST(x, mean, sd, TRUE). */
function normDist(x: number, mean: number, sd: number): number {
  if (sd <= 0) return x >= mean ? 1 : 0;
  return stdNormalCdf((x - mean) / sd);
}

/** log10-scale mean/SD -> arithmetic-scale mean (lognormal assumption).
 * Spreadsheet: "Two/Three-class Concentration" sheets, e.g.
 * 10^(mean + 0.5*LN(10)*SD^2). */
export function logMeanToArithmeticMean(logMean: number, logSd: number): number {
  return Math.pow(10, logMean + 0.5 * Math.LN10 * logSd * logSd);
}

export interface ThreeClassConcentrationInput {
  n: number;
  c: number;
  /** Standard deviation of concentration, log10 scale */
  sd: number;
  /** Marginal limit, log10 scale (m) */
  m: number;
  /** Unacceptable limit, log10 scale (M) */
  M: number;
}

export interface ThreeClassConcentrationPoint {
  logMean: number;
  arithmeticMean: number;
  pAcceptableRegion: number; // P(Conc <= m)
  pMarginalRegion: number;   // P(m < Conc <= M)
  pUnacceptableRegion: number; // P(Conc > M)
  pAccept: number;
  pReject: number;
}

/**
 * Three-class acceptance probability at a given lot mean concentration
 * (log10 scale). Reproduces the WHO/FAO FOSTAT spreadsheet's "Three-class
 * Concentration" sheet formula exactly:
 *   pAcceptableRegion = NORMDIST(m, logMean, SD, TRUE)
 *   pMarginalRegion   = NORMDIST(M, logMean, SD, TRUE) - NORMDIST(m, logMean, SD, TRUE)
 *   pAccept = BINOMDIST(c, n, pMarginalRegion / (pMarginalRegion + pAcceptableRegion), TRUE)
 *             * (pAcceptableRegion + pMarginalRegion)^n
 * i.e.: the probability that no unit falls in the unacceptable region,
 * times the probability that (among units that do not) at most c are
 * marginal rather than acceptable.
 */
export function threeClassAcceptanceAt(
  input: ThreeClassConcentrationInput,
  logMean: number,
): ThreeClassConcentrationPoint {
  const { n, c, sd, m, M } = input;
  const arithmeticMean = logMeanToArithmeticMean(logMean, sd);
  const pAcceptableRegion = normDist(m, logMean, sd);
  const pMarginalRegion = normDist(M, logMean, sd) - normDist(m, logMean, sd);
  const pUnacceptableRegion = 1 - normDist(M, logMean, sd);

  const denom = pMarginalRegion + pAcceptableRegion;
  const conditionalP = denom > 0 ? pMarginalRegion / denom : 0;
  const pAccept = Math.min(1, Math.max(0, probabilityOfAcceptance(n, c, conditionalP) * Math.pow(denom, n)));

  return {
    logMean,
    arithmeticMean,
    pAcceptableRegion,
    pMarginalRegion,
    pUnacceptableRegion,
    pAccept,
    pReject: 1 - pAccept,
  };
}

/** Generates a Three-class OC curve across a log10-mean-concentration
 * range. Default range centers on m, spanning 4 log10 units — wide enough
 * to show the full transition from near-0% to near-100% acceptance for
 * typical SD values (0.5–1.5), while staying anchored to the plan's own m. */
export function generateThreeClassOcCurve(
  input: ThreeClassConcentrationInput,
  logMeanMin?: number,
  logMeanMax?: number,
  resolution?: number,
): ThreeClassConcentrationPoint[] {
  const min = logMeanMin ?? input.m - 3;
  const max = logMeanMax ?? input.M + 1;
  const step = resolution ?? ((max - min) / 100 || 0.05);
  const points: ThreeClassConcentrationPoint[] = [];
  for (let x = min; x <= max + 1e-9; x += step) {
    points.push(threeClassAcceptanceAt(input, Math.min(x, max)));
  }
  return points;
}
