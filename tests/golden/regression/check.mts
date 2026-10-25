// Regression (simple + multiple) golden test — no server needed:
// node --import ./tests/register.mjs --experimental-strip-types --no-warnings tests/golden/regression/check.mts
//
// Reference values:
//  • NIST StRD certified values (itl.nist.gov/div898/strd/lls):
//      Norris — B0 −0.262323073774029 (SD 0.232818234301152) ·
//        B1 1.00211681802045 (SD 0.429796848199937E-03) · residual SD
//        0.884796396144373 · R² 0.999993745883712 · SSR 4255954.13232369 ·
//        SSE 26.6173985294224 · F 5436385.54079785
//      Longley — B0 −3482258.63459582 … B6 1829.15146461355 with their SDs ·
//        residual SD 304.854073561965 · R² 0.995479004577296 ·
//        SSR 184172401.944494 · SSE 836424.055505915 · F 330.285339234588
//  • Independent OLS fit (statsmodels 0.15 / scipy 1.18) on the same data:
//    p-values, F p-value, R²(pred) from PRESS, leverage, standardized
//    residuals, Cook's D, 95% CI / PI of a prediction, Anderson-Darling on
//    the residuals (normal_ad), Durbin-Watson, Benard normal score.
//  • Unusual-observation rules: |standardized residual| > 2, leverage >
//    min(3p/n, 0.99) (Minitab, "What is an unusual observation?").
import { readFileSync } from 'node:fs'
import { fitRegression, type RegressionFit } from '../../../lib/regression/model.ts'

const D = JSON.parse(readFileSync(new URL('./datasets.json', import.meta.url), 'utf8')) as { norris: number[][]; longley: number[][]; longleyNames: string[] }

let checks = 0
let fail = 0
function eq(id: string, what: string, got: unknown, want: unknown) {
  checks++
  if (JSON.stringify(got) !== JSON.stringify(want)) { fail++; console.log('DIFF', id, what, 'got', JSON.stringify(got), 'want', JSON.stringify(want)) }
}
/** relative agreement to `digits` significant digits */
function sig(id: string, what: string, got: number | null | undefined, want: number, digits: number) {
  checks++
  const ok = got !== null && got !== undefined && Math.abs(got - want) <= Math.abs(want) * 10 ** -digits
  if (!ok) { fail++; console.log('DIFF', id, what, 'got', got, 'want', want) }
}
function near(id: string, what: string, got: number | null | undefined, want: number, tol: number) {
  checks++
  if (got === null || got === undefined || !(Math.abs(got - want) <= tol)) { fail++; console.log('DIFF', id, what, 'got', got, 'want', want) }
}
const run = (y: number[], X: number[][], names: string[], pred?: number[]) => fitRegression('Y', names, y, X, pred) as RegressionFit

