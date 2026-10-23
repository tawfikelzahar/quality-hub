/* eslint-disable @typescript-eslint/no-explicit-any */
// Prints the capability diagnosis for every golden dataset, exactly as the
// SPC PDF report builds it (default tests, as on the site). Used to prove
// that on-screen wording changes leave the report text unchanged, and to
// review the on-screen verdict sentence in English and Arabic.
// Run: node --import ./tests/register.mjs --experimental-strip-types --no-warnings tests/golden/diagnosis-snapshot.mts [--report-only]
import { readFileSync } from 'node:fs'
import { runVariableChartAnalysis as runVar, runXbarSAnalysis as runS } from '../../lib/spc/calculator.ts'
import { buildCapabilityDiagnosis } from '../../lib/spc/reportInterpretation.ts'

const reportOnly = process.argv.includes('--report-only')
const sets = JSON.parse(readFileSync(new URL('./datasets.json', import.meta.url), 'utf8'))
const out: any[] = []

for (const d of sets) {
  if (d.kind === 'p') { out.push({ id: d.id, note: 'attribute chart: no capability' }); continue }
  const x: any = (d.kind === 'xbars' ? runS : runVar)({ data: d.data, N: d.n ?? 1, LSL: d.lsl, USL: d.usl, target: d.target, sigmaConvention: 'direct' })
  const signals = [
    ...x.violations_x.map((v: any) => ({ rule: v.rule, dispersionChart: false })),
    ...x.violations_r.map((v: any) => ({ rule: v.rule, dispersionChart: true })),
  ]
  const diag = buildCapabilityDiagnosis({
    LSL: x.LSL, USL: x.USL, target: d.target ?? null, center: x.cl_x, mu: x.mu,
    sigmaWithin: x.sigma, sdOverall: x.sdOverall, normal: x.isNormal, signals, n: x.n,
    adequacyTier: x.dataAdequacy.tier,
  })
  const row: any = { id: d.id, name: d.name, signals: signals.length, normal: x.isNormal, Cpk: x.Cpk, Ppk: x.Ppk }
  if (diag) {
    const { facts, ...report } = diag as any
    row.report = report
    if (!reportOnly) row.facts = facts
  } else row.report = null
  out.push(row)
}
console.log(JSON.stringify(out, null, 1))
