// ISO 2859-1 / ANSI ASQ Z1.4 reference data
//
// ─────────────────────────────────────────────────────────────────────────
// HOW THIS FILE WAS FIXED — session 2 (this is the important one)
// ─────────────────────────────────────────────────────────────────────────
// Session 1 fixed a hand-typing bug (rows shifted by 2 code letters) but
// replaced it with a diagonal FORMULA that generated every cell from a
// sequence: Ac = NORMAL_SEQUENCE[letterIndex + aqlIndex - 14]. That formula
// was checked against all 176 numeric cells of the official table and
// matched every one — but that check only verified "where the table HAS a
// number, does the formula agree", not "where the table has an ARROW, does
// the formula correctly stay silent". It didn't.
//
// Re-checking properly (comparing the formula's output against EVERY cell,
// arrows included) found 37 cells out of 176 — about 1 in 5 — where the
// real table has an arrow (no defined plan; follow the switching rule) but
// the formula invented a numeric Ac/Re anyway. Example: code letter N at
// AQL 4.0% is an arrow ("use letter M's plan") in the real table, but the
// formula produced Ac=30. That's the bug Tawfik caught live in the app
// (N, lot 50 000 → Minor showed 30/31, a pair that doesn't exist anywhere
// in the printed standard).
//
// FIX: no formula. AC_NORMAL below is now a plain lookup table, typed in
// directly from the cell-by-cell data extracted from Tawfik's official
// ISO 2859-1 export (AQL_table.xlsx). Every number is either a real Ac
// value copied straight from that source, or -1 (meaning: the source
// showed an arrow there — no direct plan — so calculator.ts's existing
// switching-rule logic scans to the nearest code letter that DOES have a
// defined value, exactly like the printed arrows do). No cell is computed
// or inferred.
//
// KNOWN GAP: the official export only covered AQL 0.065% through 6.5%
// (11 of our 15 AQL columns). The 4 lowest columns (0.010, 0.015, 0.025,
// 0.040%) are not yet backed by a verified source, so they're left as -1
// (arrow) for every code letter for now. That's a safe default — worst
// case it falls through to "requires 100% inspection" — but it should be
// filled in once we get a verified source for that range specifically.
//
// STATUS:
//   - Normal inspection (AC_NORMAL): pure lookup, verified cell-by-cell
//     against the official export for AQL 0.065–6.5. High confidence.
//     AQL 0.010–0.040 still unverified (see gap above).
//   - Tightened / Reduced (AC_TIGHTENED / AC_REDUCED below): still NOT
//     verified. Same best-guess placeholder as before. Do not trust for
//     real decisions until we repeat this same direct-lookup process with
//     a verified source (a clean export/table, not a scanned image — the
//     scanned Tightened/Reduced pages had the same arrow-crossing ambiguity
//     that caused this whole problem, so they weren't reliable to transcribe
//     by eye either).
// ─────────────────────────────────────────────────────────────────────────

export type InspectionLevel = 'S1' | 'S2' | 'S3' | 'S4' | 'I' | 'II' | 'III';
export type InspectionType = 'Normal' | 'Tightened' | 'Reduced';
export type CodeLetter =
  | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H'
  | 'J' | 'K' | 'L' | 'M' | 'N' | 'P' | 'Q' | 'R';

export const CODE_LETTERS: CodeLetter[] = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P', 'Q', 'R',
];

export const SAMPLE_SIZES: Record<CodeLetter, number> = {
  A: 2, B: 3, C: 5, D: 8, E: 13, F: 20, G: 32, H: 50,
  J: 80, K: 125, L: 200, M: 315, N: 500, P: 800, Q: 1250, R: 2000,
};

export const AQL_VALUES: number[] = [
  0.010, 0.015, 0.025, 0.040, 0.065, 0.10, 0.15, 0.25, 0.40, 0.65, 1.0, 1.5, 2.5, 4.0, 6.5,
];

