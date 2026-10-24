// ICMSF golden test — no server needed:
// node --import ./tests/register.mjs --experimental-strip-types --no-warnings tests/golden/icmsf/check.mts
import { ICMSF_CASES, getIcmsfCase } from '../../../lib/icmsf/tables.ts'
import { probabilityOfAcceptance, threeClassAcceptanceAt, twoClassConcentrationAt, evaluateIcmsf, evaluateRisk } from '../../../lib/icmsf/calculator.ts'
import type { IcmsfRequest } from '../../../lib/icmsf/options.ts'

let checks = 0
let fail = 0
function eq(id: string, what: string, got: unknown, want: unknown) {
  checks++
  if (JSON.stringify(got) !== JSON.stringify(want)) { fail++; console.log('DIFF', id, what, 'got', JSON.stringify(got), 'want', JSON.stringify(want)) }
}
function near(id: string, what: string, got: number, want: number, tol: number) {
  checks++
  if (!(Math.abs(got - want) <= tol)) { fail++; console.log('DIFF', id, what, 'got', got, 'want', want) }
}

// T — Table 6-1 as printed in NAP (1985), Table 6-1, from ICMSF 1974 p. 60
// https://www.ncbi.nlm.nih.gov/books/NBK216671/table/ttt00005/  [case, plan, n, c]
const T61: [number, 2 | 3, number, number][] = [
  [1, 3, 5, 3], [2, 3, 5, 2], [3, 3, 5, 1], [4, 3, 5, 3], [5, 3, 5, 2], [6, 3, 5, 1], [7, 3, 5, 2], [8, 3, 5, 1], [9, 3, 10, 1],
  [10, 2, 5, 0], [11, 2, 10, 0], [12, 2, 20, 0], [13, 2, 15, 0], [14, 2, 30, 0], [15, 2, 60, 0],
]
eq('T', 'count', ICMSF_CASES.length, 15)
for (const [k, plan, n, c] of T61) {
  const row = ICMSF_CASES.find(x => x.case === k)!
  eq('T', `case ${k}`, [row.planClass, row.n, row.c], [plan, n, c])
}
// rows × columns of the table: hazard order and condition order give cases 1..15
const H = ['utility', 'low', 'moderate_limited', 'moderate_extensive', 'severe'] as const
const C = ['reduce', 'none', 'increase'] as const
H.forEach((h, i) => C.forEach((cd, j) => eq('T', `${h}/${cd}`, getIcmsfCase(h, cd).case, i * 3 + j + 1)))

// B — binomial probability of acceptance, against scipy.stats.binom.cdf
const B: [number, number, number, number][] = [
  [5, 0, 0.1, 0.59049], [30, 0, 0.05, 0.21463876394293757], [60, 0, 0.01, 0.5471566423907614], [5, 2, 0.3, 0.83692], [10, 1, 0.2, 0.3758096384000002],
]
for (const [n, c, p, want] of B) near('B', `n ${n} c ${c} p ${p}`, probabilityOfAcceptance(n, c, p), want, 1e-12)

// 3 — three-class acceptance against the textbook sum Σ C(n,i) pm^i pg^(n−i),
// computed separately with scipy.stats.norm (pg = P(x ≤ m), pm = P(m < x ≤ M)).
// Tolerance 1e-6: the page's normal CDF is the A&S 7.1.26 erf (|error| ≤ 1.5e-7).
const T3: [number, number, number, number, number, number, number][] = [
  // n, c, sd, log m, log M, log mean, P(accept)
  [5, 2, 0.8, 2, 3, 1.5, 0.7745005], [5, 1, 0.6, 3, 4, 2.2, 0.9263649], [10, 1, 1.0, 2, 3, 1.0, 0.4648006], [5, 3, 0.8, 4, 5, 4.2, 0.3298298],
]
for (const [n, c, sd, m, M, mu, want] of T3) near('3', `n ${n} c ${c} sd ${sd} mean ${mu}`, threeClassAcceptanceAt({ n, c, sd, m, M }, mu).pAccept, want, 1e-6)

