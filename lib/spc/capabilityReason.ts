import type { CapabilityFacts } from '@/lib/spc/reportInterpretation'
import type { TKey } from '@/lib/i18n/translations'

// ─────────────────────────────────────────────────────────────────────────
// One-sentence reason under the on-screen capability verdict, in the page's
// language. It only rewords CapabilityFacts — the same numbers the PDF
// report's diagnosis is written from — so the screen and the report always
// agree. No statistics are computed here.
// ─────────────────────────────────────────────────────────────────────────

const f = (n: number, d: number) => (isFinite(n) ? n.toFixed(d) : '—')

export function capabilityReason(facts: CapabilityFacts, normal: boolean, t: (k: TKey) => string): string {
  let text: string
  if (facts.sides === 'two') {
    if (facts.meanOutside) {
      text = t('spc_reason_outside').replace('{m}', f(facts.mean, 3))
    } else {
      text =
        t('spc_reason_tol').replace('{p}', f(facts.tolUsedPct, 0)) +
        (facts.centeringOk
          ? t('spc_reason_centered')
          : t('spc_reason_offcenter').replace('{off}', f(facts.offset, 3)).replace('{side}', facts.nearer))
    }
  } else if (facts.meanOutside) {
    text = t('spc_reason_beyond').replace('{m}', f(facts.mean, 3)).replace('{side}', facts.limitName)
  } else {
    text = t(facts.ok ? 'spc_reason_one_ok' : 'spc_reason_one_bad')
      .replace('{idx}', facts.idxName)
      .replace('{k}', f(facts.k, 2))
      .replace('{side}', facts.limitName)
  }
  if (facts.target) {
    const { off, sigmas } = facts.target
    text += Math.abs(off) < 1e-12
      ? t('spc_reason_on_target')
      : t('spc_reason_target')
          .replace('{v}', f(Math.abs(off), 3))
          .replace('{dir}', t(off > 0 ? 'spc_reason_above' : 'spc_reason_below'))
          .replace('{s}', f(sigmas, 2))
  }
  return normal ? text : text + t('spc_reason_overall')
}
