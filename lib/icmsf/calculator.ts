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
