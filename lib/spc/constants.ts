// ─────────────────────────────────────────────────────────────────────────
// Unbiasing constants for range-based control charts, exactly as Minitab
// tabulates them ("Unbiasing constants d2(), d3(), and d4()", Minitab Help):
// d2 to 3 decimals, d3 to 4 decimals. Control limits are built from these
// the way Minitab does it — σ̂ = R̄/d2(n), X̄ limits = X̿ ± 3σ̂/√n, R limits =
// R̄ ± 3·d3(n)·σ̂ — instead of the rounded A2/D3/D4 shortcut table, which
// put the 5th significant digit off (e.g. 74.01151 vs Minitab 74.01150).
//
// Exception: d3(4) = 0.8794. Minitab's published table shows 0.8798, but its
// R chart uses 0.8794 — backed out of Minitab's stored limits for DS05
// (σ 0.104478, R̄ 0.21512, UCL 0.490754), 21 Oct 2026.
//
// Values for n = 2–25 (d2, d3) and 26–50 (d2) are Minitab's table. d3 for
// n = 26–50 was computed by numerical integration of the range distribution
// (scipy, the same method that reproduces Minitab's d3 for n ≤ 25 to 4 dp).
// ─────────────────────────────────────────────────────────────────────────

const D2: Record<number, number> = {
  2: 1.128, 3: 1.693, 4: 2.059, 5: 2.326, 6: 2.534, 7: 2.704, 8: 2.847, 9: 2.970, 10: 3.078,
  11: 3.173, 12: 3.258, 13: 3.336, 14: 3.407, 15: 3.472, 16: 3.532, 17: 3.588, 18: 3.640, 19: 3.689, 20: 3.735,
  21: 3.778, 22: 3.819, 23: 3.858, 24: 3.895, 25: 3.931, 26: 3.964, 27: 3.997, 28: 4.027, 29: 4.057, 30: 4.086,
  31: 4.113, 32: 4.139, 33: 4.165, 34: 4.189, 35: 4.213, 36: 4.236, 37: 4.259, 38: 4.280, 39: 4.301, 40: 4.322,
  41: 4.341, 42: 4.361, 43: 4.379, 44: 4.398, 45: 4.415, 46: 4.433, 47: 4.450, 48: 4.466, 49: 4.482, 50: 4.498,
}

const D3: Record<number, number> = {
  2: 0.8525, 3: 0.8884, 4: 0.8794, 5: 0.8641, 6: 0.8480, 7: 0.8332, 8: 0.8198, 9: 0.8078, 10: 0.7971,
  11: 0.7873, 12: 0.7785, 13: 0.7704, 14: 0.7630, 15: 0.7562, 16: 0.7499, 17: 0.7441, 18: 0.7386, 19: 0.7335, 20: 0.7287,
  21: 0.7242, 22: 0.7199, 23: 0.7159, 24: 0.7121, 25: 0.7084, 26: 0.7050, 27: 0.7017, 28: 0.6986, 29: 0.6955, 30: 0.6927,
  31: 0.6899, 32: 0.6872, 33: 0.6847, 34: 0.6822, 35: 0.6799, 36: 0.6776, 37: 0.6754, 38: 0.6732, 39: 0.6712, 40: 0.6692,
  41: 0.6673, 42: 0.6654, 43: 0.6636, 44: 0.6618, 45: 0.6601, 46: 0.6584, 47: 0.6568, 48: 0.6552, 49: 0.6536, 50: 0.6521,
}

export const MAX_RANGE_SUBGROUP = 50

/** d2(n): expected range of n standard-normal observations. */
export function d2(n: number): number {
  return D2[Math.min(Math.max(Math.round(n), 2), MAX_RANGE_SUBGROUP)]
}

/** d3(n): standard deviation of the range of n standard-normal observations. */
export function d3(n: number): number {
  return D3[Math.min(Math.max(Math.round(n), 2), MAX_RANGE_SUBGROUP)]
}

/**
 * Limits for an X̄-R chart (n ≥ 2) or I-MR chart (n = 1, moving range of 2),
 * Minitab "R̄" / "average moving range" method.
 */
export function rangeChartLimits(center: number, rBar: number, n: number) {
  const w = n === 1 ? 2 : n
  const sigma = rBar / d2(w)
  const half = (3 * sigma) / Math.sqrt(n)
  const spread = 3 * d3(w) * sigma
  return {
    sigma,
    cl_x: center, ucl_x: center + half, lcl_x: center - half,
    cl_r: rBar, ucl_r: rBar + spread, lcl_r: Math.max(0, rBar - spread),
  }
}
