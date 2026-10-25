/* eslint-disable @typescript-eslint/no-explicit-any */
// Gage R&R golden check — no server needed:
// node --import ./tests/register.mjs --experimental-strip-types --no-warnings tests/golden/gage/check.mts
//
// GR00 = the AIAG MSA 4th ed. worked example (same 3 × 10 × 3 data):
//  • Average & Range — Fig. III-B 16, p. 119 (`expected` in datasets.json).
//    The manual rounds R̄, X̄diff and Rp before the next step, so values are
//    compared at its printed precision (5 decimals for σ, 0.01 for %).
//  • ANOVA — Appendix A, Tables A 4 and A 5 (anyflip.com/acwfa/rvyx p. 201–241):
//    SS 3.1673 / 88.3619 / 0.3590 / 2.7589 / 94.6471 · F (vs interaction)
//    79.41 / 492.29 / 0.434 · interaction pooled · variance 0.039973 (EV) /
//    0.051455 (AV) / 1.086447 (PV) · σ 0.199933 / 0.226838 / 0.302373 (GRR) /
//    1.042327 (PV) · % total variation 18.4 / 20.9 / 27.9 / 96.0 ·
//    % contribution 3.4 / 4.4 / 7.8 / 92.2 · ndc 4 (1.41 × 6.25 / 1.81 = 4.87).
// GR01–GR06: Minitab results get added as `minitab` objects when they arrive.
// lib/gage/sample.ts (the faded example free visitors see) must equal what the
// calculation gives for the page's sample data.
import { readFileSync } from 'node:fs'
import { runGageRR, runAnovaGageRR } from '../../../lib/gage/calc.server.ts'
import { GAGE_SAMPLE_DATA, GAGE_SAMPLE_RESULT } from '../../../lib/gage/sample.ts'

const sets: any[] = JSON.parse(readFileSync(new URL('./datasets.json', import.meta.url), 'utf8'))

let checks = 0, fails = 0
function near(id: string, name: string, got: number, want: number, tol: number) {
  checks++
  if (!(Math.abs(got - want) <= tol)) { fails++; console.log(`DIFF ${id} ${name}: site ${got} vs ${want}`) }
}
function eq(id: string, name: string, got: unknown, want: unknown) {
  checks++
  if (JSON.stringify(got) !== JSON.stringify(want)) { fails++; console.log(`DIFF ${id} ${name}: site ${JSON.stringify(got)} vs ${JSON.stringify(want)}`) }
}
const input = (s: any) => ({ appraiserNames: s.appraisers, numTrials: s.trials, numParts: s.parts, measurements: s.data, USL: s.usl, LSL: s.lsl })

