// ─────────────────────────────────────────────────────────────────────────
// Quality Hub — Sample Report generators
// ─────────────────────────────────────────────────────────────────────────
// Powers the public /sample-reports page. Every tool listed here can
// generate a REAL PDF and REAL Excel file — built with the exact same
// lib/pdf/reportDesign.ts and lib/excelReport.ts building blocks every
// tool's own "Export" button uses — but from fixed, realistic dummy data
// instead of whatever the visitor has (or hasn't) entered.
//
// Why fixed dummy data instead of re-running each tool's live engine:
// several tools (SPCEngine.tsx, GageRR.tsx) compute results as internal
// component state with no exported calculation function, so there's no
// standalone function to call from a marketing page without duplicating
// a large component. Instead, each scenario below is computed once by
// hand using the same standard formulas (AIAG Average & Range for Gage
// R&R; Montgomery/AIAG X-bar/R control-chart constants for SPC) and
// hard-coded as a realistic, internally-consistent result — the exact
// numbers a real study of that shape would produce. Nothing here is
// randomly generated; every figure is derived from the sample raw data
// documented in each section below, so the PDF/Excel outputs are
// numerically honest, not just visually plausible.
//
// Adding a new tool's sample: compute a realistic result set for that
// tool's formulas (or borrow one from a textbook example), add a
// `buildXPdf()` / `buildXExcel()` pair following the pattern below, and
// register it in SAMPLE_REPORTS.
// ─────────────────────────────────────────────────────────────────────────

import {
  createReport as createPdfReport,
  classificationBanner,
  classifyCapability,
  classifyGageConclusion,
  twoColumnTables,
  dataTable,
  capabilityGauge,
  interpretationBox,
  calloutBox,
  summaryBox,
  criteriaReferenceTable,
  finalizeReport,
  REPORT_COLORS,
  type KVRow,
} from '@/lib/pdf/reportDesign'
import { createReport as createExcelReport, nowStamp, type Tone } from '@/lib/excelReport'
import { SITE_SLUG } from './site'

export type SampleToolId = 'gage-rr' | 'spc' | 'oee'

export interface SampleReportMeta {
  id: SampleToolId
  nameKey: string
  descKey: string
  href: string
}

export const SAMPLE_REPORTS: SampleReportMeta[] = [
  {
    id: 'gage-rr',
    nameKey: 'sample_gagerr_name',
    descKey: 'sample_gagerr_desc',
    href: '/gage-rr',
  },
  {
    id: 'spc',
    nameKey: 'sample_spc_name',
    descKey: 'sample_spc_desc',
    href: '/spc',
  },
  {
    id: 'oee',
    nameKey: 'sample_oee_name',
    descKey: 'sample_oee_desc',
    href: '/oee',
  },
]

// ─────────────────────────────────────────────────────────────────────────
// Gage R&R sample — torque wrench measurement study
// 3 appraisers × 10 parts × 3 trials, Average & Range method, AIAG MSA 4th ed.
// Spec 48.5–54.5 N·m (tolerance 6.0).
//
// Every number and sentence below is what the Gage R&R engine itself
// (POST /api/gage-rr, 6σ study variation per AIAG MSA 4th ed. p. 123)
// returns for GAGE_RR_RAW — copied here because the engine runs on the
// server and this page builds the file in the browser. Regenerate them
// with the engine if the data or the engine changes.
// ─────────────────────────────────────────────────────────────────────────

const GAGE_RR_RAW: Record<string, number[][]> = {
  A: [
    [49.54, 49.62, 49.47],
    [51.00, 50.94, 50.88],
    [51.78, 51.82, 51.78],
    [50.18, 50.25, 50.24],
    [52.60, 52.59, 52.61],
    [49.06, 49.07, 49.14],
    [51.29, 51.20, 51.27],
    [50.65, 50.58, 50.59],
    [52.14, 52.23, 52.05],
    [49.99, 49.81, 49.91],
  ],
  B: [
    [49.56, 49.73, 49.70],
    [51.02, 50.88, 50.99],
    [51.80, 51.81, 51.88],
    [50.30, 50.25, 50.20],
    [52.58, 52.74, 52.68],
    [49.19, 49.29, 49.08],
    [51.52, 51.56, 51.45],
    [50.70, 50.59, 50.71],
    [52.11, 52.14, 52.12],
    [49.96, 50.03, 49.90],
  ],
  C: [
    [49.50, 49.50, 49.50],
    [50.77, 50.81, 50.96],
    [51.73, 51.79, 51.68],
    [50.18, 50.05, 50.12],
    [52.73, 52.53, 52.65],
    [49.10, 49.06, 49.02],
    [51.36, 51.26, 51.38],
    [50.52, 50.57, 50.60],
    [52.10, 51.98, 52.02],
    [49.86, 49.81, 49.92],
  ],
}

