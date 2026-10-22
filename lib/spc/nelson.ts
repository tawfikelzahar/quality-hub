// ─────────────────────────────────────────────────────────────────────────
// Tests for special causes (Nelson / Western Electric) — single source of
// truth for the SPC Engine API (app/api/analyze/route.ts) and the shared
// calculator used by the I-MR, X̄-R and X̄-S pages (lib/spc/calculator.ts).
//
// Test definitions and default K values follow Minitab's "Tests for special
// causes" (1: 1 point > 3σ · 2: 9 in a row same side · 3: 6 in a row
// increasing/decreasing · 4: 14 in a row alternating · 5: 2 of 3 > 2σ same
// side · 6: 4 of 5 > 1σ same side · 7: 15 in a row within 1σ · 8: 8 in a row
// > 1σ either side). σ is the sigma of the PLOTTED statistic, i.e.
// (UCL − CL) / 3, so test 1 always agrees with the drawn control limits.
//
// Counting conventions verified against Minitab 21 output (golden datasets,
// Oct 2026):
//   • Tests 3 and 4 count MOVES, not points: "6 points increasing" means six
//     consecutive increases, i.e. a window of 7 points; "14 points
//     alternating" means fourteen alternating moves after the first, i.e. 15
//     points. (Minitab flags DS08 point 40 only, a 15-point alternating run.)
//   • Tests 5 and 6 fail only at a point that is itself beyond 2σ / 1σ on the
//     same side as the run (Minitab does not flag a point inside the zone even
//     when the previous 4 of 5 were beyond it).
//
// Which tests run is a TEST SET:
//   'assistant' (default) — Minitab Assistant (Variables Control Charts white
//     paper): I chart 1, 2 · X̄ chart 1, 2, 7 · R / S / MR chart 1. Attribute
//     charts 1, 2 (Minitab "Using tests for special causes": suggested start).
//     Fewer false alarms on stable data while still catching shifts/drifts.
//   'all' — classic Nelson: tests 1–8 on I / X̄, 1–4 on R / S / MR and on
//     attribute charts (Minitab allows only tests 1–4 there).
//
// Every occurrence is reported (not only the first). Overlapping windows of
// the same test are merged into one run; `failedAt` lists the points at
// which the test fails, the way Minitab's session output reports them.
// ─────────────────────────────────────────────────────────────────────────

export interface NelsonViolation {
  rule: number
  label: string
  /** rule 1: the individual points · other rules: [first, last] of the merged run (1-based) */
  points: number[]
  /** points at which the test fails (1-based), Minitab-style */
  failedAt: number[]
  desc: string
}

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

const META: Record<number, { label: string; desc: string; window: number }> = {
  1: { label: 'Beyond 3σ', desc: 'Point(s) beyond control limits.', window: 1 },
  2: { label: '9 in a row — one side', desc: 'Process shift detected.', window: 9 },
  3: { label: '6 in a row — trend', desc: 'Systematic trend detected.', window: 7 },
  4: { label: '14 in a row alternating', desc: 'Systematic alternating pattern — possible over-adjustment or two interleaved sources.', window: 15 },
  5: { label: '2 of 3 beyond 2σ', desc: 'Large shift possible.', window: 3 },
  6: { label: '4 of 5 beyond 1σ', desc: 'Moderate shift.', window: 5 },
  7: { label: '15 in a row within 1σ', desc: 'Stratification — variation smaller than expected, check for mixed subgroups or miscalculated limits.', window: 15 },
  8: { label: '8 in a row beyond 1σ (mixture)', desc: 'Mixture — possible two overlapping distributions or sources.', window: 8 },
}

