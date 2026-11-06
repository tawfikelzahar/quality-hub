/* eslint-disable @typescript-eslint/no-explicit-any */
// Attribute charts (p, np, c, u) golden check — no server needed:
// node --import ./tests/register.mjs --experimental-strip-types --no-warnings tests/golden/attribute/check.mts
// Expected values are Minitab's as printed on Tawfik's charts (1 Nov 2026),
// stored as strings in datasets.json → `minitab`. Equal sizes: centre line,
// UCL, LCL. Unequal sizes: stepped limits, so the centre line and the limits
// of the last subgroup (what Minitab prints beside the chart). Tests for
// special causes: all tests (1–4), the points Minitab marks.
import { readFileSync } from 'node:fs'
import { runAttributeAnalysis } from '../../../lib/spc/attribute.server.ts'
import { normInv } from '../../../lib/stats/normal.ts'
import { ATTRIBUTE_EXAMPLES } from '../../../lib/spc/attributeExamples.ts'
import { subgroupsNeededP, subgroupsNeededU, runAttributeChecks } from '../../../lib/spc/attributeChecks.server.ts'

const sets: any[] = JSON.parse(readFileSync(new URL('./datasets.json', import.meta.url), 'utf8'))
let checks = 0
let fail = 0
const dec = (w: string) => (w.split('.')[1] ?? '').length
function eq(id: string, what: string, got: number | null | undefined, want: string | undefined) {
  if (want === undefined) return
  checks++
  const ok = got !== null && got !== undefined && Math.abs(got - Number(want)) <= 0.5 * 10 ** -dec(want) + 1e-12
  if (!ok) { fail++; console.log('DIFF', id, what, 'site', got, 'Minitab', want) }
}
function guard(id: string, what: string, got: unknown, want: unknown) {
  if (JSON.stringify(got) !== JSON.stringify(want)) { fail++; console.log('DIFF', id, what, 'site', JSON.stringify(got), 'expected', JSON.stringify(want)) }
}
function same(id: string, what: string, got: unknown, want: unknown) {
  checks++
  if (JSON.stringify(got) !== JSON.stringify(want)) { fail++; console.log('DIFF', id, what, 'site', JSON.stringify(got), 'Minitab', JSON.stringify(want)) }
}