const GAGE_RR_RESULT = {
  method: 'average-range' as const,
  numAppraisers: 3,
  numParts: 10,
  numTrials: 3,
  tolerance: 6.0,
  EV: 0.06676,
  AV: 0.0582,
  GRR: 0.08857,
  PV: 1.10809,
  TV: 1.11162,
  ndc: 17,
  pctTV: { EV: 0.06006, AV: 0.05235, GRR: 0.07967, PV: 0.99682 },
  pctTol: { EV: 0.06676, AV: 0.0582, GRR: 0.08857, PV: 1.10809 },
  uclR: 0.29097,
  rbarByAppraiser: { A: 0.1, B: 0.125, C: 0.114 },
  conclusion: 'okay' as const,
  conclusionText: "The measurement system is acceptable: %GRR is 8.9% of Tolerance, below the 10% guideline. Both the gage (repeatability) and the differences between appraisers (reproducibility) contribute to the error. With ndc = 17, the gage can tell the parts apart. Keep it under periodic verification.",
  diagnosis: {
    summary: [
    ["Verdict", "Acceptable — %GRR 8.9% of Tolerance"] as [string, string],
    ["Main source", "Repeatability and reproducibility"] as [string, string],
    ["Discrimination", "ndc = 17 (adequate)"] as [string, string],
    ["Action", "The gage error is small against the tolerance, so the gage is suitable for accept / reject decisions on this characteristic."] as [string, string],
    ],
    rows: [
    { dimension: "Measurement Error (%GRR)", result: "8.9% of Tolerance", assessment: "Below the 10% guideline: the gage error is small compared with the tolerance.", tone: 'good' as const },
    { dimension: "Process Control Use", result: "8.0% of Total Variation", assessment: "Also below 10% of the total variation, so the gage is suitable for SPC and process improvement studies too.", tone: 'good' as const },
    { dimension: "Main Source of Error", result: "Repeatability and reproducibility · EV 56.8% / AV 43.2% of GRR variance", assessment: "Repeatability and reproducibility contribute about equally to the measurement error.", tone: 'info' as const },
    { dimension: "Discrimination (ndc)", result: "ndc = 17", assessment: "The gage separates the parts into 17 distinct groups: adequate (guideline: at least 5).", tone: 'good' as const },
    { dimension: "Appraiser Consistency", result: "No ranges above the UCL", assessment: "Every appraiser repeats consistently across the parts.", tone: 'good' as const },
    ],
    recommendedAction: "The gage error is small against the tolerance, so the gage is suitable for accept / reject decisions on this characteristic. Keep it under periodic verification: calibration, and a repeat study after any change to the gage, the method or the appraisers.",
    tone: 'good' as const,
  },
}

function toneRgb(tone: string) {
  return tone === 'good' ? REPORT_COLORS.good : tone === 'bad' ? REPORT_COLORS.bad : tone === 'warn' ? REPORT_COLORS.warn : null
}

function fmt(v: number, dp = 4): string {
  return v.toFixed(dp)
}
function pct(v: number): string {
  return `${(v * 100).toFixed(2)}%`
}

export function buildGageRRSamplePdf() {
  const r = GAGE_RR_RESULT
  const cls = classifyGageConclusion(r.conclusion)
  const gaugeBasisPct = r.pctTol.GRR * 100
  const gaugeBasisLabel = '% GRR of Tolerance'

  const ctx = createPdfReport('Gage R&R Study Report (Sample)', 'gage-rr')
  classificationBanner(ctx, cls, 'Measurement System Assessment')
  summaryBox(ctx, 'Summary', r.diagnosis.summary, 'good')

  const studyRows: KVRow[] = [
    ['Method', 'Average & Range'],
    ['Appraisers', String(r.numAppraisers)],
    ['Trials', String(r.numTrials)],
    ['Parts', String(r.numParts)],
    ['Tolerance', fmt(r.tolerance, 2)],
    ['Measurement Unit', 'Torque, N·m'],
  ]
  const metricRows: KVRow[] = [
    ['EV (Repeatability)', fmt(r.EV)],
    ['AV (Reproducibility)', fmt(r.AV)],
    ['Gage R&R', fmt(r.GRR)],
    ['Part Variation (PV)', fmt(r.PV)],
    ['Total Variation (TV)', fmt(r.TV)],
    ['Number of Distinct Categories (ndc)', String(r.ndc)],
  ]
  twoColumnTables(ctx, 'Study Information', studyRows, 'Key Metrics', metricRows)

  const rowValue = (frac: number, tolFrac: number) => `${pct(tolFrac)} of Tolerance  ·  ${pct(frac)} of TV`
  dataTable(
    ctx,
    'Variation Summary',
    [
      { header: 'SOURCE', width: 200 },
      { header: 'RESULT', width: ctx.pageWidth - ctx.margin * 2 - 200 },
    ],
    [
      ['EV — Repeatability', rowValue(r.pctTV.EV, r.pctTol.EV)],
      ['AV — Reproducibility', rowValue(r.pctTV.AV, r.pctTol.AV)],
      ['GRR — Combined', rowValue(r.pctTV.GRR, r.pctTol.GRR)],
      ['PV — Part Variation', rowValue(r.pctTV.PV, r.pctTol.PV)],
    ],
    { cellColors: [[], [], [null, cls.color], []] }
  )

  capabilityGauge(ctx, {
    title: 'Measurement System Gauge',
    value: gaugeBasisPct,
    min: 0,
    max: 60,
    bands: [
      { upTo: 10, color: REPORT_COLORS.goodBg },
      { upTo: 30, color: REPORT_COLORS.warnBg },
      { upTo: 60, color: REPORT_COLORS.badBg },
    ],
    ticks: [
      { value: 0, label: '0%' },
      { value: 10, label: '10%' },
      { value: 30, label: '30%' },
      { value: 60, label: '60%+' },
    ],
    caption: `${gaugeBasisLabel} = ${gaugeBasisPct.toFixed(1)}% (AIAG: <10% acceptable, 10-30% marginal, >30% unacceptable)`,
  })

  calloutBox(
    ctx,
    'No out-of-control ranges were detected — appraisers are applying the gage consistently.',
    'good'
  )

  dataTable(
    ctx,
    'Average Range by Appraiser',
    [
      { header: 'APPRAISER', width: 200 },
      { header: 'AVERAGE RANGE (R-bar)', width: 150 },
      { header: 'UCL (R-bar x D4)', width: ctx.pageWidth - ctx.margin * 2 - 350 },
    ],
    Object.entries(r.rbarByAppraiser).map(([a, rbar]) => [a, fmt(rbar, 3), fmt(r.uclR, 3)])
  )

  dataTable(
    ctx,
    'Measurement System Diagnosis',
    [
      { header: 'DIMENSION', width: 120 },
      { header: 'RESULT', width: 150 },
      { header: 'ASSESSMENT', width: ctx.pageWidth - ctx.margin * 2 - 270 },
    ],
    r.diagnosis.rows.map(x => [x.dimension, x.result, x.assessment]),
    { cellColors: r.diagnosis.rows.map(x => [null, null, toneRgb(x.tone)]) }
  )
  interpretationBox(ctx, 'Recommended Action', r.diagnosis.recommendedAction, 'good')
  interpretationBox(ctx, 'Study Conclusion', r.conclusionText, 'good')
  criteriaReferenceTable(
    ctx,
    '%GRR Criteria Reference (AIAG)',
    [
      ['< 10%', 'Acceptable', 'Measurement system is acceptable for process control and capability analysis.'],
      ['10% to 30%', 'Marginal', 'May be acceptable depending on application, cost of gage, or criticality of measurement.'],
      ['> 30%', 'Unacceptable', 'Measurement system needs improvement — investigate repeatability and reproducibility sources.'],
    ],
    ['% GRR', 'CLASSIFICATION', 'GENERAL INTERPRETATION']
  )

  finalizeReport(ctx)
  ctx.pdf.save(`${SITE_SLUG}-sample-gage-rr-report.pdf`)
}