// Code Letter lookup table (ISO 2859-1 Table I)
// [minLot, maxLot, S1, S2, S3, S4, I, II, III]
// Cross-checked against Tawfik's official lot-size table — matches exactly.
export const CODE_LETTER_TABLE: [number, number, CodeLetter, CodeLetter, CodeLetter, CodeLetter, CodeLetter, CodeLetter, CodeLetter][] = [
  [2, 8, 'A', 'A', 'A', 'A', 'A', 'A', 'B'],
  [9, 15, 'A', 'A', 'A', 'A', 'A', 'B', 'C'],
  [16, 25, 'A', 'A', 'B', 'B', 'B', 'C', 'D'],
  [26, 50, 'A', 'B', 'B', 'C', 'C', 'D', 'E'],
  [51, 90, 'B', 'B', 'C', 'C', 'C', 'E', 'F'],
  [91, 150, 'B', 'B', 'D', 'D', 'D', 'F', 'G'],
  [151, 280, 'B', 'C', 'D', 'E', 'E', 'G', 'H'],
  [281, 500, 'B', 'C', 'E', 'E', 'F', 'H', 'J'],
  [501, 1200, 'C', 'C', 'E', 'F', 'G', 'J', 'K'],
  [1201, 3200, 'C', 'D', 'F', 'G', 'H', 'K', 'L'],
  [3201, 10000, 'C', 'D', 'G', 'H', 'J', 'L', 'M'],
  [10001, 35000, 'C', 'D', 'H', 'J', 'K', 'M', 'N'],
  [35001, 150000, 'D', 'E', 'J', 'K', 'L', 'N', 'P'],
  [150001, 500000, 'D', 'E', 'K', 'L', 'M', 'P', 'Q'],
  [500001, Infinity, 'D', 'E', 'L', 'M', 'N', 'Q', 'R'],
];

// ─────────────────────────────────────────────────────────────────────────
// HOW THIS FILE WAS FIXED — session 3 (arrow DIRECTION, not just values)
// ─────────────────────────────────────────────────────────────────────────
// Session 2 fixed the *values* (pure lookup, no formula) but calculator.ts
// still had to GUESS which direction to follow an arrow in: "if this row
// already has a real value further left, go to a smaller code letter;
// otherwise go to a bigger one." That heuristic is wrong for some cells —
// e.g. code letter M at AQL 0.065% has no real value anywhere to its left,
// so the heuristic would send it to a BIGGER letter, but the official
// table's actual arrow at that cell points to L, a SMALLER letter.
//
// Fix: stop guessing direction entirely. RESOLVED_NORMAL below is built by
// directly following each cell's real arrow target (re-extracted
// programmatically from Tawfik's official export, letter references kept
// intact instead of being collapsed to -1) all the way to the first real
// Ac number, however many hops that takes. Every cell is either the exact
// resolved { letter, ac } pair from the standard, or null (AQL 0.010–0.040,
// still unverified — see the gap noted in session 2).
// ─────────────────────────────────────────────────────────────────────────

