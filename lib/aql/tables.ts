// ISO 2859-1 / ANSI ASQ Z1.4 reference data
//
// ─────────────────────────────────────────────────────────────────────────
// HOW THIS FILE WAS FIXED — session 2 (Normal, values)
// ─────────────────────────────────────────────────────────────────────────
// Session 1 fixed a hand-typing bug (rows shifted by 2 code letters) but
// replaced it with a diagonal FORMULA that generated every cell from a
// sequence. That formula invented numeric Ac/Re values for 37 cells that
// are actually arrows in the real table (no defined plan there). FIX: no
// formula — every AC_* table below is a plain lookup, typed in directly
// from cell-by-cell extraction. -1 means the source showed an arrow there.
//
// ─────────────────────────────────────────────────────────────────────────
// HOW THIS FILE WAS FIXED — session 3 (Normal, arrow direction)
// ─────────────────────────────────────────────────────────────────────────
// calculator.ts used to GUESS which direction to follow an arrow in. Fixed
// by RESOLVED_NORMAL: every cell's real arrow target followed directly to
// the actual Ac number, however many hops that takes, instead of guessed.
//
// ─────────────────────────────────────────────────────────────────────────
// HOW THIS FILE WAS FIXED — session 4 (Tightened + Reduced, and the
// remaining Normal gap) — ISO 2859-1:2026 official PDF, page-accurate
// table extraction (not OCR/flattened text — actual PDF cell positions
// via pdfplumber, so no column-alignment guessing)
// ─────────────────────────────────────────────────────────────────────────
// AC_TIGHTENED and AC_REDUCED were previously a "same shape as Normal"
// placeholder that was never verified — and turned out to be wrong.
// Tightened's real progression is spaced differently (e.g. code letter J
// tops out at Ac=8 at AQL 6.5%, not 21), and Reduced likewise doesn't
// mirror Normal's spacing. Re-extracted both tables cell-by-cell from
// ISO 2859-1:2026 Table 3 (Tightened) and Table 4 (Reduced), the same way
// AC_NORMAL was done in session 2, then resolved every arrow cell to its
// real target with the exact same nearest-anchor-in-column algorithm used
// to build RESOLVED_NORMAL (verified: re-running that algorithm on
// AC_NORMAL reproduces the existing RESOLVED_NORMAL table exactly, cell
// for cell, zero mismatches — so it's the same method, not a new guess).
//
// Also: while re-extracting, cross-checked the new Normal-table read
// against the existing AC_NORMAL for AQL 0.065–6.5 — zero mismatches,
// which confirms this PDF source agrees with what was already verified.
// That let us fill in the AQL 0.010–0.040% gap that was previously left
// as unverified (-1) for every code letter, using the same source.
//
// STATUS: Normal, Tightened and Reduced are all now pure lookups, fully
// resolved (no null cells) for the complete AQL 0.010–6.5 range, and
// RESOLVED_NORMAL / RESOLVED_TIGHTENED / RESOLVED_REDUCED are what
// calculator.ts actually uses — no scanning/guessing logic left anywhere.
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
  A: [{ letter: 'Q', ac: 0 }, { letter: 'P', ac: 0 }, { letter: 'N', ac: 0 }, { letter: 'M', ac: 0 }, { letter: 'L', ac: 0 }, { letter: 'K', ac: 0 }, { letter: 'J', ac: 0 }, { letter: 'H', ac: 0 }, { letter: 'G', ac: 0 }, { letter: 'F', ac: 0 }, { letter: 'E', ac: 0 }, { letter: 'D', ac: 0 }, { letter: 'C', ac: 0 }, { letter: 'B', ac: 0 }, { letter: 'A', ac: 0 }],
  B: [{ letter: 'Q', ac: 0 }, { letter: 'P', ac: 0 }, { letter: 'N', ac: 0 }, { letter: 'M', ac: 0 }, { letter: 'L', ac: 0 }, { letter: 'K', ac: 0 }, { letter: 'J', ac: 0 }, { letter: 'H', ac: 0 }, { letter: 'G', ac: 0 }, { letter: 'F', ac: 0 }, { letter: 'E', ac: 0 }, { letter: 'D', ac: 0 }, { letter: 'C', ac: 0 }, { letter: 'B', ac: 0 }, { letter: 'A', ac: 0 }],
  C: [{ letter: 'Q', ac: 0 }, { letter: 'P', ac: 0 }, { letter: 'N', ac: 0 }, { letter: 'M', ac: 0 }, { letter: 'L', ac: 0 }, { letter: 'K', ac: 0 }, { letter: 'J', ac: 0 }, { letter: 'H', ac: 0 }, { letter: 'G', ac: 0 }, { letter: 'F', ac: 0 }, { letter: 'E', ac: 0 }, { letter: 'D', ac: 0 }, { letter: 'C', ac: 0 }, { letter: 'B', ac: 0 }, { letter: 'D', ac: 1 }],
  D: [{ letter: 'Q', ac: 0 }, { letter: 'P', ac: 0 }, { letter: 'N', ac: 0 }, { letter: 'M', ac: 0 }, { letter: 'L', ac: 0 }, { letter: 'K', ac: 0 }, { letter: 'J', ac: 0 }, { letter: 'H', ac: 0 }, { letter: 'G', ac: 0 }, { letter: 'F', ac: 0 }, { letter: 'E', ac: 0 }, { letter: 'D', ac: 0 }, { letter: 'C', ac: 0 }, { letter: 'E', ac: 1 }, { letter: 'D', ac: 1 }],
  E: [{ letter: 'Q', ac: 0 }, { letter: 'P', ac: 0 }, { letter: 'N', ac: 0 }, { letter: 'M', ac: 0 }, { letter: 'L', ac: 0 }, { letter: 'K', ac: 0 }, { letter: 'J', ac: 0 }, { letter: 'H', ac: 0 }, { letter: 'G', ac: 0 }, { letter: 'F', ac: 0 }, { letter: 'E', ac: 0 }, { letter: 'D', ac: 0 }, { letter: 'F', ac: 1 }, { letter: 'E', ac: 1 }, { letter: 'E', ac: 2 }],
  F: [{ letter: 'Q', ac: 0 }, { letter: 'P', ac: 0 }, { letter: 'N', ac: 0 }, { letter: 'M', ac: 0 }, { letter: 'L', ac: 0 }, { letter: 'K', ac: 0 }, { letter: 'J', ac: 0 }, { letter: 'H', ac: 0 }, { letter: 'G', ac: 0 }, { letter: 'F', ac: 0 }, { letter: 'E', ac: 0 }, { letter: 'G', ac: 1 }, { letter: 'F', ac: 1 }, { letter: 'F', ac: 2 }, { letter: 'F', ac: 3 }],
  G: [{ letter: 'Q', ac: 0 }, { letter: 'P', ac: 0 }, { letter: 'N', ac: 0 }, { letter: 'M', ac: 0 }, { letter: 'L', ac: 0 }, { letter: 'K', ac: 0 }, { letter: 'J', ac: 0 }, { letter: 'H', ac: 0 }, { letter: 'G', ac: 0 }, { letter: 'F', ac: 0 }, { letter: 'H', ac: 1 }, { letter: 'G', ac: 1 }, { letter: 'G', ac: 2 }, { letter: 'G', ac: 3 }, { letter: 'G', ac: 5 }],
  H: [{ letter: 'Q', ac: 0 }, { letter: 'P', ac: 0 }, { letter: 'N', ac: 0 }, { letter: 'M', ac: 0 }, { letter: 'L', ac: 0 }, { letter: 'K', ac: 0 }, { letter: 'J', ac: 0 }, { letter: 'H', ac: 0 }, { letter: 'G', ac: 0 }, { letter: 'J', ac: 1 }, { letter: 'H', ac: 1 }, { letter: 'H', ac: 2 }, { letter: 'H', ac: 3 }, { letter: 'H', ac: 5 }, { letter: 'H', ac: 7 }],
  J: [{ letter: 'Q', ac: 0 }, { letter: 'P', ac: 0 }, { letter: 'N', ac: 0 }, { letter: 'M', ac: 0 }, { letter: 'L', ac: 0 }, { letter: 'K', ac: 0 }, { letter: 'J', ac: 0 }, { letter: 'H', ac: 0 }, { letter: 'K', ac: 1 }, { letter: 'J', ac: 1 }, { letter: 'J', ac: 2 }, { letter: 'J', ac: 3 }, { letter: 'J', ac: 5 }, { letter: 'J', ac: 7 }, { letter: 'J', ac: 10 }],
  K: [{ letter: 'Q', ac: 0 }, { letter: 'P', ac: 0 }, { letter: 'N', ac: 0 }, { letter: 'M', ac: 0 }, { letter: 'L', ac: 0 }, { letter: 'K', ac: 0 }, { letter: 'J', ac: 0 }, { letter: 'L', ac: 1 }, { letter: 'K', ac: 1 }, { letter: 'K', ac: 2 }, { letter: 'K', ac: 3 }, { letter: 'K', ac: 5 }, { letter: 'K', ac: 7 }, { letter: 'K', ac: 10 }, { letter: 'K', ac: 14 }],
  L: [{ letter: 'Q', ac: 0 }, { letter: 'P', ac: 0 }, { letter: 'N', ac: 0 }, { letter: 'M', ac: 0 }, { letter: 'L', ac: 0 }, { letter: 'K', ac: 0 }, { letter: 'M', ac: 1 }, { letter: 'L', ac: 1 }, { letter: 'L', ac: 2 }, { letter: 'L', ac: 3 }, { letter: 'L', ac: 5 }, { letter: 'L', ac: 7 }, { letter: 'L', ac: 10 }, { letter: 'L', ac: 14 }, { letter: 'L', ac: 21 }],
  M: [{ letter: 'Q', ac: 0 }, { letter: 'P', ac: 0 }, { letter: 'N', ac: 0 }, { letter: 'M', ac: 0 }, { letter: 'L', ac: 0 }, { letter: 'N', ac: 1 }, { letter: 'M', ac: 1 }, { letter: 'M', ac: 2 }, { letter: 'M', ac: 3 }, { letter: 'M', ac: 5 }, { letter: 'M', ac: 7 }, { letter: 'M', ac: 10 }, { letter: 'M', ac: 14 }, { letter: 'M', ac: 21 }, { letter: 'L', ac: 21 }],
  N: [{ letter: 'Q', ac: 0 }, { letter: 'P', ac: 0 }, { letter: 'N', ac: 0 }, { letter: 'M', ac: 0 }, { letter: 'P', ac: 1 }, { letter: 'N', ac: 1 }, { letter: 'N', ac: 2 }, { letter: 'N', ac: 3 }, { letter: 'N', ac: 5 }, { letter: 'N', ac: 7 }, { letter: 'N', ac: 10 }, { letter: 'N', ac: 14 }, { letter: 'N', ac: 21 }, { letter: 'M', ac: 21 }, { letter: 'L', ac: 21 }],
  P: [{ letter: 'Q', ac: 0 }, { letter: 'P', ac: 0 }, { letter: 'N', ac: 0 }, { letter: 'Q', ac: 1 }, { letter: 'P', ac: 1 }, { letter: 'P', ac: 2 }, { letter: 'P', ac: 3 }, { letter: 'P', ac: 5 }, { letter: 'P', ac: 7 }, { letter: 'P', ac: 10 }, { letter: 'P', ac: 14 }, { letter: 'P', ac: 21 }, { letter: 'N', ac: 21 }, { letter: 'M', ac: 21 }, { letter: 'L', ac: 21 }],
  Q: [{ letter: 'Q', ac: 0 }, { letter: 'P', ac: 0 }, { letter: 'R', ac: 1 }, { letter: 'Q', ac: 1 }, { letter: 'Q', ac: 2 }, { letter: 'Q', ac: 3 }, { letter: 'Q', ac: 5 }, { letter: 'Q', ac: 7 }, { letter: 'Q', ac: 10 }, { letter: 'Q', ac: 14 }, { letter: 'Q', ac: 21 }, { letter: 'P', ac: 21 }, { letter: 'N', ac: 21 }, { letter: 'M', ac: 21 }, { letter: 'L', ac: 21 }],
  R: [{ letter: 'Q', ac: 0 }, { letter: 'P', ac: 0 }, { letter: 'R', ac: 1 }, { letter: 'R', ac: 2 }, { letter: 'R', ac: 3 }, { letter: 'R', ac: 5 }, { letter: 'R', ac: 7 }, { letter: 'R', ac: 10 }, { letter: 'R', ac: 14 }, { letter: 'R', ac: 21 }, { letter: 'Q', ac: 21 }, { letter: 'P', ac: 21 }, { letter: 'N', ac: 21 }, { letter: 'M', ac: 21 }, { letter: 'L', ac: 21 }],
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
  M: [-1, -1, -1, 0, -1, -1, 1, 2, 3, 5, 7, 10, 14, 21, -1],
  N: [-1, -1, 0, -1, -1, 1, 2, 3, 5, 7, 10, 14, 21, -1, -1],
  P: [-1, 0, -1, -1, 1, 2, 3, 5, 7, 10, 14, 21, -1, -1, -1],
  Q: [0, -1, -1, 1, 2, 3, 5, 7, 10, 14, 21, -1, -1, -1, -1],
  R: [-1, -1, 1, 2, 3, 5, 7, 10, 14, 21, -1, -1, -1, -1, -1],
};

