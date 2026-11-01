import 'server-only'
import type { DoeResult } from '@/lib/doe/calculator'

// ─────────────────────────────────────────────────────────────────────────
// What a visitor or free account receives from /api/doe (free/Pro split,
// 1 Nov 2026). Free: every effect and coefficient, % contribution, the main
// effects and interaction plots, R², R²(adj), S, and the warning when the
// largest main effect is part of an active interaction. Pro: which terms are
// statistically significant / active, the Pareto of effects with its
// reference line, SE / T / P, ANOVA, Lenth's PSE and ME, R²(pred) and the
// equation in uncoded units. Nothing is recalculated here; Pro fields are removed.
// ─────────────────────────────────────────────────────────────────────────

/** Accuracy warning for free accounts — always sent (rule: warnings are never locked) */
export interface DoeFreeChecks {
  /** active interaction (e.g. "AB") that contains the largest main effect, or null */
  bigInter: string | null
}

export type DoeView = DoeResult & { locked?: true; checks?: DoeFreeChecks }

export function freeDoeView(r: DoeResult): DoeView {
  const big = [...r.terms].sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect))[0]
  const inter = big && big.order === 1 ? r.terms.find(x => x.order >= 2 && x.significant && x.idx.includes(big.idx[0])) : undefined
  return {
    ...r,
    terms: r.terms.map(x => ({ ...x, seCoef: null, tValue: null, fValue: null, pValue: null, paretoValue: 0, significant: false })),
    model: { ...r.model, fValue: null, pValue: null },
    r2Pred: null,
    lenth: null,
    paretoLine: 0,
    significant: [],
    uncoded: [],
    locked: true,
    checks: { bigInter: inter ? inter.term : null },
  }
}