// Precomputed cell resolutions for Normal inspection. Index = position in
// AQL_VALUES. Each entry is either:
//   - null: not yet verified (AQL 0.010–0.040 gap, see above), or
//   - { letter, ac }: the code letter whose plan actually applies here
//     (may be a different letter than the row itself, if the official
//     table's arrow redirects here) and its acceptance number (Re = ac+1).
export const RESOLVED_NORMAL: Record<CodeLetter, Array<{ letter: CodeLetter; ac: number } | null>> = {
  A: [null, null, null, null, { letter: 'L', ac: 0 }, { letter: 'K', ac: 0 }, { letter: 'J', ac: 0 }, { letter: 'H', ac: 0 }, { letter: 'G', ac: 0 }, { letter: 'F', ac: 0 }, { letter: 'E', ac: 0 }, { letter: 'D', ac: 0 }, { letter: 'C', ac: 0 }, { letter: 'B', ac: 0 }, { letter: 'A', ac: 0 }],
  B: [null, null, null, null, { letter: 'L', ac: 0 }, { letter: 'K', ac: 0 }, { letter: 'J', ac: 0 }, { letter: 'H', ac: 0 }, { letter: 'G', ac: 0 }, { letter: 'F', ac: 0 }, { letter: 'E', ac: 0 }, { letter: 'D', ac: 0 }, { letter: 'C', ac: 0 }, { letter: 'B', ac: 0 }, { letter: 'A', ac: 0 }],
  C: [null, null, null, null, { letter: 'L', ac: 0 }, { letter: 'K', ac: 0 }, { letter: 'J', ac: 0 }, { letter: 'H', ac: 0 }, { letter: 'G', ac: 0 }, { letter: 'F', ac: 0 }, { letter: 'E', ac: 0 }, { letter: 'D', ac: 0 }, { letter: 'C', ac: 0 }, { letter: 'B', ac: 0 }, { letter: 'D', ac: 1 }],
  D: [null, null, null, null, { letter: 'L', ac: 0 }, { letter: 'K', ac: 0 }, { letter: 'J', ac: 0 }, { letter: 'H', ac: 0 }, { letter: 'G', ac: 0 }, { letter: 'F', ac: 0 }, { letter: 'E', ac: 0 }, { letter: 'D', ac: 0 }, { letter: 'C', ac: 0 }, { letter: 'E', ac: 1 }, { letter: 'D', ac: 1 }],
  E: [null, null, null, null, { letter: 'L', ac: 0 }, { letter: 'K', ac: 0 }, { letter: 'J', ac: 0 }, { letter: 'H', ac: 0 }, { letter: 'G', ac: 0 }, { letter: 'F', ac: 0 }, { letter: 'E', ac: 0 }, { letter: 'D', ac: 0 }, { letter: 'F', ac: 1 }, { letter: 'E', ac: 1 }, { letter: 'E', ac: 2 }],
  F: [null, null, null, null, { letter: 'L', ac: 0 }, { letter: 'K', ac: 0 }, { letter: 'J', ac: 0 }, { letter: 'H', ac: 0 }, { letter: 'G', ac: 0 }, { letter: 'F', ac: 0 }, { letter: 'E', ac: 0 }, { letter: 'G', ac: 1 }, { letter: 'F', ac: 1 }, { letter: 'F', ac: 2 }, { letter: 'F', ac: 3 }],
  G: [null, null, null, null, { letter: 'L', ac: 0 }, { letter: 'K', ac: 0 }, { letter: 'J', ac: 0 }, { letter: 'H', ac: 0 }, { letter: 'G', ac: 0 }, { letter: 'F', ac: 0 }, { letter: 'H', ac: 1 }, { letter: 'G', ac: 1 }, { letter: 'G', ac: 2 }, { letter: 'G', ac: 3 }, { letter: 'G', ac: 5 }],
  H: [null, null, null, null, { letter: 'L', ac: 0 }, { letter: 'K', ac: 0 }, { letter: 'J', ac: 0 }, { letter: 'H', ac: 0 }, { letter: 'G', ac: 0 }, { letter: 'J', ac: 1 }, { letter: 'H', ac: 1 }, { letter: 'H', ac: 2 }, { letter: 'H', ac: 3 }, { letter: 'H', ac: 5 }, { letter: 'H', ac: 7 }],
  J: [null, null, null, null, { letter: 'L', ac: 0 }, { letter: 'K', ac: 0 }, { letter: 'J', ac: 0 }, { letter: 'H', ac: 0 }, { letter: 'K', ac: 1 }, { letter: 'J', ac: 1 }, { letter: 'J', ac: 2 }, { letter: 'J', ac: 3 }, { letter: 'J', ac: 5 }, { letter: 'J', ac: 7 }, { letter: 'J', ac: 10 }],
  K: [null, null, null, null, { letter: 'L', ac: 0 }, { letter: 'K', ac: 0 }, { letter: 'J', ac: 0 }, { letter: 'L', ac: 1 }, { letter: 'K', ac: 1 }, { letter: 'K', ac: 2 }, { letter: 'K', ac: 3 }, { letter: 'K', ac: 5 }, { letter: 'K', ac: 7 }, { letter: 'K', ac: 10 }, { letter: 'K', ac: 14 }],
  L: [null, null, null, null, { letter: 'L', ac: 0 }, { letter: 'K', ac: 0 }, { letter: 'M', ac: 1 }, { letter: 'L', ac: 1 }, { letter: 'L', ac: 2 }, { letter: 'L', ac: 3 }, { letter: 'L', ac: 5 }, { letter: 'L', ac: 7 }, { letter: 'L', ac: 10 }, { letter: 'L', ac: 14 }, { letter: 'L', ac: 21 }],
  M: [null, null, null, null, { letter: 'L', ac: 0 }, { letter: 'N', ac: 1 }, { letter: 'M', ac: 1 }, { letter: 'M', ac: 2 }, { letter: 'M', ac: 3 }, { letter: 'M', ac: 5 }, { letter: 'M', ac: 7 }, { letter: 'M', ac: 10 }, { letter: 'M', ac: 14 }, { letter: 'M', ac: 21 }, { letter: 'L', ac: 21 }],
  N: [null, null, null, null, { letter: 'P', ac: 1 }, { letter: 'N', ac: 1 }, { letter: 'N', ac: 2 }, { letter: 'N', ac: 3 }, { letter: 'N', ac: 5 }, { letter: 'N', ac: 7 }, { letter: 'N', ac: 10 }, { letter: 'N', ac: 14 }, { letter: 'N', ac: 21 }, { letter: 'M', ac: 21 }, { letter: 'L', ac: 21 }],
  P: [null, null, null, null, { letter: 'P', ac: 1 }, { letter: 'P', ac: 2 }, { letter: 'P', ac: 3 }, { letter: 'P', ac: 5 }, { letter: 'P', ac: 7 }, { letter: 'P', ac: 10 }, { letter: 'P', ac: 14 }, { letter: 'P', ac: 21 }, { letter: 'N', ac: 21 }, { letter: 'M', ac: 21 }, { letter: 'L', ac: 21 }],
  Q: [null, null, null, null, { letter: 'Q', ac: 2 }, { letter: 'Q', ac: 3 }, { letter: 'Q', ac: 5 }, { letter: 'Q', ac: 7 }, { letter: 'Q', ac: 10 }, { letter: 'Q', ac: 14 }, { letter: 'Q', ac: 21 }, { letter: 'P', ac: 21 }, { letter: 'N', ac: 21 }, { letter: 'M', ac: 21 }, { letter: 'L', ac: 21 }],
  R: [null, null, null, null, { letter: 'R', ac: 3 }, { letter: 'R', ac: 5 }, { letter: 'R', ac: 7 }, { letter: 'R', ac: 10 }, { letter: 'R', ac: 14 }, { letter: 'R', ac: 21 }, { letter: 'Q', ac: 21 }, { letter: 'P', ac: 21 }, { letter: 'N', ac: 21 }, { letter: 'M', ac: 21 }, { letter: 'L', ac: 21 }],
};

