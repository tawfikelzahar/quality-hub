// Descriptive Statistics — method check against SciPy (no server needed):
// node --import ./tests/register.mjs --experimental-strip-types --no-warnings tests/golden/descriptive/reference.mts
//
// reference.json was produced with SciPy 1.18 / NumPy on the six golden sets
// (datasets.json, D01–D06) and two extra sets (X1 n = 6, X2 with ties):
//  • skewness / kurtosis: scipy.stats.skew / kurtosis(bias=False) = G1 / G2
//  • quartiles: numpy.percentile(method='weibull') = position (n + 1)p
//  • CI for StDev: √((n − 1)s² / chi2.ppf) · CI for the mean: t.ppf
//  • CI for the median: scipy.stats.mstats.median_cihs (Hettmansperger–Sheather)
//  • chi-square quantiles on their own: chi2.ppf
// check.mts stays the comparison with Minitab's printed results.
import { readFileSync } from 'node:fs'
import { computeDescriptiveStats } from '../../../lib/descriptive/stats.ts'
import { chiSquareQuantile } from '../../../lib/stats/dist.ts'

interface Ref {
  id: string; data: number[] | null; n: number; skew: number; kurt: number | null
  q1: number; med: number; q3: number; sdLo: number; sdHi: number; medLo: number | null; medHi: number | null
  meanLo: number; meanHi: number; chi: number[]
}
const refs = JSON.parse(readFileSync(new URL('./reference.json', import.meta.url), 'utf8')) as Ref[]
const sets = JSON.parse(readFileSync(new URL('./datasets.json', import.meta.url), 'utf8')) as { id: string; data: number[] }[]

let checks = 0
let fail = 0
function near(id: string, what: string, got: number | null | undefined, want: number, tol = 1e-9) {
  checks++
  const ok = got !== null && got !== undefined && Math.abs(got - want) <= tol * Math.max(1, Math.abs(want))
  if (!ok) { fail++; console.log('DIFF', id, what, 'got', got, 'want', want) }
}

for (const r of refs) {
  const data = r.data ?? sets.find(s => s.id === r.id)!.data
  const d = computeDescriptiveStats(data)
  near(r.id, 'skewness G1', d.skewness, r.skew)
  if (r.kurt !== null) near(r.id, 'kurtosis G2', d.kurtosis, r.kurt)
  near(r.id, 'Q1 (n+1)/4', d.q1, r.q1)
  near(r.id, 'median', d.median, r.med)
  near(r.id, 'Q3 3(n+1)/4', d.q3, r.q3)
  near(r.id, 'CI StDev low', d.ciStdev?.lower, r.sdLo)
  near(r.id, 'CI StDev high', d.ciStdev?.upper, r.sdHi)
  near(r.id, 'CI mean low', d.ciMean?.lower, r.meanLo)
  near(r.id, 'CI mean high', d.ciMean?.upper, r.meanHi)
  if (r.medLo !== null && r.medHi !== null) {
    near(r.id, 'CI median low (H-S)', d.ciMedian?.lower, r.medLo)
    near(r.id, 'CI median high (H-S)', d.ciMedian?.upper, r.medHi)
  }
}
const chi = refs[0].chi
;[[0.025, 4], [0.975, 4], [0.025, 99], [0.975, 99], [0.5, 1]].forEach(([p, df], i) => near('chi2', `q(${p}, ${df})`, chiSquareQuantile(p, df), chi[i]))
// fewer than 6 points: even (min, max) covers less than 95%, so no median interval
checks++
if (computeDescriptiveStats([1, 2, 3, 4, 5]).ciMedian !== null) { fail++; console.log('DIFF n = 5 median CI should be null') }

console.log(`Descriptive reference: ${checks - fail}/${checks} passed`)
if (fail) process.exit(1)
