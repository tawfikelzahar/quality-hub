// Server only: ESLint keeps this file out of the browser (eslint.config.mjs).
// ─────────────────────────────────────────────────────────────────────────
// Data checks for attribute charts (p, np, c, u), as in the report card of
// specialised statistical software (Minitab Assistant, white paper
// "Attribute Control Charts"). They judge the data, never change a result.
//
// 1. Number of subgroups. Enough subgroups that, with 95% confidence, the
//    false alarm rate of test 1 stays at or below 2% (1% above the UCL,
//    Trietsch 1999). P chart: find p_c with
//        p_c + 3√(p_c(1 − p_c)/n) = p̄ + z₀.₉₉√(p̄(1 − p̄)/n)
//    then m = p̄(1 − p̄) / [n((p̄ − p_c)/z₀.₉₅)²]. U chart: find c_c with
//        c_c + 3√c_c = c̄ + z₀.₉₉√c̄,  then m = c̄ / [(c̄ − c_c)/z₀.₉₅]²
//    with c̄ the average defects per subgroup. n is the average subgroup
//    size when sizes differ. Rounded up. These formulas reproduce every
//    cell of the white paper's Tables 2 and 3 (tests/golden/attribute).
// 2. Subgroup size. nᵢ·p̄ ≥ 0.5 (P) or nᵢ·ū ≥ 0.5 (U) for every subgroup;
//    below that the limits are inaccurate and false alarms rise.
//
// np is the P chart with one fixed n, and c is the U chart with one unit
// per subgroup, so both use the same formulas.
// ─────────────────────────────────────────────────────────────────────────

const Z99 = 2.3263478740408408
const Z95 = 1.6448536269514722

function bisect(f: (x: number) => number, lo: number, hi: number): number {
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2
    if (f(mid) > 0) hi = mid
    else lo = mid
  }
  return (lo + hi) / 2
}

/** Subgroups needed for a P chart (unrounded); p̄ strictly between 0 and 1 */
export function subgroupsNeededP(pBar: number, n: number): number {
  const target = pBar + Z99 * Math.sqrt(pBar * (1 - pBar) / n)
  const pc = bisect(x => x + 3 * Math.sqrt(x * (1 - x) / n) - target, 0, pBar)
  return (pBar * (1 - pBar)) / (n * ((pBar - pc) / Z95) ** 2)
}

/** Subgroups needed for a U chart (unrounded); c̄ = average defects per subgroup, above 0 */
export function subgroupsNeededU(cBar: number): number {
  const target = cBar + Z99 * Math.sqrt(cBar)
  const cc = bisect(x => x + 3 * Math.sqrt(x) - target, 0, cBar)
  return cBar / ((cBar - cc) / Z95) ** 2
}

export type CheckStatus = 'ok' | 'warn' | 'na'

export interface AttributeChecks {
  subgroups: {
    status: CheckStatus
    /** subgroups in the data */
    have: number
    /** subgroups needed (rounded up); null when there is no defective or defect */
    need: number | null
    /** p̄ (p, np) or c̄ (c, u) the requirement was worked out from */
    basis: number
    /** average subgroup size used (p, np, u); 1 for c */
    nBar: number
  }
  size: {
    status: CheckStatus
    /** 1-based subgroups below the 0.5 rule */
    small: number[]
    /** nᵢ·p̄ or nᵢ·ū of the smallest subgroup */
    minProduct: number
    /** smallest subgroup size that passes (p, np, u); null for c or when there is no defect */
    minSize: number | null
  }
}

/** data rows as sent to /api/analyze: [n, count] for p and u, [count] for np and c */
export function runAttributeChecks(data: number[][], attrType: string, fixedN: number, clVal: number): AttributeChecks {
  const k = data.length
  const sizes = attrType === 'p' || attrType === 'u' ? data.map(r => r[0]) : data.map(() => (attrType === 'np' ? fixedN : 1))
  const nBar = sizes.reduce((s, v) => s + v, 0) / k
  const proportion = attrType === 'p' || attrType === 'np'

  // per-unit rate: p̄ for p and np, ū for u, c̄ for c (one unit per subgroup)
  const rate = attrType === 'np' ? clVal / fixedN : clVal
  const basis = proportion ? rate : rate * nBar

  let need: number | null = null
  if (proportion ? rate > 0 && rate < 1 : basis > 0) {
    need = Math.ceil(proportion ? subgroupsNeededP(rate, nBar) : subgroupsNeededU(basis))
  }

  const products = sizes.map(n => n * rate)
  const small = products.flatMap((v, i) => (v < 0.5 ? [i + 1] : []))
  const minSize = attrType !== 'c' && rate > 0 ? Math.ceil(0.5 / rate - 1e-12) : null

  return {
    subgroups: { status: need === null ? 'na' : k >= need ? 'ok' : 'warn', have: k, need, basis, nBar },
    size: { status: rate === 0 ? 'na' : small.length === 0 ? 'ok' : 'warn', small, minProduct: Math.min(...products), minSize },
  }
}
