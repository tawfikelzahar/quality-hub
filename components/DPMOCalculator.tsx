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
import type { TKey } from '@/lib/i18n/translations'
import { createReport, nowStamp, type Tone } from '@/lib/excelReport'
import { createReport as createPdfReport, addChartImage, dataTable, calloutBox, finalizeReport, REPORT_COLORS } from '@/lib/pdf/reportDesign'
import { dpmoMetrics, overallDpmo, validateDpmo, dpmoForSigma, type DpmoError } from '@/lib/dpmo/calc'
import { fixed } from '@/lib/stats/format'

// ─────────────────────────────────────────────────────────────────────────
// DPMO & Sigma page on the shared tool layout. Formulas: lib/dpmo/calc.ts
// (public, in the browser). The overall figure pools defects and
// opportunities across processes.
// ─────────────────────────────────────────────────────────────────────────

interface Row {
  id: string
  name: string
  units: string
  opportunities: string
  defects: string
}

// Performance bands (common Six Sigma benchmarks). `label` stays English for exports.
const SIGMA_BANDS = [
  { min: 6, label: 'World Class', labelKey: 'dpmo_band_worldclass' as TKey, color: 'var(--qh-good)' },
  { min: 5, label: 'Excellent', labelKey: 'dpmo_band_excellent' as TKey, color: 'var(--qh-good)' },
  { min: 4, label: 'Good', labelKey: 'dpmo_band_good' as TKey, color: 'var(--qh-good)' },
  { min: 3, label: 'Industry Average', labelKey: 'dpmo_band_avg' as TKey, color: 'var(--qh-amber)' },
  { min: 2, label: 'Needs Improvement', labelKey: 'dpmo_band_needsimprovement' as TKey, color: 'var(--qh-amber)' },
  { min: -Infinity, label: 'Non-Competitive', labelKey: 'dpmo_band_noncompetitive' as TKey, color: 'var(--qh-danger)' },
]
const bandOf = (sigma: number) => SIGMA_BANDS.find(b => sigma >= b.min) ?? SIGMA_BANDS[SIGMA_BANDS.length - 1]

const ERR_KEY: Record<DpmoError, TKey> = {
  units: 'dpmo_err_units',
  opportunities: 'dpmo_err_opp',
  defects_negative: 'dpmo_err_def_neg',
  defects_over: 'dpmo_err_def_over',
}

const newId = () => Math.random().toString(36).slice(2, 9)
const toRows = (list: [string, number, number, number][]): Row[] =>
  list.map(([name, u, o, d]) => ({ id: newId(), name, units: String(u), opportunities: String(o), defects: String(d) }))

const EXAMPLE: [string, number, number, number][] = [
  ['Assembly line A', 500, 12, 18],
  ['Welding cell B', 200, 10, 30],
  ['Packing C', 1200, 4, 7],
]

const int = (v: number) => Math.round(v).toLocaleString('en-US')
const ltr = (v: string) => `⁦${v}⁩`
/** Sigma for display: two decimals, "—" when there are no defects */
const sig = (s: number) => (Number.isFinite(s) ? fixed(s, 2) : '—')
const csvCell = (v: string) => `"${v.replace(/"/g, '""')}"`

