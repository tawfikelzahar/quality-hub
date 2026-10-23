/* eslint-disable @typescript-eslint/no-explicit-any */
// Checks that /api/spc/chart returns exactly what the calculator returns.
// Needs a running server: node --import ./tests/register.mjs --experimental-strip-types --no-warnings tests/golden/api-parity.mts http://localhost:3123
import { readFileSync } from 'node:fs'
import { isDeepStrictEqual } from 'node:util'
import { runVariableChartAnalysis as runVar, runXbarSAnalysis as runS } from '../../lib/spc/calculator.ts'
import { wireReviver } from '../../lib/spc/wire.ts'
import { EXAMPLE_IMR, EXAMPLE_XBAR_R, EXAMPLE_XBAR_S } from '../../lib/spc/examples.ts'

const base = process.argv[2] ?? 'http://localhost:3123'
const sets: any[] = JSON.parse(readFileSync(new URL('./datasets.json', import.meta.url), 'utf8'))
const cases: { id: string; chart: string; data: number[][]; LSL: number | null; USL: number | null; target: number | null }[] = []
const num = (v: any) => (v === undefined || v === null || v === '' ? null : Number(v))

for (const d of sets) {
  if (d.kind === 'p') continue
  const chart = d.kind === 'xbars' ? 'xbar-s' : (d.n ?? 1) === 1 ? 'imr' : 'xbar-r'
  cases.push({ id: d.id, chart, data: d.data, LSL: num(d.lsl), USL: num(d.usl), target: num(d.target) })
}
for (const [id, chart, ex] of [['EX-IMR', 'imr', EXAMPLE_IMR], ['EX-XR', 'xbar-r', EXAMPLE_XBAR_R], ['EX-XS', 'xbar-s', EXAMPLE_XBAR_S]] as const) {
  cases.push({ id, chart, data: ex.rows.map(r => r.map(Number)), LSL: num(ex.lsl), USL: num(ex.usl), target: null })
}
// Edge cases: zero spread (Infinity / NaN), one-sided limits, target
cases.push({ id: 'EDGE-flat', chart: 'imr', data: [[5], [5], [5], [5], [5]], LSL: 4, USL: 6, target: null })
cases.push({ id: 'EDGE-usl-only', chart: 'xbar-r', data: [[1, 2], [2, 3], [3, 1], [2, 2]], LSL: null, USL: 5, target: 2 })

let fail = 0
for (const c of cases) {
  const input = { data: c.data, N: c.data[0].length, LSL: c.LSL, USL: c.USL, target: c.target, sigmaConvention: 'direct' }
  const local = c.chart === 'xbar-s' ? runS(input) : runVar(input)
  const res = await fetch(base + '/api/spc/chart', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chart: c.chart, ...c }) })
  const text = await res.text()
  if (!res.ok) { fail++; console.log('FAIL', c.id, res.status, text); continue }
  const remote = JSON.parse(text, wireReviver).result
  // JSON drops keys whose value is undefined; compare on the same footing
  const expected = JSON.parse(JSON.stringify(local, (_k, v) => (typeof v === 'number' && !Number.isFinite(v) ? '__num:' + v : v)), wireReviver)
  const same = isDeepStrictEqual(remote, expected)
  if (!same) fail++
  console.log(same ? 'same' : 'DIFF', c.id, c.chart)
}
console.log(fail ? `api-parity: ${fail} case(s) differ` : `api-parity: ${cases.length} cases identical`)
process.exit(fail ? 1 : 0)
