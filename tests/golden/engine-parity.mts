/* eslint-disable @typescript-eslint/no-explicit-any */
// SPC Engine (/api/analyze) must give the same numbers as the chart pages'
// calculator: I-MR for n = 1, X̄-R for 2–8, X̄-S for 9 or more
// (lib/spc/chartChoice.ts). Needs a running server:
// node --import ./tests/register.mjs --experimental-strip-types --no-warnings tests/golden/engine-parity.mts http://localhost:3123
import { readFileSync } from 'node:fs'
import { isDeepStrictEqual } from 'node:util'
import { runVariableChartAnalysis as runVar, runXbarSAnalysis as runS } from '../../lib/spc/calculator.ts'
import { variableChartFor } from '../../lib/spc/chartChoice.ts'

const base = process.argv[2] ?? 'http://localhost:3123'
const sets: any[] = JSON.parse(readFileSync(new URL('./datasets.json', import.meta.url), 'utf8'))
const num = (v: any) => (v === undefined || v === null || v === '' ? null : Number(v))

const cases: { id: string; data: number[][]; LSL: number | null; USL: number | null; target: number | null }[] = []
for (const d of sets) {
  if (d.kind === 'p') continue
  cases.push({ id: d.id, data: d.data, LSL: num(d.lsl), USL: num(d.usl), target: num(d.target) })
}
// n = 9 (the first X̄-S size) and n = 8 (the last X̄-R size), cut from DS06
const ds06 = sets.find(d => d.id === 'DS06')
cases.push({ id: 'DS06-n9', data: ds06.data.map((r: number[]) => r.slice(0, 9)), LSL: num(ds06.lsl), USL: num(ds06.usl), target: num(ds06.target) })
cases.push({ id: 'DS06-n8', data: ds06.data.map((r: number[]) => r.slice(0, 8)), LSL: num(ds06.lsl), USL: num(ds06.usl), target: num(ds06.target) })

let fail = 0
for (const c of cases) {
  const N = c.data[0].length
  const expectChart = variableChartFor(N)
  const input = { data: c.data, N, LSL: c.LSL, USL: c.USL, target: c.target, sigmaConvention: 'direct' }
  const local = expectChart === 'xbar-s' ? runS(input) : runVar(input)
  const res = await fetch(base + '/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify({ ...input, lastN: 0 }) })
  const remote: any = await res.json()
  if (!res.ok) { fail++; console.log('FAIL', c.id, res.status, remote.error); continue }
  // NextResponse.json turns Infinity into null; compare on the same footing
  const expected = JSON.parse(JSON.stringify(local))
  const diffs = Object.keys(expected).filter(k => !isDeepStrictEqual(remote[k], expected[k]))
  const ok = remote.chart === expectChart && diffs.length === 0
  if (!ok) fail++
  console.log(ok ? 'same' : 'DIFF', c.id, `n=${N}`, remote.chart, diffs.length ? diffs.join(',') : '')
}
console.log(fail === 0 ? `engine-parity: ${cases.length} cases match` : `engine-parity: ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
