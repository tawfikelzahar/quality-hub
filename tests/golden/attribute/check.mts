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
console.log(fail === 0 ? `attribute golden: ${checks} checks match Minitab` : `attribute golden: ${fail} of ${checks} differ`)
process.exit(fail === 0 ? 0 : 1)