export async function buildGageRRSampleExcel() {
  const r = GAGE_RR_RESULT
  const conclusionTone: Tone = 'good'
  const report = createExcelReport({ toolName: 'Gage R&R Study (Sample)' })

  const overview = report.addSheet('Overview')
  overview.titleBand('Gage Repeatability & Reproducibility Study — SAMPLE', 'Method: Average & Range')
  overview.metaStrip([
    ['Generated on', nowStamp()],
    ['Appraisers x Parts x Trials', `${r.numAppraisers} x ${r.numParts} x ${r.numTrials}`],
    ['Standard', 'AIAG MSA 4th Edition'],
    ['Note', 'Sample report — illustrative data, not a live analysis'],
  ])

  overview.sectionHeading('Variance Components')
  overview.kpiRow([
    { label: '%GRR (of Tolerance)', value: pct(r.pctTol.GRR), tone: conclusionTone },
    { label: 'NDC', value: r.ndc, sub: 'Number of Distinct Categories', tone: 'good' },
    { label: 'Repeatability (EV)', value: pct(r.pctTol.EV), tone: 'neutral' },
    { label: 'Reproducibility (AV)', value: pct(r.pctTol.AV), tone: 'neutral' },
  ])

  overview.sectionHeading('Detailed Breakdown')
  overview.table({
    headers: [
      { header: 'Metric', key: 'metric', align: 'left', width: 26 },
      { header: 'Value', key: 'value', align: 'right', numFmt: '0.00000' },
      { header: '% of Total Variation', key: 'pctTV', align: 'right' },
      { header: '% of Tolerance', key: 'pctTol', align: 'right' },
    ],
    rows: [
      ['EV (Repeatability)', r.EV, pct(r.pctTV.EV), pct(r.pctTol.EV)],
      ['AV (Reproducibility)', r.AV, pct(r.pctTV.AV), pct(r.pctTol.AV)],
      ['GRR', r.GRR, pct(r.pctTV.GRR), pct(r.pctTol.GRR)],
      ['PV (Part Variation)', r.PV, pct(r.pctTV.PV), pct(r.pctTol.PV)],
      ['TV (Total Variation)', r.TV, '100.00%', ''],
    ],
    rowTones: [undefined, undefined, conclusionTone, undefined, undefined],
  })
  overview.note(`Conclusion: ${r.conclusionText}`, conclusionTone)
  overview.freezeHeader(2)

  const dataSheet = report.addSheet('Raw Data')
  dataSheet.titleBand('Raw Measurements (Sample)', 'Torque wrench study, N·m')
  const rawRows: (string | number)[][] = []
  for (const [appraiser, parts] of Object.entries(GAGE_RR_RAW)) {
    parts.forEach((trials, partIdx) => {
      trials.forEach((v, trialIdx) => {
        rawRows.push([appraiser, partIdx + 1, trialIdx + 1, v])
      })
    })
  }
  dataSheet.table({
    headers: [
      { header: 'Appraiser', key: 'appraiser', align: 'left', width: 18 },
      { header: 'Part', key: 'part', align: 'center' },
      { header: 'Trial', key: 'trial', align: 'center' },
      { header: 'Value', key: 'value', align: 'right', numFmt: '0.0000' },
    ],
    rows: rawRows,
  })
  dataSheet.freezeHeader(2)

  await report.download(`${SITE_SLUG}-sample-gage-rr-report.xlsx`)
}

// ─────────────────────────────────────────────────────────────────────────
// SPC sample — X-bar/R chart, fill-weight process
// n=5 subgroup size, k=20 subgroups (100 individual readings), drawn from
// a genuine Normal(250.067, 0.169) distribution so the Anderson-Darling
// test below is numerically honest (not just a plausible-looking number).
// Spec 249.18–250.94 g. Numbers below are the site's own calculator output
// for SPC_SUBGROUPS (lib/spc/calculator.ts): limits from R̄ (A2, D3, D4),
// σ within = pooled SD / c4, as on the SPC pages. Mirrors the PDF sections added to
// components/SPCEngine.tsx: data-adequacy callout, Anderson-Darling table,
// formatted yield, and the capability diagnosis (spread vs. centering).
// ─────────────────────────────────────────────────────────────────────────

