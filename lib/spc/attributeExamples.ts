// Example data for "Try an example" on the Attribute Charts page: golden
// datasets checked against Minitab (tests/golden/attribute/datasets.json).
// Do not edit by hand: tests/golden/attribute/check.mts fails if these drift.

export type AttrChartType = 'p' | 'np' | 'c' | 'u'

export interface AttrExample {
  /** golden dataset id */
  id: string
  /** sample size of every subgroup (p, u) or the fixed size (np); empty for c */
  sizes: number[]
  counts: number[]
}

export const ATTRIBUTE_EXAMPLES: Record<AttrChartType, AttrExample> = {
  /** A1: p chart · equal sample size (n = 200) */
  p: { id: 'A1', sizes: [200, 200, 200, 200, 200, 200, 200, 200, 200, 200, 200, 200, 200, 200, 200, 200, 200, 200, 200, 200, 200, 200, 200, 200, 200], counts: [8, 7, 8, 15, 5, 1, 8, 6, 7, 7, 6, 6, 7, 9, 12, 9, 10, 21, 9, 10, 9, 10, 8, 5, 10] },
  /** A3: np chart · n = 100 */
  np: { id: 'A3', sizes: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100], counts: [4, 4, 6, 8, 8, 8, 6, 5, 8, 3, 0, 8, 3, 6, 8, 12, 9, 9, 7, 5, 6, 4, 3, 9, 5] },
  /** A4: c chart · defects per unit */
  c: { id: 'A4', sizes: [], counts: [5, 3, 4, 4, 5, 6, 4, 2, 6, 3, 5, 5, 5, 3, 4, 4, 7, 11, 5, 4, 17, 5, 8, 5, 4] },
  /** A5: u chart · unequal inspection units (5–15) */
  u: { id: 'A5', sizes: [15, 8, 10, 13, 15, 13, 6, 13, 11, 5, 11, 5, 12, 11, 9, 13, 6, 10, 9, 14, 8, 14, 12, 5, 8], counts: [16, 5, 13, 12, 15, 16, 5, 16, 17, 9, 25, 7, 22, 37, 9, 15, 4, 14, 14, 13, 11, 11, 20, 2, 13] },
}
