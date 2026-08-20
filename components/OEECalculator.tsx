'use client'

import { useEffect, useRef, useState } from 'react'
import 'chart.js/auto'
import { Chart } from 'react-chartjs-2'
import type { Chart as ChartJSInstance } from 'chart.js'
import jsPDF from 'jspdf'
import { COLORS, usePersistedTheme } from '@/lib/theme'
import Nav from '@/components/Nav'
import SaveAnalysisButton from '@/components/SaveAnalysisButton'
import { useSubscription } from '@/lib/useSubscription'
import { goToLogin, goToPricing } from '@/lib/exportGate'
import { useLanguage } from '@/lib/i18n/context'
import type { TKey } from '@/lib/i18n/translations'
import { createReport, nowStamp, type Tone } from '@/lib/excelReport'

// ─────────────────────────────────────────────────────────────────────────
// OEE = Availability × Performance × Quality  (Nakajima / JIPM TPM standard)
// World-class benchmark: A ≥ 90%, P ≥ 95%, Q ≥ 99.9%, OEE ≥ 85%
// ─────────────────────────────────────────────────────────────────────────

interface OEEInputs {
  plannedTime: number   // minutes
  breaks: number         // minutes (planned downtime, excluded from base)
  downtime: number       // minutes (unplanned)
  cycleTime: number      // seconds / part (ideal cycle time)
  totalCount: number     // parts produced
  goodCount: number      // good parts (first pass)
}

interface OEEResult {
  netPlanned: number
  runTime: number
  availability: number
  performance: number
  performanceCapped: number
  quality: number
  oee: number
  downtimeLoss: number
  speedLoss: number
  qualityLoss: number
}

type Classification = 'world-class' | 'good' | 'average' | 'poor'

function classify(oee: number): { labelKey: TKey; type: Classification } {
  if (oee >= 85) return { labelKey: 'oee_class_worldclass', type: 'world-class' }
  if (oee >= 60) return { labelKey: 'oee_class_good', type: 'good' }
  if (oee >= 40) return { labelKey: 'oee_class_average', type: 'average' }
  return { labelKey: 'oee_class_poor', type: 'poor' }
}

function calcOEE(i: OEEInputs): OEEResult | null {
  const netPlanned = i.plannedTime - i.breaks
  if (netPlanned <= 0) return null
  if (i.downtime >= netPlanned) return null

  const runTime = netPlanned - i.downtime
  const availability = (runTime / netPlanned) * 100
  const performance = i.totalCount > 0 && i.cycleTime > 0
    ? ((i.totalCount * i.cycleTime) / 60 / runTime) * 100
    : 0
  const performanceCapped = Math.min(performance, 100)
  const quality = i.totalCount > 0 ? (i.goodCount / i.totalCount) * 100 : 0
  const oee = (availability / 100) * (performanceCapped / 100) * (quality / 100) * 100

  const downtimeLoss = (i.downtime / netPlanned) * 100
  const speedLoss = Math.max(0, 100 - performance) * (runTime / netPlanned)
  const qualityLoss = Math.max(0, 100 - quality) * (runTime / netPlanned) * (performanceCapped / 100)

  return {
    netPlanned, runTime, availability, performance, performanceCapped,
    quality, oee, downtimeLoss, speedLoss, qualityLoss,
  }
}

function validate(i: OEEInputs): TKey | null {
  if (i.plannedTime <= 0) return 'oee_err_planned'
  if (i.plannedTime - i.breaks <= 0) return 'oee_err_breaks'
  if (i.downtime >= i.plannedTime - i.breaks) return 'oee_err_downtime'
  if (i.goodCount > i.totalCount) return 'oee_err_goodparts'
  if (i.cycleTime <= 0) return 'oee_err_cycletime'
  return null
}

const BENCH = [
  { key: 'availability', labelKey: 'oee_bench_availability', wc: 90, note: 'A ≥ 90%' },
  { key: 'performanceCapped', labelKey: 'oee_bench_performance', wc: 95, note: 'P ≥ 95%' },
  { key: 'quality', labelKey: 'oee_bench_quality', wc: 99.9, note: 'Q ≥ 99.9%' },
  { key: 'oee', labelKey: 'oee_bench_oee', wc: 85, note: 'OEE ≥ 85%' },
] as const