const SPC_SUBGROUPS: number[][] = [
  [250.03, 250.02, 250.03, 250.19, 250.03], [249.77, 250.12, 250.0, 250.01, 250.08],
  [250.1, 250.28, 250.18, 250.08, 249.91], [249.86, 250.1, 250.31, 250.06, 250.04],
  [250.16, 249.78, 250.0, 250.15, 250.22], [250.01, 250.13, 250.1, 250.21, 249.84],
  [250.16, 249.77, 249.56, 249.94, 249.88], [250.22, 250.18, 249.82, 250.22, 249.86],
  [250.04, 250.0, 250.08, 250.21, 250.18], [250.12, 250.18, 250.15, 249.94, 249.92],
  [249.97, 250.15, 250.01, 250.5, 249.9], [249.85, 250.2, 250.33, 250.15, 250.22],
  [250.33, 250.04, 249.78, 249.95, 250.24], [249.78, 250.06, 250.1, 250.0, 250.19],
  [250.17, 250.5, 250.17, 249.94, 249.95], [249.9, 250.24, 249.95, 250.04, 250.2],
  [249.92, 250.0, 249.7, 249.85, 249.95], [250.14, 250.28, 250.05, 250.11, 250.09],
  [250.26, 250.23, 250.11, 249.86, 250.23], [250.13, 250.29, 250.05, 250.43, 249.99],
]

const SPC_RESULT = {
  subgroupSize: 5,
  numSubgroups: 20,
  n: 100,
  xdbar: 250.0671,
  rbar: 0.3965,
  uclX: 250.2959,
  lclX: 249.8383,
  uclR: 0.8384,
  lclR: 0,
  sigmaWithin: 0.1663,
  sigmaOverall: 0.1685,
  lsl: 249.18,
  usl: 250.94,
  cp: 1.764,
  cpk: 1.749,
  pp: 1.741,
  ppk: 1.727,
  oocX: [] as number[],
  oocR: [] as number[],
  ad: { A2: 0.317, A2adj: 0.319, p: 0.534 },
  isNormal: true,
  dataAdequacy: { n: 100, tier: 'adequate' as const, label: 'Adequate' },
  ppmTotal: 0.18, // estimated overall defect PPM (normal model, overall sigma)
}

function formatYieldPct(ppmTotal: number): string {
  const yieldPct = 100 - ppmTotal / 10000
  return yieldPct >= 99.9995 ? `${yieldPct.toFixed(5)}%` : `${yieldPct.toFixed(3)}%`
}