for (const s of sets) {
  const m = s.minitab
  if (!m) continue
  const data = s.chart === 'p' || s.chart === 'u' ? s.counts.map((d: number, i: number) => [s.sizes[i], d]) : s.counts.map((d: number) => [d])
  const r: any = runAttributeAnalysis({ data, attrType: s.chart, fixedN: s.sizes?.[0] ?? 0, sigmaConvention: 'direct', testSet: 'all' })
  eq(s.id, 'centre', r.clVal, m.center)
  eq(s.id, 'UCL', r.ucl, m.ucl ?? m.ucl_last)
  eq(s.id, 'LCL', r.lcl, m.lcl ?? m.lcl_last)
  same(s.id, 'stepped limits', !!r.stepped, !!m.stepped)
  const tests: Record<string, number[]> = {}
  for (const v of r.violations) (tests[String(v.rule)] ??= []).push(...v.failedAt)
  for (const k of Object.keys(tests)) tests[k].sort((a, b) => a - b)
  same(s.id, 'tests', tests, m.tests)
  // DPM and Sigma Level only where the chart value is a probability (p, np)
  same(s.id, 'Sigma Level shown', r.sigmaLvl !== null, s.chart === 'p' || s.chart === 'np')
  same(s.id, 'DPM shown', r.dpm !== null, s.chart === 'p' || s.chart === 'np')
  if (s.chart === 'p' || s.chart === 'np') {
    const pBar = s.chart === 'p' ? r.clVal : r.clVal / s.sizes[0]
    checks++
    if (!(Math.abs(r.dpm - pBar * 1e6) < 1e-6 && r.sigmaLvl > 0 && Math.abs(r.sigmaLvl - (-normInv(pBar))) < 1e-9)) { fail++; console.log('DIFF', s.id, 'Sigma Level', r.sigmaLvl, 'DPM', r.dpm) }
  }
}
// Number of subgroups the report card asks for: every cell of Tables 2 (P chart)
// and 3 (U chart) of the "Attribute Control Charts" white paper of the
// specialised software (read 6 Nov 2026), rounded up as published.
const TABLE_P: Record<number, number[]> = { 10: [1881, 421, 228, 60, 35], 50: [425, 109, 64, 23, 16], 100: [232, 65, 41, 17, 13], 150: [165, 49, 32, 14, 11], 200: [131, 41, 27, 13, 10], 500: [65, 24, 18, 10, 9] }
const TABLE_P_PBAR = [0.001, 0.005, 0.01, 0.05, 0.1]
for (const [n, row] of Object.entries(TABLE_P)) TABLE_P_PBAR.forEach((p, i) => same('Table 2', `n=${n} p̄=${p}`, Math.ceil(subgroupsNeededP(p, Number(n))), row[i]))
const TABLE_U_CBAR = [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 10, 30, 50]
const TABLE_U = [232, 95, 65, 52, 41, 22, 18, 14, 10, 9]
TABLE_U_CBAR.forEach((cb, i) => same('Table 3', `c̄=${cb}`, Math.ceil(subgroupsNeededU(cb)), TABLE_U[i]))
// The checks on the golden datasets, worked by hand from the rules above
// (hand checks, not comparisons with the software, so not counted in `checks`):
//   A1 p  n 200, p̄ 0.0426 → need ceil(m(0.0426, 200)); every nᵢp̄ = 8.52 ≥ 0.5
//   A4 c  c̄ 5.36 → need ceil(m_U(5.36)) = Table 3 between 5 (18) and 10 (14)
//   A5 u  ū 1.33203 · n̄ 10.24 → c̄ 13.64; smallest n 5 → 6.66 ≥ 0.5
{
  const A1 = sets.find(x => x.id === 'A1'), A4 = sets.find(x => x.id === 'A4'), A5 = sets.find(x => x.id === 'A5')
  const c1 = runAttributeChecks(A1.counts.map((d: number, i: number) => [A1.sizes[i], d]), 'p', 0, 0.0426)
  guard('A1', 'need', c1.subgroups.need, Math.ceil(subgroupsNeededP(0.0426, 200)))
  guard('A1', 'size ok', c1.size.small, [])
  const c4 = runAttributeChecks(A4.counts.map((d: number) => [d]), 'c', 0, 5.36)
  guard('A4', 'need between table cells', c4.subgroups.need! <= 18 && c4.subgroups.need! >= 14, true)
  const nBar5 = A5.sizes.reduce((s: number, v: number) => s + v, 0) / A5.sizes.length
  const c5 = runAttributeChecks(A5.counts.map((d: number, i: number) => [A5.sizes[i], d]), 'u', 0, 341 / 256)
  guard('A5', 'c̄', Math.abs(c5.subgroups.basis - (341 / 256) * nBar5) < 1e-12, true)
  guard('A5', 'size ok', c5.size.small, [])
  // a p chart with too small samples: n 10, p̄ 0.04 → nᵢp̄ 0.4, needs n ≥ 13
  const tiny = runAttributeChecks([[10, 0], [10, 1], [10, 0], [10, 0], [10, 1]], 'p', 0, 0.04)
  guard('small n', 'flags all', tiny.size.small, [1, 2, 3, 4, 5])
  guard('small n', 'min size', tiny.size.minSize, 13)
}
// "Try an example" data on the Attribute Charts page must stay the golden datasets
// (a data guard, not a comparison with Minitab, so it is not counted in `checks`)
for (const [chart, ex] of Object.entries(ATTRIBUTE_EXAMPLES)) {
  const s = sets.find(x => x.id === ex.id)
  if (JSON.stringify({ chart, sizes: ex.sizes, counts: ex.counts }) !== JSON.stringify({ chart: s?.chart, sizes: s?.sizes ?? [], counts: s?.counts })) {
    fail++
    console.log('DIFF', ex.id, `example data (${chart}) differs from the golden dataset`)
  }
}
console.log(fail === 0 ? `attribute golden: ${checks} checks match Minitab` : `attribute golden: ${fail} of ${checks} differ`)
process.exit(fail === 0 ? 0 : 1)
