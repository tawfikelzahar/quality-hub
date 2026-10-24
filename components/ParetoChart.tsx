'use client'

import { useEffect, useRef, useState } from 'react'
import 'chart.js/auto'
import { Chart } from 'react-chartjs-2'
import type { Chart as ChartJSInstance } from 'chart.js'
import { COLORS, getSharedStyles, usePersistedTheme, tint } from '@/lib/theme'
import Nav from '@/components/Nav'
import ToolSidebar from '@/components/ToolSidebar'
import ToolStyles from '@/components/tool/ToolStyles'
import { ToolHeader, HelpPanel, PhoneTabs, PhoneBar, ExportRow, DataCardHead, useCompactSave, type MobileTab } from '@/components/tool/ToolParts'
import SaveAnalysisButton from '@/components/SaveAnalysisButton'
import { SheetPicker, PasteToast } from '@/components/GridImportControls'
import { useGridImport } from '@/lib/gridImport'
import { useSubscription } from '@/lib/useSubscription'
import { goToLogin, goToPricing } from '@/lib/exportGate'
import { watermarkOptions, watermarkLayout, withWatermarksDisabled } from '@/lib/watermarkHelpers'
import { useLanguage } from '@/lib/i18n/context'
import { createReport, nowStamp } from '@/lib/excelReport'
import { createReport as createPdfReport, addChartImage, dataTable, calloutBox, finalizeReport, REPORT_COLORS } from '@/lib/pdf/reportDesign'
import { paretoAnalysis, PARETO_DEFAULT_COMBINE, VITAL_FEW_PCT } from '@/lib/pareto/calc'
import { fixed } from '@/lib/stats/format'

// ─────────────────────────────────────────────────────────────────────────
// Pareto page on the shared tool layout. The analysis (sorting, duplicates,
// "Other", vital few) is lib/pareto/calc.ts; this page edits rows and draws.
// ─────────────────────────────────────────────────────────────────────────

interface Row {
  id: string
  label: string
  value: string
}

const newId = () => Math.random().toString(36).slice(2, 9)
const toRows = (pairs: [string, number | string][]): Row[] => pairs.map(([label, value]) => ({ id: newId(), label, value: String(value) }))

const EXAMPLE: [string, number][] = [
  ['Dimensional error', 42],
  ['Surface defect', 28],
  ['Wrong material', 15],
  ['Assembly fault', 9],
  ['Packaging damage', 6],
]

const int = (v: number) => Number(v.toPrecision(12)).toLocaleString('en-US')
const ltr = (v: string) => `⁦${v}⁩`
const csvCell = (v: string) => `"${v.replace(/"/g, '""')}"`

