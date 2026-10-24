// OEE golden test — no server needed:
// node --import ./tests/register.mjs --experimental-strip-types --no-warnings tests/golden/oee/check.mts
import { calcOEE, validate, lossTime, type OEEInputs } from '../../../lib/oee/calc.ts'
import { buildOEEInsight, type LossKind } from '../../../lib/oee/insight.server.ts'
import { fixed } from '../../../lib/stats/format.ts'

interface Case {
  id: string
  source: string
  inputs: OEEInputs
  expected: Record<string, number>
  /** losses in minutes / parts (lossTime) */
  time?: Record<string, number>
  /** largest loss the "What to work on first" card must name */
  biggest?: LossKind
  /** decimals the source reports */
  tol: number
}

const cases: Case[] = [
  {
    // oee.com "Calculating OEE" worked example (first shift): 480 min shift,
    // breaks 2 × 15 + 30 min, 47 min downtime, ideal cycle 1.0 s,
    // 19,271 total, 423 rejects. Page results: planned production time 420,
    // run time 373, A 88.81%, P 86.11%, Q 97.80%, OEE 74.79%.
    id: 'OEE01',
    source: 'https://www.oee.com/calculating-oee/',
    inputs: { plannedTime: 480, breaks: 60, downtime: 47, cycleTime: 1.0, totalCount: 19271, goodCount: 18848 },
    expected: { netPlanned: 420, runTime: 373, availability: 88.81, performance: 86.11, quality: 97.80, oee: 74.79 },
    // Fully productive time = good count × ideal cycle = 18,848 s (page definition)
    time: { downtimeMin: 47, productiveMin: 314.13, qualityParts: 423 },
    biggest: 'speed',
    tol: 0.005,
  },
  {
    // The tool's own example (roadmap O6): 480 min, 52 min down, 6 s cycle,
    // 3,800 made, 3,650 good → 52 min down · 48 min speed · 15 min quality
    // (150 parts × 6 s) · 365 min fully productive; OEE 76.04%. Quality loss is
    // exactly 3.125% (15 ÷ 480): shown as 3.13 with fixed() (plain toFixed gave 3.12).
    id: 'OEE02',
    source: 'tool example (hand check)',
    inputs: { plannedTime: 480, breaks: 0, downtime: 52, cycleTime: 6, totalCount: 3800, goodCount: 3650 },
    expected: { runTime: 428, oee: 76.04, downtimeLoss: 10.83, speedLoss: 10.00, qualityLoss: 3.13 },
    time: { downtimeMin: 52, speedMin: 48, qualityMin: 15, productiveMin: 365, speedParts: 480, qualityParts: 150 },
    biggest: 'downtime',
    tol: 0.005,
  },
]

let checks = 0
let fail = 0
for (const c of cases) {
  const err = validate(c.inputs)
  const r = err ? null : calcOEE(c.inputs)
  if (!r) { fail++; console.log('FAIL', c.id, 'no result', err); continue }
  for (const [k, want] of Object.entries(c.expected)) {
    checks++
    const got = (r as unknown as Record<string, number>)[k]
    const ok = Math.abs(Number(fixed(got, 2)) - want) <= c.tol
    if (!ok) { fail++; console.log('DIFF', c.id, k, 'got', got, 'want', want) }
  }
  if (c.time) {
    const lt = lossTime(c.inputs, r) as unknown as Record<string, number>
    for (const [k, want] of Object.entries(c.time)) {
      checks++
      if (Math.abs(Number(fixed(lt[k], 2)) - want) > c.tol) { fail++; console.log('DIFF', c.id, k, 'got', lt[k], 'want', want) }
    }
    // minutes add up to net planned time, and match the % losses
    checks++
    const tsum = lt.downtimeMin + lt.speedMin + lt.qualityMin + lt.productiveMin
    const pctOk = Math.abs(lt.speedMin / r.netPlanned * 100 - r.speedLoss) < 1e-9 && Math.abs(lt.qualityMin / r.netPlanned * 100 - r.qualityLoss) < 1e-9
    if (Math.abs(tsum - r.netPlanned) > 1e-9 || !pctOk) { fail++; console.log('DIFF', c.id, 'minutes sum', tsum, 'pct match', pctOk) }
  }
  if (c.biggest) {
    checks++
    const ins = buildOEEInsight(c.inputs)
    const lt = lossTime(c.inputs, r)
    const min = { downtime: lt.downtimeMin, speed: lt.speedMin, quality: lt.qualityMin }[c.biggest]
    const ok = !!ins && ins.biggest === c.biggest && ins.en.includes(fixed(min, 1)) && ins.ar.includes(fixed(min, 1))
    if (!ok) { fail++; console.log('DIFF', c.id, 'insight', ins?.biggest, 'want', c.biggest) }
  }
  // Losses (% of net planned time) and OEE must add up to 100
  checks++
  const sum = r.oee + r.downtimeLoss + r.speedLoss + r.qualityLoss
  if (Math.abs(sum - 100) > 1e-9) { fail++; console.log('DIFF', c.id, 'OEE + losses =', sum) }
}
console.log(fail === 0 ? `oee golden: ${checks} checks match (published example + hand check)` : `oee golden: ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
