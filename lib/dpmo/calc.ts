// ─────────────────────────────────────────────────────────────────────────
// DPMO and Sigma level. Public formulas, so this runs in the browser
// (roadmap P6).
//   DPO   = defects ÷ (units × opportunities per unit)
//   DPMO  = DPO × 1,000,000
//   Yield = 1 − DPO (per opportunity, as in sigma conversion tables)
//   Sigma = Φ⁻¹(1 − DPO) + 1.5 (long-term, with the conventional 1.5σ shift)
// Several processes together: the overall figure pools the defects and the
// opportunities (Σ defects ÷ Σ opportunities) — averaging sigma levels is
// not a valid way to combine them.
// Checked against the published sigma conversion table and a worked example
// (tests/golden/dpmo/check.mts).
// ─────────────────────────────────────────────────────────────────────────

export interface DpmoInput {
  units: number
  opportunities: number
  defects: number
}

export interface DpmoMetrics {
  totalOpportunities: number
  dpu: number
  dpo: number
  dpmo: number
  /** % */
  yieldPct: number
  /** Infinity when there are no defects */
  sigma: number
}

export type DpmoError = 'units' | 'opportunities' | 'defects_negative' | 'defects_over'

export const SIGMA_SHIFT = 1.5

/** Inverse standard normal CDF (Acklam's algorithm, relative error < 1.2e-9) */
export function normSInv(p: number): number {
  if (p <= 0) return -Infinity
  if (p >= 1) return Infinity
  const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00]
  const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01]
  const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00]
  const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00]
  const pLow = 0.02425
  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p))
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  }
  if (p <= 1 - pLow) {
    const q = p - 0.5
    const r = q * q
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
  }
  const q = Math.sqrt(-2 * Math.log(1 - p))
  return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
}

export function validateDpmo(i: DpmoInput): DpmoError | null {
  if (!(i.units > 0)) return 'units'
  if (!(i.opportunities > 0)) return 'opportunities'
  if (i.defects < 0) return 'defects_negative'
  if (i.defects > i.units * i.opportunities) return 'defects_over'
  return null
}

export function dpmoMetrics(i: DpmoInput): DpmoMetrics {
  const totalOpportunities = i.units * i.opportunities
  const dpo = i.defects / totalOpportunities
  return {
    totalOpportunities,
    dpu: i.defects / i.units,
    dpo,
    dpmo: dpo * 1e6,
    yieldPct: (1 - dpo) * 100,
    sigma: normSInv(1 - dpo) + SIGMA_SHIFT,
  }
}

/** Pooled figures for several processes (Σ defects ÷ Σ opportunities) */
export function overallDpmo(rows: DpmoInput[]): (DpmoMetrics & { units: number; defects: number }) | null {
  const ok = rows.filter(r => !validateDpmo(r))
  if (ok.length === 0) return null
  const totalOpportunities = ok.reduce((s, r) => s + r.units * r.opportunities, 0)
  const defects = ok.reduce((s, r) => s + r.defects, 0)
  const units = ok.reduce((s, r) => s + r.units, 0)
  const dpo = defects / totalOpportunities
  return { units, defects, totalOpportunities, dpu: defects / units, dpo, dpmo: dpo * 1e6, yieldPct: (1 - dpo) * 100, sigma: normSInv(1 - dpo) + SIGMA_SHIFT }
}

/** DPMO that a sigma level corresponds to (for the reference table) */
export function dpmoForSigma(sigma: number): number {
  // 1 − Φ(sigma − 1.5), via erfc for accuracy in the far tail
  const z = sigma - SIGMA_SHIFT
  return 0.5 * erfc(z / Math.SQRT2) * 1e6
}

function erfc(x: number): number {
  // Numerical Recipes erfc (Chebyshev), fractional error < 1.2e-7
  const z = Math.abs(x)
  const t = 1 / (1 + 0.5 * z)
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))))
  return x >= 0 ? r : 2 - r
}