// ─────────────────────────────────────────────────────────────────────────
// Tightened & Reduced — verified session 4 (ISO 2859-1:2026 Table 3 & 4)
// ─────────────────────────────────────────────────────────────────────────
// Same treatment as Normal: RESOLVED_TIGHTENED / RESOLVED_REDUCED are the
// fully arrow-followed lookups calculator.ts actually uses. AC_TIGHTENED /
// AC_REDUCED below are the raw own-row values (-1 = arrow), kept for
// reference/debugging only, same as AC_NORMAL above.

export const RESOLVED_TIGHTENED: Record<CodeLetter, Array<{ letter: CodeLetter; ac: number } | null>> = {
  A: [{ letter: 'R', ac: 0 }, { letter: 'Q', ac: 0 }, { letter: 'P', ac: 0 }, { letter: 'N', ac: 0 }, { letter: 'M', ac: 0 }, { letter: 'L', ac: 0 }, { letter: 'K', ac: 0 }, { letter: 'J', ac: 0 }, { letter: 'H', ac: 0 }, { letter: 'G', ac: 0 }, { letter: 'F', ac: 0 }, { letter: 'E', ac: 0 }, { letter: 'D', ac: 0 }, { letter: 'C', ac: 0 }, { letter: 'B', ac: 0 }],
  B: [{ letter: 'R', ac: 0 }, { letter: 'Q', ac: 0 }, { letter: 'P', ac: 0 }, { letter: 'N', ac: 0 }, { letter: 'M', ac: 0 }, { letter: 'L', ac: 0 }, { letter: 'K', ac: 0 }, { letter: 'J', ac: 0 }, { letter: 'H', ac: 0 }, { letter: 'G', ac: 0 }, { letter: 'F', ac: 0 }, { letter: 'E', ac: 0 }, { letter: 'D', ac: 0 }, { letter: 'C', ac: 0 }, { letter: 'B', ac: 0 }],
  C: [{ letter: 'R', ac: 0 }, { letter: 'Q', ac: 0 }, { letter: 'P', ac: 0 }, { letter: 'N', ac: 0 }, { letter: 'M', ac: 0 }, { letter: 'L', ac: 0 }, { letter: 'K', ac: 0 }, { letter: 'J', ac: 0 }, { letter: 'H', ac: 0 }, { letter: 'G', ac: 0 }, { letter: 'F', ac: 0 }, { letter: 'E', ac: 0 }, { letter: 'D', ac: 0 }, { letter: 'C', ac: 0 }, { letter: 'B', ac: 0 }],
  D: [{ letter: 'R', ac: 0 }, { letter: 'Q', ac: 0 }, { letter: 'P', ac: 0 }, { letter: 'N', ac: 0 }, { letter: 'M', ac: 0 }, { letter: 'L', ac: 0 }, { letter: 'K', ac: 0 }, { letter: 'J', ac: 0 }, { letter: 'H', ac: 0 }, { letter: 'G', ac: 0 }, { letter: 'F', ac: 0 }, { letter: 'E', ac: 0 }, { letter: 'D', ac: 0 }, { letter: 'C', ac: 0 }, { letter: 'E', ac: 1 }],
  E: [{ letter: 'R', ac: 0 }, { letter: 'Q', ac: 0 }, { letter: 'P', ac: 0 }, { letter: 'N', ac: 0 }, { letter: 'M', ac: 0 }, { letter: 'L', ac: 0 }, { letter: 'K', ac: 0 }, { letter: 'J', ac: 0 }, { letter: 'H', ac: 0 }, { letter: 'G', ac: 0 }, { letter: 'F', ac: 0 }, { letter: 'E', ac: 0 }, { letter: 'D', ac: 0 }, { letter: 'F', ac: 1 }, { letter: 'E', ac: 1 }],
  F: [{ letter: 'R', ac: 0 }, { letter: 'Q', ac: 0 }, { letter: 'P', ac: 0 }, { letter: 'N', ac: 0 }, { letter: 'M', ac: 0 }, { letter: 'L', ac: 0 }, { letter: 'K', ac: 0 }, { letter: 'J', ac: 0 }, { letter: 'H', ac: 0 }, { letter: 'G', ac: 0 }, { letter: 'F', ac: 0 }, { letter: 'E', ac: 0 }, { letter: 'G', ac: 1 }, { letter: 'F', ac: 1 }, { letter: 'F', ac: 2 }],
  G: [{ letter: 'R', ac: 0 }, { letter: 'Q', ac: 0 }, { letter: 'P', ac: 0 }, { letter: 'N', ac: 0 }, { letter: 'M', ac: 0 }, { letter: 'L', ac: 0 }, { letter: 'K', ac: 0 }, { letter: 'J', ac: 0 }, { letter: 'H', ac: 0 }, { letter: 'G', ac: 0 }, { letter: 'F', ac: 0 }, { letter: 'H', ac: 1 }, { letter: 'G', ac: 1 }, { letter: 'G', ac: 2 }, { letter: 'G', ac: 3 }],
  H: [{ letter: 'R', ac: 0 }, { letter: 'Q', ac: 0 }, { letter: 'P', ac: 0 }, { letter: 'N', ac: 0 }, { letter: 'M', ac: 0 }, { letter: 'L', ac: 0 }, { letter: 'K', ac: 0 }, { letter: 'J', ac: 0 }, { letter: 'H', ac: 0 }, { letter: 'G', ac: 0 }, { letter: 'J', ac: 1 }, { letter: 'H', ac: 1 }, { letter: 'H', ac: 2 }, { letter: 'H', ac: 3 }, { letter: 'H', ac: 5 }],
  J: [{ letter: 'R', ac: 0 }, { letter: 'Q', ac: 0 }, { letter: 'P', ac: 0 }, { letter: 'N', ac: 0 }, { letter: 'M', ac: 0 }, { letter: 'L', ac: 0 }, { letter: 'K', ac: 0 }, { letter: 'J', ac: 0 }, { letter: 'H', ac: 0 }, { letter: 'K', ac: 1 }, { letter: 'J', ac: 1 }, { letter: 'J', ac: 2 }, { letter: 'J', ac: 3 }, { letter: 'J', ac: 5 }, { letter: 'J', ac: 8 }],
  K: [{ letter: 'R', ac: 0 }, { letter: 'Q', ac: 0 }, { letter: 'P', ac: 0 }, { letter: 'N', ac: 0 }, { letter: 'M', ac: 0 }, { letter: 'L', ac: 0 }, { letter: 'K', ac: 0 }, { letter: 'J', ac: 0 }, { letter: 'L', ac: 1 }, { letter: 'K', ac: 1 }, { letter: 'K', ac: 2 }, { letter: 'K', ac: 3 }, { letter: 'K', ac: 5 }, { letter: 'K', ac: 8 }, { letter: 'K', ac: 12 }],
  L: [{ letter: 'R', ac: 0 }, { letter: 'Q', ac: 0 }, { letter: 'P', ac: 0 }, { letter: 'N', ac: 0 }, { letter: 'M', ac: 0 }, { letter: 'L', ac: 0 }, { letter: 'K', ac: 0 }, { letter: 'M', ac: 1 }, { letter: 'L', ac: 1 }, { letter: 'L', ac: 2 }, { letter: 'L', ac: 3 }, { letter: 'L', ac: 5 }, { letter: 'L', ac: 8 }, { letter: 'L', ac: 12 }, { letter: 'L', ac: 18 }],
  M: [{ letter: 'R', ac: 0 }, { letter: 'Q', ac: 0 }, { letter: 'P', ac: 0 }, { letter: 'N', ac: 0 }, { letter: 'M', ac: 0 }, { letter: 'L', ac: 0 }, { letter: 'N', ac: 1 }, { letter: 'M', ac: 1 }, { letter: 'M', ac: 2 }, { letter: 'M', ac: 3 }, { letter: 'M', ac: 5 }, { letter: 'M', ac: 8 }, { letter: 'M', ac: 12 }, { letter: 'M', ac: 18 }, { letter: 'L', ac: 18 }],
  N: [{ letter: 'R', ac: 0 }, { letter: 'Q', ac: 0 }, { letter: 'P', ac: 0 }, { letter: 'N', ac: 0 }, { letter: 'M', ac: 0 }, { letter: 'P', ac: 1 }, { letter: 'N', ac: 1 }, { letter: 'N', ac: 2 }, { letter: 'N', ac: 3 }, { letter: 'N', ac: 5 }, { letter: 'N', ac: 8 }, { letter: 'N', ac: 12 }, { letter: 'N', ac: 18 }, { letter: 'M', ac: 18 }, { letter: 'L', ac: 18 }],
  P: [{ letter: 'R', ac: 0 }, { letter: 'Q', ac: 0 }, { letter: 'P', ac: 0 }, { letter: 'N', ac: 0 }, { letter: 'Q', ac: 1 }, { letter: 'P', ac: 1 }, { letter: 'P', ac: 2 }, { letter: 'P', ac: 3 }, { letter: 'P', ac: 5 }, { letter: 'P', ac: 8 }, { letter: 'P', ac: 12 }, { letter: 'P', ac: 18 }, { letter: 'N', ac: 18 }, { letter: 'M', ac: 18 }, { letter: 'L', ac: 18 }],
  Q: [{ letter: 'R', ac: 0 }, { letter: 'Q', ac: 0 }, { letter: 'P', ac: 0 }, { letter: 'R', ac: 1 }, { letter: 'Q', ac: 1 }, { letter: 'Q', ac: 2 }, { letter: 'Q', ac: 3 }, { letter: 'Q', ac: 5 }, { letter: 'Q', ac: 8 }, { letter: 'Q', ac: 12 }, { letter: 'Q', ac: 18 }, { letter: 'P', ac: 18 }, { letter: 'N', ac: 18 }, { letter: 'M', ac: 18 }, { letter: 'L', ac: 18 }],
  R: [{ letter: 'R', ac: 0 }, { letter: 'Q', ac: 0 }, { letter: 'P', ac: 0 }, { letter: 'R', ac: 1 }, { letter: 'R', ac: 2 }, { letter: 'R', ac: 3 }, { letter: 'R', ac: 5 }, { letter: 'R', ac: 8 }, { letter: 'R', ac: 12 }, { letter: 'R', ac: 18 }, { letter: 'Q', ac: 18 }, { letter: 'P', ac: 18 }, { letter: 'N', ac: 18 }, { letter: 'M', ac: 18 }, { letter: 'L', ac: 18 }],
};

