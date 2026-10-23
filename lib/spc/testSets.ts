// Which tests for special causes run on which chart (see ./nelson.ts for the
// rules themselves). Configuration and labels only.

export type TestSet = 'assistant' | 'all'
export type ChartRole = 'individuals' | 'xbar' | 'dispersion' | 'attribute'

export const DEFAULT_TEST_SET: TestSet = 'assistant'

const TESTS: Record<TestSet, Record<ChartRole, number[]>> = {
  assistant: { individuals: [1, 2], xbar: [1, 2, 7], dispersion: [1], attribute: [1, 2] },
  all: { individuals: [1, 2, 3, 4, 5, 6, 7, 8], xbar: [1, 2, 3, 4, 5, 6, 7, 8], dispersion: [1, 2, 3, 4], attribute: [1, 2, 3, 4] },
}

export function testsFor(role: ChartRole, set: TestSet = DEFAULT_TEST_SET): number[] {
  return TESTS[set]?.[role] ?? TESTS[DEFAULT_TEST_SET][role]
}

export function isTestSet(v: unknown): v is TestSet {
  return v === 'assistant' || v === 'all'
}

/** Short human description of a test set for reports, e.g. "Standard default tests (I: 1, 2 · MR: 1)". */
export function describeTestSet(set: TestSet, location: 'individuals' | 'xbar', dispersionName: string): string {
  const loc = location === 'individuals' ? 'I' : 'X-bar'
  const a = testsFor(location, set).join(', ')
  const d = testsFor('dispersion', set).join(', ')
  return `${set === 'assistant' ? 'Standard default tests' : 'All Nelson tests'} (${loc}: ${a} · ${dispersionName}: ${d})`
}
