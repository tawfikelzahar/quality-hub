'use client'

import { useEffect, useRef, useState } from 'react'
import 'chart.js/auto'
import { Chart } from 'react-chartjs-2'
import type { Chart as ChartJSInstance } from 'chart.js'
import { COLORS, getSharedStyles, usePersistedTheme, tint } from '@/lib/theme'
import Nav from '@/components/Nav'
import ToolSidebar from '@/components/ToolSidebar'
import ToolStyles from '@/components/tool/ToolStyles'
import { ToolHeader, HelpPanel, PhoneTabs, PhoneBar, ExportRow, useCompactSave, type MobileTab } from '@/components/tool/ToolParts'
import SaveAnalysisButton from '@/components/SaveAnalysisButton'
import { useSubscription } from '@/lib/useSubscription'
import { goToLogin, goToPricing } from '@/lib/exportGate'
import { watermarkOptions, watermarkLayout, withWatermarksDisabled } from '@/lib/watermarkHelpers'
import { useLanguage } from '@/lib/i18n/context'
import type { TKey } from '@/lib/i18n/translations'
import { calcOEE, classify, validate, lossTime, type OEEInputs, type OEEResult, type OEELossTime, type Classification } from '@/lib/oee/calc'
import { fixed } from '@/lib/stats/format'
import { createReport, nowStamp, type Tone } from '@/lib/excelReport'
import {
  createReport as createPdfReport,
  classificationBanner,
  twoColumnTables,
  dataTable,
  capabilityGauge,
  interpretationBox,
  criteriaReferenceTable,
  addChartImage,
  finalizeReport,
  REPORT_COLORS,
  type KVRow,
  type Classification as PdfClassification,
} from '@/lib/pdf/reportDesign'

// ─────────────────────────────────────────────────────────────────────────
// OEE tool page on the shared tool layout (ToolParts / ToolStyles).
// Formulas: lib/oee/calc.ts (public, run in the browser). The "What to work
// on first" card is Pro and written on the server (/api/oee/insight).
// ─────────────────────────────────────────────────────────────────────────

const EXAMPLE: OEEInputs = { plannedTime: 480, breaks: 0, downtime: 52, cycleTime: 6.0, totalCount: 3800, goodCount: 3650 }

const BENCH = [
  { key: 'oee', labelKey: 'oee_stat_overall', wc: 85 },
  { key: 'availability', labelKey: 'oee_stat_availability', wc: 90 },
  { key: 'performanceCapped', labelKey: 'oee_stat_performance', wc: 95 },
  { key: 'quality', labelKey: 'oee_stat_quality_fpy', wc: 99.9 },
] as const

const BENCH_ENGLISH: Record<(typeof BENCH)[number]['key'], string> = {
  oee: 'OEE',
  availability: 'Availability',
  performanceCapped: 'Performance',
  quality: 'Quality',
}

const CLASS_SHORT: Record<Classification, TKey> = {
  'world-class': 'oee_cls_worldclass',
  good: 'oee_cls_good',
  average: 'oee_cls_average',
  poor: 'oee_cls_poor',
}

const CLASS_COLOR: Record<Classification, string> = {
  'world-class': 'var(--qh-good)',
  good: 'var(--qh-accent)',
  average: 'var(--qh-amber)',
  poor: 'var(--qh-danger)',
}

/**
 * PDF reports stay in English regardless of the UI language (exported file
 * content stays in English for interoperability).
 */
function oeeClassificationForPdf(type: Classification): PdfClassification {
  if (type === 'world-class') return { label: 'WORLD-CLASS PERFORMANCE', color: REPORT_COLORS.good, bg: REPORT_COLORS.goodBg }
  if (type === 'good') return { label: 'TYPICAL PERFORMANCE', color: REPORT_COLORS.brand, bg: REPORT_COLORS.panelTint }
  if (type === 'average') return { label: 'BELOW AVERAGE', color: REPORT_COLORS.warn, bg: REPORT_COLORS.warnBg }
  return { label: 'SIGNIFICANT LOSSES', color: REPORT_COLORS.bad, bg: REPORT_COLORS.badBg }
}

const int = (v: number) => Math.round(v).toLocaleString('en-US')
/** minutes for a sentence: one decimal, without a trailing ".0" (115, 52.5) */
const min1 = (v: number) => String(Number(fixed(v, 1)))
/** keeps a number or signed value in one piece inside Arabic text */
const ltr = (v: string) => `\u2066${v}\u2069`