// ── N1: NIST Norris (simple) ──────────────────────────────────────────────
{
  const y = D.norris.map(r => r[0]), X = D.norris.map(r => [r[1]])
  const r = run(y, X, ['x'], [500])
  sig('N1', 'B0', r.coefficients[0].coef, -0.262323073774029, 11)
  sig('N1', 'SD B0', r.coefficients[0].se, 0.232818234301152, 11)
  sig('N1', 'B1', r.coefficients[1].coef, 1.00211681802045, 12)
  sig('N1', 'SD B1', r.coefficients[1].se, 0.429796848199937e-3, 11)
  sig('N1', 'residual SD', r.s, 0.884796396144373, 11)
  sig('N1', 'R²', r.r2, 0.999993745883712, 12)
  sig('N1', 'SSR', r.anova[0].ss, 4255954.13232369, 11)
  sig('N1', 'SSE', r.anova.find(a => a.source === 'Error')!.ss, 26.6173985294224, 9)
  sig('N1', 'F', r.fRegression, 5436385.54079785, 9)
  eq('N1', 'df error', r.dfError, 34)
  sig('N1', 'p constant', r.coefficients[0].p, 0.26774674233339163, 8)
  sig('N1', 'p slope (tiny, kept)', r.coefficients[1].p, 4.6540408524748426e-90, 5)
  sig('N1', 'F p = slope p', r.pRegression, 4.6540408524748426e-90, 5)
  sig('N1', 'R² pred', r.r2Pred, 0.9999928394667227, 10)
  sig('N1', 'Durbin-Watson', r.durbinWatson, 1.2715089712593526, 10)
  sig('N1', 'AD A²*', r.normality?.A2adj, 0.28501157645940367 * (1 + 0.75 / 36 + 2.25 / 36 ** 2), 8)
  sig('N1', 'AD p', r.normality?.p, 0.6079914435313055, 8)
  ;[0.06919888851371712, 0.029355790035750985, 0.04915290091768069].forEach((v, i) => sig('N1', `leverage ${i + 1}`, r.residuals[i].leverage, v, 9))
  ;[0.18965935953064628, 1.08763892140733, -0.10186269472756021].forEach((v, i) => sig('N1', `std resid ${i + 1}`, r.residuals[i].stdResid, v, 8))
  ;[0.001337090456961505, 0.017888469709442346, 0.000268187662352011].forEach((v, i) => sig('N1', `Cook ${i + 1}`, r.residuals[i].cook, v, 8))
  near('N1', 'leverage limit 3p/n', r.leverageLimit, 6 / 36, 1e-15)
  eq('N1', 'unusual rows', [...r.unusual].sort((a, b) => a - b), [4, 29, 34])
  sig('N1', 'pred fit', r.prediction?.fit, 500.7960859364531, 11)
  sig('N1', 'pred SE fit', r.prediction?.seFit, 0.15150217580019285, 9)
  sig('N1', 'CI low', r.prediction?.ciLo, 500.48819647153346, 11)
  sig('N1', 'CI high', r.prediction?.ciHi, 501.10397540137274, 11)
  sig('N1', 'PI low', r.prediction?.piLo, 498.97179405418353, 11)
  sig('N1', 'PI high', r.prediction?.piHi, 502.62037781872266, 11)
  eq('N1', 'pred inside data', r.prediction?.beyondData, false)
  sig('N1', 'normal plot z(1) Benard', r.normalPlot[0].z, -2.0699018308950516, 8)
  sig('N1', 'normal plot smallest residual', r.normalPlot[0].resid, -2.352378128659666, 9)
  eq('N1', 'band points', r.band?.length, 41)
  near('N1', 'band ends at the data range', r.band![40].x, Math.max(...X.map(v => v[0])), 1e-9)
}

// ── L1: NIST Longley (6 predictors, ill-conditioned) ─────────────────────
{
  const y = D.longley.map(r => r[0]), X = D.longley.map(r => r.slice(1))
  const xm = D.longleyNames.slice(1).map((_, j) => X.reduce((a, r) => a + r[j], 0) / X.length)
  const r = run(y, X, D.longleyNames.slice(1), xm)
  const est = [-3482258.63459582, 15.0618722713733, -0.358191792925910e-1, -2.02022980381683, -1.03322686717359, -0.511041056535807e-1, 1829.15146461355]
  const sd = [890420.383607373, 84.9149257747669, 0.334910077722432e-1, 0.488399681651699, 0.214274163161675, 0.226073200069370, 455.478499142212]
  est.forEach((v, i) => sig('L1', `B${i}`, r.coefficients[i].coef, v, 9))
  sd.forEach((v, i) => sig('L1', `SD B${i}`, r.coefficients[i].se, v, 9))
  sig('L1', 'residual SD', r.s, 304.854073561965, 10)
  sig('L1', 'R²', r.r2, 0.995479004577296, 11)
  sig('L1', 'SSR', r.anova[0].ss, 184172401.944494, 10)
  sig('L1', 'SSE', r.anova.find(a => a.source === 'Error')!.ss, 836424.055505915, 9)
  sig('L1', 'F', r.fRegression, 330.285339234588, 9)
  ;[0.003560403663708892, 0.863140832807347, 0.31268106109169336, 0.0025350917341006363, 0.0009443667641592067, 0.826211795763202, 0.003036803341615373]
    .forEach((v, i) => sig('L1', `p ${r.coefficients[i].term}`, r.coefficients[i].p, v, 7))
  sig('L1', 'F p', r.pRegression, 4.984030528716498e-10, 6)
  ;[135.53243828000367, 1788.5134827182983, 33.61889059604998, 3.5889301934455404, 399.15102231263205, 758.9805974069244]
    .forEach((v, i) => sig('L1', `VIF ${D.longleyNames[i + 1]}`, r.coefficients[i + 1].vif, v, 8))
  sig('L1', 'R² pred', r.r2Pred, 0.9843959198926739, 9)
  sig('L1', 'Durbin-Watson', r.durbinWatson, 2.5594876892803406, 9)
  sig('L1', 'AD p', r.normality?.p, 0.25498161947373593, 7)
  ;[0.42453693062428854, 0.5649782977094588, 0.36207471236589583].forEach((v, i) => sig('L1', `leverage ${i + 1}`, r.residuals[i].leverage, v, 8))
  ;[0.14084015648305068, 0.04056135021656895, 0.0029302031308898655].forEach((v, i) => sig('L1', `Cook ${i + 1}`, r.residuals[i].cook, v, 7))
  near('L1', 'leverage limit 0.99', r.leverageLimit, 0.99, 1e-15)
  eq('L1', 'no unusual rows', r.unusual, [])
  sig('L1', 'pred fit at the means', r.prediction?.fit, 65317.00000002098, 10)
  sig('L1', 'pred SE fit', r.prediction?.seFit, 76.2135185582768, 8)
  sig('L1', 'PI low', r.prediction?.piLo, 64606.14790756828, 9)
  sig('L1', 'PI high', r.prediction?.piHi, 66027.85209247367, 9)
  // per-predictor Adj SS = t² · MSE, F = t²
  const g = r.anova.find(a => a.source === 'GNP')!
  sig('L1', 'Adj SS F = t²', g.f, r.coefficients[2].t ** 2, 12)
  eq('L1', 'ANOVA rows', r.anova.map(a => a.source), ['Regression', ...D.longleyNames.slice(1), 'Error', 'Total'])
  eq('L1', 'no band for multiple', r.band, null)
}

