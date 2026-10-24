// ─────────────────────────────────────────────────────────────────────────
// What the AQL page may know in the browser: the choices it offers and the
// shape of the reply from /api/aql. The tables and the plan lookup stay on
// the server (lib/aql/tables.ts, lib/aql/calculator.ts).
// ─────────────────────────────────────────────────────────────────────────

import type { InspectionLevel, InspectionType, PlanLetter, CodeLetter } from './tables'

export type { InspectionLevel, InspectionType, PlanLetter, CodeLetter }

/** AQL columns offered (ISO 2859-1:2026 Tables 2–4, 0.010 to 6.5) */
export const AQL_OPTIONS = [0.010, 0.015, 0.025, 0.040, 0.065, 0.10, 0.15, 0.25, 0.40, 0.65, 1.0, 1.5, 2.5, 4.0, 6.5] as const

export const LEVELS: InspectionLevel[] = ['S1', 'S2', 'S3', 'S4', 'I', 'II', 'III']
export const TYPES: InspectionType[] = ['Normal', 'Tightened', 'Reduced']
export const MIN_LOT_SIZE = 2
export const MAX_LOT_SIZE = 1_000_000_000
export const MAX_STAGES = 20
export const MAX_CLASSES = 20

/** Display name of a level, as printed in Table 1 (S-1 … S-4, I, II, III) */
export const levelName = (l: InspectionLevel) => (l.startsWith('S') ? `S-${l.slice(1)}` : l)

export const DEFAULT_DEFECT_CLASSES = [
  { name: 'Critical', aql: 0.065 },
  { name: 'Major', aql: 2.5 },
  { name: 'Minor', aql: 4.0 },
]

export type Decision = 'accept' | 'reject'

/** Request body of POST /api/aql */
export interface AqlStageRequest {
  lotSize: number
  level: InspectionLevel
  inspectionType: InspectionType
  /** found: nonconforming items (or nonconformities) found in the sample; null = not entered yet */
  classes: { aql: number; found: number | null }[]
}

/** One defect class in the reply */
export interface AqlClassResult {
  /** letter whose plan applies (differs from the stage letter when the table sends you elsewhere) */
  letter: PlanLetter
  /** sample size of that plan */
  n: number
  /** units actually inspected: n, or the whole lot when n ≥ lot size */
  inspect: number
  fullLot: boolean
  ac: number
  re: number
  decision: Decision | null
}

export interface AqlStageResult {
  error: 'lot' | null
  codeLetter: CodeLetter | null
  /** sample size of the stage's own letter */
  sampleSize: number | null
  classes: AqlClassResult[]
  /** not accepted when any class is not accepted; accepted when every class is entered and accepted */
  lot: Decision | null
}