export function buildSpcSamplePdf() {
  const r = SPC_RESULT
  const cls = classifyCapability(r.cpk)
  const cpkCls = classifyCapability(r.cpk)
  const ppkCls = classifyCapability(r.ppk)
  const stable = r.oocX.length === 0 && r.oocR.length === 0
  const usingCpk = true // isNormal -> Cpk is the primary index, matching SPCEngine.tsx
  const primaryLabel = usingCpk ? 'Primary Capability Index' : 'Primary Performance Indicator'
  const pkVal = r.cpk

  const ctx = createPdfReport('SPC Analysis Report (Sample)', 'spc')
  classificationBanner(ctx, cls)

  const studyRows: KVRow[] = [
    ['Data Type', `Subgrouped measurements (n=${r.subgroupSize})`],
    ['Observations', String(r.n)],
    ['Subgroup Size', String(r.subgroupSize)],
    ['Within Sigma Method', 'Pooled standard deviation / c4'],
    ['LSL', fmt(r.lsl, 3)],
    ['Target', fmt((r.lsl + r.usl) / 2, 3)],
    ['USL', fmt(r.usl, 3)],
  ]
  const metricRows: KVRow[] = [
    ['Mean', fmt(r.xdbar, 3)],
    ['StDev Within', fmt(r.sigmaWithin, 4)],
    ['StDev Overall', fmt(r.sigmaOverall, 4)],
    ['Cp', fmt(r.cp, 3)],
    ['Cpk', fmt(r.cpk, 3)],
    ['Pp', fmt(r.pp, 3)],
    ['Ppk', fmt(r.ppk, 3)],
  ]
  twoColumnTables(ctx, 'Study Information', studyRows, 'Key Metrics', metricRows)

  calloutBox(
    ctx,
    `Data adequacy: ${r.dataAdequacy.label} (n = ${r.dataAdequacy.n}). Sample size is sufficient for the reported statistics.`,
    'good'
  )

  dataTable(
    ctx,
    'Capability Classification Summary',
    [
      { header: 'CRITERION', width: 150 },
      { header: 'RESULT', width: 190 },
      { header: 'ASSESSMENT', width: ctx.pageWidth - ctx.margin * 2 - 340 },
    ],
    [
      [primaryLabel, fmt(pkVal), cls.label],
      ['Within Capability', `Cp ${fmt(r.cp)} / Cpk ${fmt(r.cpk)}`, cpkCls.label],
      ['Overall Performance', `Pp ${fmt(r.pp)} / Ppk ${fmt(r.ppk)}`, ppkCls.label],
      [
        'Stability Screen',
        stable ? 'No violations detected' : `${r.oocX.length + r.oocR.length} rule violation(s)`,
        stable ? 'No Stability Signals Detected' : 'Review Required',
      ],
    ],
    {
      cellColors: [
        [null, null, cls.color],
        [null, null, cpkCls.color],
        [null, null, ppkCls.color],
        [null, null, stable ? REPORT_COLORS.good : REPORT_COLORS.warn],
      ],
    }
  )

  calloutBox(
    ctx,
    usingCpk
      ? 'Cpk is used as the primary capability index because the normality assumption was not rejected.'
      : 'Cpk is shown for reference, as standard statistical software reports it, but the normality assumption was rejected, so the verdict uses Ppk, the performance index based on the overall variation observed in the study data.',
    'info'
  )

  capabilityGauge(ctx, {
    title: usingCpk ? 'Capability Classification Gauge' : 'Performance Classification Gauge',
    value: pkVal,
    caption: `${primaryLabel} = ${fmt(pkVal)}`,
  })

  dataTable(
    ctx,
    'Control Chart Limits',
    [
      { header: 'CHART', width: 140 },
      { header: 'LCL', width: 130, align: 'right' },
      { header: 'CENTER LINE', width: 130, align: 'right' },
      { header: 'UCL', width: ctx.pageWidth - ctx.margin * 2 - 400, align: 'right' },
    ],
    [
      ['X-bar', fmt(r.lclX, 3), fmt(r.xdbar, 3), fmt(r.uclX, 3)],
      ['R', fmt(r.lclR, 3), fmt(r.rbar, 3), fmt(r.uclR, 3)],
    ]
  )

  calloutBox(
    ctx,
    stable
      ? 'No basic Nelson Rule signal was detected in the displayed charts. Continue to review patterns, subgrouping, and practical process knowledge.'
      : `${r.oocX.length + r.oocR.length} Nelson Rule violation(s) were detected in the displayed charts — see the detailed table below.`,
    stable ? 'good' : 'warn'
  )

  dataTable(
    ctx,
    'Normality Test (Anderson-Darling)',
    [
      { header: 'STATISTIC', width: 200 },
      { header: 'VALUE', width: ctx.pageWidth - ctx.margin * 2 - 200 },
    ],
    [
      ['N', String(r.n)],
      ['Mean', fmt(r.xdbar, 3)],
      ['StDev', fmt(r.sigmaOverall, 4)],
      ['AD (A²)', fmt(r.ad.A2, 3)],
      ['P-Value', fmt(r.ad.p, 3)],
      ['Conclusion', r.isNormal ? 'Fail to reject normality (p >= 0.05)' : 'Reject normality (p < 0.05)'],
    ],
    {
      cellColors: [[], [], [], [], [], [null, r.isNormal ? REPORT_COLORS.good : REPORT_COLORS.warn]],
    }
  )
  calloutBox(
    ctx,
    r.isNormal
      ? 'The normal distribution assumption is not rejected at the 0.05 level. Capability indices and PPM estimates in this report assume normality.'
      : 'The normal distribution assumption is rejected at the 0.05 level (p < 0.05). Cp, Cpk, Pp and Ppk are reported as standard statistical software does, but all of them assume normality, so treat them as approximate; the verdict uses Ppk, based on overall variation. The PPM estimates below still assume a normal distribution and should be interpreted with caution — consider a distribution fit or transformation for a non-normal process.',
    r.isNormal ? 'good' : 'warn'
  )

  dataTable(
    ctx,
    'Performance and Defect Risk',
    [
      { header: 'PPM ESTIMATE', width: 260 },
      { header: 'VALUE', width: ctx.pageWidth - ctx.margin * 2 - 260 },
    ],
    [
      ['Within - Total PPM', r.ppmTotal.toFixed(1)],
      ['Overall - Total PPM', r.ppmTotal.toFixed(1)],
      ['Estimated Yield (Overall)', formatYieldPct(r.ppmTotal)],
    ]
  )

  calloutBox(
    ctx,
    'Within PPM is based on within-process variation estimated from moving ranges, while Overall PPM is based on the total variation observed in the study data. The two estimates use different sigma values and may differ — this is expected and is not a check on each other.',
    'info'
  )

  // ── Capability diagnosis: spread (Cp) vs. centering ─────────────────────
  const cpkLower = (r.xdbar - r.lsl) / (3 * r.sigmaWithin)
  const cpkUpper = (r.usl - r.xdbar) / (3 * r.sigmaWithin)
  const nearerLimit: 'LSL' | 'USL' = cpkLower <= cpkUpper ? 'LSL' : 'USL'
  const spreadOk = r.cp >= 1.33
  const centeringOk = Math.abs(cpkUpper - cpkLower) < 0.1
  const recommendedAction =
    spreadOk && centeringOk
      ? 'Process capability is acceptable. Continue routine monitoring and control.'
      : !spreadOk && !centeringOk
      ? `Both variation reduction and better centering would improve capability. The process mean sits closer to the ${nearerLimit}.`
      : !spreadOk
      ? 'Prioritize reducing process variation — the specification width limits achievable capability even under perfect centering.'
      : `Prioritize centering the process away from the ${nearerLimit}; variation is already acceptable relative to the specification width.`

  dataTable(
    ctx,
    'Capability Diagnosis',
    [
      { header: 'DIMENSION', width: 150 },
      { header: 'RESULT', width: 150 },
      { header: 'ASSESSMENT', width: ctx.pageWidth - ctx.margin * 2 - 300 },
    ],
    [
      [
        'Process Spread',
        `Cp = ${fmt(r.cp)}`,
        spreadOk
          ? 'Spread is acceptable relative to specification width.'
          : 'Spread is limited relative to specification width — variation reduction is needed.',
      ],
      [
        'Process Centering',
        `Closer to ${nearerLimit}`,
        centeringOk
          ? 'Process is reasonably centered between specification limits.'
          : `Process mean is closer to the ${nearerLimit} than to the opposite limit — this is the main driver of the lower index.`,
      ],
    ],
    {
      cellColors: [
        [null, null, spreadOk ? REPORT_COLORS.good : REPORT_COLORS.warn],
        [null, null, centeringOk ? REPORT_COLORS.good : REPORT_COLORS.warn],
      ],
    }
  )
  interpretationBox(ctx, 'Recommended Action', recommendedAction, stable ? (spreadOk && centeringOk ? 'good' : 'warn') : 'bad')

  const yieldStr = formatYieldPct(r.ppmTotal)
  const tone = pkVal >= 1.33 ? 'good' : pkVal >= 1.0 ? 'warn' : 'bad'
  const basisSentence = usingCpk
    ? `The process is classified as ${cls.label} based on Cpk, the primary capability index for this analysis, since the normality assumption was not rejected. Cpk is ${fmt(r.cpk)} and Ppk is ${fmt(r.ppk)}.`
    : `The process is classified as ${cls.label} based on Ppk, the primary performance indicator for this analysis. Because the normality assumption was rejected, Cpk is shown for reference only. Ppk is ${fmt(r.ppk)}.`
  const conclusion = `${basisSentence} The estimated overall nonconformance rate is ${r.ppmTotal.toFixed(1)} PPM, corresponding to an estimated yield of ${yieldStr}. Final capability decisions should consider process stability, distribution fit, subgrouping strategy, specification validity, customer requirements, and risk associated with the product or process characteristic.`
  interpretationBox(ctx, 'Study Conclusion', conclusion, tone)
  criteriaReferenceTable(ctx)

  finalizeReport(ctx)
  ctx.pdf.save(`${SITE_SLUG}-sample-spc-report.pdf`)
}