interface LossRow {
  kind: 'downtime' | 'speed' | 'quality'
  nameEn: string
  descEn: string
  shortKey: TKey
  min: number
  pct: number
  parts: number
  rejected: boolean
}

function lossRows(i: OEEInputs, r: OEEResult, lt: OEELossTime): LossRow[] {
  return [
    { kind: 'downtime', nameEn: 'Downtime Loss', descEn: 'Breakdown + Changeover', shortKey: 'oee_loss_downtime_short', min: lt.downtimeMin, pct: r.downtimeLoss, parts: (lt.downtimeMin * 60) / i.cycleTime, rejected: false },
    { kind: 'speed', nameEn: 'Speed Loss', descEn: 'Minor Stops + Reduced Speed', shortKey: 'oee_loss_speed_short', min: lt.speedMin, pct: r.speedLoss, parts: lt.speedParts, rejected: false },
    { kind: 'quality', nameEn: 'Quality Loss', descEn: 'Defects + Startup Rejects', shortKey: 'oee_loss_quality_short', min: lt.qualityMin, pct: r.qualityLoss, parts: lt.qualityParts, rejected: true },
  ]
}

type InsightState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'done'; key: string; en: string; ar: string }

export default function OEECalculator() {
  const { isPro, isLoggedIn } = useSubscription()
  const [theme, setTheme] = usePersistedTheme()
  const { t, lang } = useLanguage()
  const c = COLORS[theme]
  const s = getSharedStyles(theme)
  const compactSave = useCompactSave()
  const chartRef = useRef<ChartJSInstance<'bar'>>(null)

  const [inputs, setInputs] = useState<OEEInputs>(EXAMPLE)
  const [mobileTab, setMobileTab] = useState<MobileTab>('setup')
  const [helpOpen, setHelpOpen] = useState(false)
  const [loadedProjectName, setLoadedProjectName] = useState('')
  const [loadError, setLoadError] = useState('')
  const [insight, setInsight] = useState<InsightState>({ status: 'idle' })

  // ── Load a saved project from the dashboard (?id=...) ──────────────────
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id')
    if (!id) return
    fetch(`/api/saved-analyses/${id}`)
      .then(res => (res.ok ? res.json() : Promise.reject()))
      .then(({ analysis }) => {
        setInputs(analysis.input_data as OEEInputs)
        setLoadedProjectName(analysis.name as string)
      })
      .catch(() =>
        setLoadError(lang === 'ar' ? 'تعذر تحميل المشروع المحفوظ.' : 'Could not load the saved project.')
      )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setField = (field: keyof OEEInputs, val: string) => {
    setInputs(prev => ({ ...prev, [field]: parseFloat(val) || 0 }))
  }

  const errorKey = validate(inputs)
  const result = errorKey ? null : calcOEE(inputs)
  const cls = result ? classify(result.oee) : null
  const lt = result ? lossTime(inputs, result) : null
  const rows = result && lt ? lossRows(inputs, result, lt) : []
  const lostMin = lt ? lt.downtimeMin + lt.speedMin + lt.qualityMin : 0
  const inputKey = JSON.stringify(inputs)

  // ── "What to work on first" (Pro, server) — refreshed as the inputs settle ──
  useEffect(() => {
    if (!isPro || errorKey) return
    const ctrl = new AbortController()
    const timer = setTimeout(() => {
      setInsight({ status: 'loading' })
      fetch('/api/oee/insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: inputKey,
        signal: ctrl.signal,
      })
        .then(res => (res.ok ? res.json() : Promise.reject()))
        .then((j: { en: string; ar: string }) => setInsight({ status: 'done', key: inputKey, en: j.en, ar: j.ar }))
        .catch(() => { if (!ctrl.signal.aborted) setInsight({ status: 'error' }) })
    }, 400)
    return () => { clearTimeout(timer); ctrl.abort() }
  }, [isPro, errorKey, inputKey])

  const insightText = insight.status === 'done' && insight.key === inputKey ? (lang === 'ar' ? insight.ar : insight.en) : null

  // Pro exports read chart canvases via toBase64Image(); the watermark (kept
  // on the live view for everyone) is switched off just for that call.
  const exportExcel = () => (isPro ? withWatermarksDisabled([chartRef.current], runExportExcel) : runExportExcel())
  const exportPDF = () => (isPro ? withWatermarksDisabled([chartRef.current], runExportPDF) : runExportPDF())
  const exportPNG = () => (isPro ? withWatermarksDisabled([chartRef.current], runExportPNG) : runExportPNG())

  // ── Where the time went: one stacked bar, minutes ────────────────────────
  const timeData = {
    labels: [''],
    datasets: [
      { label: t('oee_productive'), data: [lt?.productiveMin ?? 0], backgroundColor: c.good, maxBarThickness: 44 },
      { label: t('oee_loss_downtime_short'), data: [lt?.downtimeMin ?? 0], backgroundColor: c.danger, maxBarThickness: 44 },
      { label: t('oee_loss_speed_short'), data: [lt?.speedMin ?? 0], backgroundColor: c.amber, maxBarThickness: 44 },
      { label: t('oee_loss_quality_short'), data: [lt?.qualityMin ?? 0], backgroundColor: c.data, maxBarThickness: 44 },
    ],
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const timeOptions: any = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    devicePixelRatio: 2,
    layout: watermarkLayout(),
    plugins: {
      watermark: watermarkOptions('light'),
      legend: { position: 'bottom', labels: { color: c.muted, font: { size: 11 }, boxWidth: 12 } },
      tooltip: {
        backgroundColor: c.surface,
        borderColor: c.border,
        borderWidth: 1,
        titleColor: c.text,
        bodyColor: c.muted,
        padding: 10,
        callbacks: {
          title: () => '',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          label: (ctx: any) => ` ${ctx.dataset.label}: ${fixed(ctx.raw, 1)} ${t('oee_unit_min')}`,
        },
      },
    },
    scales: {
      x: {
        stacked: true,
        min: 0,
        max: result?.netPlanned,
        ticks: { color: c.muted, font: { size: 11 } },
        grid: { color: c.grid },
        border: { color: c.border },
        title: { display: true, text: t('oee_unit_min'), color: c.muted, font: { size: 11 } },
      },
      y: { stacked: true, display: false },
    },
  }

  // ── Exports ───────────────────────────────────────────────────────────────
  const exportCSV = () => {
    if (!isLoggedIn) { goToLogin('oee', 'csv'); return }
    if (!result || !cls || !lt) return
    const lines = [
      'Metric,Value,Unit',
      `OEE (Overall),${fixed(result.oee, 2)},%`,
      `Availability,${fixed(result.availability, 2)},%`,
      `Performance,${fixed(result.performanceCapped, 2)},%`,
      `Quality (First Pass Yield),${fixed(result.quality, 2)},%`,
      '',
      'Time,Minutes,Parts,% of net planned time',
      // plain integers: a thousands comma would split the CSV column
      `Fully productive,${fixed(lt.productiveMin, 1)},${Math.round(inputs.goodCount)},${fixed(result.oee, 2)}`,
      ...rows.map(l => `${l.nameEn},${fixed(l.min, 1)},${Math.round(l.parts)} ${l.rejected ? 'rejected' : 'not made'},${fixed(l.pct, 2)}`),
      '',
      'Benchmark,Your Value,World-Class,Gap',
      ...BENCH.map(b => {
        const yours = result[b.key]
        const gap = yours - b.wc
        return `${BENCH_ENGLISH[b.key]},${fixed(yours, 2)}%,${b.wc}%,${gap >= 0 ? '+' : ''}${fixed(gap, 2)}%`
      }),
    ]
    const blob = new Blob(['\uFEFF', lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'oee-analysis.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  /** The Pro card text for the report (English); null if it can't be had */
  const insightForReport = async (): Promise<string | null> => {
    if (insight.status === 'done' && insight.key === inputKey) return insight.en
    try {
      const res = await fetch('/api/oee/insight', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: inputKey })
      if (!res.ok) return null
      return ((await res.json()) as { en: string }).en
    } catch {
      return null
    }
  }

  const runExportExcel = async () => {
    if (!isPro) { goToPricing('oee', 'excel'); return }
    if (!result || !cls || !lt) return
    const report = createReport({ toolName: 'OEE Calculator' })
    const classTone: Tone = cls.type === 'world-class' || cls.type === 'good' ? 'good' : cls.type === 'average' ? 'warning' : 'danger'

    const overview = report.addSheet('Overview')
    overview.titleBand('OEE (Overall Equipment Effectiveness) Report', oeeClassificationForPdf(cls.type).label)
    overview.metaStrip([
      ['Generated on', nowStamp()],
      ['Standard', 'Nakajima / JIPM TPM — OEE = Availability × Performance × Quality'],
    ])

    overview.sectionHeading('OEE Indices')
    overview.kpiRow([
      { label: 'OEE (Overall)', value: `${fixed(result.oee, 2)}%`, tone: classTone },
      { label: 'Availability', value: `${fixed(result.availability, 2)}%`, tone: 'neutral' },
      { label: 'Performance', value: `${fixed(result.performanceCapped, 2)}%`, tone: 'neutral' },
      { label: 'Quality', value: `${fixed(result.quality, 2)}%`, tone: 'neutral' },
    ])

    overview.sectionHeading('Where the Planned Time Went (Chart)')
    if (chartRef.current) {
      await overview.image(chartRef.current.toBase64Image('image/png', 1), { widthCm: 16, heightCm: 5 })
    }

    overview.sectionHeading('Where the Planned Time Went')
    overview.table({
      headers: [
        { header: 'Time', key: 'cat', align: 'left', width: 22 },
        { header: 'Description', key: 'desc', align: 'left', width: 30 },
        { header: 'Minutes', key: 'min', align: 'right', numFmt: '0.0' },
        { header: 'Parts', key: 'parts', align: 'right', numFmt: '#,##0' },
        { header: '% of net planned time', key: 'pct', align: 'right', numFmt: '0.00' },
      ],
      rows: [
        { cat: 'Fully productive', desc: 'Good parts × ideal cycle time', min: lt.productiveMin, parts: inputs.goodCount, pct: result.oee },
        ...rows.map(l => ({ cat: l.nameEn, desc: `${l.descEn} (${l.rejected ? 'parts rejected' : 'parts not made'})`, min: l.min, parts: Math.round(l.parts), pct: Number(l.pct.toPrecision(12)) })),
      ],
      rowTones: [undefined, ...rows.map(l => (l.pct >= 15 ? 'danger' as const : l.pct >= 5 ? 'warning' as const : undefined))],
    })

    overview.sectionHeading('Benchmark vs World-Class')
    overview.table({
      headers: [
        { header: 'Metric', key: 'metric', align: 'left', width: 22 },
        { header: 'Your Value (%)', key: 'yours', align: 'right', numFmt: '0.00' },
        { header: 'World-Class (%)', key: 'wc', align: 'right', numFmt: '0.00' },
        { header: 'Gap (%)', key: 'gap', align: 'right', numFmt: '+0.00;-0.00' },
      ],
      rows: BENCH.map(b => {
        const yours = result[b.key]
        return { metric: BENCH_ENGLISH[b.key], yours, wc: b.wc, gap: yours - b.wc }
      }),
      rowTones: BENCH.map(b => (result[b.key] - b.wc >= 0 ? 'good' : 'warning')),
    })

    const next = await insightForReport()
    if (next) {
      overview.sectionHeading('What to Work on First')
      overview.note(next, classTone)
    }
    overview.freezeHeader(2)

    await report.download('oee-analysis.xlsx')
  }

  const runExportPNG = () => {
    if (!isLoggedIn) { goToLogin('oee', 'png'); return }
    const chart = chartRef.current
    if (!chart) return
    const url = chart.toBase64Image('image/png', 1)
    const a = document.createElement('a')
    a.href = url
    a.download = 'oee-time-chart.png'
    a.click()
  }

  const runExportPDF = async () => {
    if (!isPro) { goToPricing('oee', 'pdf'); return }
    if (!result || !cls || !lt) return
    const next = await insightForReport()

    const pdfCls = oeeClassificationForPdf(cls.type)
    const ctx = createPdfReport('OEE Analysis Report', 'oee')
    classificationBanner(ctx, pdfCls, 'OEE Performance Classification')

    const studyRows: KVRow[] = [
      ['Planned Production Time', `${fixed(inputs.plannedTime, 1)} min`],
      ['Breaks (Planned)', `${fixed(inputs.breaks, 1)} min`],
      ['Downtime (Unplanned)', `${fixed(inputs.downtime, 1)} min`],
      ['Ideal Cycle Time', `${fixed(inputs.cycleTime, 2)} s/part`],
      ['Total Count', int(inputs.totalCount)],
      ['Good Count', int(inputs.goodCount)],
    ]
    const metricRows: KVRow[] = [
      ['Net Planned Time', `${fixed(result.netPlanned, 1)} min`],
      ['Run Time', `${fixed(result.runTime, 1)} min`],
      ['Availability', `${fixed(result.availability, 2)}%`],
      ['Performance', `${fixed(result.performanceCapped, 2)}%`],
      ['Quality', `${fixed(result.quality, 2)}%`],
      ['OEE', `${fixed(result.oee, 2)}%`],
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
      BENCH.map(b => {
        const yours = result[b.key]
        const gap = yours - b.wc
        return [BENCH_ENGLISH[b.key], `${fixed(yours, 2)}%`, `${b.wc}%`, `${gap >= 0 ? '+' : ''}${fixed(gap, 2)}%`]
      }),
      { cellColors: BENCH.map(b => [null, null, null, result[b.key] - b.wc >= 0 ? REPORT_COLORS.good : REPORT_COLORS.bad]) }
    )

    capabilityGauge(ctx, {
      title: 'OEE Performance Gauge',
      value: result.oee,
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
      caption: `OEE = ${fixed(result.oee, 2)}% — ${pdfCls.label} (World-class benchmark: OEE ≥ 85%)`,
    })

    addChartImage(ctx, chartRef.current, 'Where the Planned Time Went', { width: 1000, height: 220 })

    dataTable(
      ctx,
      'Loss Detail',
      [
        { header: 'TIME', width: 120 },
        { header: 'DESCRIPTION', width: 160 },
        { header: 'MINUTES', width: 70, align: 'right' },
        { header: 'PARTS', width: 90, align: 'right' },
        { header: '% OF TIME', width: ctx.pageWidth - ctx.margin * 2 - 440, align: 'right' },
      ],
      [
        ['Fully productive', 'Good parts x ideal cycle', fixed(lt.productiveMin, 1), int(inputs.goodCount), `${fixed(result.oee, 2)}%`],
        ...rows.map(l => [l.nameEn, l.descEn, fixed(l.min, 1), `${int(l.parts)} ${l.rejected ? 'rejected' : 'not made'}`, `${fixed(l.pct, 2)}%`]),
      ]
    )

    const biggest = rows.reduce((a, b) => (b.min > a.min ? b : a))
    const conclusionTone = cls.type === 'world-class' ? 'good' : cls.type === 'good' ? 'info' : cls.type === 'average' ? 'warn' : 'bad'
    const conclusion = `The line achieved an OEE of ${fixed(result.oee, 2)}%, classified as ${pdfCls.label.toLowerCase()}. Availability was ${fixed(result.availability, 1)}%, Performance ${fixed(result.performanceCapped, 1)}%, and Quality ${fixed(result.quality, 1)}%. ${fixed(lostMin, 1)} of ${fixed(result.netPlanned, 1)} planned minutes were lost; the largest loss was ${biggest.kind} at ${fixed(biggest.min, 1)} min (${fixed(biggest.pct, 2)}% of net planned time). World-class benchmark is OEE ≥ 85% (A ≥ 90%, P ≥ 95%, Q ≥ 99.9%).`
    interpretationBox(ctx, 'Study Conclusion', conclusion, conclusionTone)
    if (next) interpretationBox(ctx, 'What to Work on First', next, 'info')

    criteriaReferenceTable(
      ctx,
      'OEE Classification Reference',
      [
        ['≥ 85%', 'World-Class Performance', 'Common benchmark for world-class manufacturing (Nakajima / JIPM TPM standard).'],
        ['60% to < 85%', 'Typical Performance', 'Common for most manufacturers — room to improve.'],
        ['40% to < 60%', 'Below Average', 'Focus on the single weakest factor (Availability, Performance, or Quality).'],
        ['< 40%', 'Significant Losses', 'Investigate root causes across all three factors.'],
      ],
      ['OEE RANGE', 'CLASSIFICATION', 'GENERAL INTERPRETATION']
    )

    finalizeReport(ctx)
    ctx.pdf.save('oee-report.pdf')
  }

  // ── Page ──────────────────────────────────────────────────────────────────
  const timeFields: { key: keyof OEEInputs; labelKey: TKey }[] = [
    { key: 'plannedTime', labelKey: 'oee_f_planned' },
    { key: 'breaks', labelKey: 'oee_f_breaks' },
    { key: 'downtime', labelKey: 'oee_f_downtime' },
  ]
  const partFields: { key: keyof OEEInputs; labelKey: TKey; step?: string }[] = [
    { key: 'cycleTime', labelKey: 'oee_f_cycle', step: '0.1' },
    { key: 'totalCount', labelKey: 'oee_f_total' },
    { key: 'goodCount', labelKey: 'oee_f_good' },
  ]
  const field = (f: { key: keyof OEEInputs; labelKey: TKey; step?: string }) => (
    <label key={f.key} className="tl-field">
      <span>{t(f.labelKey)}</span>
      <input type="number" step={f.step ?? '1'} min={0} placeholder="0" value={inputs[f.key] || ''} onChange={e => setField(f.key, e.target.value)} />
    </label>
  )

  const helpSteps = [
    { t: t('oee_help_s1_t'), d: t('oee_help_s1_d') },
    { t: t('oee_help_s2_t'), d: t('oee_help_s2_d') },
    { t: t('oee_help_s3_t'), d: t('oee_help_s3_d') },
    { t: t('oee_help_s4_t'), d: t('oee_help_s4_d') },
  ]
  const loadExample = () => { setInputs(EXAMPLE); setMobileTab('results') }
  const vc = cls ? CLASS_COLOR[cls.type] : 'var(--qh-accent)'

  return (
    <div style={s.page}>
      <ToolStyles />
      <Nav theme={theme} setTheme={setTheme} breadcrumbKey="bc_oee" />

      {(loadedProjectName || loadError) && (
        <div className="qh-main" style={{ ...s.main, paddingBottom: 0 }}>
          {loadedProjectName && (
            <div style={{ fontSize: 13, color: c.accent, background: c.surface2, border: `1px solid ${c.border}`, borderRadius: 8, padding: '8px 14px' }}>
              {lang === 'ar' ? `تم تحميل المشروع المحفوظ: ${loadedProjectName}` : `Loaded saved project: ${loadedProjectName}`}
            </div>
          )}
          {loadError && <div className="tl-error">{loadError}</div>}
        </div>
      )}

      <div className="tl-shell">
        <ToolSidebar current="/oee" />

        <div className="tl-main">
          <ToolHeader title={t('oee_title')} intro={t('oee_intro')} onHelp={() => setHelpOpen(true)} onExample={loadExample} />
          <HelpPanel open={helpOpen} onClose={() => setHelpOpen(false)} title={t('oee_help_title')} steps={helpSteps} onExample={loadExample} showCapability={false} tip={t('oee_help_tip')} />
          <PhoneTabs tab={mobileTab} onTab={setMobileTab} dataCount={null} />

          <div className="tl-top">
            {/* ── SETUP ──────────────────────────────────────────────────── */}
            <section className="tl-panel tl-setup tl-card" data-active={mobileTab === 'setup'} aria-label={t('spc_tab_setup')}>
              <div>
                <div className="tl-label">{t('oee_group_time')}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{timeFields.map(field)}</div>
              </div>
              <div>
                <div className="tl-label">{t('oee_group_parts')}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{partFields.map(field)}</div>
              </div>
              {errorKey ? <div className="tl-error">{t(errorKey)}</div> : <div className="tl-hint" style={{ marginTop: 0 }}>{t('oee_live_hint')}</div>}
            </section>

            {/* ── RESULTS ──────────────────────────────────────────────── */}
            <section className="tl-panel tl-results tl-col" data-active={mobileTab === 'results'} aria-label={t('spc_tab_results')}>
              {result && cls && lt ? (
                <>
                  <div className="tl-verdict" style={{ background: tint(vc, 8), border: `1px solid ${tint(vc, 35)}` }}>
                    <span className="tl-verdict-icon" aria-hidden="true" style={{ background: tint(vc, 16), color: vc }}>{cls.type === 'world-class' ? '✓' : '!'}</span>
                    <div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '4px 12px' }}>
                        <span style={{ fontSize: 26, fontWeight: 700, direction: 'ltr' }}>{fixed(result.oee, 1)}%</span>
                        <span style={{ fontSize: 17, fontWeight: 600, color: vc }}>{t(CLASS_SHORT[cls.type])}</span>
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--qh-muted)', lineHeight: 1.6, marginTop: 2 }}>
                        {t('oee_verdict_sub').replace('{lost}', ltr(min1(lostMin))).replace('{net}', ltr(min1(result.netPlanned)))}
                      </div>
                    </div>
                  </div>

                  <div className="tl-results-head">
                    <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{t('spc_tab_results')}</h2>
                    <ExportRow
                      isPro={isPro}
                      isLoggedIn={isLoggedIn}
                      hasResult={!!result}
                      onCSV={exportCSV}
                      onPNG={exportPNG}
                      onExcel={exportExcel}
                      onPDF={exportPDF}
                      save={
                        <SaveAnalysisButton
                          theme={theme}
                          tool="oee"
                          defaultName={`OEE — ${new Date().toLocaleDateString('en-US')}`}
                          compact={compactSave}
                          getPayload={() => ({ input_data: inputs, results: result })}
                        />
                      }
                    />
                  </div>

                  <div className="tl-kpis tl-kpis-4">
                    {BENCH.map(b => {
                      const v = result[b.key]
                      const gap = v - b.wc
                      const ok = gap >= 0
                      return (
                        <div key={b.key} className="tl-kpi">
                          <span>{t(b.labelKey)}</span>
                          <b style={b.key === 'oee' ? { color: vc } : undefined}>{fixed(v, 1)}%</b>
                          <small style={{ color: ok ? 'var(--qh-good)' : 'var(--qh-danger)' }}>
                            {t(ok ? 'oee_vs_above' : 'oee_vs_below').replace('{d}', ltr(fixed(Math.abs(gap), 1))).replace('{wc}', ltr(String(b.wc)))}
                          </small>
                        </div>
                      )
                    })}
                  </div>

                  <div className="tl-chart">
                    <h3>{t('oee_time_title').replace('{n}', fixed(result.netPlanned, 0))}</h3>
                    <div className="tl-chart-sub">{t('oee_time_sub')}</div>
                    <div className="tl-chart-inner tl-chart-bar">
                      <Chart ref={chartRef} type="bar" data={timeData} options={timeOptions} />
                    </div>
                    <div style={{ overflowX: 'auto', marginTop: 12 }}>
                      <table className="tl-table">
                        <thead>
                          <tr>
                            <th>{t('oee_col_loss')}</th>
                            <th className="num">{t('oee_col_min')}</th>
                            <th className="num">{t('oee_col_parts')}</th>
                            <th className="num">{t('oee_col_pct')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((l, i) => (
                            <tr key={l.kind}>
                              <td>
                                <span aria-hidden="true" style={{ color: [c.danger, c.amber, c.data][i] }}>■</span> {t(l.shortKey)}
                              </td>
                              <td className="num">{fixed(l.min, 1)}</td>
                              <td className="num">{t(l.rejected ? 'oee_parts_rejected' : 'oee_parts_notmade').replace('{n}', int(l.parts))}</td>
                              <td className="num">{fixed(l.pct, 2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="tl-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>{t('oee_next_title')}</span>
                      <span className="tl-pro">PRO</span>
                    </div>
                    {isPro ? (
                      insightText ? (
                        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.8 }}>{insightText}</p>
                      ) : insight.status === 'error' ? (
                        <div style={{ fontSize: 13, color: 'var(--qh-danger)' }}>{t('oee_next_error')}</div>
                      ) : (
                        <div style={{ fontSize: 13, color: 'var(--qh-muted)' }}>{t('oee_next_loading')}</div>
                      )
                    ) : (
                      <>
                        <p aria-hidden="true" style={{ margin: 0, fontSize: 14, lineHeight: 1.8, opacity: 0.45, userSelect: 'none' }}>{t('oee_next_sample')}</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 10 }}>
                          <span style={{ fontSize: 13, color: 'var(--qh-muted)' }}>{t('oee_next_locked')}</span>
                          <button type="button" className="tl-xbtn tl-xbtn-pro" onClick={() => goToPricing('oee', 'insight')}>{t('oee_next_getpro')}</button>
                        </div>
                      </>
                    )}
                  </div>
                </>
              ) : (
                <div className="tl-card tl-empty">{errorKey ? t(errorKey) : t('oee_empty_state')}</div>
              )}
            </section>
          </div>
        </div>
      </div>

      <PhoneBar
        showResultActions={mobileTab === 'results' && !!result}
        onAnalyze={() => { setMobileTab('results'); window.scrollTo({ top: 0 }) }}
        onEdit={() => setMobileTab('setup')}
        analyzeLabel={t('oee_bar_results')}
      />
    </div>
  )
}
