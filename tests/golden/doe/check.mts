// DOE (2^k full factorial) golden test — no server needed:
// node --import ./tests/register.mjs --experimental-strip-types --no-warnings tests/golden/doe/check.mts
//
// Reference values:
//  • Montgomery, Design and Analysis of Experiments, Example 6.1 — plasma
//    etch, 2^3, 2 replicates (A gap, B C2F6 flow, C power). Data and sums of
//    squares as printed by SAS (PROC FACTEX documentation, nitride etch
//    example: Gap 41310.5625 · Flow 217.5625 · Power 374850.0625 ·
//    Gap×Power 94402.5625 · Flow×Gap 2475.0625 · Power×Flow 18.0625).
//    Full-model F, p, R² from an independent OLS fit (statsmodels / scipy):
//    F_A 18.3394 p 0.002679 · F_C 166.4105 p 1.233e-6 · F_AC 41.9090 p 0.000193 ·
//    p_B 0.763911 · p_AB 0.325168 · p_BC 0.930849 · p_ABC 0.818586 ·
//    R² 96.609% · R²adj 93.642% · R²pred 86.436% · S 47.4612 · SE coef 11.8653 ·
//    model F 32.5598 p 2.896e-5.
//  • The same SAS page, reduced model with 5 error df: F(1, 5) → p
//    (183.99 <.0001 · 20.28 0.0064 · 46.34 0.0010 · 3.78 0.1095) — checks the
//    exact F distribution against printed output.
//  • Montgomery Example 6.2 — filtration rate, 2^4, 1 replicate. Effects
//    (arXiv:0708.0715, Section 4.3, Table 1: 21.625, −18.125, 16.625, 14.625, 9.875 …) and
//    Lenth PSE = 2.625 (Maghsoodloo, Auburn INSY 7300 notes on Example 6.2).
//    ME = t(0.975, 15/3) · PSE = 2.5706 · 2.625 = 6.7478 → active A, AC, AD, D, C.
import { analyzeFactorial, predictUncoded, type DoeResult } from '../../../lib/doe/calculator.ts'
import { fSF, tQuantile } from '../../../lib/stats/dist.ts'
import { buildDesignMatrix, randomizeRunOrder } from '../../../lib/doe/design.ts'

let checks = 0
let fail = 0
function eq(id: string, what: string, got: unknown, want: unknown) {
  checks++
  if (JSON.stringify(got) !== JSON.stringify(want)) { fail++; console.log('DIFF', id, what, 'got', JSON.stringify(got), 'want', JSON.stringify(want)) }
}
function near(id: string, what: string, got: number | null | undefined, want: number, tol: number) {
  checks++
  if (got === null || got === undefined || !(Math.abs(got - want) <= tol)) { fail++; console.log('DIFF', id, what, 'got', got, 'want', want) }
}
const f = (name: string, low = -1, high = 1) => ({ name, low, high })
const term = (r: DoeResult, t: string) => r.terms.find(x => x.term === t)!

// ── E1: plasma etch, 2^3 × 2 ──────────────────────────────────────────────
{
  const Y = [[550, 604], [669, 650], [633, 601], [642, 635], [1037, 1052], [749, 868], [1075, 1063], [729, 860]]
  const r = analyzeFactorial([f('Gap', 0.8, 1.2), f('Flow', 125, 200), f('Power', 275, 325)], Y) as DoeResult
  eq('E1', 'method', r.method, 'anova')
  eq('E1', 'term order', r.terms.map(t => t.term), ['A', 'B', 'C', 'AB', 'AC', 'BC', 'ABC'])
  const ss: Record<string, number> = { A: 41310.5625, B: 217.5625, C: 374850.0625, AB: 2475.0625, AC: 94402.5625, BC: 18.0625, ABC: 126.5625 }
  for (const [t, v] of Object.entries(ss)) near('E1', `SS ${t}`, term(r, t).ss, v, 1e-6)
  near('E1', 'SS error', r.error?.ss, 18020.5, 1e-6)
  eq('E1', 'df error', r.error?.df, 8)
  near('E1', 'SS total', r.total.ss, 531420.9375, 1e-6)
  near('E1', 'effect A', term(r, 'A').effect, -101.625, 1e-9)
  near('E1', 'effect C', term(r, 'C').effect, 306.125, 1e-9)
  near('E1', 'effect AC', term(r, 'AC').effect, -153.625, 1e-9)
  near('E1', 'intercept', r.grandMean, 776.0625, 1e-9)
  near('E1', 'coef C', term(r, 'C').coef, 153.0625, 1e-9)
  near('E1', 'SE coef', term(r, 'A').seCoef, 11.865292, 1e-5)
  near('E1', 'F A', term(r, 'A').fValue, 18.339364, 1e-5)
  near('E1', 'F C', term(r, 'C').fValue, 166.410505, 1e-5)
  near('E1', 'F AC', term(r, 'AC').fValue, 41.908965, 1e-5)
  const p: Record<string, [number, number]> = {
    A: [0.0026786105, 1e-9], B: [0.7639107082, 1e-8], C: [1.2332620e-6, 1e-11], AB: [0.3251678561, 1e-8],
    AC: [0.0001933958, 1e-10], BC: [0.9308485642, 1e-8], ABC: [0.8185860579, 1e-8],
  }
  for (const [t, [v, tol]] of Object.entries(p)) near('E1', `p ${t}`, term(r, t).pValue, v, tol)
  eq('E1', 'significant', r.significant, ['C', 'AC', 'A'])
  near('E1', 'R²', r.r2, 0.96608997, 1e-7)
  near('E1', 'R² adj', r.r2Adj, 0.93641869, 1e-7)
  near('E1', 'R² pred', r.r2Pred, 0.86435988, 1e-7)
  near('E1', 'S', r.s, 47.461168, 1e-5)
  near('E1', 'model F', r.model.fValue, 32.559771, 1e-5)
  near('E1', 'model p', r.model.pValue, 2.8961677e-5, 1e-11)
  near('E1', 'Pareto line t(0.975, 8)', r.paretoLine, 2.306004, 1e-5)
  near('E1', 'Pareto value C = |t|', term(r, 'C').paretoValue, 12.9000196, 1e-6)
  // main effects plot: means at low / high
  near('E1', 'mean A low', r.mainEffects[0].low, 826.875, 1e-9)
  near('E1', 'mean A high', r.mainEffects[0].high, 725.25, 1e-9)
  // interaction AC: (gap low, power low) = mean of points 1 and 3
  near('E1', 'AC cell --', r.interactions.find(i => i.a === 0 && i.b === 2)!.means[0][0], (577 + 617) / 2, 1e-9)
  // uncoded equation reproduces every design-point mean
  const means = Y.map(y => (y[0] + y[1]) / 2)
  const lv = [[0.8, 1.2], [125, 200], [275, 325]]
  means.forEach((m, pt) => near('E1', `uncoded at point ${pt + 1}`, predictUncoded(r, lv.map((l, i) => l[(pt >> i) & 1])), m, 1e-6))
}

