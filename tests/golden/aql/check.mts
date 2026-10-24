// AQL golden test — no server needed:
// node --import ./tests/register.mjs --experimental-strip-types --no-warnings tests/golden/aql/check.mts
//
// Reference: iso2859-1-2026.json, extracted from ISO 2859-1:2026 Table 1
// and Tables 2/3/4 (numbers + cell shading) and checked visually against
// the rendered pages. This test re-reads that extract with the rule printed
// in the table key (light grey → first plan below in the column, dark grey
// → last plan above) and compares every cell the site can be asked for.
import { readFileSync } from 'node:fs'
import { getCodeLetter, getPlan, computeRow, evaluateStage } from '../../../lib/aql/calculator.ts'
import { AQL_VALUES, CODE_LETTERS, CODE_LETTER_TABLE, sampleSizeFor, AC_TABLES, type InspectionType, type InspectionLevel } from '../../../lib/aql/tables.ts'

const ref = JSON.parse(readFileSync(new URL('./iso2859-1-2026.json', import.meta.url), 'utf8'))

let checks = 0
let fail = 0
function eq(id: string, what: string, got: unknown, want: unknown) {
  checks++
  if (JSON.stringify(got) !== JSON.stringify(want)) { fail++; console.log('DIFF', id, what, 'got', JSON.stringify(got), 'want', JSON.stringify(want)) }
}

const TYPES: InspectionType[] = ['Normal', 'Tightened', 'Reduced']

// R — every cell of the three master tables, AQL 0.010–6.5
eq('R', 'AQL columns', AQL_VALUES, ref.aql)
for (const type of TYPES) {
  const t: Record<string, (number | string)[]> = ref.tables[type]
  const letters = Object.keys(t)
  for (const L of CODE_LETTERS) {
    for (let j = 0; j < ref.aql.length; j++) {
      let i = letters.indexOf(L)
      const cell = t[L][j]
      if (cell === 'L' || cell === 'D') {
        const step = cell === 'L' ? 1 : -1
        do { i += step } while (typeof t[letters[i]][j] !== 'number')
      }
      const at = letters[i]
      const plan = getPlan(L, ref.aql[j], type)
      eq('R', `${type} ${L} AQL ${ref.aql[j]}`,
        plan && { letter: plan.usedLetter, n: plan.requiredSampleSize, ac: plan.ac, re: plan.re },
        { letter: at, n: ref.sampleSize[type][at], ac: t[at][j] as number, re: (t[at][j] as number) + 1 })
      // raw own-row values kept in tables.ts must agree too
      eq('R', `${type} ${L} AQL ${ref.aql[j]} raw`, AC_TABLES[type][L][j], typeof cell === 'number' ? cell : -1)
    }
  }
}

// N — sample size per letter for each inspection type (incl. S, tightened only)
for (const type of TYPES) for (const [L, n] of Object.entries(ref.sampleSize[type])) {
  eq('N', `${type} n for ${L}`, sampleSizeFor(L as never, type), n)
}

// C — Table 1, every lot-size row at both ends, every level
eq('C', 'Table 1 rows', CODE_LETTER_TABLE.length, ref.codeLetters.rows.length)
for (const [min, max, letters] of ref.codeLetters.rows as [number, number | null, string][]) {
  ref.codeLetters.levels.forEach((lv: InspectionLevel, k: number) => {
    eq('C', `lot ${min} level ${lv}`, getCodeLetter(min, lv), letters[k])
    if (max !== null) eq('C', `lot ${max} level ${lv}`, getCodeLetter(max, lv), letters[k])
  })
}
eq('C', 'lot 1 has no letter', getCodeLetter(1, 'II'), null)

// A — ISO 2859-1:2026 Annex A, Table A.1: code letters at level II and the
// integer acceptance numbers shown there (fractional ones are not offered by
// the site and are left out). AQL 1 %.
const ANNEX: [number, string, InspectionType, number, number][] = [
  // lot, letter, inspection, n, Ac
  [450, 'H', 'Normal', 50, 1], [300, 'H', 'Normal', 50, 1], [80, 'E', 'Normal', 13, 0],
  [800, 'J', 'Tightened', 80, 1], [600, 'J', 'Tightened', 80, 1],
  [600, 'J', 'Normal', 80, 2], [700, 'J', 'Normal', 80, 2], [550, 'J', 'Normal', 80, 2],
  [500, 'H', 'Normal', 50, 1], [85, 'E', 'Normal', 13, 0],
]
for (const [lot, letter, type, n, ac] of ANNEX) {
  const L = getCodeLetter(lot, 'II')!
  eq('A', `lot ${lot} letter`, L, letter)
  const p = getPlan(L, 1.0, type, lot)!
  eq('A', `lot ${lot} ${type} plan`, [p.usedLetter, p.requiredSampleSize, p.ac], [letter, n, ac])
}
// Annex A code letters for the fractional rows (letter only)
for (const [lot, letter] of [[180, 'G'], [200, 'G'], [250, 'G'], [100, 'F'], [120, 'F'], [400, 'H']] as [number, string][]) {
  eq('A', `lot ${lot} letter`, getCodeLetter(lot, 'II'), letter)
}
// lot 25 of Annex A: reduced inspection, H → n 20
eq('A', 'lot 400 reduced n', sampleSizeFor('H', 'Reduced'), 20)

