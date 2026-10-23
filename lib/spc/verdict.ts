import type { TKey } from '@/lib/i18n/translations'

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

// The reason sentence under the verdict is written on the server
// (lib/spc/reportText.server.ts → screenReason) and arrives with the result.