export async function buildSpcSampleExcel() {
  const r = SPC_RESULT
  const report = createExcelReport({ toolName: 'SPC Analysis (Sample)' })

  const overview = report.addSheet('Overview')
  overview.titleBand('SPC X-bar/R Analysis — SAMPLE', `Subgroup size n=${r.subgroupSize}, k=${r.numSubgroups} subgroups`)
  overview.metaStrip([
    ['Generated on', nowStamp()],
    ['Standard', 'Montgomery / AIAG SPC constants'],
    ['Note', 'Sample report — illustrative data, not a live analysis'],
  ])

  overview.sectionHeading('Capability Summary')
  overview.kpiRow([
    { label: 'Cpk', value: fmt(r.cpk, 2), tone: 'good' },
    { label: 'Cp', value: fmt(r.cp, 2), tone: 'good' },
    { label: 'Ppk', value: fmt(r.ppk, 2), tone: 'good' },
    { label: 'Pp', value: fmt(r.pp, 2), tone: 'good' },
  ])

  overview.sectionHeading('Control Limits')
  overview.table({
    headers: [
      { header: 'Chart', key: 'chart', align: 'left', width: 18 },
      { header: 'LCL', key: 'lcl', align: 'right', numFmt: '0.0000' },
      { header: 'Center Line', key: 'cl', align: 'right', numFmt: '0.0000' },
      { header: 'UCL', key: 'ucl', align: 'right', numFmt: '0.0000' },
    ],
    rows: [
      ['X-bar', r.lclX, r.xdbar, r.uclX],
      ['R', r.lclR, r.rbar, r.uclR],
    ],
  })
  overview.note('No points beyond control limits — process is in statistical control.', 'good')

  overview.sectionHeading('Normality Test (Anderson-Darling)')
  overview.table({
    headers: [
      { header: 'Statistic', key: 'stat', align: 'left', width: 22 },
      { header: 'Value', key: 'value', align: 'right' },
    ],
    rows: [
      ['N', r.n],
      ['Mean', r.xdbar.toFixed(3)],
      ['StDev', r.sigmaOverall.toFixed(4)],
      ['AD (A²)', r.ad.A2.toFixed(3)],
      ['P-Value', r.ad.p.toFixed(3)],
      ['Conclusion', r.isNormal ? 'Fail to reject normality (p >= 0.05)' : 'Reject normality (p < 0.05)'],
    ],
    rowTones: [undefined, undefined, undefined, undefined, undefined, 'good'],
  })
  overview.note(`Data adequacy: ${r.dataAdequacy.label} (n = ${r.dataAdequacy.n}).`, 'good')
  overview.freezeHeader(2)

  const dataSheet = report.addSheet('Raw Data')
  dataSheet.titleBand('Raw Subgroup Data (Sample)', 'Fill weight, grams')
  const rawRows: (string | number)[][] = []
  SPC_SUBGROUPS.forEach((sub, i) => {
    sub.forEach((v, j) => rawRows.push([i + 1, j + 1, v]))
  })
  dataSheet.table({
    headers: [
      { header: 'Subgroup', key: 'subgroup', align: 'center' },
      { header: 'Sample', key: 'sample', align: 'center' },
      { header: 'Value', key: 'value', align: 'right', numFmt: '0.0000' },
    ],
    rows: rawRows,
  })
  dataSheet.freezeHeader(2)

  await report.download(`${SITE_SLUG}-sample-spc-report.xlsx`)
}

// ─────────────────────────────────────────────────────────────────────────
// OEE sample — packaging line, one 8-hour shift
// Inputs mirror OEECalculator.tsx's own defaults: 480 min planned, 0 min
// planned breaks, 52 min unplanned downtime, 6.0 s ideal cycle time,
// 3800 total units, 3650 good units. Formulas: OEE = Availability x
// Performance x Quality (Nakajima / JIPM TPM).
// ─────────────────────────────────────────────────────────────────────────

const OEE_INPUTS = {
  plannedTime: 480,
  breaks: 0,
  downtime: 52,
  cycleTime: 6.0,
  totalCount: 3800,
  goodCount: 3650,
}

