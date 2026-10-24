import {
  AQL_VALUES,
  CODE_LETTER_TABLE,
  RESOLVED_NORMAL,
  RESOLVED_REDUCED,
  RESOLVED_TIGHTENED,
  sampleSizeFor,
  type CodeLetter,
  type PlanLetter,
  type InspectionLevel,
  type InspectionType,
} from './tables';
import type { AqlStageRequest, AqlStageResult, Decision } from './options';

export interface ResolvedPlan {
  /** The code letter your Lot Size + Level naturally map to */
  baseLetter: CodeLetter;
  baseSampleSize: number;
  /** The code letter whose plan actually applies (may differ from baseLetter if the ISO switching rule redirected here) */
  usedLetter: PlanLetter;
  /** The sample size called for by the resolved plan itself, before checking it against the lot size */
  requiredSampleSize: number;
  /** The number of units that will actually be inspected: requiredSampleSize, capped at the lot size */
  actualSampleSize: number;
  ac: number;
  re: number;
  /** True if requiredSampleSize >= lot size, meaning the whole lot must be inspected (per ISO 2859-1) */
  fullLotInspection: boolean;
  /** True only when there is no verified data at all for this AQL (still-unverified low-AQL columns) */
  noVerifiedData: boolean;
}

/**
 * Step 1: Lot Size + Inspection Level -> Code Letter (ISO 2859-1 Table I)
 */
export function getCodeLetter(lotSize: number, level: InspectionLevel): CodeLetter | null {
  const row = CODE_LETTER_TABLE.find(([min, max]) => lotSize >= min && lotSize <= max);
  if (!row) return null;
  const [, , s1, s2, s3, s4, i, ii, iii] = row;
  switch (level) {
    case 'S1': return s1;
    case 'S2': return s2;
    case 'S3': return s3;
    case 'S4': return s4;
    case 'I': return i;
    case 'II': return ii;
    case 'III': return iii;
    default: return null;
  }
}

/**
 * Step 2: Code Letter + Inspection Type -> Sample Size (n).
 *
 * Normal and Tightened share the same n per code letter. Reduced does not
 * — it deliberately calls for a smaller sample for the same letter (see
 * SAMPLE_SIZES_REDUCED in tables.ts). This must always be looked up with
 * the inspection type in mind; a single flat "code letter -> n" mapping
 * is only correct for Normal/Tightened.
 */
export function getSampleSize(letter: CodeLetter, inspectionType: InspectionType): number {
  return sampleSizeFor(letter, inspectionType);
}

/**
 * Step 3: Code Letter + AQL% + Inspection Type -> Ac/Re.
 *
 * All three inspection types (Normal, Tightened, Reduced) now use a fully
 * precomputed RESOLVED_* lookup, where every cell's switching-rule arrow
 * has already been followed to its real value directly from the official
 * ISO 2859-1:2026 table (see tables.ts for how each was verified). No
 * direction-guessing happens here for any of the three anymore.
 *
 * Once a candidate (letter, ac) is found, we check it against the lot
 * size: per ISO 2859-1, if the required sample size equals or exceeds the
 * lot size, the correct action is to inspect the full lot (using the same
 * Ac/Re the plan calls for), not to take that sample.
 */
export function getPlan(
  letter: CodeLetter,
  aql: number,
  inspectionType: InspectionType,
  lotSize?: number,
): ResolvedPlan | null {
  const aqlIndex = AQL_VALUES.indexOf(aql);
  if (aqlIndex === -1) return null;

  const baseSampleSize = sampleSizeFor(letter, inspectionType);

  const build = (
    usedLetter: PlanLetter,
    requiredSampleSize: number,
    ac: number,
  ): ResolvedPlan => {
    const fullLotInspection = lotSize !== undefined && requiredSampleSize >= lotSize;
    return {
      baseLetter: letter,
      baseSampleSize,
      usedLetter,
      requiredSampleSize,
      actualSampleSize: fullLotInspection ? (lotSize as number) : requiredSampleSize,
      ac,
      re: ac + 1,
      fullLotInspection,
      noVerifiedData: false,
    };
  };

  const noData = (): ResolvedPlan => ({
    baseLetter: letter,
    baseSampleSize,
    usedLetter: letter,
    requiredSampleSize: baseSampleSize,
    actualSampleSize: lotSize !== undefined ? Math.min(baseSampleSize, lotSize) : baseSampleSize,
    ac: -1,
    re: -1,
    fullLotInspection: lotSize !== undefined && baseSampleSize >= lotSize,
    noVerifiedData: true,
  });

  const resolvedTable =
    inspectionType === 'Normal'
      ? RESOLVED_NORMAL
      : inspectionType === 'Tightened'
        ? RESOLVED_TIGHTENED
        : RESOLVED_REDUCED;

  const resolved = resolvedTable[letter][aqlIndex];
  if (!resolved) return noData();
  const resolvedSampleSize = sampleSizeFor(resolved.letter, inspectionType);
  return build(resolved.letter, resolvedSampleSize, resolved.ac);
}