export default function ParetoChart() {
  const { isPro, isLoggedIn } = useSubscription()
  const [theme, setTheme] = usePersistedTheme()
  const { t, lang } = useLanguage()
  const c = COLORS[theme]
  const s = getSharedStyles(theme)
  const compactSave = useCompactSave()
  const chartRef = useRef<ChartJSInstance<'bar' | 'line'>>(null)

  const [rows, setRows] = useState<Row[]>(() => toRows(EXAMPLE))
  const [combineOn, setCombineOn] = useState(true)
  const [combineAt, setCombineAt] = useState(String(PARETO_DEFAULT_COMBINE))
  const [mobileTab, setMobileTab] = useState<MobileTab>('data')
  const [helpOpen, setHelpOpen] = useState(false)
  const [loadedProjectName, setLoadedProjectName] = useState('')
  const [loadError, setLoadError] = useState('')

  // ── Load a saved project (?id=...). Old saves are a plain row array. ──
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id')
    if (!id) return
    fetch(`/api/saved-analyses/${id}`)
      .then(res => (res.ok ? res.json() : Promise.reject()))
      .then(({ analysis }) => {
        const input = analysis.input_data as { label: string; value: number }[] | { rows: { label: string; value: number }[]; combine: number | null }
        const list = Array.isArray(input) ? input : input.rows
        setRows(toRows(list.map(r => [r.label, r.value])))
        if (!Array.isArray(input)) {
          setCombineOn(input.combine !== null)
          if (input.combine !== null) setCombineAt(String(input.combine))
        }
        setLoadedProjectName(analysis.name as string)
      })
      .catch(() => setLoadError(lang === 'ar' ? 'تعذر تحميل المشروع المحفوظ.' : 'Could not load the saved project.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Paste anywhere / upload: first column = category, second = count
  const gridImport = useGridImport({
    minCellsPerRow: 2,
    onGrid: grid => {
      const next = grid
        .filter(r => r.length >= 2 && r[0].trim() !== '' && Number.isFinite(parseFloat(r[1])))
        .map(r => [r[0].trim(), parseFloat(r[1])] as [string, number])
      if (next.length > 0) setRows(toRows(next))
    },
    onError: () => undefined,
  })

  const combine = combineOn ? Math.min(99.9, Math.max(1, parseFloat(combineAt) || PARETO_DEFAULT_COMBINE)) : null
  const input = rows.map(r => ({ label: r.label, value: parseFloat(r.value) }))
  const result = paretoAnalysis(input, combine)
  const items = result?.items ?? []
  const other = items.find(it => it.other)
  const labelOf = (it: { label: string; other: boolean }) => (it.other ? t('pareto_other') : it.label)

  const updateRow = (id: string, field: 'label' | 'value', v: string) => setRows(prev => prev.map(r => (r.id === id ? { ...r, [field]: v } : r)))
  const removeRow = (id: string) => setRows(prev => prev.filter(r => r.id !== id))
  const addRow = () => setRows(prev => [...prev, { id: newId(), label: '', value: '' }])
  const clearAll = () => setRows([])
  const loadExample = () => { setRows(toRows(EXAMPLE)); setCombineOn(true); setCombineAt(String(PARETO_DEFAULT_COMBINE)); setMobileTab('results') }

  // ── Chart: bars (vital few full colour), cumulative line, 80% line ──
  const chartData = {
    labels: items.map(labelOf),
    datasets: [
      {
        type: 'bar' as const,
        label: t('pareto_axis_frequency'),
        data: items.map(it => it.count),
        backgroundColor: items.map(it => (it.vital ? c.bar : tint(c.bar, 40))),
        borderColor: c.bar,
        borderWidth: 1,
        barPercentage: 1,
        categoryPercentage: 0.85,
        yAxisID: 'y',
        order: 3,
      },
      {
        type: 'line' as const,
        label: t('pareto_axis_cumulative'),
        data: items.map(it => Number(it.cum.toFixed(1))),
        borderColor: c.line,
        backgroundColor: c.line,
        borderWidth: 2.5,
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0,
        yAxisID: 'y2',
        order: 1,
        fill: false,
      },
      {
        type: 'line' as const,
        label: `${VITAL_FEW_PCT}%`,
        data: items.map(() => VITAL_FEW_PCT),
        borderColor: c.danger,
        borderWidth: 1.2,
        borderDash: [6, 4],
        pointRadius: 0,
        pointHoverRadius: 0,
        yAxisID: 'y2',
        order: 2,
        fill: false,
      },
    ],
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    devicePixelRatio: 2,
    interaction: { mode: 'index', intersect: false },
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
        filter: (item: { datasetIndex: number }) => item.datasetIndex !== 2,
        callbacks: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          label: (ctx: any) => {
            const it = items[ctx.dataIndex]
            if (!it) return ''
            if (ctx.datasetIndex === 1) return ` ${t('pareto_tooltip_cumulative')}: ${fixed(it.cum, 1)}%`
            return ` ${t('pareto_tooltip_count')}: ${int(it.count)} (${fixed(it.pct, 1)}%)`
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          afterBody: (list: any[]) => {
            const it = items[list[0]?.dataIndex]
            if (it?.other && it.members) return ['', t('pareto_other_members').replace('{list}', it.members.join(', '))]
            return it?.vital ? ['', t('pareto_tooltip_vitalfew')] : []
          },
        },
      },
    },
    scales: {
      x: { ticks: { color: c.muted, font: { size: 11 }, maxRotation: 35, autoSkip: false }, grid: { display: false }, border: { color: c.border } },
      y: { position: 'left', beginAtZero: true, max: result ? result.total : undefined, ticks: { color: c.muted, font: { size: 11 } }, grid: { color: c.grid }, border: { color: c.border }, title: { display: true, text: t('pareto_axis_frequency'), color: c.muted, font: { size: 11 } } },
      y2: { position: 'right', min: 0, max: 100, ticks: { color: c.line, font: { size: 11 }, callback: (v: number) => `${v}%` }, grid: { drawOnChartArea: false }, border: { color: c.line }, title: { display: true, text: t('pareto_axis_cumulative'), color: c.line, font: { size: 11 } } },
    },
  }

  // ── Exports (file content in English) ──
  const nameEn = (it: { label: string; other: boolean }) => (it.other ? 'Other' : it.label)
  const statusEn = (it: { vital: boolean }) => (it.vital ? 'Vital Few' : 'Useful Many')
  const otherNote = other?.members ? `"Other" combines ${other.members.length} categories after the cumulative percent passed ${combine}%: ${other.members.join(', ')}.` : null

  const exportCSV = () => {
    if (!isLoggedIn) { goToLogin('pareto', 'csv'); return }
    if (!result) return
    const lines = [
      'Rank,Category,Count,Percent of Total,Cumulative Percent,Status',
      ...items.map((it, i) => `${i + 1},${csvCell(nameEn(it))},${it.count},${fixed(it.pct, 1)},${fixed(it.cum, 1)},${statusEn(it)}`),
      '',
      `Total,${result.total}`,
      ...(other?.members ? [`Other = ${csvCell(other.members.join('; '))}`] : []),
    ]
    const blob = new Blob(['\uFEFF', lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'pareto-data.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const runExportExcel = async () => {
    if (!isPro) { goToPricing('pareto', 'excel'); return }
    if (!result) return
    const report = createReport({ toolName: 'Pareto Chart' })
    const overview = report.addSheet('Overview')
    overview.titleBand('Pareto Analysis Report', `${result.categories} categories — vital few at ${VITAL_FEW_PCT}%`)
    overview.metaStrip([
      ['Generated on', nowStamp()],
      ['Total count', result.total],
      ['Other', combine === null ? 'Not grouped' : `Grouped after ${combine}% cumulative`],
    ])
    overview.sectionHeading('At a Glance')
    overview.kpiRow([
      { label: 'Vital Few', value: result.vitalFew, sub: `categories = ${fixed(result.vitalCum, 1)}%`, tone: 'accent' },
      { label: 'Categories', value: result.categories, tone: 'neutral' },
      { label: 'Total Count', value: result.total, tone: 'neutral' },
      { label: 'Top Category', value: `${fixed(items[0].pct, 1)}%`, sub: nameEn(items[0]), tone: 'neutral' },
    ])
    overview.sectionHeading('Category Breakdown')
    overview.table({
      headers: [
        { header: 'Rank', key: 'rank', align: 'center', width: 8 },
        { header: 'Category', key: 'category', align: 'left', width: 28 },
        { header: 'Count', key: 'count', align: 'right', numFmt: '#,##0.##' },
        { header: 'Percent of Total', key: 'pct', align: 'right', numFmt: '0.0' },
        { header: 'Cumulative Percent', key: 'cum', align: 'right', numFmt: '0.0' },
        { header: 'Status', key: 'status', align: 'center', width: 16 },
      ],
      rows: items.map((it, i) => ({ rank: i + 1, category: nameEn(it), count: it.count, pct: Number(it.pct.toPrecision(12)), cum: Number(it.cum.toPrecision(12)), status: statusEn(it) })),
      rowTones: items.map(it => (it.vital ? 'accent' : undefined)),
    })
    if (otherNote) overview.note(otherNote, 'neutral')
    overview.sectionHeading('Pareto Chart')
    if (chartRef.current) await overview.image(chartRef.current.toBase64Image('image/png', 1), { widthCm: 17, heightCm: 8 })
    overview.freezeHeader(2)
    await report.download('pareto-data.xlsx')
  }

  const runExportPNG = () => {
    if (!isLoggedIn) { goToLogin('pareto', 'png'); return }
    const chart = chartRef.current
    if (!chart) return
    const a = document.createElement('a')
    a.href = chart.toBase64Image('image/png', 1)
    a.download = 'pareto-chart.png'
    a.click()
  }

  const runExportPDF = () => {
    if (!isPro) { goToPricing('pareto', 'pdf'); return }
    if (!result) return
    const ctx = createPdfReport('Pareto Analysis Report', 'pareto')
    calloutBox(
      ctx,
      `${result.vitalFew} of ${items.length} categories cause ${fixed(result.vitalCum, 1)}% of the problems. Start with ${nameEn(items[0])}: ${fixed(items[0].pct, 1)}% of all ${int(result.total)} counts.`,
      'info'
    )
    addChartImage(ctx, chartRef.current, 'Pareto Chart')
    const w = ctx.pageWidth - ctx.margin * 2
    dataTable(
      ctx,
      'Category Breakdown',
      [
        { header: '#', width: 30, align: 'center' },
        { header: 'CATEGORY', width: w - 400 },
        { header: 'COUNT', width: 70, align: 'right' },
        { header: '% TOTAL', width: 80, align: 'right' },
        { header: 'CUMULATIVE', width: 100, align: 'right' },
        { header: 'STATUS', width: 120, align: 'center' },
      ],
      items.map((it, i) => [String(i + 1), nameEn(it), int(it.count), `${fixed(it.pct, 1)}%`, `${fixed(it.cum, 1)}%`, statusEn(it)]),
      { cellColors: items.map(it => (it.vital ? [null, null, null, null, null, REPORT_COLORS.warn] : [null, null, null, null, null, null])) }
    )
    if (otherNote) calloutBox(ctx, otherNote, 'info')
    finalizeReport(ctx)
    ctx.pdf.save('pareto-report.pdf')
  }

  const exportExcel = () => (isPro ? withWatermarksDisabled([chartRef.current], runExportExcel) : runExportExcel())
  const exportPDF = () => (isPro ? withWatermarksDisabled([chartRef.current], runExportPDF) : runExportPDF())
  const exportPNG = () => (isLoggedIn ? withWatermarksDisabled([chartRef.current], runExportPNG) : runExportPNG())

  // ── Page ──
  const helpSteps = [
    { t: t('pareto_help_s1_t'), d: t('pareto_help_s1_d') },
    { t: t('pareto_help_s2_t'), d: t('pareto_help_s2_d') },
    { t: t('pareto_help_s3_t'), d: t('pareto_help_s3_d') },
    { t: t('pareto_help_s4_t'), d: t('pareto_help_s4_d') },
  ]
  const top = items[0]
  const vc = 'var(--qh-accent)'

  return (
    <div style={s.page}>
      <ToolStyles />
      <Nav theme={theme} setTheme={setTheme} breadcrumbKey="bc_pareto" />

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
        <ToolSidebar current="/pareto" />

        <div className="tl-main">
          <ToolHeader title={t('pareto_title')} intro={t('pareto_intro')} onHelp={() => setHelpOpen(true)} onExample={loadExample} />
          <HelpPanel open={helpOpen} onClose={() => setHelpOpen(false)} title={t('pareto_help_title')} steps={helpSteps} onExample={loadExample} showCapability={false} tip={t('pareto_help_tip')} />
          <PhoneTabs tab={mobileTab} onTab={setMobileTab} dataCount={rows.length} hideSetup />

          <div className="tl-top">
            {/* ── DATA + OPTIONS ──────────────────────────────────────── */}
            <section className="tl-panel tl-setup" data-active={mobileTab === 'data'} aria-label={t('spc_tab_data')} style={{ gap: 14 }}>
              <div className="tl-card">
                <DataCardHead
                  countLabel={t('pareto_data_count').replace('{n}', String(rows.length))}
                  onUpload={gridImport.openFilePicker}
                  onClear={clearAll}
                  extra={<gridImport.FileInput />}
                />
                {gridImport.fileError && <div className="tl-error" style={{ marginBottom: 10 }}>{gridImport.fileError}</div>}
                <SheetPicker
                  sheetNames={gridImport.sheetNames}
                  activeSheet={gridImport.activeSheet}
                  onSelect={gridImport.selectSheet}
                  accentColor={c.accent}
                  textColor={c.text}
                  mutedColor={c.muted}
                  borderColor={c.border}
                />
                <div className="tl-sg-wrap">
                  <table className="tl-sg">
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'start' }}>{t('pareto_col_category')}</th>
                        <th style={{ width: 76 }}>{t('pareto_col_count')}</th>
                        <th aria-label={t('spc_remove')} style={{ width: 28 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(r => (
                        <tr key={r.id}>
                          <td>
                            <input
                              value={r.label}
                              placeholder={t('pareto_placeholder_category')}
                              aria-label={t('pareto_col_category')}
                              onChange={e => updateRow(r.id, 'label', e.target.value)}
                              style={{ textAlign: 'start', fontFamily: 'inherit', fontWeight: 500, minWidth: 0 }}
                            />
                          </td>
                          <td>
                            <input type="number" min={0} value={r.value} aria-label={t('pareto_col_count')} onChange={e => updateRow(r.id, 'value', e.target.value)} style={{ minWidth: 0 }} />
                          </td>
                          <td><button type="button" className="tl-sg-x" aria-label={t('spc_remove')} onClick={() => removeRow(r.id)}>✕</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ marginTop: 10 }}>
                  <button type="button" className="tl-xbtn tl-add" onClick={addRow}>{t('pareto_add_category')}</button>
                </div>
                <div className="tl-paste">{t('pareto_paste_hint')}</div>
              </div>

              <div className="tl-card">
                <div className="tl-label">{t('pareto_options')}</div>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, lineHeight: 1.5, cursor: 'pointer' }}>
                  <input type="checkbox" checked={combineOn} onChange={e => setCombineOn(e.target.checked)} style={{ marginTop: 3 }} />
                  <span>{t('pareto_combine')}</span>
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, paddingInlineStart: 24, fontSize: 13 }}>
                  <input
                    className="tl-input"
                    type="number"
                    min={1}
                    max={99.9}
                    step={1}
                    value={combineAt}
                    disabled={!combineOn}
                    onChange={e => setCombineAt(e.target.value)}
                    style={{ width: 72, padding: '4px 8px' }}
                    aria-label={t('pareto_combine')}
                  />
                  <span>%</span>
                </div>
                <div className="tl-hint">{t('pareto_combine_note')}</div>
              </div>
            </section>

            {/* ── RESULTS ──────────────────────────────────────────────── */}
            <section className="tl-panel tl-results tl-col" data-active={mobileTab === 'results'} aria-label={t('spc_tab_results')}>
              {result && top ? (
                <>
                  <div className="tl-verdict" style={{ background: tint(vc, 8), border: `1px solid ${tint(vc, 35)}` }}>
                    <span className="tl-verdict-icon" aria-hidden="true" style={{ background: tint(vc, 16), color: vc }}>★</span>
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--qh-muted)', marginBottom: 2 }}>{t('pareto_verdict_label')}</div>
                      <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 4 }}>
                        {t('pareto_verdict_title').replace('{k}', ltr(String(result.vitalFew))).replace('{n}', ltr(String(items.length))).replace('{p}', ltr(fixed(result.vitalCum, 1)))}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--qh-muted)', lineHeight: 1.6 }}>
                        {t('pareto_verdict_sub').replace('{top}', labelOf(top)).replace('{p}', ltr(fixed(top.pct, 1))).replace('{total}', ltr(int(result.total)))}
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
                          tool="pareto"
                          defaultName={`Pareto — ${new Date().toLocaleDateString('en-US')}`}
                          compact={compactSave}
                          getPayload={() => ({
                            input_data: { rows: rows.map(r => ({ label: r.label, value: parseFloat(r.value) || 0 })), combine },
                            results: result,
                          })}
                        />
                      }
                    />
                  </div>

                  <div className="tl-kpis tl-kpis-4">
                    <div className="tl-kpi"><span>{t('pareto_kpi_total')}</span><b>{int(result.total)}</b></div>
                    <div className="tl-kpi"><span>{t('pareto_kpi_categories')}</span><b>{result.categories}</b></div>
                    <div className="tl-kpi"><span>{t('pareto_kpi_vital')}</span><b style={{ color: 'var(--qh-accent)' }}>{result.vitalFew}</b></div>
                    <div className="tl-kpi"><span>{t('pareto_kpi_top')}</span><b>{fixed(top.pct, 1)}%</b></div>
                  </div>

                  <div className="tl-chart">
                    <h3>{t('pareto_chart_title')}</h3>
                    <div className="tl-chart-sub">{t('pareto_chart_sub')}</div>
                    <div className="tl-chart-inner">
                      <Chart ref={chartRef} type="bar" data={chartData} options={chartOptions} />
                    </div>
                    {other?.members && <div className="tl-hint">{t('pareto_other_members').replace('{list}', other.members.join(lang === 'ar' ? '، ' : ', '))}</div>}
                  </div>

                  <div className="tl-card">
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>{t('pareto_breakdown_table')}</div>
                    <div style={{ overflowX: 'auto' }}>
                      <table className="tl-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>{t('pareto_col_category')}</th>
                            <th className="num">{t('pareto_col_count')}</th>
                            <th className="num">{t('pareto_col_pct')}</th>
                            <th className="num">{t('pareto_col_cum')}</th>
                            <th>{t('pareto_col_status')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((it, i) => (
                            <tr key={i}>
                              <td>{i + 1}</td>
                              <td style={{ whiteSpace: 'normal', fontWeight: it.vital ? 600 : 400 }}>{labelOf(it)}</td>
                              <td className="num">{int(it.count)}</td>
                              <td className="num">{fixed(it.pct, 1)}</td>
                              <td className="num">{fixed(it.cum, 1)}</td>
                              <td style={{ color: it.vital ? 'var(--qh-accent)' : 'var(--qh-muted)', fontWeight: it.vital ? 600 : 400 }}>
                                {it.vital ? t('pareto_vitalfew') : t('pareto_usefulmany')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                <div className="tl-card tl-empty">{t('pareto_empty_chart')}</div>
              )}
            </section>
          </div>
        </div>
      </div>

      <PhoneBar
        showResultActions={mobileTab === 'results' && !!result}
        onAnalyze={() => { setMobileTab('results'); window.scrollTo({ top: 0 }) }}
        onEdit={() => setMobileTab('data')}
        analyzeLabel={t('pareto_bar_results')}
      />
      <PasteToast show={gridImport.pasteToast} />
    </div>
  )
}
