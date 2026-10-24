// ─────────────────────────────────────────────────────────────────────────
// What the ICMSF page may know in the browser: the choices, the ICMSF
// examples and the shape of the replies from /api/icmsf and
// /api/icmsf/risk. Table 6-1 and every calculation stay on the server
// (lib/icmsf/tables.ts, lib/icmsf/calculator.ts).
// ─────────────────────────────────────────────────────────────────────────

import type { HazardLevel, ConditionEffect, PlanClass, ResultMode } from './tables'

export type { HazardLevel, ConditionEffect, PlanClass, ResultMode }

export const HAZARD_LEVEL_ORDER: HazardLevel[] = ['utility', 'low', 'moderate_limited', 'moderate_extensive', 'severe']
export const CONDITION_EFFECT_ORDER: ConditionEffect[] = ['reduce', 'none', 'increase']

/**
 * Common organisms for each hazard level, as given by ICMSF itself:
 * "ICMSF Cases concept" (ICMSF workshop, 2020),
 * https://www.icmsf.org/wp-content/uploads/2020/09/07-ICMSF-Cases-concept-LGMG.pdf
 * Its five categories carry the same Cases and n/c as Table 6-1 (lib/icmsf/tables.ts), with
 * newer names: Utility · Indicator (= low, indirect) · Moderate (= moderate,
 * direct, limited spread) · Serious (= moderate, direct, potentially
 * extensive spread) · Severe. Examples only — the full organism list
 * (Microorganisms in Foods 7/8) is not in this file yet.
 */
export const HAZARD_EXAMPLES: Record<HazardLevel, { name: string; examples: string[] }> = {
  utility: { name: 'Utility', examples: ['Total viable count', 'Yeasts and moulds'] },
  low: { name: 'Indicator', examples: ['Coliforms', 'Enterobacteriaceae'] },
  moderate_limited: { name: 'Moderate', examples: ['S. aureus', 'B. cereus', 'C. perfringens', 'Norovirus'] },
  moderate_extensive: { name: 'Serious', examples: ['Salmonella', 'Shigella flexneri', 'Yersinia enterocolitica'] },
  severe: { name: 'Severe', examples: ['E. coli O157:H7', 'C. botulinum toxin', 'Cronobacter (infant foods)'] },
}

export const MAX_RESULT = 1e12

/** Request body of POST /api/icmsf */
export interface IcmsfRequest {
  hazard: HazardLevel
  condition: ConditionEffect
  /** 2-class plans only: presence/absence or a count limit m (3-class is always a count) */
  mode: ResultMode
  /** count limits, CFU per unit as entered (null = not entered) */
  m: number | null
  M: number | null
  /** presence mode: positive units found (null = not entered) */
  positives: number | null
  /** count modes: one result per sample unit, null where not entered yet */
  results: (number | null)[]
  /** % of the lot assumed defective, for the "check a risk" line (2-class) */
  riskP: number
}

export type UnitClass = 'acceptable' | 'marginal' | 'defective'
export type Decision = 'accept' | 'reject'

export interface IcmsfResult {
  caseNumber: number
  planClass: PlanClass
  n: number
  c: number
  /** count limits valid for this plan (m < M for 3-class) */
  limitsOk: boolean
  /** class of each entered unit result (null where empty) */
  units: (UnitClass | null)[]
  marginal: number
  defective: number
  entered: number
  decision: Decision | null
  /** why: 'over_M' any unit above M · 'over_c' more than c marginal/defective/positive */
  reason: 'over_M' | 'over_c' | null
  /** 2-class: probability of acceptance vs % defective in the lot (0..100 step 1) */
  oc: number[] | null
  /** 2-class: probability of acceptance at riskP */
  riskPa: number | null
}

/** Request body of POST /api/icmsf/risk (Pro) */
export interface IcmsfRiskRequest {
  hazard: HazardLevel
  condition: ConditionEffect
  m: number
  /** null for 2-class count plans */
  M: number | null
  /** SD of log10 concentration */
  sd: number
  /** point to check, log10 CFU per unit */
  point: number
}

export interface IcmsfRiskPoint {
  logMean: number
  arithmeticMean: number
  pAcceptableRegion: number
  pMarginalRegion: number
  pUnacceptableRegion: number
  pAccept: number
}

export interface IcmsfRiskResult {
  curve: IcmsfRiskPoint[]
  point: IcmsfRiskPoint
  /** lot mean (log10) accepted 95% / 5% of the time — read off the curve */
  accept95: number | null
  reject95: number | null
}