// ── E2: F distribution against SAS printed p (1, 5 df) ────────────────────
for (const [F, want, tol] of [[183.99, 3.90e-5, 1e-6], [20.28, 0.0064, 5e-5], [46.34, 0.0010, 5e-5], [3.78, 0.1095, 5e-5], [1.21, 0.3206, 1e-3]] as const) {
  near('E2', `F(1,5)=${F}`, fSF(F, 1, 5), want, tol)
}
near('E2', 't(0.975, 5)', tQuantile(0.975, 5), 2.570582, 1e-6)
near('E2', 't(0.975, 8)', tQuantile(0.975, 8), 2.306004, 1e-6)

// ── E3: filtration rate, 2^4 unreplicated, Lenth ─────────────────────────
{
  const y = [45, 71, 48, 65, 68, 60, 80, 65, 43, 100, 45, 104, 75, 86, 70, 96].map(v => [v])
  const r = analyzeFactorial(['Temp', 'Pressure', 'Conc', 'Stir'].map(n => f(n)), y) as DoeResult
  eq('E3', 'method', r.method, 'lenth')
  const top = [...r.terms].sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect)).slice(0, 8).map(t => t.effect).sort((a, b) => a - b)
  eq('E3', 'top 8 effects (published)', top, [-18.125, -2.625, 3.125, 4.125, 9.875, 14.625, 16.625, 21.625])
  near('E3', 'SS AC', term(r, 'AC').ss, 1314.0625, 1e-9)
  near('E3', 'PSE', r.lenth?.pse, 2.625, 1e-12)
  near('E3', 'ME', r.lenth?.me, 6.747777, 1e-5)
  eq('E3', 'active effects', r.significant, ['A', 'AC', 'AD', 'D', 'C'])
  eq('E3', 'no p-values', r.terms.every(t => t.pValue === null), true)
  eq('E3', 'R² adj not shown', r.r2Adj, null)
  near('E3', 'R²', r.r2, 1, 1e-12)
}

// ── E4: refusals and the design matrix ───────────────────────────────────
eq('E4', 'unequal replicates', analyzeFactorial([f('A'), f('B')], [[1, 2], [3], [4, 5], [6, 7]]), 'unequal')
eq('E4', 'no variation', analyzeFactorial([f('A'), f('B')], [[5], [5], [5], [5]]), 'no-variation')
eq('E4', 'identical replicates', analyzeFactorial([f('A'), f('B')], [[1, 1], [2, 2], [3, 3], [5, 5]]), 'zero-error')
eq('E4', 'equal levels', analyzeFactorial([f('A', 1, 1), f('B')], [[1], [2], [3], [4]]), 'levels')
{
  const d = buildDesignMatrix(3, 2)
  eq('E4', 'standard order', d.slice(0, 4).map(x => x.coded), [[-1, -1, -1], [1, -1, -1], [-1, 1, -1], [1, 1, -1]])
  eq('E4', 'rows', d.length, 16)
  const z = randomizeRunOrder(d)
  eq('E4', 'random keeps rows', z.map(x => `${x.standardOrder}-${x.replicate}`).sort(), d.map(x => `${x.standardOrder}-${x.replicate}`).sort())
  eq('E4', 'random run order 1..N', z.map(x => x.runOrder), d.map((_, i) => i + 1))
}

console.log(`DOE golden: ${checks - fail}/${checks} passed`)
if (fail) process.exit(1)
