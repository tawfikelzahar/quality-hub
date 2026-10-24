import type { ChartKind } from '@/lib/spc/useChartAnalysis'

// ─────────────────────────────────────────────────────────────────────────
// Which variables control chart fits a subgroup size. One rule for the whole
// site (SPC Engine, the chart pages' hints and the tools list):
//   n = 1      → I-MR
//   n = 2 – 8  → X̄-R
//   n ≥ 9      → X̄-S
// Source: the Minitab Assistant white paper "Variables Control Charts"
// recommends an S chart when the subgroup size is greater than 8, and Minitab
// Help ("Should I use an S chart or an R chart?") says R for 8 or less, S for
// 9 or more. No calculation here, so client code may import it.
// ─────────────────────────────────────────────────────────────────────────

export const XBAR_S_MIN_N = 9

export function variableChartFor(n: number): ChartKind {
  if (n <= 1) return 'imr'
  return n >= XBAR_S_MIN_N ? 'xbar-s' : 'xbar-r'
}
