/* eslint-disable @typescript-eslint/no-explicit-any */
// Golden datasets vs Minitab 21 output (Tawfik, 21 Oct 2026).
// Each expected value is copied as Minitab displays it; ours is rounded to
// the same number of decimals and must match exactly.
// Run: npm run test:golden
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runVariableChartAnalysis as runVar, runXbarSAnalysis as runS } from '../../lib/spc/calculator.ts'
import { formatPValue } from '../../lib/stats/normal.ts'

const ds = Object.fromEntries(JSON.parse(readFileSync(new URL('./datasets.json', import.meta.url), 'utf8')).map((d: any) => [d.id, d]))
const dec = (s: string) => (s.includes('.') ? s.split('.')[1].length : 0)
const r = (v: number, s: string) => v.toFixed(dec(s))
let checks = 0
function eq(label: string, ours: number | null | undefined, minitab: string) {
  assert.ok(ours !== null && ours !== undefined, `${label}: ours is null, Minitab ${minitab}`)
  let o = r(ours, minitab)
  if (o === '-0' || /^-0\.0+$/.test(o)) o = o.slice(1)
  assert.equal(o, minitab, `${label}: ours ${ours} → ${o}, Minitab ${minitab}`)
  checks++
}
const fails = (vs: { rule: number; failedAt: number[] }[]) => Object.fromEntries(vs.map(v => [v.rule, v.failedAt]).reduce((m: any[], [k, a]) => { const e = m.find(x => x[0] === k); if (e) e[1] = [...e[1], ...a]; else m.push([k, [...a]]); return m }, []))

function run(id: string) {
  const d = ds[id]
  const N = d.n ?? 1
  return (d.kind === 'xbars' ? runS : runVar)({ data: d.data, N, LSL: d.lsl, USL: d.usl, target: d.target, sigmaConvention: 'direct', testSet: 'all' })
}
type Exp = Record<string, string>
function check(id: string, e: Exp, x: any) {
  const map: Record<string, any> = {
    cl: x.cl_x, ucl: x.ucl_x, lcl: x.lcl_x, rcl: x.cl_r, rucl: x.ucl_r, rlcl: x.lcl_r,
    sdO: x.sdOverall, sdW: x.sigma, Cp: x.Cp, Cpk: x.Cpk, Pp: x.Pp, Ppk: x.Ppk, Cpm: x.Cpm,
    wL: x.ppmD_st?.below, wU: x.ppmD_st?.above, wT: x.ppmD_st?.total,
    oL: x.ppmD_lt?.below, oU: x.ppmD_lt?.above, oT: x.ppmD_lt?.total,
    AD: x.ad?.A2,
  }
  for (const [k, v] of Object.entries(e)) {
    if (k === 'p') { assert.equal(formatPValue(x.ad.p), v, `${id} p`); checks++; continue }
    eq(`${id} ${k}`, map[k], v)
  }
}

// I-MR ───────────────────────────────────────────────────────────────────
check('DS01', { cl: '24.167', ucl: '25.098', lcl: '23.236', rcl: '0.35', rucl: '1.144', sdO: '0.258199', sdW: '0.310284',
  Pp: '1.29', Ppk: '1.08', Cp: '1.07', Cpk: '0.90', oL: '3.11', oU: '624.42', oT: '627.53', wL: '84.96', wU: '3618.75', wT: '3703.70' }, run('DS01'))
