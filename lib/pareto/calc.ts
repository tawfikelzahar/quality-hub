// ─────────────────────────────────────────────────────────────────────────
// Pareto analysis. Public method, so it runs in the browser (roadmap P6).
//   • Categories with an empty name or a count ≤ 0 are left out.
//   • The same name entered twice (ignoring case and outer spaces) is one
//     category: the counts are added; the first spelling is kept.
//   • Sorted by count, largest first; equal counts keep the entered order.
//   • "Other" (as in leading statistical software): bars are drawn one by
//     one until the cumulative percent passes `combineAfter`; whatever is
//     left becomes one "Other" bar, always drawn last. A single leftover
//     category keeps its own name (an "Other" of one hides nothing).
//   • Vital few: categories up to and including the first whose cumulative
//     percent reaches 80, judged on the unrounded value (79.6 is not 80).
// Tested in tests/golden/pareto/check.mts.
// ─────────────────────────────────────────────────────────────────────────

export interface ParetoInputRow {
  label: string
  value: number
}

export interface ParetoItem {
  label: string
  count: number
  /** % of the total, unrounded */
  pct: number
  /** cumulative %, unrounded */
  cum: number
  vital: boolean
  /** the combined "Other" bar */
  other: boolean
  /** categories combined into "Other" */
  members?: string[]
}

export interface ParetoResult {
  items: ParetoItem[]
  total: number
  /** categories after merging duplicates, before "Other" */
  categories: number
  vitalFew: number
  /** cumulative % reached by the vital few */
  vitalCum: number
}

export const PARETO_DEFAULT_COMBINE = 95
export const VITAL_FEW_PCT = 80

export function paretoAnalysis(rows: ParetoInputRow[], combineAfter: number | null = PARETO_DEFAULT_COMBINE): ParetoResult | null {
  // merge duplicates
  const merged: { label: string; count: number; order: number }[] = []
  const index = new Map<string, number>()
  for (const r of rows) {
    const label = String(r.label ?? '').trim()
    const value = Number(r.value)
    if (!label || !Number.isFinite(value) || value <= 0) continue
    const key = label.toLowerCase()
    const at = index.get(key)
    if (at === undefined) {
      index.set(key, merged.length)
      merged.push({ label, count: value, order: merged.length })
    } else {
      merged[at].count += value
    }
  }
  if (merged.length === 0) return null

  const sorted = [...merged].sort((a, b) => b.count - a.count || a.order - b.order)
  const total = sorted.reduce((s, r) => s + r.count, 0)

  // bars until the cumulative percent passes combineAfter
  let shown = sorted
  let rest: typeof sorted = []
  if (combineAfter !== null && combineAfter > 0 && combineAfter < 100) {
    let running = 0
    let cut = sorted.length
    for (let i = 0; i < sorted.length; i++) {
      running += sorted[i].count
      if ((running / total) * 100 > combineAfter) { cut = i + 1; break }
    }
    if (sorted.length - cut >= 2) {
      shown = sorted.slice(0, cut)
      rest = sorted.slice(cut)
    }
  }

  const items: ParetoItem[] = []
  let running = 0
  for (const r of shown) {
    running += r.count
    items.push({ label: r.label, count: r.count, pct: (r.count / total) * 100, cum: (running / total) * 100, vital: false, other: false })
  }
  if (rest.length) {
    const count = rest.reduce((s, r) => s + r.count, 0)
    running += count
    items.push({ label: 'Other', count, pct: (count / total) * 100, cum: (running / total) * 100, vital: false, other: true, members: rest.map(r => r.label) })
  }
  // last cumulative is exactly 100 (no float drift)
  items[items.length - 1].cum = 100

  const reach = items.findIndex(it => it.cum >= VITAL_FEW_PCT - 1e-9)
  const vitalFew = reach + 1
  for (let i = 0; i < vitalFew; i++) items[i].vital = !items[i].other

  return {
    items,
    total,
    categories: sorted.length,
    vitalFew: items.filter(it => it.vital).length,
    vitalCum: items[reach]?.cum ?? 100,
  }
}
