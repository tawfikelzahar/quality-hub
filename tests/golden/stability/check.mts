// Stability (ICH Q1E) golden test — no server needed:
// node --import ./tests/register.mjs --experimental-strip-types --no-warnings tests/golden/stability/check.mts
//
// Reference values:
//  • expirest (CRAN), expirest_osle() documented examples on the LeBlond et al.
//    (2011) potency data, one-sided 95% confidence, α pool 0.25, limit 95 with
//    sf_option "loose" (= 94.95):
//      b2,b5,b7 → cics (one line) 26.22410 · individual worst 23.34184
//      b4,b5,b8 → dids (separate lines) 15.96453, worst batch b8
//      b3,b4,b5 → dics (common slope) 23.60194, worst batch b5
//  • JMP Stability example (Stability.jmp = expirest exp4), lower spec 95:
//      equal slopes p = 0.8043 → different intercepts, common slope → 23.475
import { readFileSync } from 'node:fs'
import { analyzeStability, linearRegression, tCritical, shelfLifeClaim, type StabilityInput, type StabilityResult } from '../../../lib/stability/calc.ts'
import { storageKindOf } from '../../../lib/stability/options.ts'

const D = JSON.parse(readFileSync(new URL('./datasets.json', import.meta.url), 'utf8'))

let checks = 0
let fail = 0
function eq(id: string, what: string, got: unknown, want: unknown) {
  checks++
  if (JSON.stringify(got) !== JSON.stringify(want)) { fail++; console.log('DIFF', id, what, 'got', JSON.stringify(got), 'want', JSON.stringify(want)) }
}
function near(id: string, what: string, got: number | null, want: number, tol: number) {
  checks++
  if (got === null || !(Math.abs(got - want) <= tol)) { fail++; console.log('DIFF', id, what, 'got', got, 'want', want) }
}

const pick = (set: string, keep: string[]) =>
  keep.map(b => ({ name: b, points: (D[set] as { batch: string; month: number; value: number }[]).filter(r => r.batch === b).map(r => ({ time: r.month, value: r.value })) }))
const run = (set: string, keep: string[], lower: number, extra: Partial<StabilityInput> = {}) =>
  analyzeStability({ batches: pick(set, keep), lower, upper: null, confidence: 0.95, ...extra })!

// E1 — expirest res1: slopes and intercepts poolable → one line
{
  const r = run('exp1', ['b2', 'b5', 'b7'], 94.95)
  eq('E1', 'model', r.model, 'pooled')
  near('E1', 'shelf life (cics)', r.recommended, 26.22410, 5e-5)
  near('E1', 'one line row', r.pooled!.shelfLife, 26.22410, 5e-5)
  // individual worst batch on its own line (expirest "dids" for the same data)
  near('E1', 'worst separate batch (dids)', Math.min(...r.batches.map(b => {
    const rr = analyzeStability({ batches: [pick('exp1', [b.name])[0]], lower: 94.95, upper: null, confidence: 0.95 })!
    return rr.recommended as number
  })), 23.34184, 5e-5)
}
// E2 — expirest res2: slopes differ (p < 0.25) → separate lines, worst b8
{
  const r = run('exp1', ['b4', 'b5', 'b8'], 94.95)
  eq('E2', 'model', r.model, 'separate')
  eq('E2', 'slopes not poolable', r.poolability!.slopesPoolable, false)
  near('E2', 'shelf life (dids)', r.recommended, 15.96453, 5e-5)
  eq('E2', 'limiting batch', r.limiting, 'b8')
  near('E2', 'b8 intercept', r.batches.find(b => b.name === 'b8')!.intercept, 101.2594, 5e-5)
}
// E3 — expirest print example: common slope, different intercepts, worst b5
{
  const r = run('exp1', ['b3', 'b4', 'b5'], 94.95)
  eq('E3', 'model', r.model, 'common-slope')
  near('E3', 'shelf life (dics)', r.recommended, 23.60194, 5e-5)
  eq('E3', 'limiting batch', r.limiting, 'b5')
  near('E3', 'b5 intercept in the common-slope model', r.batches.find(b => b.name === 'b5')!.modelIntercept, 100.82, 0.005)
}
// J — JMP Stability example
{
  const r = run('exp4', ['1_11', '2_12', '3_13', '4_14'], 95)
  near('J', 'equal slopes p', r.poolability!.slopesP, 0.8043, 5e-5)
  eq('J', 'model', r.model, 'common-slope')
  near('J', 'expiration', r.recommended, 23.475, 5e-4)
}

