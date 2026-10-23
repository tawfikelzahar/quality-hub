import type { TKey } from '@/lib/i18n/translations'
import { buildCapabilityDiagnosis } from '@/lib/spc/reportInterpretation'
import { capabilityReason } from '@/lib/spc/capabilityReason'

// ─────────────────────────────────────────────────────────────────────────
// On-screen verdicts shared by every variable-chart tool (SPC, I-MR, X̄-R,
// X̄-S). Reads values the calculator already produced; computes nothing new.
// ─────────────────────────────────────────────────────────────────────────

type T = (k: TKey) => string

export interface VerdictInput {
  isNormal: boolean
  Cpk: number | null
  Ppk: number | null
  LSL: number | null
  USL: number | null
}

export interface CapabilityVerdict {
  pkName: 'Cpk' | 'Ppk'
  pkVal: number
  text: string
  sub: string
  color: string
}

/** Capability verdict: Cpk when normality holds, otherwise Ppk; 1.33 / 1.00 thresholds. */
export function capabilityVerdict(r: VerdictInput, t: T): CapabilityVerdict | null {
  if (r.LSL === null && r.USL === null) return null
  const useCpk = r.isNormal && r.Cpk !== null
  const pkVal = useCpk ? r.Cpk : r.Ppk
  if (pkVal === null || !isFinite(pkVal)) return null
  const pkName = useCpk ? 'Cpk' : 'Ppk'
  const key = pkVal >= 1.33 ? 'spc_capable' : pkVal < 1.0 ? 'spc_notcapable' : 'spc_marginal'
  const color = pkVal >= 1.33 ? 'var(--qh-good)' : pkVal < 1.0 ? 'var(--qh-danger)' : 'var(--qh-amber)'
  return {
    pkName,
    pkVal,
    text: t(key).replace('{idx}', pkName).replace('{n}', pkVal.toFixed(2)),
    sub: t(`${key}_sub` as TKey),
    color,
  }
}

export interface ReasonInput {
  LSL: number | null
  USL: number | null
  cl_x: number
  mu: number
  sigma: number
  sdOverall: number
  isNormal: boolean
  n: number
  violations_x: { rule: number }[]
  violations_r: { rule: number }[]
  dataAdequacy: { tier: 'low' | 'moderate' | 'adequate' }
}

/** The sentence under the capability verdict, from the PDF report's own diagnosis. */
export function capabilityReasonFor(r: ReasonInput, target: number | null, t: T): string | null {
  if (r.LSL === null && r.USL === null) return null
  const diagnosis = buildCapabilityDiagnosis({
    LSL: r.LSL,
    USL: r.USL,
    target,
    center: r.cl_x,
    mu: r.mu,
    sigmaWithin: r.sigma,
    sdOverall: r.sdOverall,
    normal: r.isNormal,
    signals: [
      ...r.violations_x.map(v => ({ rule: v.rule, dispersionChart: false })),
      ...r.violations_r.map(v => ({ rule: v.rule, dispersionChart: true })),
    ],
    n: r.n,
    adequacyTier: r.dataAdequacy.tier,
  })
  return diagnosis ? capabilityReason(diagnosis.facts, r.isNormal, t) : null
}
