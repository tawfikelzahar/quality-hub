export interface XbarRMessages {
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
  chartRTitle: string
  histogramTitle: string
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

export const messages: XbarRMessages = {
  appSubtitle:
    'Build an X̄-R (Xbar-R) chart for subgrouped measurement data — process stability, Nelson Rules screening, and capability in one view.',
  dataSectionTitle: 'Input Data',
  dataSectionHelp:
    'Upload a CSV or paste subgrouped data — one row per subgroup, with each column holding one measurement within that subgroup (2 to 10 measurements per subgroup).',
  loadExampleButton: 'Load Example Data',
  clearDataButton: 'Clear',
  csvUploadLabel: 'Upload CSV',
  csvUploadHint: 'One row per subgroup, one column per measurement within the subgroup. A header row is optional.',
  pasteLabel: 'Or Paste Data',
  pastePlaceholder: 'Paste one subgroup per line, comma-separated (e.g. 10.1, 10.3, 9.9, 10.2)',
  subgroupSizeLabel: 'Subgroup Size',
  subgroupSizeHint: 'Detected automatically from your data (2–10 measurements per subgroup).',
  specLimitsTitle: 'Specification Limits (optional — needed for capability indices)',
  lslLabel: 'Lower Spec Limit (LSL)',
  uslLabel: 'Upper Spec Limit (USL)',
  targetLabel: 'Target (optional, for Cpm)',
  optionalHint: 'Leave blank if not applicable.',
  runAnalysisButton: 'Run Xbar-R Analysis',
  errorInsufficientData: 'At least 3 subgroups are required to build an Xbar-R chart (20-25 subgroups is typical for a stability study).',
  errorNoData: 'No data yet. Load the example or paste/upload your own data first.',
  errorBadColumn: 'Enter subgrouped data before running the analysis.',
  errorInconsistentSubgroupSize: 'All subgroups must have the same number of measurements. Check that every row has the same number of values.',
  errorSubgroupTooSmall: 'Each subgroup needs at least 2 measurements. For single measurements with no subgroups, use the I-MR chart instead.',
  resultsTitle: 'Xbar-R Chart Results',
  chartXTitle: 'X̄ (Subgroup Average) Chart',
  chartRTitle: 'R (Range) Chart',
  histogramTitle: 'Capability Histogram (Overall vs. Within)',
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
      ? `Anderson-Darling normality test: ${pValue}. Data is consistent with a normal distribution.`
      : `Anderson-Darling normality test: ${pValue}. Data departs from normality. Cp/Cpk and Pp/Ppk are still shown, as Minitab does, but all of them assume normal data, so treat them as approximate; the capability verdict uses Ppk.`,
  dataAdequacyNote: (label, n) => `${label} (N = ${n} individual measurements). More subgroups give a more reliable capability read.`,
  exportSectionTitle: 'Export & Save',
  exportCsvButton: 'CSV',
  exportExcelButton: 'Excel',
  exportPngButton: 'PNG',
  exportPdfButton: 'PDF',
  pdfReportTitle: 'Xbar-R Chart — Study Report',
  footerNote:
    'Control limits follow the Minitab R̄ method: σ = R̄/d2, X̄ limits = X̿ ± 3σ/√n, R limits = R̄ ± 3·d3·σ (Minitab d2/d3 unbiasing constants). Capability uses σ within = pooled standard deviation / c4 (the Minitab default). Control chart rules follow the Nelson Rules (1-8). Anderson-Darling: AD is reported as in Minitab; its p-value uses the Stephens (1974) small-sample adjustment.',
  whatIsTitle: 'When to use an Xbar-R chart',
  whatIsBody:
    'Use an Xbar-R chart when your process naturally produces several measurements per subgroup (for example, 4-5 units sampled every hour, or 3 measurements per batch). It tracks both the subgroup average (X̄) and the within-subgroup spread (R). For a single measurement per unit with no natural subgroups, use an I-MR chart instead. For larger subgroups (n ≥ 10), consider an Xbar-S chart, which uses the standard deviation instead of the range.',
}