// S — single batch and the confidence bound itself
{
  // one-sided 95% t = two-sided 90% t: df 10 → 1.812461 (t tables)
  near('S', 't one-sided 95%, df 10', tCritical(0.90, 10), 1.812461, 1e-5)
  near('S', 't two-sided 95%, df 10', tCritical(0.95, 10), 2.228139, 1e-5)
  const pts = pick('exp1', ['b2'])[0]
  const r = analyzeStability({ batches: [pts], lower: 94.95, upper: null, confidence: 0.95 })!
  eq('S', 'single model', r.model, 'single')
  const reg = linearRegression(pts.points)!
  near('S', 'single batch uses one-sided t', r.tCrit, tCritical(0.90, reg.df), 1e-12)
  // both limits → two-sided: each side at 97.5%
  const two = analyzeStability({ batches: [pts], lower: 94.95, upper: 105, confidence: 0.95 })!
  eq('S', 'two limits → two-sided', two.sided, 'two')
  near('S', 'two-sided t', two.tCrit, tCritical(0.95, reg.df), 1e-12)
  eq('S', 'two-sided is shorter', (two.recommended as number) < (r.recommended as number), true)
  // no limit → no shelf life
  eq('S', 'no limit', analyzeStability({ batches: [pts], lower: null, upper: null, confidence: 0.95 })!.recommended, null)
}

// C — what the label may claim, ICH Q1E 2.4 / 2.5 (checked against the ICH Q1E PDF, database.ich.org)
{
  const fake = (maxObserved: number, recommended: number | null) => ({ maxObserved, recommended } as StabilityResult)
  const max = (x: number, st: Parameters<typeof shelfLifeClaim>[1], ac: Parameters<typeof shelfLifeClaim>[3]) => shelfLifeClaim(fake(x, 999), st, true, ac).maxAllowed
  // room temperature
  eq('C', 'room, no change at accelerated (2.4.1.2): 12 → 24', max(12, 'room', 'none'), 24)
  eq('C', 'room, no change at accelerated: 36 → 48 (12 beyond)', max(36, 'room', 'none'), 48)
  eq('C', 'room, change at accelerated only (2.4.2.1): 6 → 9', max(6, 'room', 'accelerated'), 9)
  eq('C', 'room, change at accelerated only: 24 → 30 (6 beyond)', max(24, 'room', 'accelerated'), 30)
  eq('C', 'room, change at intermediate (2.4.2.2): data only', max(24, 'room', 'intermediate'), 24)
  eq('C', 'room, accelerated not known: data only', max(24, 'room', 'unknown'), 24)
  // refrigerator
  eq('C', 'fridge, no change at accelerated (2.5.1.1): 6 → 9', max(6, 'refrigerated', 'none'), 9)
  eq('C', 'fridge, no change at accelerated: 24 → 30 (6 beyond)', max(24, 'refrigerated', 'none'), 30)
  eq('C', 'fridge, change at accelerated (2.5.1.2): no extrapolation', max(24, 'refrigerated', 'accelerated'), 24)
  eq('C', 'fridge, change at intermediate: no extrapolation', max(24, 'refrigerated', 'intermediate'), 24)
  // freezer (2.5.2) and supporting conditions
  eq('C', 'freezer: data only', max(18, 'frozen', 'none'), 18)
  eq('C', 'accelerated storage sets no rule', max(6, 'support', 'none'), null)
  eq('C', 'custom sets no rule', max(6, 'other', 'none'), null)
  // claim = shorter of bound and rule; whole months and 6-month steps rounded down
  const a = shelfLifeClaim(fake(36, 26.2241), 'room', true, 'none')
  eq('C', 'bound inside the data sets the claim', [a.claim, a.limitedBy, a.wholeMonths, a.step6, a.rule], [26.2241, 'data', 26, 24, '2x12'])
  const b = shelfLifeClaim(fake(12, 40), 'room', true, 'none')
  eq('C', 'rule caps a long bound', [b.claim, b.limitedBy, b.wholeMonths], [24, 'rule', 24])
  const u = shelfLifeClaim(fake(24, 30.03), 'room', true, 'unknown')
  eq('C', 'unknown accelerated: capped at the data', [u.claim, u.limitedBy, u.rule], [24, 'rule', 'none'])
  const n = shelfLifeClaim(fake(24, null), 'refrigerated', true, 'none')
  eq('C', 'bound not reached: the rule sets the claim', [n.claim, n.limitedBy], [30, 'rule'])
  eq('C', 'no limit: no claim', shelfLifeClaim(fake(24, null), 'room', false, 'none').claim, null)
  eq('C', 'storage keys', ['long-term', 'long-term-30', 'refrigerated', 'frozen', 'accelerated', 'custom', 'x'].map(storageKindOf), ['room', 'room', 'refrigerated', 'frozen', 'support', 'other', 'other'])
}

console.log(`Stability golden: ${checks - fail}/${checks} pass`)
if (fail) process.exit(1)
