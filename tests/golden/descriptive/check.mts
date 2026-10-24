/* eslint-disable @typescript-eslint/no-explicit-any */
// Descriptive Statistics golden test — no server needed:
// node --import ./tests/register.mjs --experimental-strip-types --no-warnings tests/golden/descriptive/check.mts
// Each set in datasets.json gets an `expected` object once Minitab's
// Graphical Summary results are in (keys as below, values as Minitab prints
// them). Sets without `expected` only print the site's values.
import { readFileSync } from 'node:fs'
import { computeDescriptiveStats } from '../../../lib/descriptive/stats.ts'

const sets: any[] = JSON.parse(readFileSync(new URL('./datasets.json', import.meta.url), 'utf8'))

// key → value from the site result
const pick: Record<string, (r: any) => number | null> = {
  n: r => r.n,
  mean: r => r.mean,
  stdev: r => r.stdev,
  variance: r => r.variance,
  cv: r => r.cv,
  skewness: r => r.skewness,
  kurtosis: r => r.kurtosis,
  min: r => r.min,
  q1: r => r.q1,
  median: r => r.median,
  q3: r => r.q3,
  max: r => r.max,
  iqr: r => r.iqr,
  range: r => r.range,
  adA2: r => r.andersonDarling?.statistic ?? null,
  adP: r => r.andersonDarling?.pValue ?? null,
  ciMeanLo: r => r.ciMean?.lower ?? null,
  ciMeanHi: r => r.ciMean?.upper ?? null,
  ciMedianLo: r => r.ciMedian?.lower ?? null,
  ciMedianHi: r => r.ciMedian?.upper ?? null,
  ciStdevLo: r => r.ciStdev?.lower ?? null,
  ciStdevHi: r => r.ciStdev?.upper ?? null,
}

/** Equal at the decimals Minitab printed (its value is the reference) */
function sameAsPrinted(got: number | null, want: number | string): boolean {
  if (typeof want === 'string') {
    // "< 0.005" for p-values
    return want.startsWith('<') && got !== null && got < Number(want.slice(1))
  }
  if (got === null) return false
  const dec = (String(want).split('.')[1] ?? '').length
  return Math.abs(got - want) <= 0.5 * 10 ** -dec + 1e-12
}

let checks = 0
let fail = 0
let pending = 0
for (const s of sets) {
  const r = computeDescriptiveStats(s.data)
  if (!s.expected) {
    pending++
    const line = Object.entries(pick).map(([k, f]) => { const v = f(r); return `${k}=${v === null ? '—' : Number(v.toPrecision(6))}` }).join(' ')
    console.log(`${s.id} (no Minitab results yet) ${line}`)
    continue
  }
  for (const [k, want] of Object.entries(s.expected as Record<string, number | string>)) {
    if (!(k in pick)) continue
    checks++
    const got = pick[k](r)
    if (!sameAsPrinted(got, want)) { fail++; console.log('DIFF', s.id, k, 'site', got, 'Minitab', want) }
  }
}
console.log(fail === 0
  ? `descriptive golden: ${checks} checks match Minitab${pending ? ` · ${pending} set(s) waiting for Minitab results` : ''}`
  : `descriptive golden: ${fail} of ${checks} differ`)
process.exit(fail === 0 ? 0 : 1)
