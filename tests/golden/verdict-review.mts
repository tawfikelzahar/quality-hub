/* eslint-disable @typescript-eslint/no-explicit-any */
// Review table: for every golden dataset, the on-screen verdict and reason
// (English and Arabic) next to the PDF report's own diagnosis lines.
// Run: node --import ./tests/register.mjs --experimental-strip-types --no-warnings tests/golden/verdict-review.mts
import { readFileSync } from 'node:fs'
import { runVariableChartAnalysis as runVar, runXbarSAnalysis as runS } from '../../lib/spc/calculator.ts'
import { buildCapabilityDiagnosis } from '../../lib/spc/reportInterpretation.ts'
import { capabilityReason } from '../../lib/spc/capabilityReason.ts'
import { translations } from '../../lib/i18n/translations.ts'

const sets = JSON.parse(readFileSync(new URL('./datasets.json', import.meta.url), 'utf8'))
// Extra example (not a golden dataset): DS01 with a target that is not mid-spec
const ds01 = sets.find((d: any) => d.id === 'DS01')
sets.splice(1, 0, { ...ds01, id: 'DS01+T', name: 'DS01 with Target 24.5 (example, target not at mid-spec)', target: 24.5 })
const tr = (lang: 'en' | 'ar') => (k: string) => (translations[lang] as any)[k] as string
const out: any[] = []

for (const d of sets) {
  if (d.kind === 'p') { out.push({ id: d.id, name: d.name, note: 'Attribute chart: no capability verdict' }); continue }
  const x: any = (d.kind === 'xbars' ? runS : runVar)({ data: d.data, N: d.n ?? 1, LSL: d.lsl, USL: d.usl, target: d.target, sigmaConvention: 'direct' })
  const signals = [
    ...x.violations_x.map((v: any) => ({ rule: v.rule, dispersionChart: false })),
    ...x.violations_r.map((v: any) => ({ rule: v.rule, dispersionChart: true })),
  ]
  const hasSpec = x.LSL !== null || x.USL !== null
  const usesCpk = x.isNormal && x.Cpk !== null
  const pk = usesCpk ? x.Cpk : x.Ppk
  const row: any = { id: d.id, name: d.name, signals: signals.length, normal: x.isNormal }
  if (!hasSpec || pk === null) { row.note = 'No specification limits: no capability verdict'; out.push(row); continue }
  const key = pk >= 1.33 ? 'spc_capable' : pk < 1.0 ? 'spc_notcapable' : 'spc_marginal'
  const idx = usesCpk ? 'Cpk' : 'Ppk'
  row.verdict_en = tr('en')(key).replace('{idx}', idx).replace('{n}', pk.toFixed(2))
  row.verdict_ar = tr('ar')(key).replace('{idx}', idx).replace('{n}', pk.toFixed(2))
  const diag: any = buildCapabilityDiagnosis({
    LSL: x.LSL, USL: x.USL, target: d.target ?? null, center: x.cl_x, mu: x.mu,
    sigmaWithin: x.sigma, sdOverall: x.sdOverall, normal: x.isNormal, signals, n: x.n,
    adequacyTier: x.dataAdequacy.tier,
  })
  row.screen_en = capabilityReason(diag.facts, x.isNormal, tr('en') as any)
  row.screen_ar = capabilityReason(diag.facts, x.isNormal, tr('ar') as any)
  row.report = diag.rows.map((r: any) => `${r.dimension}: ${r.result} — ${r.assessment}`)
  out.push(row)
}
console.log(JSON.stringify(out, null, 1))
