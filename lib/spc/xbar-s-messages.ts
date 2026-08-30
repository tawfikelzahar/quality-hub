export interface XbarSMessages {
  appSubtitle: string
  dataSectionTitle: string
  dataSectionHelp: string
  loadExampleButton: string
  clearDataButton: string
  csvUploadLabel: string
  csvUploadHint: string
  pasteLabel: string
  pastePlaceholder: string
  subgroupSizeLabel: string
  subgroupSizeHint: string
  specLimitsTitle: string
  lslLabel: string
  uslLabel: string
  targetLabel: string
  optionalHint: string
  runAnalysisButton: string
  errorInsufficientData: string
  errorNoData: string
  errorBadColumn: string
  errorInconsistentSubgroupSize: string
  errorSubgroupTooSmall: string
  resultsTitle: string
  chartXTitle: string
  chartSTitle: string
  metricGrandMean: string
  metricSigma: string
  metricUCL: string
  metricLCL: string
  metricN: string
  metricSubgroups: string
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

export const messages: XbarSMessages = {
  appSubtitle:
    'Build an X̄-S (Xbar-S) chart for subgrouped measurement data with larger subgroup sizes — process stability, Nelson Rules screening, and capability in one view.',
  dataSectionTitle: 'Input Data',
  dataSectionHelp:
    'Upload a CSV or paste subgrouped data — one row per subgroup, with each column holding one measurement within that subgroup (typically 10 or more measurements per subgroup).',
  loadExampleButton: 'Load Example Data',
  clearDataButton: 'Clear',
  csvUploadLabel: 'Upload CSV',
  csvUploadHint: 'One row per subgroup, one column per measurement within the subgroup. A header row is optional.',
  pasteLabel: 'Or Paste Data',
  pastePlaceholder: 'Paste one subgroup per line, comma-separated (e.g. 50.2, 49.8, 50.5, 50.1, 49.9)',
  subgroupSizeLabel: 'Subgroup Size',
  subgroupSizeHint: 'Detected automatically from your data.',
  specLimitsTitle: 'Specification Limits (optional — needed for capability indices)',
  lslLabel: 'Lower Spec Limit (LSL)',
  uslLabel: 'Upper Spec Limit (USL)',
  targetLabel: 'Target (optional, for Cpm)',
  optionalHint: 'Leave blank if not applicable.',
  runAnalysisButton: 'Run Xbar-S Analysis',
  errorInsufficientData: 'At least 3 subgroups are required to build an Xbar-S chart (20-25 subgroups is typical for a stability study).',
  errorNoData: 'No data yet. Load the example or paste/upload your own data first.',
  errorBadColumn: 'Enter subgrouped data before running the analysis.',
  errorInconsistentSubgroupSize: 'All subgroups must have the same number of measurements. Check that every row has the same number of values.',
  errorSubgroupTooSmall: 'Each subgroup needs at least 2 measurements. For single measurements with no subgroups, use the I-MR chart instead.',
  resultsTitle: 'Xbar-S Chart Results',
  chartXTitle: 'X̄ (Subgroup Average) Chart',
  chartSTitle: 'S (Standard Deviation) Chart',
  metricGrandMean: 'Grand Mean (X̿)',
  metricSigma: 'σ (pooled within-subgroup)',
  metricUCL: 'UCL',
  metricLCL: 'LCL',
  metricN: 'Subgroup Size (n)',
  metricSubgroups: 'Subgroups (k)',
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
  dataAdequacyNote: (label, n) => `${label} (N = ${n} individual measurements). More subgroups give a more reliable capability read.`,
  exportSectionTitle: 'Export & Save',
  exportCsvButton: 'CSV',
  exportExcelButton: 'Excel',
  exportPngButton: 'PNG',
  exportPdfButton: 'PDF',
  pdfReportTitle: 'Xbar-S Chart — Study Report',
  footerNote:
    'Control limits use the standard Xbar-S constants (A3, B3, B4), derived from the c4 bias-correction factor for the given subgroup size. Sigma is estimated from the pooled within-subgroup standard deviation, bias-corrected with c4. Control chart rules follow the Nelson Rules (1-8). Anderson-Darling normality uses the Stephens (1974) small-sample correction.',
  whatIsTitle: 'When to use an Xbar-S chart',
  whatIsBody:
    'Use an Xbar-S chart instead of Xbar-R when your subgroup size is larger — conventionally n ≥ 10. At larger subgroup sizes, the standard deviation (S) is a more statistically efficient estimator of within-subgroup spread than the range (R), which becomes less reliable as more points are added. For smaller subgroups (n < 10), an Xbar-R chart is simpler and works just as well. For a single measurement per unit with no subgroups, use an I-MR chart instead.',
}
