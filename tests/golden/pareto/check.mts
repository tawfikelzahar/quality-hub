// Pareto golden test — hand-worked cases, no server needed:
// node --import ./tests/register.mjs --experimental-strip-types --no-warnings tests/golden/pareto/check.mts
import { paretoAnalysis, type ParetoInputRow } from '../../../lib/pareto/calc.ts'

const rows = (pairs: [string, number][]): ParetoInputRow[] => pairs.map(([label, value]) => ({ label, value }))
let checks = 0
let fail = 0
function eq(id: string, what: string, got: unknown, want: unknown) {
  checks++
  const ok = typeof want === 'number' && typeof got === 'number' ? Math.abs(got - want) < 1e-9 : JSON.stringify(got) === JSON.stringify(want)
  if (!ok) { fail++; console.log('DIFF', id, what, 'got', got, 'want', want) }
}

// P01 — the tool's example: 42, 28, 15, 9, 6 (total 100). Cum 42 / 70 / 85 / 94 / 100;
// 85 ≥ 80 at the 3rd bar → vital few 3. Never above 95 before the last bar → no "Other".
{
  const r = paretoAnalysis(rows([['Dimensional error', 42], ['Surface defect', 28], ['Wrong material', 15], ['Assembly fault', 9], ['Packaging damage', 6]]))!
  eq('P01', 'cum', r.items.map(i => i.cum), [42, 70, 85, 94, 100])
  eq('P01', 'vitalFew', r.vitalFew, 3)
  eq('P01', 'vitalCum', r.vitalCum, 85)
  eq('P01', 'bars', r.items.length, 5)
}
// P02 — boundary: 500, 296, 120, 84 (total 1000). Cum 50.0 / 79.6 / 91.6 / 100.
// 79.6 is not 80, so the vital few are 3 (the old page rounded 79.6 to 80 and said 2).
{
  const r = paretoAnalysis(rows([['A', 500], ['B', 296], ['C', 120], ['D', 84]]))!
  eq('P02', 'cum', r.items.map(i => Number(i.cum.toFixed(1))), [50, 79.6, 91.6, 100])
  eq('P02', 'vitalFew', r.vitalFew, 3)
}
// P03 — numeric names and duplicates: "101" 10 + "101" 7 + " 101 " 3 = 20, "102" 5.
// Total 25 → 80% / 20%; 80 reaches 80 → vital few 1.
{
  const r = paretoAnalysis(rows([['101', 10], ['102', 5], ['101', 7], [' 101 ', 3]]))!
  eq('P03', 'labels', r.items.map(i => i.label), ['101', '102'])
  eq('P03', 'counts', r.items.map(i => i.count), [20, 5])
  eq('P03', 'pct', r.items.map(i => i.pct), [80, 20])
  eq('P03', 'vitalFew', r.vitalFew, 1)
  eq('P03', 'categories', r.categories, 2)
}
// P04 — "Other" after 95%: 50, 20, 10, 8, 5, 3, 2, 1, 1 (total 100).
// Cum 50 / 70 / 80 / 88 / 93 / 96 → passes 95 at the 6th bar; 2 + 1 + 1 = 4 go to "Other" (last).
{
  const r = paretoAnalysis(rows([['a', 50], ['b', 20], ['c', 10], ['d', 8], ['e', 5], ['f', 3], ['g', 2], ['h', 1], ['i', 1]]))!
  eq('P04', 'bars', r.items.length, 7)
  eq('P04', 'other', [r.items[6].label, r.items[6].count, r.items[6].other, r.items[6].members], ['Other', 4, true, ['g', 'h', 'i']])
  eq('P04', 'cum', r.items.map(i => i.cum), [50, 70, 80, 88, 93, 96, 100])
  eq('P04', 'vitalFew', r.vitalFew, 3)
  eq('P04', 'categories', r.categories, 9)
}
// P05 — one leftover keeps its name: 60, 30, 6, 4 → passes 95 at the 3rd bar, only "4" left.
{
  const r = paretoAnalysis(rows([['a', 60], ['b', 30], ['c', 6], ['d', 4]]))!
  eq('P05', 'labels', r.items.map(i => i.label), ['a', 'b', 'c', 'd'])
}
// P06 — grouping switched off: P04 data, 9 bars.
{
  const r = paretoAnalysis(rows([['a', 50], ['b', 20], ['c', 10], ['d', 8], ['e', 5], ['f', 3], ['g', 2], ['h', 1], ['i', 1]]), null)!
  eq('P06', 'bars', r.items.length, 9)
}
// P07 — empty names and zero / negative counts are left out; nothing valid → null.
{
  eq('P07', 'filtered', paretoAnalysis(rows([['', 5], ['x', 0], ['y', -2]])), null)
}
console.log(fail === 0 ? `pareto golden: ${checks} checks match the hand-worked cases` : `pareto golden: ${fail} of ${checks} differ`)
process.exit(fail === 0 ? 0 : 1)