export default function DPMOCalculator() {
  const { isPro, isLoggedIn } = useSubscription()
  const [theme, setTheme] = usePersistedTheme()
  const { t, lang } = useLanguage()
  const c = COLORS[theme]
  const s = getSharedStyles(theme)
  const compactSave = useCompactSave()
  const chartRef = useRef<ChartJSInstance<'bar' | 'line'>>(null)

  const [rows, setRows] = useState<Row[]>(() => toRows(EXAMPLE))
  const [mobileTab, setMobileTab] = useState<MobileTab>('data')
  const [helpOpen, setHelpOpen] = useState(false)
  const [loadedProjectName, setLoadedProjectName] = useState('')
  const [loadError, setLoadError] = useState('')

  // ── Saved project (?id=...): input_data is the process list ──
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id')
    if (!id) return
    fetch(`/api/saved-analyses/${id}`)
      .then(res => (res.ok ? res.json() : Promise.reject()))
      .then(({ analysis }) => {
        const list = analysis.input_data as { name: string; units: number; opportunities: number; defects: number }[]
        setRows(toRows(list.map(r => [r.name, r.units, r.opportunities, r.defects])))
        setLoadedProjectName(analysis.name as string)
      })
      .catch(() => setLoadError(lang === 'ar' ? 'تعذر تحميل المشروع المحفوظ.' : 'Could not load the saved project.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Paste anywhere / upload: process, units, opportunities per unit, defects
  const gridImport = useGridImport({
    minCellsPerRow: 4,
    onGrid: grid => {
      const next = grid
        .filter(r => r.length >= 4 && r[0].trim() !== '' && [r[1], r[2], r[3]].every(v => Number.isFinite(parseFloat(v))))
        .map(r => [r[0].trim(), parseFloat(r[1]), parseFloat(r[2]), parseFloat(r[3])] as [string, number, number, number])
      if (next.length > 0) setRows(toRows(next))
    },
    onError: () => undefined,
  })

  // ── Results ──
  const parsed = rows
    .filter(r => r.name.trim() || r.units || r.opportunities || r.defects)
    .map((r, i) => {
      const input = { units: parseFloat(r.units), opportunities: parseFloat(r.opportunities), defects: parseFloat(r.defects) || 0 }
      const error = validateDpmo(input)
      return { row: r, name: r.name.trim() || `#${i + 1}`, input, error }
    })
  const errors = parsed.filter(p => p.error)
  const results = parsed.filter(p => !p.error).map(p => ({ name: p.name, ...p.input, ...dpmoMetrics(p.input) }))
  const overall = overallDpmo(results)
  const multi = results.length > 1
  const lowest = results.length ? results.reduce((a, b) => (b.sigma < a.sigma ? b : a)) : null

  const updateRow = (id: string, field: keyof Row, v: string) => setRows(prev => prev.map(r => (r.id === id ? { ...r, [field]: v } : r)))
  const removeRow = (id: string) => setRows(prev => prev.filter(r => r.id !== id))
  const addRow = () => setRows(prev => [...prev, { id: newId(), name: '', units: '', opportunities: '', defects: '' }])
  const clearAll = () => setRows([])
  const loadExample = () => { setRows(toRows(EXAMPLE)); setMobileTab('results') }

  // ── Chart: sigma by process, 4σ and 5σ lines ──
  const chartColor = (sigma: number) => (sigma >= 4 ? c.good : sigma >= 2 ? c.amber : c.danger)
  const chartData = {
    labels: results.map(r => r.name),
    datasets: [
      {
        type: 'bar' as const,
        label: t('dpmo_axis_sigma'),
        data: results.map(r => (Number.isFinite(r.sigma) ? Number(Math.max(0, r.sigma).toFixed(3)) : null)),
        backgroundColor: results.map(r => chartColor(r.sigma)),
        borderRadius: 4,
        maxBarThickness: 90,
        order: 3,
      },
      ...[4, 5].map(level => ({
        type: 'line' as const,
        label: `${level}σ`,
        data: results.map(() => level),
        borderColor: level === 4 ? c.amber : c.good,
        borderWidth: 1.2,
        borderDash: [6, 4],
        pointRadius: 0,
        pointHoverRadius: 0,
        fill: false,
        order: 1,
      })),
    ],
  }
  const maxSigma = Math.max(6, ...results.map(r => (Number.isFinite(r.sigma) ? Math.ceil(r.sigma) : 0)))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    devicePixelRatio: 2,
    layout: watermarkLayout(),
    plugins: {
      watermark: watermarkOptions('light'),
      legend: { position: 'bottom', labels: { color: c.muted, font: { size: 11 }, boxWidth: 12, filter: (item: { datasetIndex: number }) => item.datasetIndex > 0 } },
      tooltip: {
        backgroundColor: c.surface,
        borderColor: c.border,
        borderWidth: 1,
        titleColor: c.text,
        bodyColor: c.muted,
        padding: 10,
        filter: (item: { datasetIndex: number }) => item.datasetIndex === 0,
        callbacks: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          label: (ctx: any) => {
            const r = results[ctx.dataIndex]
            if (!r) return ''
            return [
              ` ${t('dpmo_tooltip_sigma')}: ${sig(r.sigma)}`,
              ` ${t('dpmo_tooltip_dpmo')}: ${int(r.dpmo)}`,
              ` ${t('dpmo_tooltip_yield')}: ${fixed(r.yieldPct, 3)}%`,
              ` ${t('dpmo_tooltip_rating')}: ${t(bandOf(r.sigma).labelKey)}`,
            ]
          },
        },
      },
    },
    scales: {
      x: { ticks: { color: c.muted, font: { size: 11 }, maxRotation: 30 }, grid: { display: false }, border: { color: c.border } },
      y: { min: 0, max: maxSigma, ticks: { color: c.muted, font: { size: 11 }, stepSize: 1, callback: (v: number) => `${v}σ` }, grid: { color: c.grid }, border: { color: c.border }, title: { display: true, text: t('dpmo_axis_sigma'), color: c.muted, font: { size: 11 } } },
    },
  }

  // ── Reference table (1σ to 6σ, half steps) ──
  const reference = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6].map(sg => {
    const d = dpmoForSigma(sg)
    return { sg, dpmo: d, yieldPct: 100 - d / 1e4 }
  })
  const refDpmo = (d: number) => (d >= 100 ? int(d) : fixed(d, 1))

  // ── Exports (English) ──
  const exportCSV = () => {
    if (!isLoggedIn) { goToLogin('dpmo', 'csv'); return }
    if (!overall) return
    const lines = [
      'Process,Units,Opportunities/Unit,Defects,DPO,DPMO,Yield %,Sigma Level,Rating',
      ...results.map(r => [csvCell(r.name), r.units, r.opportunities, r.defects, fixed(r.dpo, 6), fixed(r.dpmo, 1), fixed(r.yieldPct, 4), sig(r.sigma), Number.isFinite(r.sigma) ? bandOf(r.sigma).label : 'No defects'].join(',')),
      ...(multi ? [['"Overall (pooled)"', overall.units, '', overall.defects, fixed(overall.dpo, 6), fixed(overall.dpmo, 1), fixed(overall.yieldPct, 4), sig(overall.sigma), Number.isFinite(overall.sigma) ? bandOf(overall.sigma).label : 'No defects'].join(',')] : []),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'dpmo-analysis.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const toneOf = (sigma: number): Tone => (sigma >= 4 ? 'good' : sigma >= 3 ? 'warning' : 'danger')

  const runExportExcel = async () => {
    if (!isPro) { goToPricing('dpmo', 'excel'); return }
    if (!overall) return
    const report = createReport({ toolName: 'DPMO & Sigma Calculator' })
    const overview = report.addSheet('Overview')
    overview.titleBand('DPMO & Sigma Level Report', `${results.length} process${results.length === 1 ? '' : 'es'} · 1.5σ shift`)
    overview.metaStrip([
      ['Generated on', nowStamp()],
      ['Method', 'DPMO = defects ÷ (units × opportunities) × 10⁶ · Sigma = Φ⁻¹(1 − DPO) + 1.5 · overall = pooled'],
    ])
    overview.sectionHeading('At a Glance')
    overview.kpiRow([
      { label: multi ? 'Overall Sigma (pooled)' : 'Sigma Level', value: sig(overall.sigma), tone: Number.isFinite(overall.sigma) ? toneOf(overall.sigma) : 'good' },
      { label: multi ? 'Overall DPMO' : 'DPMO', value: int(overall.dpmo), tone: 'neutral' },
      { label: 'Yield', value: `${fixed(overall.yieldPct, 3)}%`, tone: 'neutral' },
      ...(multi && lowest ? [{ label: 'Lowest Process', value: `${sig(lowest.sigma)} (${lowest.name})`, tone: toneOf(lowest.sigma) }] : []),
    ])
    overview.sectionHeading('Process Detail')
    overview.table({
      headers: [
        { header: 'Process', key: 'process', align: 'left', width: 24 },
        { header: 'Units', key: 'units', align: 'right', numFmt: '#,##0' },
        { header: 'Opp/Unit', key: 'opp', align: 'right', numFmt: '#,##0' },
        { header: 'Defects', key: 'defects', align: 'right', numFmt: '#,##0' },
        { header: 'DPO', key: 'dpo', align: 'right', numFmt: '0.000000' },
        { header: 'DPMO', key: 'dpmo', align: 'right', numFmt: '#,##0.0' },
        { header: 'Yield %', key: 'yield', align: 'right', numFmt: '0.000' },
        { header: 'Sigma', key: 'sigma', align: 'right', numFmt: '0.00' },
        { header: 'Rating', key: 'rating', align: 'left', width: 20 },
      ],
      rows: [
        ...results.map(r => ({ process: r.name, units: r.units, opp: r.opportunities, defects: r.defects, dpo: r.dpo, dpmo: r.dpmo, yield: r.yieldPct, sigma: Number.isFinite(r.sigma) ? r.sigma : '—', rating: Number.isFinite(r.sigma) ? bandOf(r.sigma).label : 'No defects' })),
        ...(multi ? [{ process: 'Overall (pooled)', units: overall.units, opp: '', defects: overall.defects, dpo: overall.dpo, dpmo: overall.dpmo, yield: overall.yieldPct, sigma: Number.isFinite(overall.sigma) ? overall.sigma : '—', rating: Number.isFinite(overall.sigma) ? bandOf(overall.sigma).label : 'No defects' }] : []),
      ],
      rowTones: [...results.map(r => (Number.isFinite(r.sigma) ? toneOf(r.sigma) : 'good')), ...(multi ? ['accent' as const] : [])],
    })
    if (multi) overview.note('Overall = all defects ÷ all opportunities, then converted to sigma (not the average of the sigma levels).', 'neutral')
    overview.sectionHeading('Sigma Level by Process')
    if (chartRef.current) await overview.image(chartRef.current.toBase64Image('image/png', 1), { widthCm: 16, heightCm: 8 })
    overview.sectionHeading('Sigma Conversion Table (1.5σ shift)')
    overview.table({
      headers: [
        { header: 'Sigma Level', key: 'sg', align: 'right', numFmt: '0.0' },
        { header: 'DPMO', key: 'dpmo', align: 'right', numFmt: '#,##0.0' },
        { header: 'Yield %', key: 'y', align: 'right', numFmt: '0.0000' },
      ],
      rows: reference.map(r => ({ sg: r.sg, dpmo: r.dpmo, y: r.yieldPct })),
    })
    overview.freezeHeader(2)
    await report.download('dpmo-analysis.xlsx')
  }

  const runExportPNG = () => {
    if (!isLoggedIn) { goToLogin('dpmo', 'png'); return }
    const chart = chartRef.current
    if (!chart) return
    const a = document.createElement('a')
    a.href = chart.toBase64Image('image/png', 1)
    a.download = 'sigma-level-chart.png'
    a.click()
  }

  const runExportPDF = () => {
    if (!isPro) { goToPricing('dpmo', 'pdf'); return }
    if (!overall) return
    const ctx = createPdfReport('DPMO & Sigma Level Analysis', 'dpmo')
    const head = Number.isFinite(overall.sigma)
      ? `${multi ? 'Overall (all processes pooled)' : 'Result'}: ${sig(overall.sigma)} sigma (${bandOf(overall.sigma).label}) · ${int(overall.dpmo)} DPMO · yield ${fixed(overall.yieldPct, 3)}%`
      : 'No defects found: a sigma level needs at least one defect.'
    calloutBox(ctx, multi && lowest ? `${head}. Lowest process: ${lowest.name} at ${sig(lowest.sigma)} sigma.` : head, Number.isFinite(overall.sigma) ? (overall.sigma >= 4 ? 'good' : overall.sigma >= 3 ? 'warn' : 'bad') : 'good')
    addChartImage(ctx, chartRef.current, 'Sigma Level by Process')
    const toneColor = (sigma: number) => (!Number.isFinite(sigma) || sigma >= 4 ? REPORT_COLORS.good : sigma >= 3 ? REPORT_COLORS.warn : REPORT_COLORS.bad)
    const w = ctx.pageWidth - ctx.margin * 2
    const body = [
      ...results.map(r => [r.name, int(r.units), int(r.opportunities), int(r.defects), int(r.dpmo), fixed(r.yieldPct, 3), sig(r.sigma), Number.isFinite(r.sigma) ? bandOf(r.sigma).label : 'No defects']),
      ...(multi ? [['Overall (pooled)', int(overall.units), '', int(overall.defects), int(overall.dpmo), fixed(overall.yieldPct, 3), sig(overall.sigma), Number.isFinite(overall.sigma) ? bandOf(overall.sigma).label : 'No defects']] : []),
    ]
    dataTable(
      ctx,
      'Process Detail',
      [
        { header: 'PROCESS', width: w - 440 },
        { header: 'UNITS', width: 55, align: 'right' },
        { header: 'OPP/UNIT', width: 55, align: 'right' },
        { header: 'DEFECTS', width: 55, align: 'right' },
        { header: 'DPMO', width: 60, align: 'right' },
        { header: 'YIELD %', width: 60, align: 'right' },
        { header: 'SIGMA', width: 50, align: 'right' },
        { header: 'RATING', width: 105 },
      ],
      body,
      { cellColors: [...results.map(r => [null, null, null, null, null, null, toneColor(r.sigma), null]), ...(multi ? [[null, null, null, null, null, null, toneColor(overall.sigma), null]] : [])] }
    )
    if (multi) calloutBox(ctx, 'Overall = all defects ÷ all opportunities, then converted to sigma (not the average of the sigma levels).', 'info')
    dataTable(
      ctx,
      'Sigma Conversion Table (1.5 sigma shift)',
      [
        { header: 'SIGMA LEVEL', width: 120, align: 'right' },
        { header: 'DPMO', width: 160, align: 'right' },
        { header: 'YIELD %', width: w - 280, align: 'right' },
      ],
      reference.map(r => [fixed(r.sg, 1), refDpmo(r.dpmo), fixed(r.yieldPct, 4)])
    )
    finalizeReport(ctx)
    ctx.pdf.save('dpmo-report.pdf')
  }

  const exportExcel = () => (isPro ? withWatermarksDisabled([chartRef.current], runExportExcel) : runExportExcel())
  const exportPDF = () => (isPro ? withWatermarksDisabled([chartRef.current], runExportPDF) : runExportPDF())
  const exportPNG = () => (isLoggedIn ? withWatermarksDisabled([chartRef.current], runExportPNG) : runExportPNG())

  // ── Page ──
  const helpSteps = [
    { t: t('dpmo_help_s1_t'), d: t('dpmo_help_s1_d') },
    { t: t('dpmo_help_s2_t'), d: t('dpmo_help_s2_d') },
    { t: t('dpmo_help_s3_t'), d: t('dpmo_help_s3_d') },
    { t: t('dpmo_help_s4_t'), d: t('dpmo_help_s4_d') },
  ]
  const verdictColor = overall && Number.isFinite(overall.sigma) ? bandOf(overall.sigma).color : 'var(--qh-good)'
  const lowColor = lowest ? bandOf(lowest.sigma).color : 'var(--qh-muted)'

  return (
    <div style={s.page}>
      <ToolStyles />
      <Nav theme={theme} setTheme={setTheme} breadcrumbKey="bc_dpmo" />

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
        <ToolSidebar current="/dpmo" />

        <div className="tl-main">
          <ToolHeader title={t('dpmo_title')} intro={t('dpmo_intro')} onHelp={() => setHelpOpen(true)} onExample={loadExample} />
          <HelpPanel open={helpOpen} onClose={() => setHelpOpen(false)} title={t('dpmo_help_title')} steps={helpSteps} onExample={loadExample} showCapability={false} tip={t('dpmo_help_tip')} />
          <PhoneTabs tab={mobileTab} onTab={setMobileTab} dataCount={rows.length} hideSetup />

          {/* ── DATA (full width: four columns) ───────────────────────── */}
          <section className="tl-panel tl-card" data-active={mobileTab === 'data'} aria-label={t('spc_tab_data')}>
            <DataCardHead
              countLabel={t('dpmo_data_count').replace('{n}', String(rows.length))}
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
                    <th style={{ textAlign: 'start' }}>{t('dpmo_col_process')}</th>
                    <th>{t('dpmo_col_units')}</th>
                    <th>{t('dpmo_col_oppunit')}</th>
                    <th>{t('dpmo_col_defects')}</th>
                    <th aria-label={t('spc_remove')} style={{ width: 28 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id}>
                      <td><input value={r.name} placeholder={t('dpmo_placeholder_process')} aria-label={t('dpmo_col_process')} onChange={e => updateRow(r.id, 'name', e.target.value)} style={{ textAlign: 'start', fontFamily: 'inherit', fontWeight: 500, minWidth: 140 }} /></td>
                      <td><input type="number" min={0} value={r.units} aria-label={t('dpmo_col_units')} onChange={e => updateRow(r.id, 'units', e.target.value)} /></td>
                      <td><input type="number" min={0} value={r.opportunities} aria-label={t('dpmo_col_oppunit')} onChange={e => updateRow(r.id, 'opportunities', e.target.value)} /></td>
                      <td><input type="number" min={0} value={r.defects} aria-label={t('dpmo_col_defects')} onChange={e => updateRow(r.id, 'defects', e.target.value)} /></td>
                      <td><button type="button" className="tl-sg-x" aria-label={t('spc_remove')} onClick={() => removeRow(r.id)}>✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginTop: 10 }}>
              <button type="button" className="tl-xbtn tl-add" onClick={addRow}>{t('dpmo_add_process')}</button>
            </div>
            <div className="tl-paste">{t('dpmo_paste_hint')}</div>
            {errors.length > 0 && (
              <div className="tl-error" style={{ marginTop: 10 }}>
                {errors.map(e => <div key={e.row.id}>{t('dpmo_row_error').replace('{name}', e.name).replace('{msg}', t(ERR_KEY[e.error as DpmoError]))}</div>)}
              </div>
            )}
          </section>

          {/* ── RESULTS ──────────────────────────────────────────────── */}
          <section className="tl-panel tl-results" data-active={mobileTab === 'results'} aria-label={t('spc_tab_results')}>
            {overall ? (
              <>
                <div className="tl-verdicts">
                  <div className="tl-verdict" style={{ background: tint(verdictColor, 8), border: `1px solid ${tint(verdictColor, 35)}` }}>
                    <span className="tl-verdict-icon" aria-hidden="true" style={{ background: tint(verdictColor, 16), color: verdictColor }}>σ</span>
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--qh-muted)', marginBottom: 2 }}>{multi ? t('dpmo_overall_label') : t('dpmo_result_label')}</div>
                      <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 4, color: verdictColor }}>
                        {Number.isFinite(overall.sigma) ? <>{ltr(`${sig(overall.sigma)}σ`)} · {t(bandOf(overall.sigma).labelKey)}</> : t('dpmo_no_defects')}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--qh-muted)', lineHeight: 1.6 }}>
                        {Number.isFinite(overall.sigma)
                          ? t('dpmo_overall_sub').replace('{dpmo}', ltr(int(overall.dpmo))).replace('{y}', ltr(fixed(overall.yieldPct, 3))).replace('{d}', ltr(int(overall.defects))).replace('{o}', ltr(int(overall.totalOpportunities)))
                          : t('dpmo_no_defects_sub')}
                      </div>
                    </div>
                  </div>
                  {multi && lowest && Number.isFinite(lowest.sigma) && (
                    <div className="tl-verdict" style={{ background: tint(lowColor, 8), border: `1px solid ${tint(lowColor, 35)}` }}>
                      <span className="tl-verdict-icon" aria-hidden="true" style={{ background: tint(lowColor, 16), color: lowColor }}>!</span>
                      <div>
                        <div style={{ fontSize: 12, color: 'var(--qh-muted)', marginBottom: 2 }}>{t('dpmo_lowest_label')}</div>
                        <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 4, color: lowColor }}>{lowest.name} · {ltr(`${sig(lowest.sigma)}σ`)}</div>
                        <div style={{ fontSize: 13, color: 'var(--qh-muted)', lineHeight: 1.6 }}>{t('dpmo_lowest_sub').replace('{dpmo}', ltr(int(lowest.dpmo)))}</div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="tl-results-head">
                  <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{t('spc_tab_results')}</h2>
                  <ExportRow
                    isPro={isPro}
                    isLoggedIn={isLoggedIn}
                    hasResult={!!overall}
                    onCSV={exportCSV}
                    onPNG={exportPNG}
                    onExcel={exportExcel}
                    onPDF={exportPDF}
                    save={
                      <SaveAnalysisButton
                        theme={theme}
                        tool="dpmo"
                        defaultName={`DPMO — ${new Date().toLocaleDateString('en-US')}`}
                        compact={compactSave}
                        getPayload={() => ({
                          input_data: results.map(r => ({ name: r.name, units: r.units, opportunities: r.opportunities, defects: r.defects })),
                          results: { processes: results, overall },
                        })}
                      />
                    }
                  />
                </div>

                <div className="tl-chart">
                  <h3>{t('dpmo_chart_title')}</h3>
                  <div className="tl-chart-sub">{t('dpmo_chart_lines')}</div>
                  <div className="tl-chart-inner" style={{ height: 300 }}>
                    <Chart ref={chartRef} type="bar" data={chartData} options={chartOptions} />
                  </div>
                </div>

                <div className="tl-card">
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>{t('dpmo_detailed_results')}</div>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="tl-table">
                      <thead>
                        <tr>
                          <th>{t('dpmo_col_process')}</th>
                          <th className="num">{t('dpmo_col_opps')}</th>
                          <th className="num">{t('dpmo_col_defects')}</th>
                          <th className="num">{t('dpmo_col_dpo')}</th>
                          <th className="num">{t('dpmo_col_dpmo')}</th>
                          <th className="num">{t('dpmo_col_yield')}</th>
                          <th className="num">{t('dpmo_col_sigma')}</th>
                          <th>{t('dpmo_col_rating')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.map((r, i) => (
                          <tr key={i}>
                            <td style={{ whiteSpace: 'normal' }}>{r.name}</td>
                            <td className="num">{int(r.totalOpportunities)}</td>
                            <td className="num">{int(r.defects)}</td>
                            <td className="num">{fixed(r.dpo, 6)}</td>
                            <td className="num">{int(r.dpmo)}</td>
                            <td className="num">{fixed(r.yieldPct, 3)}</td>
                            <td className="num" style={{ fontWeight: 600, color: Number.isFinite(r.sigma) ? bandOf(r.sigma).color : undefined }}>{sig(r.sigma)}</td>
                            <td>{Number.isFinite(r.sigma) ? t(bandOf(r.sigma).labelKey) : t('dpmo_no_defects')}</td>
                          </tr>
                        ))}
                        {multi && (
                          <tr style={{ fontWeight: 700 }}>
                            <td>{t('dpmo_overall_row')}</td>
                            <td className="num">{int(overall.totalOpportunities)}</td>
                            <td className="num">{int(overall.defects)}</td>
                            <td className="num">{fixed(overall.dpo, 6)}</td>
                            <td className="num">{int(overall.dpmo)}</td>
                            <td className="num">{fixed(overall.yieldPct, 3)}</td>
                            <td className="num" style={{ color: verdictColor }}>{sig(overall.sigma)}</td>
                            <td>{Number.isFinite(overall.sigma) ? t(bandOf(overall.sigma).labelKey) : t('dpmo_no_defects')}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  {multi && <div className="tl-hint">{t('dpmo_pooled_note')}</div>}
                </div>

                <details className="tl-more">
                  <summary>{t('dpmo_ref_title')}</summary>
                  <div className="tl-more-body">
                    <div className="tl-hint" style={{ marginTop: 0 }}>{t('dpmo_ref_sub')}</div>
                    <table className="tl-table">
                      <thead>
                        <tr><th className="num">{t('dpmo_col_sigma_level')}</th><th className="num">{t('dpmo_col_dpmo')}</th><th className="num">{t('dpmo_col_yield')}</th></tr>
                      </thead>
                      <tbody>
                        {reference.map(r => (
                          <tr key={r.sg}><td className="num">{fixed(r.sg, 1)}σ</td><td className="num">{refDpmo(r.dpmo)}</td><td className="num">{fixed(r.yieldPct, 4)}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </>
            ) : (
              <div className="tl-card tl-empty">{t('dpmo_empty_state')}</div>
            )}
          </section>
        </div>
      </div>

      <PhoneBar
        showResultActions={mobileTab === 'results' && !!overall}
        onAnalyze={() => { setMobileTab('results'); window.scrollTo({ top: 0 }) }}
        onEdit={() => setMobileTab('data')}
        analyzeLabel={t('dpmo_bar_results')}
      />
      <PasteToast show={gridImport.pasteToast} />
    </div>
  )
}
