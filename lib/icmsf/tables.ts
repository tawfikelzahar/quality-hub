// ICMSF microbiological sampling plan reference data — the 15 "Cases"
//
// ─────────────────────────────────────────────────────────────────────────
// SOURCE & VERIFICATION (session 1)
// ─────────────────────────────────────────────────────────────────────────
// TABLE 6-1, "Suggested Sampling Plans for Combinations of Degrees of
// Health Hazard and Conditions of Use (i.e., the 15 'Cases')"
//
// Primary source cited on the table itself: ICMSF, 1974, p. 60,
// © University of Toronto Press, 1974 (International Commission on
// Microbiological Specifications for Foods — the same body that authored
// the "Microorganisms in Foods 2" volume this tool's PART II data comes
// from).
//
// Verified via independent secondary reproduction:
//   National Research Council (US) Subcommittee on Microbiological
//   Criteria. 1985. "An Evaluation of the Role of Microbiological
//   Criteria for Foods and Food Ingredients." Washington, DC: National
//   Academies Press. Table 6-1, Chapter 6.
//   https://www.ncbi.nlm.nih.gov/books/NBK216671/table/ttt00005/?report=objectonly
//   (NCBI Bookshelf, National Library of Medicine / NIH — federal .gov
//   host, fetched and read directly, table transcribed cell-by-cell from
//   the live page, not OCR/inferred.)
//
// Cross-checked against every explicit "case N, n=.., c=.." mention found
// by direct-text-search in the user's uploaded ICMSF "Microorganisms in
// Foods 2" PART II PDF (Tables 19, 20, 22, 23, 24 — raw meats, processed
// meats, poultry, pet foods, dried milk/cheese). All matched exactly
// except one: Case 5 applied to coliforms in dried milk uses c=1, not the
// table's standard c=2. The book states explicitly this was a deliberate
// tightening for that specific application ("decreasing c from 2 to 1")
// — consistent with Table 6-1's own footnote (a): "More stringent
// sampling plans would generally be used for sensitive foods destined for
// susceptible populations." So this is a documented case-specific
// override, not a conflict with the base table. CASES below hold the
// Table 6-1 standard values; case-specific overrides are not modeled here
// and are left for the user's own m/M judgement per their applicable
// standard (Codex, EOS, client spec, etc.) — see product notes.
//
// PART I (chapters 1–9, which include this table's origin chapter) is not
// present in the user's uploaded PDF — only PART II (commodity chapters
// 10–26) was uploaded. This file's data was independently sourced and
// verified as documented above rather than transcribed from the user's
// upload.
// ─────────────────────────────────────────────────────────────────────────

export type HazardLevel =
  | 'utility'      // No direct health hazard — shelf-life / spoilage utility test
  | 'low'          // Low, indirect (indicator organism)
  | 'moderate_limited'   // Moderate, direct, limited spread
  | 'moderate_extensive' // Moderate, direct, potentially extensive spread
  | 'severe';      // Severe, direct

export type ConditionEffect =
  | 'reduce'   // Conditions after sampling reduce the degree of concern
  | 'none'     // Conditions cause no change in concern
  | 'increase'; // Conditions may increase the degree of concern

export type PlanClass = 2 | 3;

export interface IcmsfCase {
  case: number; // 1–15
  hazardLevel: HazardLevel;
  conditionEffect: ConditionEffect;
  planClass: PlanClass;
  n: number;
  c: number;
}

// TABLE 6-1 — verified values, see header above.
export const ICMSF_CASES: IcmsfCase[] = [
  { case: 1,  hazardLevel: 'utility',             conditionEffect: 'reduce',  planClass: 3, n: 5,  c: 3 },
  { case: 2,  hazardLevel: 'utility',             conditionEffect: 'none',    planClass: 3, n: 5,  c: 2 },
  { case: 3,  hazardLevel: 'utility',             conditionEffect: 'increase',planClass: 3, n: 5,  c: 1 },

  { case: 4,  hazardLevel: 'low',                 conditionEffect: 'reduce',  planClass: 3, n: 5,  c: 3 },
  { case: 5,  hazardLevel: 'low',                 conditionEffect: 'none',    planClass: 3, n: 5,  c: 2 },
  { case: 6,  hazardLevel: 'low',                 conditionEffect: 'increase',planClass: 3, n: 5,  c: 1 },

  { case: 7,  hazardLevel: 'moderate_limited',    conditionEffect: 'reduce',  planClass: 3, n: 5,  c: 2 },
  { case: 8,  hazardLevel: 'moderate_limited',    conditionEffect: 'none',    planClass: 3, n: 5,  c: 1 },
  { case: 9,  hazardLevel: 'moderate_limited',    conditionEffect: 'increase',planClass: 3, n: 10, c: 1 },

  { case: 10, hazardLevel: 'moderate_extensive',  conditionEffect: 'reduce',  planClass: 2, n: 5,  c: 0 },
  { case: 11, hazardLevel: 'moderate_extensive',  conditionEffect: 'none',    planClass: 2, n: 10, c: 0 },
  { case: 12, hazardLevel: 'moderate_extensive',  conditionEffect: 'increase',planClass: 2, n: 20, c: 0 },

  { case: 13, hazardLevel: 'severe',              conditionEffect: 'reduce',  planClass: 2, n: 15, c: 0 },
  { case: 14, hazardLevel: 'severe',              conditionEffect: 'none',    planClass: 2, n: 30, c: 0 },
  { case: 15, hazardLevel: 'severe',              conditionEffect: 'increase',planClass: 2, n: 60, c: 0 },
];

export function getIcmsfCase(hazardLevel: HazardLevel, conditionEffect: ConditionEffect): IcmsfCase {
  const found = ICMSF_CASES.find(
    (c) => c.hazardLevel === hazardLevel && c.conditionEffect === conditionEffect
  );
  if (!found) {
    throw new Error(`No ICMSF case found for hazardLevel=${hazardLevel}, conditionEffect=${conditionEffect}`);
  }
  return found;
}

export function getIcmsfCaseByNumber(caseNumber: number): IcmsfCase {
  const found = ICMSF_CASES.find((c) => c.case === caseNumber);
  if (!found) {
    throw new Error(`Invalid ICMSF case number: ${caseNumber}`);
  }
  return found;
}

export const HAZARD_LEVEL_ORDER: HazardLevel[] = [
  'utility',
  'low',
  'moderate_limited',
  'moderate_extensive',
  'severe',
];

export const CONDITION_EFFECT_ORDER: ConditionEffect[] = ['reduce', 'none', 'increase'];
