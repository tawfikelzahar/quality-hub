// ─────────────────────────────────────────────────────────────────────────
// Two-level full factorial design matrix (2^k, 2–5 factors). This is the
// published construction (Montgomery, Design and Analysis of Experiments,
// Ch. 6): coded −1 / +1 levels in standard (Yates) order, the first factor
// alternating fastest. It holds no analysis, so the browser may use it; the
// analysis itself runs on the server (lib/doe/calculator.ts, /api/doe).
// ─────────────────────────────────────────────────────────────────────────

export const MIN_FACTORS = 2
export const MAX_FACTORS = 5
export const MAX_REPLICATES = 10
/** Term labels: factor 1 is A, factor 2 is B … */
export const LETTERS = ['A', 'B', 'C', 'D', 'E'] as const

export interface FactorDef {
  /** what the engineer calls it, e.g. "Temperature"; terms use the letter */
  name: string
  low: number
  high: number
  unit?: string
}

export interface DesignRow {
  /** 1-based run order (randomized or not) */
  runOrder: number
  /** 1-based standard order of the design point (1 … 2^k) */
  standardOrder: number
  /** 1-based replicate */
  replicate: number
  /** coded level per factor, in factor order */
  coded: (1 | -1)[]
}

export type DesignError = 'too-few-factors' | 'too-many-factors' | 'invalid-levels' | 'bad-replicates'

export function validateDesign(factors: FactorDef[], replicates: number): DesignError | null {
  if (factors.length < MIN_FACTORS) return 'too-few-factors'
  if (factors.length > MAX_FACTORS) return 'too-many-factors'
  for (const f of factors) {
    if (!Number.isFinite(f.low) || !Number.isFinite(f.high) || f.low === f.high) return 'invalid-levels'
  }
  if (!Number.isInteger(replicates) || replicates < 1 || replicates > MAX_REPLICATES) return 'bad-replicates'
  return null
}

/** Coded level of factor `idx` at design point `point` (0-based, standard order). */
export function codedLevel(point: number, idx: number): 1 | -1 {
  return Math.floor(point / 2 ** idx) % 2 === 0 ? -1 : 1
}

/** Standard order, replicate blocks one after the other. */
export function buildDesignMatrix(k: number, replicates: number): DesignRow[] {
  const rows: DesignRow[] = []
  for (let rep = 1; rep <= replicates; rep++) {
    for (let p = 0; p < 2 ** k; p++) {
      rows.push({ runOrder: rows.length + 1, standardOrder: p + 1, replicate: rep, coded: Array.from({ length: k }, (_, i) => codedLevel(p, i)) })
    }
  }
  return rows
}

/** Shuffles the run order only (Fisher–Yates); the rows keep their design point. */
export function randomizeRunOrder(rows: DesignRow[]): DesignRow[] {
  const out = [...rows]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out.map((r, i) => ({ ...r, runOrder: i + 1 }))
}
