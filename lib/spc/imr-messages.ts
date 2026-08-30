export interface ImrMessages {
  appSubtitle: string
  dataSectionTitle: string
  dataSectionHelp: string
  loadExampleButton: string
  clearDataButton: string
  measurementLabel: string
  csvUploadLabel: string
  csvUploadHint: string
  pasteLabel: string
  pastePlaceholder: string
  readColumnButton: string
  specLimitsTitle: string
  lslLabel: string
  uslLabel: string
  targetLabel: string
  optionalHint: string
  runAnalysisButton: string
  errorInsufficientData: string
  errorNoData: string
  errorBadColumn: string
  resultsTitle: string
  chartITitle: string
  chartMRTitle: string
  metricMean: string
  metricSigma: string
  metricUCL: string
  metricLCL: string
  metricN: string
  violationsTitle: string
  noViolations: string
  ruleLabel: string
  pointsAffected: string
  capabilityTitle: string
  metricCp: string
  metricCpk: string
  metricPp: string
  metricPpk: string
  metricSigmaLevel: string
  metricPpmTotal: string
  capabilityNeedsLimits: string
  normalityNote: (pValue: string, normal: boolean) => string
  dataAdequacyNote: (label: string, n: number) => string
  exportSectionTitle: string
  exportCsvButton: string
  exportExcelButton: string
  exportPngButton: string
  exportPdfButton: string
  pdfReportTitle: string
  footerNote: string
  whatIsTitle: string
  whatIsBody: string
}

export const messages: ImrMessages = {
  appSubtitle:
    'Build an Individuals and Moving Range (I-MR) chart for sequential, one-at-a-time measurement data — process stability, Nelson Rules screening, and capability in one view.',
  dataSectionTitle: 'Input Data',
  dataSectionHelp:
    'Upload a CSV or paste a single column of sequential measurements (one value per line or per row, in the order they were collected).',
  loadExampleButton: 'Load Example Data',
  clearDataButton: 'Clear',
  measurementLabel: 'Measurement Column',
  csvUploadLabel: 'Upload CSV',
  csvUploadHint: 'One column of numeric values, in collection order. A header row is optional.',
  pasteLabel: 'Or Paste Data',
  pastePlaceholder: 'Paste one measurement per line, in the order collected',
  readColumnButton: 'Read Data',
  specLimitsTitle: 'Specification Limits (optional — needed for capability indices)',
  lslLabel: 'Lower Spec Limit (LSL)',
  uslLabel: 'Upper Spec Limit (USL)',
  targetLabel: 'Target (optional, for Cpm)',
  optionalHint: 'Leave blank if not applicable.',
  runAnalysisButton: 'Run I-MR Analysis',
  errorInsufficientData: 'At least 3 valid measurements are required to build an I-MR chart (more are recommended — 20-25 is typical for a stability study).',
  errorNoData: 'No data yet. Load the example or paste/upload your own data first.',
  errorBadColumn: 'Select a measurement column before running the analysis.',
  resultsTitle: 'I-MR Chart Results',
  chartITitle: 'Individuals (I) Chart',
  chartMRTitle: 'Moving Range (MR) Chart',
  metricMean: 'Mean (X̄)',
  metricSigma: 'σ (from MR̄/1.128)',
  metricUCL: 'UCL',
  metricLCL: 'LCL',
  metricN: 'N',
  violationsTitle: 'Control Chart Rule Violations',
  noViolations: 'No rule violations detected — the process appears statistically stable over this data.',
  ruleLabel: 'Rule',
  pointsAffected: 'Point(s)',
  capabilityTitle: 'Process Capability',
  metricCp: 'Cp',
  metricCpk: 'Cpk',
  metricPp: 'Pp',
  metricPpk: 'Ppk',
  metricSigmaLevel: 'Sigma Level (Z.Bench)',
  metricPpmTotal: 'Total PPM (defects)',
  capabilityNeedsLimits: 'Enter a Lower and/or Upper Spec Limit above to see capability indices.',
  normalityNote: (pValue, normal) =>
    normal
      ? `Anderson-Darling normality test: P = ${pValue}. Data is consistent with a normal distribution, so Cp/Cpk are reported.`
      : `Anderson-Darling normality test: P = ${pValue}. Data departs from normality, so Cp/Cpk are withheld (Pp/Ppk, which don't assume normality, are still shown).`,
  dataAdequacyNote: (label, n) => `${label} (N = ${n}). More data points give a more reliable capability read.`,
  exportSectionTitle: 'Export & Save',
  exportCsvButton: 'CSV',
  exportExcelButton: 'Excel',
  exportPngButton: 'PNG',
  exportPdfButton: 'PDF',
  pdfReportTitle: 'I-MR Chart — Study Report',
  footerNote:
    'Control limits use ±3σ from the centerline, with σ estimated as MR̄/1.128 (the standard Individuals chart convention). Control chart rules follow the Nelson Rules (1-8). Anderson-Darling normality uses the Stephens (1974) small-sample correction.',
  whatIsTitle: 'When to use an I-MR chart',
  whatIsBody:
    'Use an I-MR chart when you have one measurement per unit or per time period — no natural subgroups (for example, one batch reading per day, or a destructive test where only one sample is available). If your process produces several measurements per subgroup instead, use an Xbar-R or Xbar-S chart.',
}