/** Does window-based test `rule` fail at 0-based index i (window ends at i)? */
function failsAt(rule: number, i: number, points: number[], z: number[]): boolean {
  const L = META[rule].window
  if (i < L - 1) return false
  const zs = z.slice(i - L + 1, i + 1)
  switch (rule) {
    case 2:
      return zs.every(v => v > 0) || zs.every(v => v < 0)
    case 3: {
      const ps = points.slice(i - L + 1, i + 1)
      let inc = true, dec = true
      for (let j = 1; j < ps.length; j++) {
        if (ps[j] <= ps[j - 1]) inc = false
        if (ps[j] >= ps[j - 1]) dec = false
      }
      return inc || dec
    }
    case 4: {
      const ps = points.slice(i - L + 1, i + 1)
      for (let j = 2; j < ps.length; j++) {
        const prev = ps[j - 1] - ps[j - 2]
        const cur = ps[j] - ps[j - 1]
        if (cur === 0 || prev === 0 || cur * prev >= 0) return false
      }
      return true
    }
    case 5: {
      const last = zs[zs.length - 1]
      return (last > 2 && zs.filter(v => v > 2).length >= 2) || (last < -2 && zs.filter(v => v < -2).length >= 2)
    }
    case 6: {
      const last = zs[zs.length - 1]
      return (last > 1 && zs.filter(v => v > 1).length >= 4) || (last < -1 && zs.filter(v => v < -1).length >= 4)
    }
    case 7:
      return zs.every(v => Math.abs(v) < 1)
    case 8:
      return zs.every(v => Math.abs(v) > 1)
    default:
      return false
  }
}

/**
 * Runs the requested tests on one chart.
 * @param points plotted values
 * @param cl     centre line
 * @param sigma  sigma of the plotted statistic, (UCL − CL) / 3
 * @param tests  test numbers to run (see testsFor)
 */
export function nelsonRules(points: number[], cl: number, sigma: number, tests: number[]): NelsonViolation[] {
  const out: NelsonViolation[] = []
  if (!(sigma > 0) || points.length === 0) return out
  const z = points.map(p => (p - cl) / sigma)
  const want = new Set(tests)

  if (want.has(1)) {
    const pts = z.map((v, i) => (Math.abs(v) > 3 ? i + 1 : 0)).filter(Boolean)
    if (pts.length) out.push({ rule: 1, label: META[1].label, points: pts, failedAt: pts, desc: META[1].desc })
  }

  for (const rule of [2, 3, 4, 5, 6, 7, 8]) {
    if (!want.has(rule)) continue
    const L = META[rule].window
    let run: { start: number; end: number; failed: number[] } | null = null
    const flush = () => {
      if (run) out.push({ rule, label: META[rule].label, points: [run.start + 1, run.end + 1], failedAt: run.failed, desc: META[rule].desc })
      run = null
    }
    for (let i = 0; i < points.length; i++) {
      if (!failsAt(rule, i, points, z)) continue
      const start = i - L + 1
      if (run && start <= run.end) {
        run.end = i
        run.failed.push(i + 1)
      } else {
        flush()
        run = { start, end: i, failed: [i + 1] }
      }
    }
    flush()
  }
  return out.sort((a, b) => a.rule - b.rule || a.points[0] - b.points[0])
}

/** Shift every reported point by `offset` (e.g. +1 for moving ranges, whose #1 belongs to observation 2). */
export function offsetViolations(vs: NelsonViolation[], offset: number): NelsonViolation[] {
  if (!offset) return vs
  return vs.map(v => ({ ...v, points: v.points.map(p => p + offset), failedAt: v.failedAt.map(p => p + offset) }))
}

/** Short human description of a test set for reports, e.g. "Standard default tests (I: 1, 2 · MR: 1)". */
export function describeTestSet(set: TestSet, location: 'individuals' | 'xbar', dispersionName: string): string {
  const loc = location === 'individuals' ? 'I' : 'X-bar'
  const a = testsFor(location, set).join(', ')
  const d = testsFor('dispersion', set).join(', ')
  return `${set === 'assistant' ? 'Standard default tests' : 'All Nelson tests'} (${loc}: ${a} · ${dispersionName}: ${d})`
}
