// Centralized user-facing strings for the AQL Sampling Plan Calculator.
//
// Why this file exists: all UI text for this tool is written in English
// (Quality Hub targets a global audience), and every string a user can see
// lives here instead of being hard-coded inline inside components. That
// way, if/when the project adds real i18n (e.g. next-intl, react-i18next),
// this module is the only thing that needs to be replaced — components
// just call these functions/constants and don't need to change.
//
// Do not put calculation logic here. This file is strings only.

export const messages = {
  // Header
  appTitle: 'AQL Sampling Plan Calculator',
  appSubtitle: 'ISO 2859-1 / ANSI ASQ Z1.4 — Single Sampling Plans',
  darkModeToggleOn: '🌙 Dark',
  darkModeToggleOff: '☀️ Light',
  exportCsv: 'Export CSV',

  // Inputs
  lotSizeLabel: 'Lot Size',
  lotSizeHelp: (min: number) => `Total units in the batch (min ${min})`,
  inspectionLevelLabel: 'Inspection Level',
  inspectionTypeLabel: 'Inspection Type',
  codeLetterLabel: 'Code Letter',
  codeLetterValue: (letter: string) => letter,
  codeLetterUnavailable: '—',

  // Defect table
  defectClassLabel: 'Defect Class',
  aqlPercentLabel: 'AQL %',
  requiredSampleLabel: 'Required Sample (n)',
  actualSampleLabel: 'Actual Sample (n)',
  sampleSizeLabel: 'Sample (n)',
  acceptNumberLabel: 'Ac',
  rejectNumberLabel: 'Re',
  noDataPlaceholder: '—',
  addDefectClass: '+ Add defect class',
  addInspectionStage: '+ Add inspection stage',
  removeStage: 'Remove stage',

  // Export panel
  exportSectionTitle: 'Export',
  exportCsvButton: 'CSV',
  exportExcelButton: 'Excel',
  exportPngButton: 'PNG',
  exportPdfButton: 'PDF',
  pdfReportTitle: 'AQL Sampling Plan Report',

  // Inspection types (dropdown options)
  inspectionTypes: {
    Normal: 'Normal Inspection',
    Tightened: 'Tightened Inspection',
    Reduced: 'Reduced Inspection',
  } as Record<'Normal' | 'Tightened' | 'Reduced', string>,

  // Errors / notes
  lotSizeTooSmall: (min: number) => `Lot size must be ${min} or greater.`,
  codeLetterNotFound: 'Could not determine a code letter for this lot size.',

  noVerifiedDataWarning: (defectName: string) =>
    `⚠ ${defectName}: No verified sampling plan data is available yet for this AQL value. ` +
    `This AQL range hasn't been confirmed against an official source.`,

  /**
   * Shown when the plan's required sample size is >= the lot size.
   * Per ISO 2859-1: "If the sample size equals or exceeds the lot size,
   * carry out 100% inspection."
   */
  fullLotInspectionNote: (requiredSampleSize: number, lotSize: number) =>
    requiredSampleSize === lotSize
      ? `⚠️ Required sample size equals the lot size (${lotSize}). Therefore, the entire lot will be inspected.`
      : `⚠️ Required sample size (${requiredSampleSize}) exceeds the lot size (${lotSize}). ` +
        `Therefore, the entire lot (${lotSize} units) will be inspected.`,

  fullLotInspectionShortLabel: 'Full Lot Inspection (100%)',

  /**
   * Shown when no direct plan exists for the requested code letter/AQL
   * combination and the ISO switching rule redirected to a different
   * code letter's plan.
   */
  switchNote: (fromLetter: string, toLetter: string, sampleSize: number) =>
    `No direct plan exists for code letter ${fromLetter} at this AQL — using code letter ${toLetter} ` +
    `(n=${sampleSize}) per the ISO 2859-1 switching rule.`,

  // Switching rules guide (ISO 2859-1 clause 9.3) — collapsible panel
  switchingRulesToggleShow: 'When to switch Normal / Tightened / Reduced? ▾',
  switchingRulesToggleHide: 'When to switch Normal / Tightened / Reduced? ▴',
  switchingRulesIntro:
    'AQL tables assume a continuing series of lots from one supplier, one product, one production ' +
    'process — not a one-off calculation. The standard expects you to move between these three ' +
    'states as lot results come in:',
  switchingRules: [
    {
      from: 'Normal',
      to: 'Tightened',
      badge: 'Normal → Tightened',
      condition: '2 of 5 (or fewer) consecutive lots not accepted',
      why: 'Signals the process may be slipping below the AQL — tightened plans need fewer defects to accept a lot.',
    },
    {
      from: 'Tightened',
      to: 'Normal',
      badge: 'Tightened → Normal',
      condition: '5 consecutive lots accepted',
      why: 'Quality has recovered; back to standard sampling.',
    },
    {
      from: 'Tightened',
      to: 'Discontinue',
      badge: 'Tightened → Stop inspection',
      condition: '5 consecutive lots not accepted while on tightened',
      why: 'Per the standard, sampling inspection should stop until the supplier fixes the process — 100% inspection or corrective action, not more sampling.',
    },
    {
      from: 'Normal',
      to: 'Reduced',
      badge: 'Normal → Reduced',
      condition:
        'Switching score ≥ 30 (roughly: several consecutive lots comfortably passing), production steady, and reduced inspection is desired',
      why: 'Consistently good quality earns a smaller sample size — less inspection cost.',
    },
    {
      from: 'Reduced',
      to: 'Normal',
      badge: 'Reduced → Normal',
      condition: 'Any lot not accepted, or production becomes irregular',
      why: 'Reduced inspection has looser criteria, so any single miss reverts immediately to full normal scrutiny.',
    },
  ],
  switchingRulesNote:
    'This is a simplified summary of ISO 2859-1 clause 9.3. Tracking the running switching score per ' +
    'supplier/product across multiple lots is a separate feature — this calculator computes one plan ' +
    'at a time.',

  footerNote:
    'Based on ISO 2859-1 / ANSI ASQ Z1.4. AQL range supported: 0.010% – 6.5%. Switching rules ' +
    'are applied automatically when no direct plan exists for a given code letter/AQL combination.',
};
