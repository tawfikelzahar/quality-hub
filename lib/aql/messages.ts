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
  codeLetterValue: (letter: string, sampleSize: number) => `${letter} (n=${sampleSize})`,
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

  footerNote:
    'Based on ISO 2859-1 / ANSI ASQ Z1.4. AQL range supported: 0.010% – 6.5%. Switching rules ' +
    'are applied automatically when no direct plan exists for a given code letter/AQL combination.',
};