// Table II-A — Normal Inspection, own-row values only (-1 = arrow cell).
// Kept for reference/debugging. Calculator.ts uses RESOLVED_NORMAL above
// for actual plan lookups, since it already has arrows followed correctly.
export const AC_NORMAL: Record<CodeLetter, number[]> = {
  A: [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0],
  B: [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0, -1],
  C: [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0, -1, -1],
  D: [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0, -1, -1, 1],
  E: [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0, -1, -1, 1, 2],
  F: [-1, -1, -1, -1, -1, -1, -1, -1, -1, 0, -1, -1, 1, 2, 3],
  G: [-1, -1, -1, -1, -1, -1, -1, -1, 0, -1, -1, 1, 2, 3, 5],
  H: [-1, -1, -1, -1, -1, -1, -1, 0, -1, -1, 1, 2, 3, 5, 7],
  J: [-1, -1, -1, -1, -1, -1, 0, -1, -1, 1, 2, 3, 5, 7, 10],
  K: [-1, -1, -1, -1, -1, 0, -1, -1, 1, 2, 3, 5, 7, 10, 14],
  L: [-1, -1, -1, -1, 0, -1, -1, 1, 2, 3, 5, 7, 10, 14, 21],
  M: [-1, -1, -1, -1, -1, -1, 1, 2, 3, 5, 7, 10, 14, 21, -1],
  N: [-1, -1, -1, -1, -1, 1, 2, 3, 5, 7, 10, 14, 21, -1, -1],
  P: [-1, -1, -1, -1, 1, 2, 3, 5, 7, 10, 14, 21, -1, -1, -1],
  Q: [-1, -1, -1, -1, 2, 3, 5, 7, 10, 14, 21, -1, -1, -1, -1],
  R: [-1, -1, -1, -1, 3, 5, 7, 10, 14, 21, -1, -1, -1, -1, -1],
};

// ─────────────────────────────────────────────────────────────────────────
// NOT YET VERIFIED — Tightened & Reduced
// ─────────────────────────────────────────────────────────────────────────
// These still use the pre-fix best-guess data (same shape/logic as the old
// Normal table before we caught its shift bug). Do not treat these as
// reliable for real inspection decisions yet. Once we get an authoritative
// Tightened/Reduced reference (same kind of file Tawfik found for Normal),
// we'll derive a TIGHTENED_SEQUENCE / REDUCED_SEQUENCE the same way and
// swap these out for buildAcTable(...) calls — no other code changes needed.