const g = sets.find(x => x.id === 'GR00')
// ── Average & Range (Fig. III-B 16) ──
{
  const e = g.expected
  const r: any = runGageRR(input(g))
  for (const k of ['EV', 'AV', 'GRR', 'PV', 'TV']) near('GR00 X̄&R', k, r[k], e[k], 0.0001)
  near('GR00 X̄&R', 'rBar', r.rBar, e.rBar, 0.00005)
  near('GR00 X̄&R', 'xbarDiff', r.xbarDiff, e.xbarDiff, 0.0001)
  near('GR00 X̄&R', 'rP', r.rP, e.rP, 0.0005)
  for (const k of ['EV', 'AV', 'GRR', 'PV']) near('GR00 X̄&R', '%' + k, r.pctOfTV[k], e.pctTV[k], 0.0001)
  eq('GR00 X̄&R', 'ndc', r.ndc, e.ndc)
}
// ── ANOVA (Appendix A, Tables A 4 / A 5) ──
{
  const r: any = runAnovaGageRR(input(g), 0.25)
  const u = r.unpooledInteraction
  const raw = (src: string) => r.anovaTable.find((x: any) => x.source === src)
  near('GR00 ANOVA', 'SS part', raw('Part').SS, 88.3619, 0.00005)
  near('GR00 ANOVA', 'SS appraiser', raw('Appraiser').SS, 3.1673, 0.00005)
  near('GR00 ANOVA', 'SS interaction', u.SS, 0.3590, 0.00005)
  near('GR00 ANOVA', 'MS interaction', u.MS, 0.01994, 0.000005)
  near('GR00 ANOVA', 'F interaction', u.F, 0.434, 0.0005)
  eq('GR00 ANOVA', 'interaction pooled', r.pooled, true)
  near('GR00 ANOVA', 'pooled error SS', raw('Repeatability (Error, pooled)').SS, 0.3590 + 2.7589, 0.0001)
  eq('GR00 ANOVA', 'pooled error df', r.errorDf, 78)
  near('GR00 ANOVA', 'var EV', r.varComponents.EV, 0.039973, 0.0000005)
  near('GR00 ANOVA', 'var AV', r.varComponents.AV, 0.051455, 0.0000005)
  near('GR00 ANOVA', 'var PV', r.varComponents.PV, 1.086447, 0.0000005)
  near('GR00 ANOVA', 'σ EV', r.EV, 0.199933, 0.0000005)
  near('GR00 ANOVA', 'σ AV', r.AV, 0.226838, 0.0000005)
  // the manual takes √0.09143 (variance already rounded): 0.302373; unrounded √0.091428 = 0.302372
  near('GR00 ANOVA', 'σ GRR', r.GRR, 0.302373, 0.000005)
  near('GR00 ANOVA', 'σ PV', r.PV, 1.042327, 0.0000005)
  near('GR00 ANOVA', 'σ TV', r.TV, 1.085, 0.0005)
  ;[['EV', 18.4], ['AV', 20.9], ['GRR', 27.9], ['PV', 96.0]].forEach(([k, v]) => near('GR00 ANOVA', `% total variation ${k}`, r.pctStudyVar[k as string] * 100, v as number, 0.05))
  ;[['EV', 3.4], ['AV', 4.4], ['GRR', 7.8], ['PV', 92.2]].forEach(([k, v]) => near('GR00 ANOVA', `% contribution ${k}`, r.pctContribution[k as string] * 100, v as number, 0.05))
  eq('GR00 ANOVA', 'ndc', r.ndc, 4)
  // Table A 4 tests Part and Appraiser against the interaction (random model)
  const MSa = raw('Appraiser').MS, MSp = raw('Part').MS
  near('GR00 ANOVA', 'F appraiser vs interaction', MSa / u.MS, 79.41, 0.005)
  near('GR00 ANOVA', 'F part vs interaction', MSp / u.MS, 492.29, 0.01)
}
// ── the faded example free visitors see is the real calculation ──
{
  const r: any = runGageRR({ appraiserNames: ['Appraiser A', 'Appraiser B', 'Appraiser C'], numTrials: 3, numParts: 10, measurements: GAGE_SAMPLE_DATA, USL: 72, LSL: 70 })
  for (const k of ['EV', 'AV', 'GRR', 'PV', 'TV', 'ndc'] as const) near('sample', k, (GAGE_SAMPLE_RESULT as any)[k], r[k], 1e-12)
  for (const k of ['EV', 'AV', 'GRR', 'PV'] as const) near('sample', `%TV ${k}`, GAGE_SAMPLE_RESULT.pctOfTV[k], r.pctOfTV[k], 1e-12)
  for (const k of ['EV', 'AV', 'GRR', 'PV'] as const) near('sample', `%Tol ${k}`, GAGE_SAMPLE_RESULT.pctOfTolerance[k], r.pctOfTolerance[k], 1e-12)
  eq('sample', 'conclusion', GAGE_SAMPLE_RESULT.conclusion, r.conclusion)
}

console.log(fails ? `gage golden: ${fails} of ${checks} checks differ` : `gage golden: ${checks}/${checks} match the reference`)
process.exit(fails ? 1 : 0)
