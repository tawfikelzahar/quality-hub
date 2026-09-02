export interface DoeMessages {
  appSubtitle: string
  setupSectionTitle: string
  setupSectionHelp: string
  numFactorsLabel: string
  factorNameLabel: string
  factorLowLabel: string
  factorHighLabel: string
  replicatesLabel: string
  replicatesHint: string
  randomizeLabel: string
  loadExampleButton: string
  clearButton: string
  generateDesignButton: string
  errorTooFewFactors: string
  errorTooManyFactors: string
  errorInvalidLevels: string
  errorMissingResponses: string
  designSectionTitle: string
  designSectionHelp: string
  colRunOrder: string
  colStdOrder: string
  colReplicate: string
  colResponse: string
  responsePlaceholder: string
  runAnalysisButton: string
  backToSetupButton: string
  resultsTitle: string
  metricR2: string
  metricR2Adj: string
  metricRuns: string
  metricFactors: string
  effectsTableTitle: string
  effectsTerm: string
  effectsEffect: string
  effectsContrast: string
  effectsSS: string
  effectsPercentContribution: string
  anovaTableTitle: string
  anovaSource: string
  anovaDf: string
  anovaSS: string
  anovaMS: string
  anovaF: string
  anovaP: string
  anovaSourceError: string
  anovaSourceTotal: string
  noReplicationNote: string
  paretoTitle: string
  mainEffectsPlotTitle: string
  interactionPlotTitle: string
  interactionPlotHint: string
  equationTitle: string
  equationNote: string
  exportSectionTitle: string
  exportCsvButton: string
  exportExcelButton: string
  exportPngButton: string
  exportPdfButton: string
  pdfReportTitle: string
  footerNote: string
  requiredDataTitle: string
  requiredDataBody: string
  significantBadge: string
  notSignificantBadge: string
}

export const messages: DoeMessages = {
  appSubtitle:
    'Full Factorial (2^k) Design of Experiments: generate a coded design matrix for 2–5 factors, enter your trial results, then get effects, ANOVA, and the fitted equation.',
  setupSectionTitle: 'Step 1 — Design Setup',
  setupSectionHelp:
    'Choose how many factors you are studying (2 to 5) and set the low/high level for each. The design matrix below is generated automatically as a coded 2^k full factorial.',
  numFactorsLabel: 'Number of Factors',
  factorNameLabel: 'Factor Name',
  factorLowLabel: 'Low Level (−1)',
  factorHighLabel: 'High Level (+1)',
  replicatesLabel: 'Replicates per Run',
  replicatesHint: 'Repeating each run (2 or more replicates) lets the analysis estimate pure experimental error and compute p-values. With 1 replicate, effects are still reported but no ANOVA F-test is available.',
  randomizeLabel: 'Randomize run order',
  loadExampleButton: 'Load Example Data',
  clearButton: 'Clear',
  generateDesignButton: 'Generate Design Matrix',
  errorTooFewFactors: 'Enter at least 2 factors.',
  errorTooManyFactors: 'This tool supports up to 5 factors in the current version.',
  errorInvalidLevels: 'Each factor needs a valid, distinct low and high level.',
  errorMissingResponses: 'Enter a response value for every run before analyzing.',
  designSectionTitle: 'Step 2 — Design Matrix & Data Entry',
  designSectionHelp: 'Run each row of the table below (in the order shown) and enter the measured response for every replicate.',
  colRunOrder: 'Run Order',
  colStdOrder: 'Std Order',
  colReplicate: 'Rep',
  colResponse: 'Response',
  responsePlaceholder: 'value',
  runAnalysisButton: 'Run Analysis',
  backToSetupButton: '← Back to Setup',
  resultsTitle: 'Step 3 — Analysis Results',
  metricR2: 'R²',
  metricR2Adj: 'R² (adj)',
  metricRuns: 'Total Runs',
  metricFactors: 'Factors',
  effectsTableTitle: 'Effects & Contribution',
  effectsTerm: 'Term',
  effectsEffect: 'Effect',
  effectsContrast: 'Contrast',
  effectsSS: 'SS',
  effectsPercentContribution: '% Contribution',
  anovaTableTitle: 'Analysis of Variance (ANOVA)',
  anovaSource: 'Source',
  anovaDf: 'DF',
  anovaSS: 'SS',
  anovaMS: 'MS',
  anovaF: 'F-Value',
  anovaP: 'P-Value',
  anovaSourceError: 'Error',
  anovaSourceTotal: 'Total',
  noReplicationNote:
    'Only 1 replicate was run, so there is no pure error term to test significance against. Effects and % contribution below are still valid — use a normal/Pareto effects plot to judge which effects look practically large.',
  paretoTitle: 'Pareto of Effects',
  mainEffectsPlotTitle: 'Main Effects Plot',
  interactionPlotTitle: 'Interaction Plot',
  interactionPlotHint: 'Non-parallel lines indicate the two factors interact — the effect of one factor depends on the level of the other.',
  equationTitle: 'Fitted Equation (Coded Units)',
  equationNote:
    'Coefficients are in coded (−1 / +1) units, not the original factor units. To predict a response, substitute each factor\'s coded value (−1 at its low level, +1 at its high level).',
  exportSectionTitle: 'Export & Save',
  exportCsvButton: 'CSV',
  exportExcelButton: 'Excel',
  exportPngButton: 'PNG',
  exportPdfButton: 'PDF',
  pdfReportTitle: 'Design of Experiments — Full Factorial Study Report',
  footerNote:
    'Full factorial 2^k design. Effects are computed via Yates contrasts on design-point means; ANOVA F-test p-values use a Wilson-Hilferty approximation to the F-distribution, consistent with other statistical tools in Quality Hub.',
  requiredDataTitle: 'Required Data Structure',
  requiredDataBody:
    'A response measurement for every run of the coded 2^k design (2 to 5 factors), with 1 or more replicates per run.',
  significantBadge: 'Significant',
  notSignificantBadge: 'Not significant',
}