export default function OEECalculator() {
  const { isPro, isLoggedIn } = useSubscription()
  const [theme, setTheme] = usePersistedTheme()
  const { t, lang } = useLanguage()
  const c = COLORS[theme]
  const chartRef = useRef<ChartJSInstance<'bar'>>(null)

  const [inputs, setInputs] = useState<OEEInputs>({
    plannedTime: 480,
    breaks: 0,
    downtime: 52,
    cycleTime: 6.0,
    totalCount: 3800,
    goodCount: 3650,
  })
  const [loadedProjectName, setLoadedProjectName] = useState('')
  const [loadError, setLoadError] = useState('')

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

  const classColor: Record<Classification, string> = {
    'world-class': '#22c55e',
    good: c.accent,
    average: c.amber,
    poor: c.danger,
  }

  const lossData = result
    ? [
        { labelKey: 'oee_loss_downtime' as TKey, subKey: 'oee_loss_downtime_sub' as TKey, value: result.downtimeLoss, color: c.danger },
        { labelKey: 'oee_loss_speed' as TKey, subKey: 'oee_loss_speed_sub' as TKey, value: result.speedLoss, color: c.amber },
        { labelKey: 'oee_loss_quality' as TKey, subKey: 'oee_loss_quality_sub' as TKey, value: result.qualityLoss, color: c.accent },
      ]
    : []

  const chartData = {
    labels: lossData.map(l => t(l.labelKey)),
    datasets: [
      {
        label: t('oee_loss_pct_label'),
        data: lossData.map(l => Number(l.value.toFixed(2))),
        backgroundColor: lossData.map(l => l.color),
        borderRadius: 4,
      },
    ],
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartOptions: any = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: c.surface,
        borderColor: c.border,
        borderWidth: 1,
        titleColor: c.text,
        bodyColor: c.muted,
        padding: 10,
        callbacks: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          label: (ctx: any) => ` ${ctx.raw.toFixed(2)}%`,
        },
      },
    },
    scales: {
      x: {
        min: 0,
        ticks: { color: c.muted, font: { size: 11 }, callback: (v: number) => `${v}%` },
        grid: { color: c.grid },
        border: { color: c.border },
      },
      y: {
        ticks: { color: c.text, font: { size: 12, weight: 600 } },
        grid: { display: false },
        border: { color: c.border },
      },
    },
  }

  const exportCSV = () => {
    if (!isLoggedIn) { goToLogin(); return }
    if (!result || !cls) return
    const lines = [
      'Metric,Value,Unit',
      `OEE (Overall),${result.oee.toFixed(2)},%`,
      `Availability,${result.availability.toFixed(2)},%`,
      `Performance,${result.performanceCapped.toFixed(2)},%`,
      `Quality (First Pass Yield),${result.quality.toFixed(2)},%`,
      '',
      'Six Big Losses,Value,Unit',
      ...lossData.map(l => `${t(l.labelKey)},${l.value.toFixed(2)},%`),
      '',
      'Benchmark,Your Value,World-Class,Gap',
      ...BENCH.map(b => {
        const yours = result[b.key]
        const gap = yours - b.wc
        return `${t(b.labelKey)},${yours.toFixed(2)}%,${b.wc}%,${gap >= 0 ? '+' : ''}${gap.toFixed(2)}%`
      }),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'oee-analysis.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportExcel = async () => {
    if (!isPro) { goToPricing(); return }
    if (!result || !cls) return
    const report = createReport({ toolName: 'OEE Calculator' })
    const classTone: Tone = cls.type === 'world-class' || cls.type === 'good' ? 'good' : cls.type === 'average' ? 'warning' : 'danger'

    const overview = report.addSheet('Overview')
    overview.titleBand('OEE (Overall Equipment Effectiveness) Report', t(cls.labelKey))
    overview.metaStrip([
      ['Generated on', nowStamp()],
      ['Standard', 'Nakajima / JIPM TPM — OEE = Availability × Performance × Quality'],
    ])

    overview.sectionHeading('OEE Indices')
    overview.kpiRow([
      { label: 'OEE (Overall)', value: `${result.oee.toFixed(2)}%`, tone: classTone },
      { label: 'Availability', value: `${result.availability.toFixed(2)}%`, tone: 'neutral' },
      { label: 'Performance', value: `${result.performanceCapped.toFixed(2)}%`, tone: 'neutral' },
      { label: 'Quality', value: `${result.quality.toFixed(2)}%`, tone: 'neutral' },
    ])

    overview.table({
      headers: [
        { header: 'Metric', key: 'metric', align: 'left', width: 26 },
        { header: 'Value (%)', key: 'value', align: 'right' },
      ],
      rows: [
        ['OEE (Overall)', result.oee.toFixed(2)],
        ['Availability', result.availability.toFixed(2)],
        ['Performance', result.performanceCapped.toFixed(2)],
        ['Quality (First Pass Yield)', result.quality.toFixed(2)],
      ],
    })

    overview.sectionHeading('Six Big Losses')
    overview.table({
      headers: [
        { header: 'Loss Category', key: 'cat', align: 'left', width: 22 },
        { header: 'Description', key: 'desc', align: 'left', width: 36 },
        { header: 'Value (%)', key: 'value', align: 'right' },
      ],
      rows: lossData.map(l => [t(l.labelKey), t(l.subKey), l.value.toFixed(2)]),
      rowTones: lossData.map(l => l.value >= 15 ? 'danger' : l.value >= 5 ? 'warning' : undefined),
    })

    overview.sectionHeading('Benchmark vs World-Class')
    overview.table({
      headers: [
        { header: 'Metric', key: 'metric', align: 'left', width: 22 },
        { header: 'Your Value (%)', key: 'yours', align: 'right' },
        { header: 'World-Class (%)', key: 'wc', align: 'right' },
        { header: 'Gap (%)', key: 'gap', align: 'right' },
      ],
      rows: BENCH.map(b => {
        const yours = result[b.key]
        const gap = yours - b.wc
        return [t(b.labelKey), yours.toFixed(2), b.wc, `${gap >= 0 ? '+' : ''}${gap.toFixed(2)}`]
      }),
      rowTones: BENCH.map(b => (result[b.key] - b.wc) >= 0 ? 'good' : 'warning'),
    })

    overview.note(`Classification: ${t(cls.labelKey)}`, classTone)
    overview.freezeHeader(2)

    await report.download('oee-analysis.xlsx')
  }

  const exportPNG = () => {
    if (!isLoggedIn) { goToLogin(); return }
    const chart = chartRef.current
    if (!chart) return
    const url = chart.toBase64Image('image/png', 1)
    const a = document.createElement('a')
    a.href = url
    a.download = 'oee-six-losses-chart.png'
    a.click()
  }

  const exportPDF = () => {
    if (!isPro) { goToPricing(); return }
    if (!result || !cls) return
    const chart = chartRef.current
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const margin = 40
    let y = margin

    pdf.setFontSize(18)
    pdf.setFont('helvetica', 'bold')
    pdf.text('OEE Analysis Report', margin, y)
    y += 10
    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(100)
    pdf.text(`Generated: ${new Date().toLocaleDateString()}`, margin, y + 12)
    y += 34

    pdf.setFontSize(13)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(0)
    pdf.text(`OEE: ${result.oee.toFixed(2)}%  —  ${t(cls.labelKey)}`, margin, y)
    y += 24

    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'normal')
    const indexLines = [
      `Availability: ${result.availability.toFixed(2)}%`,
      `Performance: ${result.performanceCapped.toFixed(2)}%`,
      `Quality: ${result.quality.toFixed(2)}%`,
    ]
    indexLines.forEach(line => { pdf.text(line, margin, y); y += 16 })
    y += 10

    if (chart) {
      const imgData = chart.toBase64Image('image/png', 1)
      const imgWidth = pageWidth - margin * 2
      const imgHeight = (chart.height / chart.width) * imgWidth
      pdf.addImage(imgData, 'PNG', margin, y, imgWidth, imgHeight)
      y += imgHeight + 24
    }

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(11)
    pdf.text('World-Class Benchmark', margin, y)
    y += 18
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    BENCH.forEach(b => {
      const yours = result[b.key]
      const gap = yours - b.wc
      pdf.text(
        `${t(b.labelKey)}: ${yours.toFixed(2)}%  (World-class ${b.wc}%, gap ${gap >= 0 ? '+' : ''}${gap.toFixed(2)}%)`,
        margin, y
      )
      y += 15
    })

    pdf.save('oee-report.pdf')
  }

  const s: Record<string, React.CSSProperties> = {
    page: {
      display: 'flex', flexDirection: 'column', minHeight: '100vh',
      background: c.bg, color: c.text,
      fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: 14,
    },
    nav: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 32px', height: 56,
      background: theme === 'dark' ? 'rgba(6,13,26,.95)' : '#ffffff',
      backdropFilter: 'blur(24px)',
      borderBottom: `1px solid ${theme === 'dark' ? 'rgba(15,212,200,.1)' : c.border}`,
      flexShrink: 0,
    },
    navLeft: { display: 'flex', alignItems: 'center', gap: 16 },
    navRight: { display: 'flex', alignItems: 'center', gap: 14 },
    logo: {
      display: 'flex', alignItems: 'center', gap: 9,
      textDecoration: 'none', color: theme === 'dark' ? '#f0f6ff' : c.text,
      fontWeight: 800, fontSize: 15,
    },
    logoIcon: {
      width: 30, height: 30,
      background: 'linear-gradient(135deg,#0fd4c8,#00a896)',
      borderRadius: 7, display: 'flex', alignItems: 'center',
      justifyContent: 'center', color: '#060d1a', fontWeight: 900, fontSize: 13,
    },
    separator: { color: 'rgba(255,255,255,.12)', fontSize: 20 },
    breadcrumb: { fontSize: 13, color: c.muted, fontWeight: 500 },
    themeBtn: {
      background: theme === 'dark' ? 'rgba(255,255,255,0.08)' : c.surface2,
      border: `1px solid ${c.border}`,
      borderRadius: 20, padding: '5px 14px',
      color: c.text, cursor: 'pointer', fontSize: 12, fontWeight: 600,
    },
    body: { display: 'flex', flex: 1, overflow: 'hidden' },
    left: {
      width: 320, flexShrink: 0,
      background: c.surface,
      borderRight: `1px solid ${c.border}`,
      overflowY: 'auto', padding: 20,
      display: 'flex', flexDirection: 'column', gap: 20,
    },
    right: { flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 },
    sectionTitle: { fontSize: 11, fontWeight: 700, color: c.muted, textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 12 },
    card: { background: c.surface, border: `1px solid ${c.border}`, borderRadius: 12, padding: 20 },
    input: {
      background: theme === 'dark' ? '#0d1520' : '#f8fafc',
      border: `1px solid ${c.border}`, borderRadius: 7,
      color: c.text, padding: '7px 10px', fontSize: 13, outline: 'none', width: '100%',
    },
    label: { fontSize: 10, color: c.muted, marginBottom: 4 },
    field: { marginBottom: 14 },
    exportBtn: {
      background: c.surface2, border: `1px solid ${c.border}`,
      borderRadius: 8, color: c.text, padding: '9px 10px',
      cursor: 'pointer', fontSize: 12, fontWeight: 600,
      display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
    },
    statsRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 },
    statCard: {
      background: c.surface2, border: `1px solid ${c.border}`,
      borderRadius: 10, padding: '14px 16px', textAlign: 'center' as const,
    },
    statVal: { fontSize: 22, fontWeight: 800, color: c.accent },
    statLabel: { fontSize: 11, color: c.muted, marginTop: 4 },
    chartWrap: { background: c.surface, border: `1px solid ${c.border}`, borderRadius: 12, padding: 20 },
    chartInner: { height: 220, position: 'relative' as const },
    table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 },
    th: {
      textAlign: 'left' as const, padding: '10px 12px',
      color: c.muted, fontWeight: 600, fontSize: 11,
      borderBottom: `1px solid ${c.border}`,
      textTransform: 'uppercase' as const, letterSpacing: 0.5,
    },
    td: { padding: '10px 12px', borderBottom: `1px solid ${c.border}40` },
    banner: {
      padding: '14px 18px', borderRadius: 10,
      fontWeight: 700, fontSize: 14,
      border: '1.5px solid',
    },
  }

  const fields: { key: keyof OEEInputs; labelKey: TKey; step?: string }[] = [
    { key: 'plannedTime', labelKey: 'oee_field_planned' },
    { key: 'breaks', labelKey: 'oee_field_breaks' },
    { key: 'downtime', labelKey: 'oee_field_downtime' },
    { key: 'cycleTime', labelKey: 'oee_field_cycletime', step: '0.1' },
    { key: 'totalCount', labelKey: 'oee_field_total' },
    { key: 'goodCount', labelKey: 'oee_field_good' },
  ]

  return (
    <div style={s.page}>
      <Nav theme={theme} setTheme={setTheme} breadcrumbKey="bc_oee" />

      {loadedProjectName && (
        <div style={{ margin: '0 32px', fontSize: 13, color: c.accent, background: c.surface2, border: `1px solid ${c.border}`, borderRadius: 8, padding: '8px 14px' }}>
          {lang === 'ar' ? `تم تحميل المشروع المحفوظ: ${loadedProjectName}` : `Loaded saved project: ${loadedProjectName}`}
        </div>
      )}
      {loadError && (
        <div style={{ margin: '0 32px', fontSize: 13, color: c.danger, background: c.surface2, border: `1px solid ${c.border}`, borderRadius: 8, padding: '8px 14px' }}>
          {loadError}
        </div>
      )}

      <div className="qh-body" style={s.body}>
        <div className="qh-left" style={s.left}>
          <div>
            <div style={s.sectionTitle}>{t('oee_production_data')}</div>
            {fields.map(f => (
              <div key={f.key} style={s.field}>
                <div style={s.label}>{t(f.labelKey)}</div>
                <input
                  style={s.input}
                  type="number"
                  step={f.step ?? '1'}
                  min={0}
                  value={inputs[f.key] || ''}
                  onChange={e => setField(f.key, e.target.value)}
                />
              </div>
            ))}
            <div style={{ fontSize: 10, color: c.muted, lineHeight: 1.6, marginTop: 4 }}>
              {t('oee_hint')}
            </div>
            {errorKey && (
              <div style={{ color: c.danger, fontSize: 12, marginTop: 10, fontWeight: 600 }}>
                {t(errorKey)}
              </div>
            )}
          </div>

          {result && (
            <div>
              <div style={s.sectionTitle}>{t('common_export_section')}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button style={s.exportBtn} onClick={exportCSV}>{isLoggedIn ? t('common_export_csv') : t('common_export_csv_locked')}</button>
                <button style={s.exportBtn} onClick={exportExcel}>{isPro ? t('common_export_excel') : t('common_export_excel_locked')}</button>
                <button style={s.exportBtn} onClick={exportPNG}>{isLoggedIn ? t('common_export_png') : t('common_export_png_locked')}</button>
                <button style={s.exportBtn} onClick={exportPDF}>{isPro ? t('common_export_pdf') : t('common_export_pdf_locked')}</button>
              </div>
              <div style={{ marginTop: 8 }}>
                <SaveAnalysisButton
                  theme={theme}
                  tool="oee"
                  defaultName={`OEE — ${new Date().toLocaleDateString('en-US')}`}
                  getPayload={() => ({ input_data: inputs, results: result })}
                />
              </div>
            </div>
          )}
        </div>

        <div className="qh-right" style={s.right}>
          {result && cls ? (
            <>
              <div
                style={{
                  ...s.banner,
                  color: classColor[cls.type],
                  borderColor: classColor[cls.type],
                  background: `${classColor[cls.type]}15`,
                }}
              >
                {t(cls.labelKey)} — OEE {result.oee.toFixed(2)}%
              </div>

              <div className="qh-stats-row" style={s.statsRow}>
                <div style={s.statCard}>
                  <div style={{ ...s.statVal, color: classColor[cls.type] }}>{result.oee.toFixed(1)}%</div>
                  <div style={s.statLabel}>{t('oee_stat_overall')}</div>
                </div>
                <div style={s.statCard}>
                  <div style={s.statVal}>{result.availability.toFixed(1)}%</div>
                  <div style={s.statLabel}>{t('oee_stat_availability')}</div>
                </div>
                <div style={s.statCard}>
                  <div style={s.statVal}>{result.performanceCapped.toFixed(1)}%</div>
                  <div style={s.statLabel}>{t('oee_stat_performance')}</div>
                </div>
                <div style={s.statCard}>
                  <div style={s.statVal}>{result.quality.toFixed(1)}%</div>
                  <div style={s.statLabel}>{t('oee_stat_quality_fpy')}</div>
                </div>
              </div>

              <div className="qh-chart-wrap" style={s.chartWrap}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{t('oee_sixlosses_title')}</div>
                <div style={{ color: c.muted, fontSize: 12, marginBottom: 16 }}>
                  {t('oee_sixlosses_sub')}
                </div>
                <div className="qh-chart-inner" style={s.chartInner}>
                  <Chart ref={chartRef} type="bar" data={chartData} options={chartOptions} />
                </div>
              </div>

              <div style={s.card}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>{t('oee_bench_title')}</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={s.table}>
                    <thead>
                      <tr>
                        <th style={s.th}>{t('oee_col_metric')}</th>
                        <th style={{ ...s.th, textAlign: 'right' }}>{t('oee_col_yourvalue')}</th>
                        <th style={{ ...s.th, textAlign: 'right' }}>{t('oee_col_worldclass')}</th>
                        <th style={{ ...s.th, textAlign: 'right' }}>{t('oee_col_gap')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {BENCH.map(b => {
                        const yours = result[b.key]
                        const gap = yours - b.wc
                        return (
                          <tr key={b.key}>
                            <td style={s.td}>
                              {t(b.labelKey)}
                              <div style={{ fontSize: 10, color: c.muted }}>{b.note}</div>
                            </td>
                            <td style={{ ...s.td, textAlign: 'right', fontWeight: 700, color: yours >= b.wc ? '#22c55e' : c.text }}>
                              {yours.toFixed(1)}%
                            </td>
                            <td style={{ ...s.td, textAlign: 'right', color: c.muted }}>{b.wc}%</td>
                            <td style={{ ...s.td, textAlign: 'right', fontWeight: 700, color: gap >= 0 ? '#22c55e' : c.danger }}>
                              {gap >= 0 ? '+' : ''}{gap.toFixed(1)}%
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={s.card}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>{t('oee_conditions_title')}</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={s.table}>
                    <tbody>
                      <tr><td style={{ ...s.td, color: c.muted }}>{t('oee_row_plannedtime')}</td><td style={s.td}>{inputs.plannedTime} {t('oee_unit_min')} ({t('oee_unit_net')}: {result.netPlanned} {t('oee_unit_min')})</td></tr>
                      <tr><td style={{ ...s.td, color: c.muted }}>{t('oee_row_unplanned')}</td><td style={s.td}>{inputs.downtime} {t('oee_unit_min')}</td></tr>
                      <tr><td style={{ ...s.td, color: c.muted }}>{t('oee_row_idealcycle')}</td><td style={s.td}>{inputs.cycleTime} {t('oee_unit_secpart')}</td></tr>
                      <tr><td style={{ ...s.td, color: c.muted }}>{t('oee_row_totalproduced')}</td><td style={s.td}>{Math.round(inputs.totalCount).toLocaleString()} {t('oee_unit_parts')}</td></tr>
                      <tr><td style={{ ...s.td, color: c.muted }}>{t('oee_row_goodparts')}</td><td style={s.td}>{Math.round(inputs.goodCount).toLocaleString()} {t('oee_unit_parts')} ({result.quality.toFixed(2)}%)</td></tr>
                      <tr><td style={{ ...s.td, color: c.muted, borderBottom: 'none' }}>{t('oee_row_formula')}</td><td style={{ ...s.td, borderBottom: 'none' }}>OEE = A × P × Q</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div style={{ ...s.card, textAlign: 'center', padding: 60, color: c.muted }}>
              {errorKey ? t(errorKey) : t('oee_empty_state')}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
