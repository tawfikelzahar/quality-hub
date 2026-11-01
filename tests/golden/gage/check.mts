/* eslint-disable @typescript-eslint/no-explicit-any */
// Gage R&R golden check — no server needed:
// node --import ./tests/register.mjs --experimental-strip-types --no-warnings tests/golden/gage/check.mts
//
// GR00 = the AIAG MSA 4th ed. worked example (same 3 × 10 × 3 data):
//  • Average & Range — Fig. III-B 16, p. 119 (`expected` in datasets.json):
//    R̄, X̄diff and Rp at the manual's printed precision.
//  • ANOVA — Appendix A, Tables A 4 and A 5 (anyflip.com/acwfa/rvyx p. 201–241):
//    SS 3.1673 / 88.3619 / 0.3590 / 2.7589 / 94.6471 · F (vs interaction)
//    79.41 / 492.29 / 0.434 · interaction pooled · variance 0.039973 (EV) /
//    0.051455 (AV) / 1.086447 (PV) · σ 0.199933 / 0.226838 / 0.302373 (GRR) /
//    1.042327 (PV) · % total variation 18.4 / 20.9 / 27.9 / 96.0 ·
//    % contribution 3.4 / 4.4 / 7.8 / 92.2 · ndc 4 (1.41 × 6.25 / 1.81 = 4.87).
// GR00–GR06: Minitab results are the `minitab` objects in datasets.json, both
// methods (Average & Range follows Minitab's d2* constants, see calc.server.ts).
// D4 for 3 trials is the exact 2.574 (the manual prints 2.58).
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
// ── Average & Range raw statistics (Fig. III-B 16) ──
// EV/AV/PV themselves now follow Minitab's d2* constants (checked below); the
// manual's worksheet K1/K2/K3 are rounded, so only the raw statistics are
// compared with it here.
{
  const e = g.expected
  const r: any = runGageRR(input(g))
  near('GR00 X̄&R', 'rBar', r.rBar, e.rBar, 0.00005)
  near('GR00 X̄&R', 'xbarDiff', r.xbarDiff, e.xbarDiff, 0.0001)
  near('GR00 X̄&R', 'rP', r.rP, e.rP, 0.0005)
  eq('GR00 X̄&R', 'D4 (3 trials)', r.constants.D4, 2.574)
  near('GR00 X̄&R', 'UCL R = R̄ × D4', r.uclR, r.rBar * 2.574, 1e-12)
}
// ── ANOVA (Appendix A, Tables A 4 / A 5) ──
{
  // α = 0.05 (current default); the interaction p is 0.974 here, so it is pooled at any usual α
  const r: any = runAnovaGageRR(input(g), 0.05)
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
// ── Minitab: every set, both methods, every printed number ──
// `minitab` in datasets.json is the Minitab session output (Crossed Gage R&R,
// study variation 6, α to remove interaction 0.05), kept as the printed text so
// each value is compared at the precision Minitab prints it: the site value,
// rounded the same way, must give the same digits (half a unit in the last
// printed place).
function printed(id: string, name: string, got: number, text: string) {
  const dec = (text.split('.')[1] ?? '').length
  near(id, name, got, Number(text), 0.5 * 10 ** -dec + 1e-12)
}
const ROWS = ['GRR', 'EV', 'AV', 'PV', 'TV'] as const
for (const s of sets) {
  const m = s.minitab
  if (!m) { fails++; console.log(`DIFF ${s.id}: no Minitab results recorded`); continue }
  for (const method of ['anova', 'xbar'] as const) {
    const mm = m[method], id = `${s.id} ${method === 'anova' ? 'ANOVA' : 'X̄&R'} vs Minitab`
    const r: any = method === 'anova' ? runAnovaGageRR(input(s), mm.alpha ?? 0.05) : runGageRR(input(s))
    const sd: Record<string, number> = { GRR: r.GRR, EV: r.EV, AV: r.AV, PV: r.PV, TV: r.TV }
    for (const k of ROWS) {
      printed(id, `StdDev ${k}`, sd[k], mm.sd[k])
      printed(id, `VarComp ${k}`, sd[k] ** 2, mm.varComp[k])
      printed(id, `%Contribution ${k}`, 100 * sd[k] ** 2 / r.TV ** 2, mm.pctContribution[k])
      printed(id, `%Study Var ${k}`, 100 * sd[k] / r.TV, mm.pctStudyVar[k])
      if (mm.pctTolerance) printed(id, `%Tolerance ${k}`, 100 * 6 * sd[k] / r.tolerance, mm.pctTolerance[k])
    }
    if (mm.tolerance == null) eq(id, 'no tolerance', r.tolerance, null)
    else near(id, 'tolerance', r.tolerance, mm.tolerance, 1e-9)
    eq(id, 'ndc', r.ndc, mm.ndc)
    if (method === 'anova' && mm.withInteraction) {
      const w = mm.withInteraction, u = r.unpooledInteraction
      const raw = (src: string) => r.anovaTable.find((x: any) => x.source === src)
      printed(id, 'SS part', raw('Part').SS, w.part.SS)
      printed(id, 'SS operator', raw('Appraiser').SS, w.operator.SS)
      printed(id, 'SS interaction', u.SS, w.interaction.SS)
      printed(id, 'MS interaction', u.MS, w.interaction.MS)
      printed(id, 'F interaction', u.F, w.interaction.F)
      printed(id, 'P interaction', u.p, w.interaction.P)
      eq(id, 'interaction removed', r.pooled, mm.interactionRemoved)
      const wo = mm.withoutInteraction
      if (r.pooled && wo) {
        printed(id, 'F part (pooled)', raw('Part').F, wo.part.F)
        printed(id, 'P part (pooled)', raw('Part').p, wo.part.P)
        printed(id, 'F operator (pooled)', raw('Appraiser').F, wo.operator.F)
        printed(id, 'P operator (pooled)', raw('Appraiser').p, wo.operator.P)
        printed(id, 'MS error (pooled)', raw('Repeatability (Error, pooled)').MS, wo.error.MS)
        eq(id, 'error df (pooled)', r.errorDf, wo.error.df)
      } else {
        printed(id, 'F part', raw('Part').F, w.part.F)
        printed(id, 'P part', raw('Part').p, w.part.P)
        printed(id, 'F operator', raw('Appraiser').F, w.operator.F)
        printed(id, 'P operator', raw('Appraiser').p, w.operator.P)
        printed(id, 'MS error', raw('Repeatability (Error)').MS, w.error.MS)
      }
    }
  }
}
// ndc is never below 1 (Minitab sets values under 1 to 1)
{
  const flat = Array.from({ length: 3 }, (_, a) => Array.from({ length: 10 }, (_, p) => [p % 2 ? 0.1 : -0.1, a % 2 ? 0.1 : -0.1, (p * 7 + a) % 3 ? 0 : 0.05].map(v => 10 + v)))
  eq('ndc floor', 'X̄&R ndc ≥ 1', runGageRR({ appraiserNames: ['A', 'B', 'C'], numTrials: 3, numParts: 10, measurements: flat }).ndc >= 1, true)
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
