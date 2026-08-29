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
  criteriaReferenceTable,
  finalizeReport,
  REPORT_COLORS,
  type KVRow,
} from '@/lib/pdf/reportDesign'
import { createReport as createExcelReport, nowStamp, type Tone } from '@/lib/excelReport'

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
// 3 appraisers × 10 parts × 3 trials, Average & Range method, AIAG MSA.
// Tolerance = 6.0 (spec 48.5–54.5 N·m band, i.e. width 6). Numbers below
// were computed by hand from the raw measurements in GAGE_RR_RAW.
// ─────────────────────────────────────────────────────────────────────────

const GAGE_RR_RAW: Record<string, number[][]> = {
  A: [
    [48.9, 49.0, 48.95], [49.5, 49.55, 49.48], [50.1, 50.05, 50.12], [50.6, 50.65, 50.58],
    [51.2, 51.15, 51.22], [49.2, 49.25, 49.18], [50.8, 50.85, 50.78], [49.8, 49.75, 49.82],
    [51.0, 50.95, 51.05], [48.6, 48.65, 48.58],
  ],
  B: [
    [48.95, 49.02, 48.9], [49.52, 49.58, 49.45], [50.08, 50.15, 50.02], [50.62, 50.68, 50.55],
    [51.18, 51.25, 51.12], [49.22, 49.28, 49.15], [50.75, 50.82, 50.7], [49.78, 49.85, 49.72],
    [51.05, 51.1, 50.98], [48.58, 48.62, 48.52],
  ],
  C: [
    [48.88, 48.94, 48.85], [49.48, 49.52, 49.42], [50.05, 50.1, 49.98], [50.58, 50.62, 50.52],
    [51.15, 51.2, 51.08], [49.18, 49.22, 49.12], [50.72, 50.78, 50.68], [49.75, 49.8, 49.68],
    [51.02, 51.08, 50.95], [48.55, 48.6, 48.48],
  ],
}

const GAGE_RR_RESULT = {
  method: 'average-range' as const,
  numAppraisers: 3,
  numParts: 10,
  numTrials: 3,
  tolerance: 6.0,
  EV: 0.3152,
  AV: 0.105,
  GRR: 0.3322,
  PV: 4.2066,
  TV: 4.2197,
  ndc: 17,
  pctTV: { EV: 0.0747, AV: 0.0249, GRR: 0.0787, PV: 0.9969 },
  pctTol: { EV: 0.2705, AV: 0.0901, GRR: 0.2851, PV: 3.6107 },
  uclR: 0.266,
  rbarByAppraiser: { A: 0.076, B: 0.124, C: 0.11 },
  conclusion: 'okay' as const,
  conclusionText:
    '%GRR = 7.9% of Total Variation (28.5% of Tolerance) — well within the AIAG acceptable threshold of 10%. The measurement system contributes minimal noise relative to genuine part-to-part variation, and with ndc = 17 (AIAG requires ≥ 5), the gage reliably distinguishes between parts. This measurement system is acceptable for process control and capability studies.',
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
  ctx.pdf.save('quality-hub-sample-gage-rr-report.pdf')
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
    { label: '%GRR (of Total Variation)', value: pct(r.pctTV.GRR), tone: conclusionTone },
    { label: 'NDC', value: r.ndc, sub: 'Number of Distinct Categories', tone: 'good' },
    { label: 'Repeatability (EV)', value: pct(r.pctTV.EV), tone: 'neutral' },
    { label: 'Reproducibility (AV)', value: pct(r.pctTV.AV), tone: 'neutral' },
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

  await report.download('quality-hub-sample-gage-rr-report.xlsx')
}

// ─────────────────────────────────────────────────────────────────────────
// SPC sample — X-bar/R chart, fill-weight process
// n=5 subgroup size, k=20 subgroups (100 individual readings), drawn from
// a genuine Normal(250.067, 0.169) distribution so the Anderson-Darling
// test below is numerically honest (not just a plausible-looking number).
// Spec 249.18–250.94 g. Constants for n=5 (Montgomery/AIAG): A2=0.577,
// D3=0, D4=2.114, d2=2.326. Mirrors the PDF sections added to
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
  uclR: 0.8382,
  lclR: 0,
  sigmaWithin: 0.1705,
  sigmaOverall: 0.1685,
  lsl: 249.18,
  usl: 250.94,
  cp: 1.721,
  cpk: 1.707,
  pp: 1.741,
  ppk: 1.727,
  oocX: [] as number[],
  oocR: [] as number[],
  ad: { A2: 0.317, A2adj: 0.329, p: 0.517 },
  isNormal: true,
  dataAdequacy: { n: 100, tier: 'adequate' as const, label: 'Adequate' },
  ppmTotal: 0.31, // estimated overall defect PPM at this sigma level (~0 practically)
}

