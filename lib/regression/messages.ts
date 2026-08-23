export interface RegressionMessages {
  appSubtitle: string
  dataSectionTitle: string
  dataSectionHelp: string
  loadExampleButton: string
  clearDataButton: string
  responseLabel: string
  predictorLabel: string
  csvUploadLabel: string
  csvUploadHint: string
  pasteLabel: string
  pastePlaceholder: string
  readColumnsButton: string
  runAnalysisButton: string
  errorInsufficientData: string
  errorZeroVarianceX: string
  errorZeroVarianceY: string
  errorNoData: string
  errorBadColumns: string
  resultsTitle: string
  equationLabel: (slope: string, intercept: string) => string
  metricR2: string
  metricR2Adj: string
  metricSE: string
  metricN: string
  metricSlope: string
  coefTableTitle: string
  coefTerm: string
  coefValue: string
  coefSE: string
  coefT: string
  coefP: string
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
  scatterTitle: string
  residualPlotsTitle: string
  residPlotVsFits: string
  residPlotVsOrder: string
  residPlotHistogram: string
  residPlotNormal: string
  normalityNote: (aStar: string, pRange: string) => string
  durbinWatsonNote: (dw: string) => string
  predictionTitle: string
  predictionInputLabel: string
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
  requiredDataTitle: string
  requiredDataBody: string
  exampleTableTitle: string
}

export const messages: RegressionMessages = {
  appSubtitle:
    'Fit one response to one predictor with fitted-line plot, ANOVA, coefficient diagnostics, residual plots, and prediction intervals.',
  dataSectionTitle: 'Input Data',
  dataSectionHelp:
    'Upload a CSV or paste a table with headers in the first row. Rows with missing or non-numeric values in the selected columns are ignored.',
  loadExampleButton: 'Load Example Data',
  clearDataButton: 'Clear',
  responseLabel: 'Response Variable (Y)',
  predictorLabel: 'Predictor Variable (X)',
  csvUploadLabel: 'Upload CSV',
  csvUploadHint: 'First row must contain column headers.',
  pasteLabel: 'Or Paste CSV Data',
  pastePlaceholder: 'Paste comma-separated data with headers here',
  readColumnsButton: 'Read Columns',
  runAnalysisButton: 'Run Regression Analysis',
  errorInsufficientData: 'At least 3 valid data points are required to fit a regression line.',
  errorZeroVarianceX: 'The predictor (X) column has no variation — every value is the same.',
  errorZeroVarianceY: 'The response (Y) column has no variation — every value is the same.',
  errorNoData: 'No data yet. Load the example or paste/upload your own data first.',
  errorBadColumns: 'Select a response and a predictor column before running the analysis.',
  resultsTitle: 'Regression Results',
  equationLabel: (slope, intercept) => `Fitted equation: Y = ${intercept} + ${slope} · X`,
  metricR2: 'R²',
  metricR2Adj: 'R² (adj)',
  metricSE: 'S (Residual SE)',
  metricN: 'N',
  metricSlope: 'Slope',
  coefTableTitle: 'Coefficient Table',
  coefTerm: 'Term',
  coefValue: 'Coef',
  coefSE: 'SE Coef',
  coefT: 'T-Value',
  coefP: 'P-Value',
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
  scatterTitle: 'Fitted Line Plot',
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
  predictionInputLabel: 'New X value',
  predictionButton: 'Predict',
  predictionFitted: 'Fitted Value',
  predictionCI: '95% CI for Mean Response',
  predictionPI: '95% Prediction Interval (new observation)',
  exportSectionTitle: 'Export & Save',
  exportCsvButton: 'CSV',
  exportExcelButton: 'Excel',
  exportPngButton: 'PNG',
  exportPdfButton: 'PDF',
  pdfReportTitle: 'Simple Linear Regression — Study Report',
  footerNote:
    'Ordinary least squares regression. Coefficient p-values use a normal approximation to the t-distribution; ANOVA p-value uses a Wilson-Hilferty approximation to the F-distribution. Anderson-Darling uses the Stephens (1974) small-sample correction.',
  requiredDataTitle: 'Required Data Structure',
  requiredDataBody:
    'One numeric response column (Y) and one numeric predictor column (X). Any additional columns are ignored.',
  exampleTableTitle: 'Example',
}
