// DPMO golden test — no server needed:
// node --import ./tests/register.mjs --experimental-strip-types --no-warnings tests/golden/dpmo/check.mts
import { dpmoMetrics, overallDpmo, dpmoForSigma, validateDpmo } from '../../../lib/dpmo/calc.ts'

let checks = 0
let fail = 0
function near(id: string, what: string, got: number, want: number, tol: number) {
  checks++
  if (!(Math.abs(got - want) <= tol)) { fail++; console.log('DIFF', id, what, 'got', got, 'want', want) }
}

// T — published sigma conversion table with the 1.5σ shift
// (metricgate.com/docs/process-sigma-level): 2σ 308,537 · 3σ 66,807 · 4σ 6,210 · 5σ 233 · 6σ 3.4
const TABLE: [number, number][] = [[2, 308537], [3, 66807], [4, 6210], [5, 233], [6, 3.4]]
for (const [sigma, dpmo] of TABLE) {
  // DPMO → sigma (1,000,000 opportunities so DPMO = defects)
  const m = dpmoMetrics({ units: 1_000_000, opportunities: 1, defects: dpmo })
  near('T', `sigma for ${dpmo} DPMO`, m.sigma, sigma, 0.005)
  // sigma → DPMO, to the table's precision
  const back = dpmoForSigma(sigma)
  near('T', `DPMO for ${sigma}σ`, back, dpmo, dpmo >= 100 ? 0.6 : 0.05)
}

// W — worked example on the same page: 5,778 defects, 27,420 opportunities
// (5,484 units × 5) → DPU 1.0536 · DPO 0.2107 · DPMO 210,722 · yield 78.93% · sigma 2.30
{
  const m = dpmoMetrics({ units: 5484, opportunities: 5, defects: 5778 })
  near('W', 'DPU', m.dpu, 1.0536, 0.00005)
  near('W', 'DPO', m.dpo, 0.2107, 0.00005)
  near('W', 'DPMO', m.dpmo, 210722, 0.5)
  near('W', 'yield', m.yieldPct, 78.93, 0.005)
  near('W', 'sigma', m.sigma, 2.30, 0.005)
}

// P — pooling: A 500 units × 12 opp, 18 defects; B 200 × 10, 30 defects.
// Σ defects 48 ÷ Σ opportunities 8,000 = 6,000 DPMO (not the mean of the two sigma levels).
{
  const o = overallDpmo([{ units: 500, opportunities: 12, defects: 18 }, { units: 200, opportunities: 10, defects: 30 }])!
  near('P', 'pooled DPMO', o.dpmo, 6000, 1e-6)
  const a = dpmoMetrics({ units: 500, opportunities: 12, defects: 18 }).sigma
  const b = dpmoMetrics({ units: 200, opportunities: 10, defects: 30 }).sigma
  checks++
  if (Math.abs(o.sigma - (a + b) / 2) < 0.01) { fail++; console.log('DIFF P pooled sigma equals the mean of sigmas — pooling not applied') }
}

// V — validation
{
  const cases: [string, ReturnType<typeof validateDpmo>][] = [
    [JSON.stringify(validateDpmo({ units: 0, opportunities: 5, defects: 0 })), 'units'],
    [JSON.stringify(validateDpmo({ units: 10, opportunities: 0, defects: 0 })), 'opportunities'],
    [JSON.stringify(validateDpmo({ units: 10, opportunities: 5, defects: -1 })), 'defects_negative'],
    [JSON.stringify(validateDpmo({ units: 10, opportunities: 5, defects: 51 })), 'defects_over'],
  ]
  for (const [got, want] of cases) { checks++; if (got !== JSON.stringify(want)) { fail++; console.log('DIFF V', got, want) } }
  checks++
  if (dpmoMetrics({ units: 10, opportunities: 5, defects: 0 }).sigma !== Infinity) { fail++; console.log('DIFF V zero defects should be Infinity') }
}

console.log(fail === 0 ? `dpmo golden: ${checks} checks match the published table and example` : `dpmo golden: ${fail} of ${checks} differ`)
process.exit(fail === 0 ? 0 : 1)