// P — published worked example (globalsources.com, "Anatomy of the
// ANSI/ASQ Z1.4 AQL table"; Normal plans are the same in ISO 2859-1):
// lot 300, level II → H; AQL 0.65 → n 80; K at AQL 1.0 → 3/4, at 4.0 → 10/11
eq('P', 'lot 300 letter', getCodeLetter(300, 'II'), 'H')
eq('P', 'H 0.65 n', getPlan('H', 0.65, 'Normal')!.requiredSampleSize, 80)
eq('P', 'K 1.0', [getPlan('K', 1.0, 'Normal')!.ac, getPlan('K', 1.0, 'Normal')!.re], [3, 4])
eq('P', 'K 4.0', [getPlan('K', 4.0, 'Normal')!.ac, getPlan('K', 4.0, 'Normal')!.re], [10, 11])

// F — cells fixed on 24 Oct 2026 (light grey read as "up" before)
const t = getPlan('J', 0.40, 'Tightened', 1000)!
eq('F', 'Tightened J 0.40', [t.usedLetter, t.requiredSampleSize, t.ac, t.re], ['L', 200, 1, 2])
const r = getPlan('J', 0.40, 'Reduced', 1000)!
eq('F', 'Reduced J 0.40', [r.usedLetter, r.requiredSampleSize, r.ac, r.re], ['L', 80, 1, 2])
const s = getPlan('R', 0.025, 'Tightened')!
eq('F', 'Tightened R 0.025 → S', [s.usedLetter, s.requiredSampleSize, s.ac, s.re], ['S', 3150, 1, 2])
eq('F', 'Tightened R 0.015 → Q (dark grey)', getPlan('R', 0.015, 'Tightened')!.usedLetter, 'Q')

// L — sample size equal to or larger than the lot → inspect the whole lot
{
  const p = getPlan('D', 4.0, 'Tightened', 15)!   // → F, n 20 > lot 15
  eq('L', 'n > lot', [p.requiredSampleSize, p.actualSampleSize, p.fullLotInspection], [20, 15, true])
  const q = getPlan('C', 6.5, 'Normal', 8)!       // → D, n 8 = lot 8
  eq('L', 'n = lot', [q.requiredSampleSize, q.actualSampleSize, q.fullLotInspection], [8, 8, true])
  const ok = getPlan('J', 2.5, 'Normal', 1000)!
  eq('L', 'n < lot', [ok.actualSampleSize, ok.fullLotInspection], [80, false])
}

// V — row validation
{
  const bad = computeRow({ id: 'x', stageName: 's', lotSize: 1, level: 'II', inspectionType: 'Normal', defects: [{ id: 'd', name: 'Major', aql: 2.5 }] })
  eq('V', 'lot 1 rejected', bad.error !== null, true)
  const good = computeRow({ id: 'x', stageName: 's', lotSize: 1000, level: 'II', inspectionType: 'Normal', defects: [{ id: 'd', name: 'Major', aql: 2.5 }] })
  eq('V', 'lot 1000 Major 2.5', [good.codeLetter, good.sampleSize, good.defects[0].plan!.ac], ['J', 80, 5])
}

// D — decision (ISO 2859-1:2026, 11.2): found ≤ Ac acceptable, found ≥ Re
// not acceptable; lot not accepted when any class is not accepted
{
  // lot 1000, II, normal → J; Critical 0.065 → L n 200 0/1 · Major 2.5 → 5/6 · Minor 4.0 → 7/8
  const base = { lotSize: 1000, level: 'II' as const, inspectionType: 'Normal' as const }
  const a = evaluateStage({ ...base, classes: [{ aql: 0.065, found: 0 }, { aql: 2.5, found: 5 }, { aql: 4.0, found: 7 }] })
  eq('D', 'plans', a.classes.map(c => [c.letter, c.n, c.ac, c.re]), [['L', 200, 0, 1], ['J', 80, 5, 6], ['J', 80, 7, 8]])
  eq('D', 'all at Ac → accepted', [a.classes.map(c => c.decision), a.lot], [['accept', 'accept', 'accept'], 'accept'])
  const b = evaluateStage({ ...base, classes: [{ aql: 0.065, found: 0 }, { aql: 2.5, found: 3 }, { aql: 4.0, found: 8 }] })
  eq('D', 'Minor at Re → lot not accepted', [b.classes.map(c => c.decision), b.lot], [['accept', 'accept', 'reject'], 'reject'])
  const c = evaluateStage({ ...base, classes: [{ aql: 0.065, found: 1 }, { aql: 2.5, found: null }, { aql: 4.0, found: 0 }] })
  eq('D', 'one critical → not accepted even with a class missing', [c.classes.map(x => x.decision), c.lot], [['reject', null, 'accept'], 'reject'])
  const d = evaluateStage({ ...base, classes: [{ aql: 0.065, found: 0 }, { aql: 2.5, found: null }, { aql: 4.0, found: 0 }] })
  eq('D', 'class missing, none failed → no decision', d.lot, null)
  const e = evaluateStage({ ...base, lotSize: 1, classes: [{ aql: 2.5, found: 0 }] })
  eq('D', 'lot 1 → error', [e.error, e.lot], ['lot', null])
  // lot 26, II → D; AQL 0.10 normal is shaded down to K (n 125) → inspect all 26
  const f = evaluateStage({ lotSize: 26, level: 'II', inspectionType: 'Normal', classes: [{ aql: 0.10, found: 0 }] })
  eq('D', 'full lot: inspect 26 of n 125, Ac 0', [f.codeLetter, f.classes[0].letter, f.classes[0].n, f.classes[0].inspect, f.classes[0].fullLot, f.classes[0].decision], ['D', 'K', 125, 26, true, 'accept'])
}

console.log(`AQL golden: ${checks - fail}/${checks} pass`)
if (fail) process.exit(1)