// Table II-B — Tightened Inspection (UNVERIFIED)
export const AC_TIGHTENED: Record<CodeLetter, number[]> = {
  A: [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0],
  B: [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0, 1],
  C: [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0, 1, 2],
  D: [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0, 1, 2, 3],
  E: [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0, 1, 2, 3, 5],
  F: [-1, -1, -1, -1, -1, -1, -1, -1, -1, 0, 1, 2, 3, 5, 7],
  G: [-1, -1, -1, -1, -1, -1, -1, -1, 0, 1, 2, 3, 5, 7, 10],
  H: [-1, -1, -1, -1, -1, -1, -1, 0, 1, 2, 3, 5, 7, 10, 14],
  J: [-1, -1, -1, -1, -1, -1, 0, 1, 2, 3, 5, 7, 10, 14, 21],
  K: [-1, -1, -1, -1, -1, 0, 1, 2, 3, 5, 7, 10, 14, 21, -1],
  L: [-1, -1, -1, -1, 0, 1, 2, 3, 5, 7, 10, 14, 21, -1, -1],
  M: [-1, -1, -1, 0, 1, 2, 3, 5, 7, 10, 14, 21, -1, -1, -1],
  N: [-1, -1, 0, 1, 2, 3, 5, 7, 10, 14, 21, -1, -1, -1, -1],
  P: [-1, 0, 1, 2, 3, 5, 7, 10, 14, 21, -1, -1, -1, -1, -1],
  Q: [0, 1, 2, 3, 5, 7, 10, 14, 21, -1, -1, -1, -1, -1, -1],
  R: [1, 2, 3, 5, 7, 10, 14, 21, -1, -1, -1, -1, -1, -1, -1],
};

// Table II-C — Reduced Inspection (UNVERIFIED)
// NOTE: the official ISO 2859-1 Reduced table normally has a wider Ac/Re
// gap ("indeterminate" zone) instead of Re = Ac + 1. This placeholder does
// NOT model that gap — flagged for whoever verifies Reduced next.
export const AC_REDUCED: Record<CodeLetter, number[]> = {
  A: [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0],
  B: [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0, 1],
  C: [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0, 1, 2],
  D: [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0, 1, 2, 3],
  E: [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0, 1, 2, 3, 5],
  F: [-1, -1, -1, -1, -1, -1, -1, -1, -1, 0, 1, 2, 3, 5, 7],
  G: [-1, -1, -1, -1, -1, -1, -1, -1, 0, 1, 2, 3, 5, 7, 10],
  H: [-1, -1, -1, -1, -1, -1, -1, 0, 1, 2, 3, 5, 7, 10, 14],
  J: [-1, -1, -1, -1, -1, -1, 0, 1, 2, 3, 5, 7, 10, 14, 21],
  K: [-1, -1, -1, -1, -1, 0, 1, 2, 3, 5, 7, 10, 14, 21, 21],
  L: [-1, -1, -1, -1, 0, 1, 2, 3, 5, 7, 10, 14, 21, 21, 21],
  M: [-1, -1, -1, 0, 1, 2, 3, 5, 7, 10, 14, 21, 21, 21, 21],
  N: [-1, -1, 0, 1, 2, 3, 5, 7, 10, 14, 21, 21, 21, 21, 21],
  P: [-1, 0, 1, 2, 3, 5, 7, 10, 14, 21, 21, 21, 21, 21, 21],
  Q: [0, 1, 2, 3, 5, 7, 10, 14, 21, 21, 21, 21, 21, 21, 21],
  R: [1, 2, 3, 5, 7, 10, 14, 21, 21, 21, 21, 21, 21, 21, 21],
};

export const AC_TABLES: Record<InspectionType, Record<CodeLetter, number[]>> = {
  Normal: AC_NORMAL,
  Tightened: AC_TIGHTENED,
  Reduced: AC_REDUCED,
};

export const DEFAULT_DEFECT_CLASSES = [
  { name: 'Critical', aql: 0.065 },
  { name: 'Major', aql: 2.5 },
  { name: 'Minor', aql: 4.0 },
];