check('DS02', { cl: '10.0393', ucl: '10.2460', lcl: '9.8325', rcl: '0.0777', rucl: '0.2540', sdO: '0.0734736', sdW: '0.0689137',
  Pp: '1.59', Ppk: '1.54', Cpm: '1.57', Cp: '1.69', Cpk: '1.64', oL: '1.94', oU: '0.46', oT: '2.40', wL: '0.43', wU: '0.08', wT: '0.51' }, run('DS02'))
{
  const x = run('DS03')
  check('DS03', { cl: '50.851', ucl: '53.711', lcl: '47.991', rcl: '1.075', rucl: '3.513', sdO: '1.31104', sdW: '0.953228',
    Pp: '1.53', Ppk: '1.31', Cp: '2.10', Cpk: '1.80', oL: '0.09', oU: '42.95', oT: '43.03', wL: '0.00', wU: '0.03', wT: '0.03', AD: '1.017', p: '0.010' }, x)
  assert.deepEqual(fails(x.violations_x), { 1: [12], 6: [14, 15, 16] }); assert.deepEqual(fails(x.violations_r), { 1: [12, 13] }); checks += 2
}
{
  const x = run('DS07')
  check('DS07', { cl: '1.979', ucl: '4.194', lcl: '-0.237', rcl: '0.833', rucl: '2.722', sdO: '0.858997', sdW: '0.738535',
    Pp: '1.07', Ppk: '0.57', Cp: '1.24', Cpk: '0.67', oL: '42572.68', oU: '1.43', oT: '42574.11', wL: '22621.57', wU: '0.03', wT: '22621.60', AD: '2.066', p: '< 0.005' }, x)
  assert.deepEqual(fails(x.violations_x), { 1: [35], 5: [23] }); assert.deepEqual(fails(x.violations_r), { 1: [29, 30, 35] }); checks += 2
}
{
  const x = run('DS08')
  check('DS08', { cl: '204.42', ucl: '227.39', lcl: '181.46', rcl: '8.63', rucl: '28.21', sdO: '7.33491', sdW: '7.65412',
    Ppk: '1.11', Cpk: '1.06', oL: '434.28', oT: '434.28', wL: '708.68', wT: '708.68', AD: '0.229', p: '0.797' }, x)
  assert.equal(x.Cp, null); assert.equal(x.Pp, null)
  assert.deepEqual(fails(x.violations_x), { 4: [40] }); assert.deepEqual(fails(x.violations_r), {}); checks += 4
}
{
  const x = run('DS09')
  check('DS09', { cl: '100.02', ucl: '103.96', lcl: '96.08', rcl: '1.482', rucl: '4.842', AD: '0.947', p: '0.015' }, x)
  const f = fails(x.violations_x)
  // Minitab labels one test per point: 2@59,60 · 3@27 · 7@36–39 · 4@40–50
  assert.deepEqual(f[2], [59, 60]); assert.deepEqual(f[3], [27])
  assert.deepEqual(f[4], [40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50])
  for (const p of [36, 37, 38, 39]) assert.ok(f[7].includes(p))
  const fr = fails(x.violations_r)
  assert.deepEqual(Object.keys(fr), ['2']) // no test 3 on MR (needs 7 points)
  for (const p of [36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49]) assert.ok(fr[2].includes(p))
  checks += 7
}

// X̄-R / X̄-S ─────────────────────────────────────────────────────────────
// DS04 capability: Minitab rerun with "Subgroups across rows of Obs1–Obs5"
check('DS04', { cl: '73.99909', ucl: '74.01150', lcl: '73.98668', rcl: '0.02152', rucl: '0.04550', rlcl: '0',
  sdO: '0.00910956', sdW: '0.00922368', Pp: '1.83', Ppk: '1.80', Cp: '1.81', Cpk: '1.77',
  oL: '0.04', oU: '0.01', oT: '0.05', wL: '0.05', wU: '0.02', wT: '0.07', AD: '0.412', p: '0.335' }, run('DS04'))
{
  const x = run('DS05')
  // Minitab stored values (Storage tab): σ 0.104478 · R UCL 0.490754
  check('DS05', { cl: '12.0349', ucl: '12.1916', lcl: '11.8782', rcl: '0.2151', rucl: '0.490754', sdO: '0.128157', Pp: '1.43', Ppk: '1.39',
    oL: '14.98', oU: '5.18', oT: '20.16', AD: '0.672', p: '0.077' }, x)
  const f = fails(x.violations_x)
  // Minitab labels: 6@15,16,21,22,23,25 · 1@24
  assert.deepEqual(f[1], [24]); assert.deepEqual(f[6], [15, 16, 21, 22, 23, 24, 25])
  assert.deepEqual(fails(x.violations_r), { 1: [9] }); checks += 3
}
check('DS06', { cl: '5.02302', ucl: '5.06728', lcl: '4.97876', rcl: '0.04538', rucl: '0.07788', rlcl: '0.01287',
  sdO: '0.0471883', Pp: '1.59', Ppk: '1.58', oL: '1.14', oU: '0.75', oT: '1.90', AD: '0.166', p: '0.938' }, run('DS06'))
{
  const x = run('DS10')
  check('DS10', { cl: '29.807', ucl: '30.940', lcl: '28.675', rcl: '1.964', rucl: '4.152', AD: '9.588', p: '< 0.005' }, x)
  assert.deepEqual(fails(x.violations_x), { 7: [15, 16, 17, 18, 19, 20] }); assert.deepEqual(fails(x.violations_r), {}); checks += 2
}

console.log(`golden: ${checks} checks match Minitab`)