// D — ICMSF published example (Dahms, ICMSF): L. monocytogenes, Case 11,
// n 10, c 0, m 100 CFU/g, SD 0.8: a mean of 30 CFU/g is rejected 95% of the
// time; a mean of about 1 CFU/g is accepted 95% of the time.
near('D', 'mean 30 CFU/g → P(accept) ≈ 5%', twoClassConcentrationAt(10, 0, 0.8, 2, Math.log10(30)).pAccept, 0.05, 0.005)
near('D', 'mean 30 CFU/g → 26% of units above m', twoClassConcentrationAt(10, 0, 0.8, 2, Math.log10(30)).pUnacceptableRegion, 0.26, 0.005)
{
  const r = evaluateRisk({ hazard: 'moderate_extensive', condition: 'none', m: 100, M: null, sd: 0.8, point: Math.log10(30) })!
  // exact: Φ((2 − μ)/0.8)^10 = 0.95 → μ = −0.0543 (0.88 CFU/g); = 0.05 → μ = 1.4825 (30.4 CFU/g)
  // 1e-5 log10: the erf approximation (≤ 1.5e-7) moves the crossing in the far tail by ~1.5e-6
  near('D', 'accepted 95% at', r.accept95!, -0.054300294874054966, 1e-5)
  near('D', 'rejected 95% at', r.reject95!, 1.4825225624150924, 1e-5)
  eq('D', 'curve points', r.curve.length, 101)
}

// L — unit classes and lot decision
const base = { mode: 'count', positives: null, riskP: 10 } as const
const ev = (r: Partial<IcmsfRequest>) => evaluateIcmsf({ ...base, hazard: 'low', condition: 'none', m: 100, M: 1000, results: [], ...r } as IcmsfRequest)
{
  // Case 5: 3-class, n 5, c 2
  const a = ev({ results: [40, 250, 90, 600, 100] })
  eq('L', 'case 5 classes', [a.caseNumber, a.units], [5, ['acceptable', 'marginal', 'acceptable', 'marginal', 'acceptable']])
  eq('L', 'two marginal of c 2 → accepted', [a.marginal, a.decision], [2, 'accept'])
  const b = ev({ results: [40, 250, 90, 600, 1500] })
  eq('L', 'one above M → not accepted', [b.decision, b.reason], ['reject', 'over_M'])
  const c = ev({ results: [150, 250, 300, null, null] })
  eq('L', 'three marginal before all in → not accepted', [c.entered, c.decision, c.reason], [3, 'reject', 'over_c'])
  const d = ev({ results: [40, 250, null, null, null] })
  eq('L', 'not all in, nothing failed → no decision', d.decision, null)
  const e = ev({ results: [1000, 0, 0, 0, 0] })
  eq('L', 'exactly M is marginal, exactly m acceptable', [ev({ results: [100] }).units[0], e.units[0]], ['acceptable', 'marginal'])
  const f = ev({ m: 1000, M: 100, results: [1, 1, 1, 1, 1] })
  eq('L', 'M not above m → limits not ok', [f.limitsOk, f.decision], [false, null])
}
{
  // Case 11: 2-class, n 10, c 0
  const p = evaluateIcmsf({ ...base, hazard: 'moderate_extensive', condition: 'none', mode: 'presence', m: null, M: null, positives: 0, results: [] })
  eq('L', 'presence, 0 positives → accepted', [p.caseNumber, p.n, p.c, p.decision], [11, 10, 0, 'accept'])
  const q = evaluateIcmsf({ ...base, hazard: 'moderate_extensive', condition: 'none', mode: 'presence', m: null, M: null, positives: 1, results: [] })
  eq('L', 'presence, 1 positive → not accepted', [q.decision, q.reason], ['reject', 'over_c'])
  const r = evaluateIcmsf({ ...base, hazard: 'moderate_extensive', condition: 'none', mode: 'count', m: 100, M: null, positives: null, results: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100] })
  eq('L', '2-class count, all ≤ m → accepted', r.decision, 'accept')
  const s = evaluateIcmsf({ ...base, hazard: 'moderate_extensive', condition: 'none', mode: 'count', m: 100, M: null, positives: null, results: [10, 120] })
  eq('L', '2-class count, one above m → not accepted', [s.units.slice(0, 2), s.decision], [['acceptable', 'defective'], 'reject'])
  near('L', 'OC at 10% = 0.9^10', p.oc![10], 0.3486784401, 1e-10)
  near('L', 'risk check at 10%', p.riskPa!, 0.3486784401, 1e-10)
  eq('L', 'no OC for 3-class', ev({}).oc, null)
}

console.log(`ICMSF golden: ${checks - fail}/${checks} pass`)
if (fail) process.exit(1)
