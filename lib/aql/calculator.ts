import {
  AC_TABLES,
  AQL_VALUES,
  CODE_LETTER_TABLE,
  CODE_LETTERS,
  RESOLVED_NORMAL,
  SAMPLE_SIZES,
  type CodeLetter,
  type InspectionLevel,
  type InspectionType,
} from './tables';
import { messages } from './messages';

export interface ResolvedPlan {
  /** The code letter your Lot Size + Level naturally map to */
  baseLetter: CodeLetter;
  baseSampleSize: number;
  /** The code letter whose plan actually applies (may differ from baseLetter if the ISO switching rule redirected here) */
  usedLetter: CodeLetter;
  /** The sample size called for by the resolved plan itself, before checking it against the lot size */
  requiredSampleSize: number;
  /** The number of units that will actually be inspected: requiredSampleSize, capped at the lot size */
  actualSampleSize: number;
  ac: number;
  re: number;
  /** Explanation shown to the user when the plan had to switch code letters */
  switchNote: string | null;
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
 * Step 2: Code Letter -> Sample Size (n)
 */
export function getSampleSize(letter: CodeLetter): number {
  return SAMPLE_SIZES[letter];
}

/**
 * Step 3: Code Letter + AQL% + Inspection Type -> Ac/Re.
 *
 * Normal inspection uses RESOLVED_NORMAL — a fully precomputed lookup where
 * every cell's switching-rule arrow has already been followed to its real
 * value directly from the official ISO 2859-1 table (see tables.ts for how
 * this was verified). No direction-guessing happens here for Normal.
 *
 * Tightened and Reduced don't have that verified resolution yet, so they
 * still fall back to scanning AC_TABLES for the nearest defined cell. That
 * scan direction is inferred (does this code letter's row already have a
 * value to the left of this AQL column?) rather than read directly from a
 * source — treat Tightened/Reduced results with the same caution noted in
 * tables.ts until they get the same direct-lookup treatment as Normal.
 *
 * Either way, once a candidate (letter, ac) is found, we check it against
 * the lot size: per ISO 2859-1, if the required sample size equals or
 * exceeds the lot size, the correct action is to inspect the full lot
 * (using the same Ac/Re the plan calls for), not to take that sample.
 */
export function getPlan(
  letter: CodeLetter,
  aql: number,
  inspectionType: InspectionType,
  lotSize?: number,
): ResolvedPlan | null {
  const aqlIndex = AQL_VALUES.indexOf(aql);
  if (aqlIndex === -1) return null;

  const baseSampleSize = SAMPLE_SIZES[letter];

  const build = (
    usedLetter: CodeLetter,
    requiredSampleSize: number,
    ac: number,
    switchNote: string | null,
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
      switchNote,
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
    switchNote: null,
    fullLotInspection: lotSize !== undefined && baseSampleSize >= lotSize,
    noVerifiedData: true,
  });

  if (inspectionType === 'Normal') {
    const resolved = RESOLVED_NORMAL[letter][aqlIndex];
    if (!resolved) return noData();
    const note =
      resolved.letter === letter
        ? null
        : messages.switchNote(letter, resolved.letter, SAMPLE_SIZES[resolved.letter]);
    return build(resolved.letter, SAMPLE_SIZES[resolved.letter], resolved.ac, note);
  }

  // Tightened / Reduced: not yet verified with a direct resolution table.
  // Fall back to scanning, inferring direction from whether this row
  // already has a value to the left of the requested AQL column.
  const table = AC_TABLES[inspectionType];
  const letterIndex = CODE_LETTERS.indexOf(letter);
  const row = table[letter];

  const direct = row[aqlIndex];
  if (direct !== -1) {
    return build(letter, baseSampleSize, direct, null);
  }

  const hasEarlierDefinedValue = row.slice(0, aqlIndex).some((v) => v !== -1);
  const searchOrder = hasEarlierDefinedValue
    ? [...Array(letterIndex).keys()].reverse() // smaller letters first
    : [...Array(CODE_LETTERS.length - letterIndex - 1).keys()].map((i) => letterIndex + 1 + i); // bigger letters first

  for (const i of searchOrder) {
    const candidate = CODE_LETTERS[i];
    const val = table[candidate][aqlIndex];
    if (val !== -1) {
      return build(
        candidate,
        SAMPLE_SIZES[candidate],
        val,
        messages.switchNote(letter, candidate, SAMPLE_SIZES[candidate]),
      );
    }
  }
  // Try the opposite direction as a fallback (shouldn't normally be needed)
  const oppositeOrder = hasEarlierDefinedValue
    ? [...Array(CODE_LETTERS.length - letterIndex - 1).keys()].map((i) => letterIndex + 1 + i)
    : [...Array(letterIndex).keys()].reverse();
  for (const i of oppositeOrder) {
    const candidate = CODE_LETTERS[i];
    const val = table[candidate][aqlIndex];
    if (val !== -1) {
      return build(
        candidate,
        SAMPLE_SIZES[candidate],
        val,
        messages.switchNote(letter, candidate, SAMPLE_SIZES[candidate]),
      );
    }
  }

  return noData();
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
  error: string | null;
}

const MIN_LOT_SIZE = 2;

export function computeRow(row: InspectionRowInput): InspectionRowResult {
  if (!row.lotSize || row.lotSize < MIN_LOT_SIZE) {
    return {
      ...row,
      codeLetter: null,
      sampleSize: null,
      defects: row.defects.map((d) => ({ ...d, plan: null })),
      error: messages.lotSizeTooSmall(MIN_LOT_SIZE),
    };
  }

  const codeLetter = getCodeLetter(row.lotSize, row.level);
  if (!codeLetter) {
    return {
      ...row,
      codeLetter: null,
      sampleSize: null,
      defects: row.defects.map((d) => ({ ...d, plan: null })),
      error: messages.codeLetterNotFound,
    };
  }

  const sampleSize = getSampleSize(codeLetter);
  const defects = row.defects.map((d) => ({
    ...d,
    plan: getPlan(codeLetter, d.aql, row.inspectionType, row.lotSize),
  }));

  return { ...row, codeLetter, sampleSize, defects, error: null };
}