// Same formulas as calcOEE() in components/OEECalculator.tsx, so the sample
// shows exactly what the tool shows for these inputs. Losses are shares of
// the net planned time and add up to 100 − OEE.
const OEE_RESULT = (() => {
  const i = OEE_INPUTS
  const netPlanned = i.plannedTime - i.breaks
  const runTime = netPlanned - i.downtime
  const availability = (runTime / netPlanned) * 100
  const performance = ((i.totalCount * i.cycleTime) / 60 / runTime) * 100
  const performanceCapped = Math.min(performance, 100)
  const quality = (i.goodCount / i.totalCount) * 100
  const oee = (availability / 100) * (performanceCapped / 100) * (quality / 100) * 100
  return {
    netPlanned,
    runTime,
    availability,
    performanceCapped,
    quality,
    oee,
    downtimeLoss: (i.downtime / netPlanned) * 100,
    speedLoss: Math.max(0, 100 - performance) * (runTime / netPlanned),
    qualityLoss: Math.max(0, 100 - quality) * (runTime / netPlanned) * (performanceCapped / 100),
  }
})()

const OEE_BENCH = [
  { label: 'Availability', key: 'availability' as const, wc: 90 },
  { label: 'Performance', key: 'performanceCapped' as const, wc: 95 },
  { label: 'Quality', key: 'quality' as const, wc: 99.9 },
  { label: 'OEE', key: 'oee' as const, wc: 85 },
]

// "Typical Performance" tier (60% <= OEE < 85%) — matches
// oeeClassificationForPdf() in OEECalculator.tsx.
const OEE_CLASSIFICATION = { label: 'TYPICAL PERFORMANCE', color: REPORT_COLORS.brand, bg: REPORT_COLORS.panelTint }

export function buildOeeSamplePdf() {
  const r = OEE_RESULT
  const i = OEE_INPUTS

  const ctx = createPdfReport('OEE Analysis Report (Sample)', 'oee')
  classificationBanner(ctx, OEE_CLASSIFICATION, 'OEE Performance Classification')

  const studyRows: KVRow[] = [
    ['Planned Production Time', `${i.plannedTime.toFixed(1)} min`],
    ['Breaks (Planned)', `${i.breaks.toFixed(1)} min`],
    ['Downtime (Unplanned)', `${i.downtime.toFixed(1)} min`],
    ['Ideal Cycle Time', `${i.cycleTime.toFixed(2)} s/part`],
    ['Total Count', String(i.totalCount)],
    ['Good Count', String(i.goodCount)],
  ]
  const metricRows: KVRow[] = [
    ['Net Planned Time', `${r.netPlanned.toFixed(1)} min`],
    ['Run Time', `${r.runTime.toFixed(1)} min`],
    ['Availability', `${r.availability.toFixed(2)}%`],
    ['Performance', `${r.performanceCapped.toFixed(2)}%`],
    ['Quality', `${r.quality.toFixed(2)}%`],
    ['OEE', `${r.oee.toFixed(2)}%`],
  ]
  twoColumnTables(ctx, 'Study Information', studyRows, 'Key Metrics', metricRows)

  dataTable(
    ctx,
    'World-Class Benchmark',
    [
      { header: 'FACTOR', width: 110 },
      { header: 'YOUR RESULT', width: 100, align: 'right' },
      { header: 'WORLD-CLASS TARGET', width: 140, align: 'right' },
      { header: 'GAP', width: ctx.pageWidth - ctx.margin * 2 - 350, align: 'right' },
    ],
    OEE_BENCH.map(b => {
      const yours = r[b.key]
      const gap = yours - b.wc
      return [b.label, `${yours.toFixed(2)}%`, `${b.wc}%`, `${gap >= 0 ? '+' : ''}${gap.toFixed(2)}%`]
    }),
    {
      cellColors: OEE_BENCH.map(b => {
        const gap = r[b.key] - b.wc
        return [null, null, null, gap >= 0 ? REPORT_COLORS.good : REPORT_COLORS.bad]
      }),
    }
  )

  capabilityGauge(ctx, {
    title: 'OEE Performance Gauge',
    value: r.oee,
    min: 0,
    max: 100,
    bands: [
      { upTo: 40, color: REPORT_COLORS.badBg },
      { upTo: 60, color: REPORT_COLORS.warnBg },
      { upTo: 85, color: REPORT_COLORS.panelTint },
      { upTo: 100, color: REPORT_COLORS.goodBg },
    ],
    ticks: [
      { value: 0, label: '0%' },
      { value: 40, label: '40%' },
      { value: 60, label: '60%' },
      { value: 85, label: '85%' },
      { value: 100, label: '100%' },
    ],
    caption: `OEE = ${r.oee.toFixed(2)}% - ${OEE_CLASSIFICATION.label} (World-class benchmark: OEE >= 85%)`,
  })

  dataTable(
    ctx,
    'Loss Detail',
    [
      { header: 'LOSS CATEGORY', width: 140 },
      { header: 'DESCRIPTION', width: 220 },
      { header: 'IMPACT', width: ctx.pageWidth - ctx.margin * 2 - 360, align: 'right' },
    ],
    [
      ['Downtime Loss', 'Breakdown + Changeover', `${r.downtimeLoss.toFixed(2)}%`],
      ['Speed Loss', 'Minor Stops + Reduced Speed', `${r.speedLoss.toFixed(2)}%`],
      ['Quality Loss', 'Defects + Startup Rejects', `${r.qualityLoss.toFixed(2)}%`],
    ]
  )

  const conclusion = `The line achieved an OEE of ${r.oee.toFixed(2)}%, classified as ${OEE_CLASSIFICATION.label.toLowerCase()}. Availability was ${r.availability.toFixed(1)}%, Performance ${r.performanceCapped.toFixed(1)}%, and Quality ${r.quality.toFixed(1)}%. The largest loss category was speed loss at ${r.speedLoss.toFixed(2)}% of net planned time — prioritize improvement efforts there. World-class benchmark is OEE >= 85% (A >= 90%, P >= 95%, Q >= 99.9%).`
  interpretationBox(ctx, 'Study Conclusion', conclusion, 'info')

  criteriaReferenceTable(
    ctx,
    'OEE Classification Reference',
    [
      ['>= 85%', 'World-Class Performance', 'Common benchmark for world-class manufacturing (Nakajima / JIPM TPM standard).'],
      ['60% to < 85%', 'Typical Performance', 'Common for most manufacturers — room to improve.'],
      ['40% to < 60%', 'Below Average', 'Focus on the single weakest factor (Availability, Performance, or Quality).'],
      ['< 40%', 'Significant Losses', 'Investigate root causes across all three factors.'],
    ],
    ['OEE RANGE', 'CLASSIFICATION', 'GENERAL INTERPRETATION']
  )

  finalizeReport(ctx)
  ctx.pdf.save(`${SITE_SLUG}-sample-oee-report.pdf`)
}