// Table II-B — Tightened Inspection, own-row values only (-1 = arrow cell).
export const AC_TIGHTENED: Record<CodeLetter, number[]> = {
  A: [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
  B: [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0],
  C: [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0, -1],
  D: [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0, -1, -1],
  E: [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0, -1, -1, 1],
  F: [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0, -1, -1, 1, 2],
  G: [-1, -1, -1, -1, -1, -1, -1, -1, -1, 0, -1, -1, 1, 2, 3],
  H: [-1, -1, -1, -1, -1, -1, -1, -1, 0, -1, -1, 1, 2, 3, 5],
  J: [-1, -1, -1, -1, -1, -1, -1, 0, -1, -1, 1, 2, 3, 5, 8],
  K: [-1, -1, -1, -1, -1, -1, 0, -1, -1, 1, 2, 3, 5, 8, 12],
  L: [-1, -1, -1, -1, -1, 0, -1, -1, 1, 2, 3, 5, 8, 12, 18],
  M: [-1, -1, -1, -1, 0, -1, -1, 1, 2, 3, 5, 8, 12, 18, -1],
  N: [-1, -1, -1, 0, -1, -1, 1, 2, 3, 5, 8, 12, 18, -1, -1],
  P: [-1, -1, 0, -1, -1, 1, 2, 3, 5, 8, 12, 18, -1, -1, -1],
  Q: [-1, 0, -1, -1, 1, 2, 3, 5, 8, 12, 18, -1, -1, -1, -1],
  R: [0, -1, -1, 1, 2, 3, 5, 8, 12, 18, -1, -1, -1, -1, -1],
};

export const RESOLVED_REDUCED: Record<CodeLetter, Array<{ letter: CodeLetter; ac: number } | null>> = {
  A: [{ letter: 'Q', ac: 0 }, { letter: 'P', ac: 0 }, { letter: 'N', ac: 0 }, { letter: 'M', ac: 0 }, { letter: 'L', ac: 0 }, { letter: 'K', ac: 0 }, { letter: 'J', ac: 0 }, { letter: 'H', ac: 0 }, { letter: 'G', ac: 0 }, { letter: 'F', ac: 0 }, { letter: 'E', ac: 0 }, { letter: 'D', ac: 0 }, { letter: 'C', ac: 0 }, { letter: 'B', ac: 0 }, { letter: 'A', ac: 0 }],
  B: [{ letter: 'Q', ac: 0 }, { letter: 'P', ac: 0 }, { letter: 'N', ac: 0 }, { letter: 'M', ac: 0 }, { letter: 'L', ac: 0 }, { letter: 'K', ac: 0 }, { letter: 'J', ac: 0 }, { letter: 'H', ac: 0 }, { letter: 'G', ac: 0 }, { letter: 'F', ac: 0 }, { letter: 'E', ac: 0 }, { letter: 'D', ac: 0 }, { letter: 'C', ac: 0 }, { letter: 'B', ac: 0 }, { letter: 'A', ac: 0 }],
  C: [{ letter: 'Q', ac: 0 }, { letter: 'P', ac: 0 }, { letter: 'N', ac: 0 }, { letter: 'M', ac: 0 }, { letter: 'L', ac: 0 }, { letter: 'K', ac: 0 }, { letter: 'J', ac: 0 }, { letter: 'H', ac: 0 }, { letter: 'G', ac: 0 }, { letter: 'F', ac: 0 }, { letter: 'E', ac: 0 }, { letter: 'D', ac: 0 }, { letter: 'C', ac: 0 }, { letter: 'B', ac: 0 }, { letter: 'A', ac: 0 }],
  D: [{ letter: 'Q', ac: 0 }, { letter: 'P', ac: 0 }, { letter: 'N', ac: 0 }, { letter: 'M', ac: 0 }, { letter: 'L', ac: 0 }, { letter: 'K', ac: 0 }, { letter: 'J', ac: 0 }, { letter: 'H', ac: 0 }, { letter: 'G', ac: 0 }, { letter: 'F', ac: 0 }, { letter: 'E', ac: 0 }, { letter: 'D', ac: 0 }, { letter: 'C', ac: 0 }, { letter: 'B', ac: 0 }, { letter: 'E', ac: 1 }],
  E: [{ letter: 'Q', ac: 0 }, { letter: 'P', ac: 0 }, { letter: 'N', ac: 0 }, { letter: 'M', ac: 0 }, { letter: 'L', ac: 0 }, { letter: 'K', ac: 0 }, { letter: 'J', ac: 0 }, { letter: 'H', ac: 0 }, { letter: 'G', ac: 0 }, { letter: 'F', ac: 0 }, { letter: 'E', ac: 0 }, { letter: 'D', ac: 0 }, { letter: 'C', ac: 0 }, { letter: 'F', ac: 1 }, { letter: 'E', ac: 1 }],
  F: [{ letter: 'Q', ac: 0 }, { letter: 'P', ac: 0 }, { letter: 'N', ac: 0 }, { letter: 'M', ac: 0 }, { letter: 'L', ac: 0 }, { letter: 'K', ac: 0 }, { letter: 'J', ac: 0 }, { letter: 'H', ac: 0 }, { letter: 'G', ac: 0 }, { letter: 'F', ac: 0 }, { letter: 'E', ac: 0 }, { letter: 'D', ac: 0 }, { letter: 'G', ac: 1 }, { letter: 'F', ac: 1 }, { letter: 'F', ac: 2 }],
  G: [{ letter: 'Q', ac: 0 }, { letter: 'P', ac: 0 }, { letter: 'N', ac: 0 }, { letter: 'M', ac: 0 }, { letter: 'L', ac: 0 }, { letter: 'K', ac: 0 }, { letter: 'J', ac: 0 }, { letter: 'H', ac: 0 }, { letter: 'G', ac: 0 }, { letter: 'F', ac: 0 }, { letter: 'E', ac: 0 }, { letter: 'H', ac: 1 }, { letter: 'G', ac: 1 }, { letter: 'G', ac: 2 }, { letter: 'G', ac: 3 }],
  H: [{ letter: 'Q', ac: 0 }, { letter: 'P', ac: 0 }, { letter: 'N', ac: 0 }, { letter: 'M', ac: 0 }, { letter: 'L', ac: 0 }, { letter: 'K', ac: 0 }, { letter: 'J', ac: 0 }, { letter: 'H', ac: 0 }, { letter: 'G', ac: 0 }, { letter: 'F', ac: 0 }, { letter: 'J', ac: 1 }, { letter: 'H', ac: 1 }, { letter: 'H', ac: 2 }, { letter: 'H', ac: 3 }, { letter: 'H', ac: 5 }],
  J: [{ letter: 'Q', ac: 0 }, { letter: 'P', ac: 0 }, { letter: 'N', ac: 0 }, { letter: 'M', ac: 0 }, { letter: 'L', ac: 0 }, { letter: 'K', ac: 0 }, { letter: 'J', ac: 0 }, { letter: 'H', ac: 0 }, { letter: 'G', ac: 0 }, { letter: 'K', ac: 1 }, { letter: 'J', ac: 1 }, { letter: 'J', ac: 2 }, { letter: 'J', ac: 3 }, { letter: 'J', ac: 5 }, { letter: 'J', ac: 6 }],
  K: [{ letter: 'Q', ac: 0 }, { letter: 'P', ac: 0 }, { letter: 'N', ac: 0 }, { letter: 'M', ac: 0 }, { letter: 'L', ac: 0 }, { letter: 'K', ac: 0 }, { letter: 'J', ac: 0 }, { letter: 'H', ac: 0 }, { letter: 'L', ac: 1 }, { letter: 'K', ac: 1 }, { letter: 'K', ac: 2 }, { letter: 'K', ac: 3 }, { letter: 'K', ac: 5 }, { letter: 'K', ac: 6 }, { letter: 'K', ac: 8 }],
  L: [{ letter: 'Q', ac: 0 }, { letter: 'P', ac: 0 }, { letter: 'N', ac: 0 }, { letter: 'M', ac: 0 }, { letter: 'L', ac: 0 }, { letter: 'K', ac: 0 }, { letter: 'J', ac: 0 }, { letter: 'M', ac: 1 }, { letter: 'L', ac: 1 }, { letter: 'L', ac: 2 }, { letter: 'L', ac: 3 }, { letter: 'L', ac: 5 }, { letter: 'L', ac: 6 }, { letter: 'L', ac: 8 }, { letter: 'L', ac: 10 }],
  M: [{ letter: 'Q', ac: 0 }, { letter: 'P', ac: 0 }, { letter: 'N', ac: 0 }, { letter: 'M', ac: 0 }, { letter: 'L', ac: 0 }, { letter: 'K', ac: 0 }, { letter: 'N', ac: 1 }, { letter: 'M', ac: 1 }, { letter: 'M', ac: 2 }, { letter: 'M', ac: 3 }, { letter: 'M', ac: 5 }, { letter: 'M', ac: 6 }, { letter: 'M', ac: 8 }, { letter: 'M', ac: 10 }, { letter: 'L', ac: 10 }],
  N: [{ letter: 'Q', ac: 0 }, { letter: 'P', ac: 0 }, { letter: 'N', ac: 0 }, { letter: 'M', ac: 0 }, { letter: 'L', ac: 0 }, { letter: 'P', ac: 1 }, { letter: 'N', ac: 1 }, { letter: 'N', ac: 2 }, { letter: 'N', ac: 3 }, { letter: 'N', ac: 5 }, { letter: 'N', ac: 6 }, { letter: 'N', ac: 8 }, { letter: 'N', ac: 10 }, { letter: 'M', ac: 10 }, { letter: 'L', ac: 10 }],
  P: [{ letter: 'Q', ac: 0 }, { letter: 'P', ac: 0 }, { letter: 'N', ac: 0 }, { letter: 'M', ac: 0 }, { letter: 'Q', ac: 1 }, { letter: 'P', ac: 1 }, { letter: 'P', ac: 2 }, { letter: 'P', ac: 3 }, { letter: 'P', ac: 5 }, { letter: 'P', ac: 6 }, { letter: 'P', ac: 8 }, { letter: 'P', ac: 10 }, { letter: 'N', ac: 10 }, { letter: 'M', ac: 10 }, { letter: 'L', ac: 10 }],
  Q: [{ letter: 'Q', ac: 0 }, { letter: 'P', ac: 0 }, { letter: 'N', ac: 0 }, { letter: 'R', ac: 1 }, { letter: 'Q', ac: 1 }, { letter: 'Q', ac: 2 }, { letter: 'Q', ac: 3 }, { letter: 'Q', ac: 5 }, { letter: 'Q', ac: 6 }, { letter: 'Q', ac: 8 }, { letter: 'Q', ac: 10 }, { letter: 'P', ac: 10 }, { letter: 'N', ac: 10 }, { letter: 'M', ac: 10 }, { letter: 'L', ac: 10 }],
  R: [{ letter: 'Q', ac: 0 }, { letter: 'P', ac: 0 }, { letter: 'N', ac: 0 }, { letter: 'R', ac: 1 }, { letter: 'R', ac: 2 }, { letter: 'R', ac: 3 }, { letter: 'R', ac: 5 }, { letter: 'R', ac: 6 }, { letter: 'R', ac: 8 }, { letter: 'R', ac: 10 }, { letter: 'Q', ac: 10 }, { letter: 'P', ac: 10 }, { letter: 'N', ac: 10 }, { letter: 'M', ac: 10 }, { letter: 'L', ac: 10 }],
};

// Table II-C — Reduced Inspection, own-row values only (-1 = arrow cell).
export const AC_REDUCED: Record<CodeLetter, number[]> = {
  A: [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0],
  B: [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0, -1],
  C: [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0, -1, -1],
  D: [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0, -1, -1, -1],
  E: [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0, -1, -1, -1, 1],
  F: [-1, -1, -1, -1, -1, -1, -1, -1, -1, 0, -1, -1, -1, 1, 2],
  G: [-1, -1, -1, -1, -1, -1, -1, -1, 0, -1, -1, -1, 1, 2, 3],
  H: [-1, -1, -1, -1, -1, -1, -1, 0, -1, -1, -1, 1, 2, 3, 5],
  J: [-1, -1, -1, -1, -1, -1, 0, -1, -1, -1, 1, 2, 3, 5, 6],
  K: [-1, -1, -1, -1, -1, 0, -1, -1, -1, 1, 2, 3, 5, 6, 8],
  L: [-1, -1, -1, -1, 0, -1, -1, -1, 1, 2, 3, 5, 6, 8, 10],
  M: [-1, -1, -1, 0, -1, -1, -1, 1, 2, 3, 5, 6, 8, 10, -1],
  N: [-1, -1, 0, -1, -1, -1, 1, 2, 3, 5, 6, 8, 10, -1, -1],
  P: [-1, 0, -1, -1, -1, 1, 2, 3, 5, 6, 8, 10, -1, -1, -1],
  Q: [0, -1, -1, -1, 1, 2, 3, 5, 6, 8, 10, -1, -1, -1, -1],
  R: [-1, -1, -1, 1, 2, 3, 5, 6, 8, 10, -1, -1, -1, -1, -1],
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