// ── S1: small sample (first 6 Norris rows): the old t approximation gave p 0.008 here ──
{
  const S = D.norris.slice(0, 6)
  const r = run(S.map(v => v[0]), S.map(v => [v[1]]), ['x'], [S.reduce((a, v) => a + v[1], 0) / 6])
  sig('S1', 'p constant', r.coefficients[0].p, 0.4343569958386979, 8)
  sig('S1', 'p slope', r.coefficients[1].p, 2.592926375957917e-12, 7)
  sig('S1', 'F p', r.pRegression, 2.5929263759579154e-12, 7)
  sig('S1', 'R² pred', r.r2Pred, 0.9999892726852861, 10)
  sig('S1', 'CI low', r.prediction?.ciLo, 263.03379850205636, 11)
  sig('S1', 'PI high', r.prediction?.piHi, 265.52336600846814, 11)
  eq('S1', 'AD needs 8 points', r.normality, null)
  near('S1', 't(0.975, 4)', r.tCrit, 2.7764451051977987, 1e-9)
}

// ── E1: refusals, scale and prediction flags ─────────────────────────────
{
  eq('E1', 'too few', fitRegression('Y', ['a', 'b'], [1, 2, 3], [[1, 2], [2, 1], [3, 5]]), { code: 'too-few', need: 4 })
  eq('E1', 'y constant', fitRegression('Y', ['a'], [2, 2, 2, 2], [[1], [2], [3], [4]]), { code: 'y-constant' })
  eq('E1', 'x constant', fitRegression('Y', ['a', 'b'], [1, 2, 3, 5, 4], [[1, 1], [2, 1], [3, 1], [4, 1], [5, 1]]), { code: 'x-constant', name: 'b' })
  eq('E1', 'collinear', fitRegression('Y', ['a', 'b', 'c'], [1, 3, 2, 5, 4, 6], [[1, 2, 3], [2, 1, 3], [3, 4, 7], [4, 3, 7], [5, 6, 11], [6, 2, 8]]), { code: 'collinear', name: 'c' })
  // the same Longley fit with every predictor × 1e-8: slopes scale, t and p do not move
  const y = D.longley.map(r => r[0]), X = D.longley.map(r => r.slice(1))
  const a = run(y, X, D.longleyNames.slice(1))
  const b = run(y, X.map(r => r.map(v => v * 1e-8)), D.longleyNames.slice(1))
  a.coefficients.forEach((c, i) => sig('E1', `scale-free t ${c.term}`, b.coefficients[i].t, c.t, 7))
  sig('E1', 'scaled slope', b.coefficients[1].coef, a.coefficients[1].coef * 1e8, 7)
  const far = run(D.norris.map(r => r[0]), D.norris.map(r => [r[1]]), ['x'], [5000])
  eq('E1', 'prediction beyond the data', far.prediction?.beyondData, true)
}

console.log(`Regression golden: ${checks - fail}/${checks} passed`)
if (fail) process.exit(1)