export async function buildOeeSampleExcel() {
  const r = OEE_RESULT
  const classTone: Tone = 'accent'
  const report = createExcelReport({ toolName: 'OEE Calculator (Sample)' })

  const overview = report.addSheet('Overview')
  overview.titleBand('OEE (Overall Equipment Effectiveness) Report — SAMPLE', OEE_CLASSIFICATION.label)
  overview.metaStrip([
    ['Generated on', nowStamp()],
    ['Standard', 'Nakajima / JIPM TPM — OEE = Availability x Performance x Quality'],
    ['Note', 'Sample report — illustrative data, not a live analysis'],
  ])

  overview.sectionHeading('OEE Indices')
  overview.kpiRow([
    { label: 'OEE (Overall)', value: `${r.oee.toFixed(2)}%`, tone: classTone },
    { label: 'Availability', value: `${r.availability.toFixed(2)}%`, tone: 'neutral' },
    { label: 'Performance', value: `${r.performanceCapped.toFixed(2)}%`, tone: 'neutral' },
    { label: 'Quality', value: `${r.quality.toFixed(2)}%`, tone: 'neutral' },
  ])

  overview.table({
    headers: [
      { header: 'Metric', key: 'metric', align: 'left', width: 26 },
      { header: 'Value (%)', key: 'value', align: 'right' },
    ],
    rows: [
      ['OEE (Overall)', r.oee.toFixed(2)],
      ['Availability', r.availability.toFixed(2)],
      ['Performance', r.performanceCapped.toFixed(2)],
      ['Quality (First Pass Yield)', r.quality.toFixed(2)],
    ],
  })

  overview.sectionHeading('Six Big Losses')
  overview.table({
    headers: [
      { header: 'Loss Category', key: 'cat', align: 'left', width: 22 },
      { header: 'Description', key: 'desc', align: 'left', width: 36 },
      { header: 'Value (%)', key: 'value', align: 'right' },
    ],
    rows: [
      ['Downtime Loss', 'Breakdown + Changeover', r.downtimeLoss.toFixed(2)],
      ['Speed Loss', 'Minor Stops + Reduced Speed', r.speedLoss.toFixed(2)],
      ['Quality Loss', 'Defects + Startup Rejects', r.qualityLoss.toFixed(2)],
    ],
    rowTones: [
      r.downtimeLoss >= 15 ? 'danger' : r.downtimeLoss >= 5 ? 'warning' : undefined,
      r.speedLoss >= 15 ? 'danger' : r.speedLoss >= 5 ? 'warning' : undefined,
      r.qualityLoss >= 15 ? 'danger' : r.qualityLoss >= 5 ? 'warning' : undefined,
    ],
  })

  overview.sectionHeading('Benchmark vs World-Class')
  overview.table({
    headers: [
      { header: 'Metric', key: 'metric', align: 'left', width: 22 },
      { header: 'Your Value (%)', key: 'yours', align: 'right' },
      { header: 'World-Class (%)', key: 'wc', align: 'right' },
      { header: 'Gap (%)', key: 'gap', align: 'right' },
    ],
    rows: OEE_BENCH.map(b => {
      const yours = r[b.key]
      const gap = yours - b.wc
      return [b.label, yours.toFixed(2), b.wc, `${gap >= 0 ? '+' : ''}${gap.toFixed(2)}`]
    }),
    rowTones: OEE_BENCH.map(b => ((r[b.key] - b.wc) >= 0 ? 'good' : 'warning')),
  })

  overview.note(`Classification: ${OEE_CLASSIFICATION.label}`, classTone)
  overview.freezeHeader(2)

  await report.download(`${SITE_SLUG}-sample-oee-report.xlsx`)
}

// ─────────────────────────────────────────────────────────────────────────
// Dispatch table used by the /sample-reports page
// ─────────────────────────────────────────────────────────────────────────

export const SAMPLE_PDF_BUILDERS: Record<SampleToolId, () => void> = {
  'gage-rr': buildGageRRSamplePdf,
  spc: buildSpcSamplePdf,
  oee: buildOeeSamplePdf,
}

export const SAMPLE_EXCEL_BUILDERS: Record<SampleToolId, () => Promise<void>> = {
  'gage-rr': buildGageRRSampleExcel,
  spc: buildSpcSampleExcel,
  oee: buildOeeSampleExcel,
}
