// Centralized user-facing strings for the ICMSF Microbiological Sampling
// Plan tool.
//
// Same rationale as lib/aql/messages.ts: every user-visible string lives
// here, not hard-coded inline inside components. Do not put calculation
// logic here — this file is strings only.

export const messages = {
  // Header
  appTitle: 'ICMSF Microbiological Sampling Plan',
  appSubtitle:
    'ICMSF Case selector · n/c/m/M sampling plan · Operating Characteristic curve — methodology aligned with Codex Alimentarius CAC/GL 21',
  darkModeToggleOn: '🌙 Dark',
  darkModeToggleOff: '☀️ Light',

  // Step 1 — Case selector wizard
  step1Title: 'Step 1 — Select your sampling plan Case',
  hazardLevelLabel: 'Degree of health hazard',
  hazardLevelHelp: 'How severe is the organism you are testing for, and how far could it spread?',
  hazardLevels: {
    utility: 'No direct health hazard — shelf-life / spoilage only',
    low: 'Low, indirect hazard (indicator organism)',
    moderate_limited: 'Moderate, direct hazard — limited spread',
    moderate_extensive: 'Moderate, direct hazard — potentially extensive spread',
    severe: 'Severe, direct hazard',
  } as Record<'utility' | 'low' | 'moderate_limited' | 'moderate_extensive' | 'severe', string>,

  conditionEffectLabel: 'Conditions after sampling (storage, handling, distribution)',
  conditionEffectHelp: 'Will normal handling after sampling reduce, not change, or increase the hazard?',
  conditionEffects: {
    reduce: 'Conditions reduce the hazard (e.g. further cooking, processing)',
    none: 'Conditions cause no change',
    increase: 'Conditions may increase the hazard (e.g. temperature abuse, ready-to-eat with no further kill step)',
  } as Record<'reduce' | 'none' | 'increase', string>,

  resolvedCaseLabel: (caseNumber: number) => `Case ${caseNumber}`,
  planClassLabel: (planClass: 2 | 3): string => (planClass === 2 ? '2-class plan' : '3-class plan'),
  sampleSizeLabel: 'n (sample units)',
  acceptNumberLabel: 'c (max allowed defective/marginal units)',

  // Step 2 — limits
  step2Title: 'Step 2 — Enter your microbiological limits',
  step2Help:
    'm and M are not looked up automatically — enter the values from the standard you are working to ' +
    '(Codex, a national standard such as EOS, or your own client specification).',
  mLabel: 'm (acceptable / marginal boundary)',
  MLabel: 'M (marginal / unacceptable boundary — 3-class plans only)',
  mHelp: '2-class plan: any unit above m is defective. 3-class plan: units below m are acceptable.',
  MHelp: '3-class plan only. Units above M are always unacceptable, regardless of c.',
  MNotApplicable: 'Not used — this is a 2-class plan',
  unitPlaceholder: 'e.g. per gram, per cm²',

  // Step 3 — results
  step3Title: 'Step 3 — Sampling plan',
  planSummary: (n: number, c: number) => `Test ${n} sample units. Reject the lot if more than ${c} are unacceptable.`,
  threeClassSummary: (n: number, c: number) =>
    `Test ${n} sample units. Reject the lot if any unit exceeds M, and/or if more than ${c} units exceed m.`,

  // OC curve
  ocCurveTitle: 'Operating Characteristic (OC) curve',
  ocCurveSubtitle: 'Probability the plan accepts a lot, at a given true proportion of defective units',
  ocCurveUnavailable3Class:
    'An OC curve is not shown for 3-class plans. ICMSF/NAP methodology treats 3-class plan acceptance ' +
    'probability as a surface across two variables (proportion defective and proportion marginal), not a ' +
    'single curve — use the n/c/m/M plan above directly.',
  ocCurveXAxisLabel: 'True proportion defective in the lot (%)',
  ocCurveYAxisLabel: 'Probability of acceptance (%)',
  consumerRiskCalculatorTitle: 'Check a specific risk',
  consumerRiskInputLabel: 'If this % of the lot is actually defective...',
  consumerRiskOutputLabel: (pct: number, paPct: number) =>
    `...this plan would still accept the lot ${paPct}% of the time.`,

  // Export panel
  exportSectionTitle: 'Export',
  exportCsvButton: 'CSV',
  exportExcelButton: 'Excel',
  exportPngButton: 'PNG',
  exportPdfButton: 'PDF',
  pdfReportTitle: 'ICMSF Microbiological Sampling Plan Report',

  // Errors / notes
  incompleteSelection: 'Select a hazard level and a condition effect to determine your Case.',
  limitsRequiredForOcNote:
    'The OC curve only depends on n and c, not on m/M — you can view it as soon as a 2-class Case is selected.',

  methodologyNote:
    'Case selection follows ICMSF Table 6-1 (Suggested Sampling Plans for Combinations of Degrees of ' +
    "Health Hazard and Conditions of Use), independently verified against the National Academies Press " +
    'reproduction of the same table. The OC curve uses the binomial acceptance-sampling model for 2-class ' +
    'plans, the same approach ICMSF itself uses. m and M values are not supplied by this tool — enter ' +
    'the values from your applicable standard.',

  footerNote:
    'Case selection: ICMSF Table 6-1 methodology, cross-verified against multiple independent sources. ' +
    'Aligned with Codex Alimentarius CAC/GL 21 principles. Not a substitute for your applicable national ' +
    'or client microbiological standard.',
};

export type IcmsfMessages = typeof messages;