export interface DefectClassInput {
  id: string;
  name: string;
  aql: number;
}

export interface DefectClassResult extends DefectClassInput {
  plan: ResolvedPlan | null;
}

export interface InspectionRowInput {
  id: string;
  stageName: string;
  lotSize: number;
  level: InspectionLevel;
  inspectionType: InspectionType;
  defects: DefectClassInput[];
}

export interface InspectionRowResult {
  id: string;
  stageName: string;
  lotSize: number;
  level: InspectionLevel;
  inspectionType: InspectionType;
  codeLetter: CodeLetter | null;
  sampleSize: number | null;
  defects: DefectClassResult[];
  error: 'lot' | null;
}

const MIN_LOT_SIZE = 2;

export function computeRow(row: InspectionRowInput): InspectionRowResult {
  if (!row.lotSize || row.lotSize < MIN_LOT_SIZE) {
    return {
      ...row,
      codeLetter: null,
      sampleSize: null,
      defects: row.defects.map((d) => ({ ...d, plan: null })),
      error: 'lot',
    };
  }

  const codeLetter = getCodeLetter(row.lotSize, row.level);
  if (!codeLetter) {
    return {
      ...row,
      codeLetter: null,
      sampleSize: null,
      defects: row.defects.map((d) => ({ ...d, plan: null })),
      error: 'lot',
    };
  }

  const sampleSize = getSampleSize(codeLetter, row.inspectionType);
  const defects = row.defects.map((d) => ({
    ...d,
    plan: getPlan(codeLetter, d.aql, row.inspectionType, row.lotSize),
  }));

  return { ...row, codeLetter, sampleSize, defects, error: null };
}

/**
 * ISO 2859-1:2026, 11.2 — single sampling, integer acceptance number:
 * found ≤ Ac → acceptable · found ≥ Re → not acceptable (Re = Ac + 1).
 */
export function decide(found: number, ac: number): Decision {
  return found <= ac ? 'accept' : 'reject';
}

/**
 * One inspection stage for /api/aql: plan per defect class, the decision
 * per class when the found count is given, and the lot decision. Each class
 * has its own plan (7.4); the lot is not accepted when any class is not
 * accepted, and accepted only when every class is entered and accepted.
 */
export function evaluateStage(req: AqlStageRequest): AqlStageResult {
  const row = computeRow({
    id: '',
    stageName: '',
    lotSize: req.lotSize,
    level: req.level,
    inspectionType: req.inspectionType,
    defects: req.classes.map((c, i) => ({ id: String(i), name: '', aql: c.aql })),
  });
  if (row.error || !row.codeLetter) {
    return { error: 'lot', codeLetter: null, sampleSize: null, classes: [], lot: null };
  }
  const classes = row.defects.map((d, i) => {
    const p = d.plan!;
    const found = req.classes[i].found;
    return {
      letter: p.usedLetter,
      n: p.requiredSampleSize,
      inspect: p.actualSampleSize,
      fullLot: p.fullLotInspection,
      ac: p.ac,
      re: p.re,
      decision: found === null ? null : decide(found, p.ac),
    };
  });
  const lot: Decision | null = classes.some(c => c.decision === 'reject')
    ? 'reject'
    : classes.length > 0 && classes.every(c => c.decision === 'accept')
      ? 'accept'
      : null;
  return { error: null, codeLetter: row.codeLetter, sampleSize: row.sampleSize, classes, lot };
}
