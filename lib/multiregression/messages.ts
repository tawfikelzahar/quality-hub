export interface MultiRegressionMessages {
  appSubtitle: string
  dataSectionTitle: string
  dataSectionHelp: string
  loadExampleButton: string
  clearDataButton: string
  responseLabel: string
  predictorsLabel: string
  predictorsHint: string
  csvUploadLabel: string
  csvUploadHint: string
  pasteLabel: string
  pastePlaceholder: string
  readColumnsButton: string
  runAnalysisButton: string
  errorInsufficientData: string
  errorTooManyPredictors: string
  errorSingularMatrix: string
  errorZeroVariancePredictor: string
  errorZeroVarianceY: string
  errorNoData: string
  errorBadColumns: string
  errorSelectPredictor: string
  resultsTitle: string
  equationLabel: string
  metricR2: string
  metricR2Adj: string
  metricSE: string
  metricN: string
  metricK: string
  coefTableTitle: string
  coefTerm: string
  coefValue: string
  coefSE: string
  coefT: string
  coefP: string
  coefVIF: string
  vifWarning: string
  anovaTableTitle: string
  anovaSource: string
  anovaDf: string
  anovaSS: string
  anovaMS: string
  anovaF: string
  anovaP: string
  anovaSourceRegression: string
  anovaSourceResidual: string
  anovaSourceTotal: string
  residualPlotsTitle: string
  residPlotVsFits: string
  residPlotVsOrder: string
  residPlotHistogram: string
  residPlotNormal: string
  normalityNote: (aStar: string, pRange: string) => string
  durbinWatsonNote: (dw: string) => string
  predictionTitle: string
  predictionButton: string
  predictionFitted: string
  predictionCI: string
  predictionPI: string
  exportSectionTitle: string
  exportCsvButton: string
  exportExcelButton: string
  exportPngButton: string
  exportPdfButton: string
  pdfReportTitle: string
  footerNote: string
}

export const messages: MultiRegressionMessages = {
  appSubtitle:
    'Fit one response to two or more predictors with coefficient diagnostics, VIF collinearity checks, ANOVA, residual plots, and prediction intervals.',
  dataSectionTitle: 'Input Data',
  dataSectionHelp:
    'Upload a CSV or paste a table with headers in the first row. Rows with missing or non-numeric values in the selected columns are ignored.',
  loadExampleButton: 'Load Example Data',
  clearDataButton: 'Clear',
  responseLabel: 'Response Variable (Y)',
  predictorsLabel: 'Predictor Variables (X)',
  predictorsHint: 'Select two or more predictor columns.',
  csvUploadLabel: 'Upload CSV',
  csvUploadHint: 'First row must contain column headers.',
  pasteLabel: 'Or Paste CSV Data',
  pastePlaceholder: 'Paste comma-separated data with headers here',
  readColumnsButton: 'Read Columns',
  runAnalysisButton: 'Run Regression Analysis',
  errorInsufficientData: 'Not enough valid rows for the number of predictors selected — need at least (predictors + 2) rows.',
  errorTooManyPredictors: 'Too many predictors for the number of data rows available. Remove a predictor or add more rows.',
  errorSingularMatrix: 'The selected predictors are perfectly collinear (one is an exact combination of the others), so a unique solution does not exist. Remove one of the redundant predictors.',
  errorZeroVariancePredictor: 'One of the selected predictor columns has no variation — every value is the same.',
  errorZeroVarianceY: 'The response (Y) column has no variation — every value is the same.',
  errorNoData: 'No data yet. Load the example or paste/upload your own data first.',
  errorBadColumns: 'Select a response column before running the analysis.',
  errorSelectPredictor: 'Select at least two predictor columns.',
  resultsTitle: 'Regression Results',
  equationLabel: 'Fitted equation',
  metricR2: 'R²',
  metricR2Adj: 'R² (adj)',
  metricSE: 'S (Residual SE)',
  metricN: 'N',
  metricK: 'Predictors (k)',
  coefTableTitle: 'Coefficient Table',
  coefTerm: 'Term',
  coefValue: 'Coef',
  coefSE: 'SE Coef',
  coefT: 'T-Value',
  coefP: 'P-Value',
  coefVIF: 'VIF',
  vifWarning: 'VIF above 5–10 signals meaningful multicollinearity — the affected coefficients become unstable and hard to interpret individually. Consider removing or combining correlated predictors.',
  anovaTableTitle: 'Analysis of Variance',
  anovaSource: 'Source',
  anovaDf: 'DF',
  anovaSS: 'Seq SS',
  anovaMS: 'Adj MS',
  anovaF: 'F-Value',
  anovaP: 'P-Value',
  anovaSourceRegression: 'Regression',
  anovaSourceResidual: 'Residual Error',
  anovaSourceTotal: 'Total',
  residualPlotsTitle: 'Residual Diagnostic Plots',
  residPlotVsFits: 'Residuals vs Fitted Values',
  residPlotVsOrder: 'Residuals vs Order',
  residPlotHistogram: 'Histogram of Residuals',
  residPlotNormal: 'Normal Probability Plot',
  normalityNote: (aStar, pRange) =>
    `Anderson-Darling normality of residuals: A* = ${aStar} (approx. P ${pRange}). Values well below the significance threshold support the normality assumption behind the coefficient and prediction intervals above.`,
  durbinWatsonNote: (dw) =>
    `Durbin-Watson statistic: ${dw} (values near 2 indicate no autocorrelation in residual order; values near 0 or 4 suggest the data may be sequence-dependent).`,
  predictionTitle: 'Prediction',
  predictionButton: 'Predict',
  predictionFitted: 'Fitted Value',
  predictionCI: '95% CI for Mean Response',
  predictionPI: '95% Prediction Interval (new observation)',
  exportSectionTitle: 'Export & Save',
  exportCsvButton: 'CSV',
  exportExcelButton: 'Excel',
  exportPngButton: 'PNG',
  exportPdfButton: 'PDF',
  pdfReportTitle: 'Multiple Linear Regression — Study Report',
  footerNote:
    'Ordinary least squares regression solved via the normal equations. Coefficient p-values use a normal approximation to the t-distribution; ANOVA p-value uses a Wilson-Hilferty approximation to the F-distribution. VIF is computed by regressing each predictor on the remaining predictors. Anderson-Darling uses the Stephens (1974) small-sample correction.',
}
