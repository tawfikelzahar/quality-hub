/* eslint-disable @typescript-eslint/no-explicit-any */
// Gage R&R golden check: runs every dataset in datasets.json that has `expected`
// values through POST /api/gage-rr and compares. Today that is GR00, the AIAG MSA
// 4th ed. worked example; Minitab results for GR01–GR06 get added as they arrive.
//
// The route is Pro-only, so it needs a running server and a Pro session cookie:
//   node --import ./tests/register.mjs --experimental-strip-types --no-warnings \
//     tests/golden/gage/check.mts http://localhost:3123 "sb-...-auth-token=..."
// The manual rounds R̄, X̄diff and Rp before the next step, so values are compared
// to the manual's printed precision (5 decimals for σ values, 0.01 for percentages).
import { readFileSync } from 'node:fs'

const base = process.argv[2] ?? 'http://localhost:3123'
const cookie = process.argv[3] ?? ''
const sets: any[] = JSON.parse(readFileSync(new URL('./datasets.json', import.meta.url), 'utf8'))

let checks = 0, fails = 0
const near = (got: number, want: number, tol: number) => Math.abs(got - want) <= tol
for (const s of sets.filter(x => x.expected)) {
  const e = s.expected
  const res = await fetch(base + '/api/gage-rr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: base, Cookie: cookie },
    body: JSON.stringify({ appraiserNames: s.appraisers, numTrials: s.trials, numParts: s.parts, measurements: s.data, USL: s.usl, LSL: s.lsl, method: e.method, poolingAlpha: 0.25 }),
  })
  if (!res.ok) { console.log(s.id, 'HTTP', res.status, await res.text()); process.exit(1) }
  const r: any = await res.json()
  const cmp = (name: string, got: number, want: number, tol: number) => {
    checks++
    const ok = near(got, want, tol)
    if (!ok) { fails++; console.log(`DIFF ${s.id} ${name}: site ${got} vs ${want}`) }
  }
  for (const k of ['EV', 'AV', 'GRR', 'PV', 'TV']) cmp(k, r[k], e[k], 0.0001)
  cmp('rBar', r.rBar, e.rBar, 0.00005)
  cmp('xbarDiff', r.xbarDiff, e.xbarDiff, 0.0001)
  cmp('rP', r.rP, e.rP, 0.0005)
  for (const k of ['EV', 'AV', 'GRR', 'PV']) cmp('%' + k, r.pctOfTV[k], e.pctTV[k], 0.0001)
  checks++; if (r.ndc !== e.ndc) { fails++; console.log(`DIFF ${s.id} ndc: ${r.ndc} vs ${e.ndc}`) }
}
console.log(fails ? `gage golden: ${fails} of ${checks} checks differ` : `gage golden: ${checks} checks match the reference`)
process.exit(fails ? 1 : 0)