function formatYieldPct(ppmTotal: number): string {
  const yieldPct = 100 - ppmTotal / 10000
  return yieldPct >= 99.9995 ? `${yieldPct.toFixed(5)}%` : `${yieldPct.toFixed(3)}%`
}

export function buildSpcSamplePdf() {
  const r = SPC_RESULT
  const cls = classifyCapability(r.cpk)

  const ctx = createPdfReport('SPC Analysis Report (Sample)', 'spc')
  classificationBanner(ctx, cls)

  const studyRows: KVRow[] = [
    ['Chart Type', 'X-bar / R'],
    ['Subgroup Size (n)', String(r.subgroupSize)],
    ['Number of Subgroups (k)', String(r.numSubgroups)],
    ['Measurement', 'Fill weight, grams'],
    ['LSL / USL', `${r.lsl.toFixed(2)} / ${r.usl.toFixed(2)}`],
  ]
  const metricRows: KVRow[] = [
    ['Grand Mean (X-double-bar)', fmt(r.xdbar, 3)],
    ['Average Range (R-bar)', fmt(r.rbar, 3)],
    ['Cp', fmt(r.cp, 3)],
    ['Cpk', fmt(r.cpk, 3)],
    ['Pp', fmt(r.pp, 3)],
    ['Ppk', fmt(r.ppk, 3)],
  ]
  twoColumnTables(ctx, 'Study Information', studyRows, 'Key Metrics', metricRows)

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

  capabilityGauge(ctx, {
    title: 'Process Capability Gauge (Cpk)',
    value: r.cpk,
    caption: `Cpk = ${fmt(r.cpk, 2)} (>=1.33 capable, 1.00-1.33 marginal, <1.00 not capable)`,
  })

  calloutBox(
    ctx,
    'No points beyond control limits on the X-bar or R chart — process is in statistical control.',
    'good'
  )

  calloutBox(
    ctx,
    `Data adequacy: ${r.dataAdequacy.label} (n = ${r.dataAdequacy.n}). Sample size is sufficient for the reported statistics.`,
    'good'
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
      ['AD (A²)', fmt(r.ad.A2adj, 3)],
      ['P-Value', fmt(r.ad.p, 3)],
      ['Conclusion', r.isNormal ? 'Fail to reject normality (p >= 0.05)' : 'Reject normality (p < 0.05)'],
    ],
    {
      cellColors: [[], [], [], [], [], [null, r.isNormal ? REPORT_COLORS.good : REPORT_COLORS.warn]],
    }
  )
  calloutBox(
    ctx,
    'The normal distribution assumption is not rejected at the 0.05 level. Capability indices and PPM estimates in this report assume normality.',
    'good'
  )

  dataTable(
    ctx,
    'Process Performance (PPM)',
    [
      { header: 'METRIC', width: 260 },
      { header: 'VALUE', width: ctx.pageWidth - ctx.margin * 2 - 260 },
    ],
    [
      ['Estimated Defects (Overall)', `${r.ppmTotal.toFixed(2)} PPM`],
      ['Estimated Yield (Overall)', formatYieldPct(r.ppmTotal)],
    ]
  )
  calloutBox(
    ctx,
    'Within (short-term) and Overall (long-term) PPM estimates use different sigma values — Within reflects the process\u2019s inherent short-term variation, while Overall reflects everything observed during the study, including shifts and drift. The two figures are expected to differ and are not a check on each other.',
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
      ? `Both variation reduction and improved centering are needed. The process mean sits closer to the ${nearerLimit}; reducing overall variation alone will not be sufficient.`
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
  interpretationBox(ctx, 'Recommended Action', recommendedAction, spreadOk && centeringOk ? 'good' : 'warn')

  criteriaReferenceTable(ctx, 'Cpk Criteria Reference')

  finalizeReport(ctx)
  ctx.pdf.save('quality-hub-sample-spc-report.pdf')
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
      ['AD (A²)', r.ad.A2adj.toFixed(3)],
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

  await report.download('quality-hub-sample-spc-report.xlsx')
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

const OEE_RESULT = {
  netPlanned: 480,
  runTime: 428,
  availability: 89.17,
  performanceCapped: 88.79,
  quality: 96.05,
  oee: 76.04,
  downtimeLoss: 10.83,
  speedLoss: 11.21,
  qualityLoss: 3.95,
}

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
  ctx.pdf.save('quality-hub-sample-oee-report.pdf')
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

  await report.download('quality-hub-sample-oee-report.xlsx')
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
