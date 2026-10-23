'use client'

import { useState, useCallback, useMemo, useRef, useEffect, type CSSProperties } from 'react'
import 'chart.js/auto'
import { Chart } from 'react-chartjs-2'
import type { Chart as ChartJSInstance } from 'chart.js'
import { COLORS, usePersistedTheme, getSharedStyles, BRAND_GRADIENT, BRAND_GRADIENT_TEXT_COLOR } from '@/lib/theme'
import { useGridImport } from '@/lib/gridImport'
import { SheetPicker, PasteToast } from '@/components/GridImportControls'
import { createReport, nowStamp } from '@/lib/excelReport'
import {
  createReport as createPdfReport,
  dataTable,
  calloutBox,
  addChartImage,
  finalizeReport,
} from '@/lib/pdf/reportDesign'

import Nav from '@/components/Nav'
import SaveAnalysisButton from '@/components/SaveAnalysisButton'
import { useSubscription } from '@/lib/useSubscription'
import { goToLogin, goToPricing } from '@/lib/exportGate'
import { watermarkOptions, watermarkLayout, withWatermarksDisabled } from '@/lib/watermarkHelpers'
import { useLanguage } from '@/lib/i18n/context'
import type { DescriptiveResult } from '@/lib/descriptive/stats'
import { formatPValue } from '@/lib/stats/format'

function parseValues(text: string): number[] {
  return text
    .split(/[\n,\t;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => parseFloat(s))
    .filter((v) => Number.isFinite(v))
}

function fmt(v: number | null | undefined, digits = 4): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—'
  return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: digits })
}

/** Fixed 3-decimal formatter (0.000) — used for the Anderson-Darling A² and p-value. */
function fmt3(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—'
  return v.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
}

export default function DescriptiveStats() {
  const { isPro, isLoggedIn } = useSubscription()
  const [theme, setTheme] = usePersistedTheme()
  const { t } = useLanguage()
  const c = COLORS[theme]
  const s = getSharedStyles(theme)

  const [rawText, setRawText] = useState('')
  const [result, setResult] = useState<DescriptiveResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadedProjectName, setLoadedProjectName] = useState('')
  const [loadError, setLoadError] = useState('')

  // Chart.js canvases used on screen and in the Excel/PDF exports.
  const histogramChartRef = useRef<ChartJSInstance<'bar'> | null>(null)
  const boxPlotChartRef = useRef<ChartJSInstance<'bar' | 'line' | 'scatter'> | null>(null)

  const values = parseValues(rawText)

  // ── Load a saved project from the dashboard (?id=...) ─────────────────
  // Only the raw input is restored (input_data.values) — the stats are
  // recomputed via the normal calculate flow, same as every other tool's
  // loader (never trusts a saved `results` blob over a fresh calculation).
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id')
    if (!id) return
    fetch(`/api/saved-analyses/${id}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(async ({ analysis }) => {
        const data = analysis.input_data as { values: number[] }
        const loadedValues = data.values
        setRawText(loadedValues.join('\n'))
        setLoadedProjectName(analysis.name as string)
        if (loadedValues.length < 2) return
        setLoading(true)
        try {
          const res = await fetch('/api/descriptive', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ values: loadedValues }),
          })
          const json = await res.json()
          if (res.ok) setResult(json as DescriptiveResult)
        } finally {
          setLoading(false)
        }
      })
      .catch(() => setLoadError(t('ds_load_error')))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCalculate = useCallback(async () => {
    setError(null)
    if (values.length < 2) {
      setError(t('ds_err_min2'))
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/descriptive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || t('ds_err_calc_failed'))
        setResult(null)
      } else {
        setResult(json as DescriptiveResult)
      }
    } catch {
      setError(t('ds_err_network'))
    } finally {
      setLoading(false)
    }
  }, [values, t])

  // Grid → flat numeric list: Descriptive only ever needs one column of
  // values, so every cell across every row/column of a paste or upload is
  // flattened and filtered down to numbers — the header row and any blank
  // rows are already stripped by useGridImport before onGrid runs.
  const gridImport = useGridImport({
    onGrid: grid => {
      const nums = grid
        .flat()
        .map(v => parseFloat(v))
        .filter(v => Number.isFinite(v))
      if (nums.length > 0) setRawText(nums.join('\n'))
    },
    onError: msg => setError(msg),
  })

  const runExportExcel = useCallback(async () => {
    if (!isPro) { goToPricing('descriptive-stats', 'excel'); return }
    if (!result) return
    const report = createReport({ toolName: 'Descriptive Statistics' })

    // ── Sheet 1: Overview ──
    const overview = report.addSheet('Overview')
    overview.titleBand('Descriptive Statistics Report', `N = ${result.n} data points`)
    overview.metaStrip([
      ['Generated on', nowStamp()],
      ['Sample size (n)', result.n],
    ])

    overview.sectionHeading('Central Tendency & Spread')
    overview.kpiRow([
      { label: 'Mean', value: fmt(result.mean), tone: 'accent' },
      { label: 'StDev', value: fmt(result.stdev), tone: 'accent' },
      { label: 'Median', value: fmt(result.median), tone: 'neutral' },
      { label: 'Range', value: fmt(result.range), tone: 'neutral' },
    ])

    overview.sectionHeading('Full Statistics')
    overview.table({
      headers: [
        { header: 'Statistic', key: 'k', align: 'left', width: 22 },
        { header: 'Value', key: 'v', align: 'right', numFmt: '0.0000' },
      ],
      rows: [
        { k: 'N', v: result.n },
        { k: 'Mean', v: result.mean },
        { k: 'StDev', v: result.stdev },
        { k: 'Variance', v: result.variance },
        { k: 'CV (%)', v: result.cv !== null ? result.cv : '—' },
        { k: 'Skewness', v: result.skewness !== null ? result.skewness : '—' },
        { k: 'Kurtosis', v: result.kurtosis !== null ? result.kurtosis : '—' },
        { k: 'Minimum', v: result.min },
        { k: 'Q1', v: result.q1 },
        { k: 'Median', v: result.median },
        { k: 'Q3', v: result.q3 },
        { k: 'Maximum', v: result.max },
        { k: 'IQR', v: result.iqr },
        { k: 'Range', v: result.range },
      ],
    })

    if (result.ciMean || result.ciMedian || result.ciStdev) {
      overview.sectionHeading('95% Confidence Intervals')
      overview.table({
        headers: [
          { header: 'Statistic', key: 'k', align: 'left', width: 20 },
          { header: 'Lower', key: 'lo', align: 'right', numFmt: '0.0000' },
          { header: 'Upper', key: 'hi', align: 'right', numFmt: '0.0000' },
        ],
        rows: [
          ...(result.ciMean ? [{ k: 'Mean', lo: result.ciMean.lower, hi: result.ciMean.upper }] : []),
          ...(result.ciMedian ? [{ k: 'Median', lo: result.ciMedian.lower, hi: result.ciMedian.upper }] : []),
          ...(result.ciStdev ? [{ k: 'StDev', lo: result.ciStdev.lower, hi: result.ciStdev.upper }] : []),
        ],
      })
    }

    if (result.andersonDarling) {
      const ad = result.andersonDarling
      overview.sectionHeading('Normality Test (Anderson-Darling)')
      overview.table({
        headers: [
          { header: 'Statistic', key: 'k', align: 'left', width: 22 },
          { header: 'Value', key: 'v', align: 'left' },
        ],
        rows: [
          { k: 'AD (A²)', v: fmt3(ad.statistic) },
          { k: 'p-value', v: formatPValue(ad.pValue) },
          { k: 'Conclusion', v: ad.normalAtAlpha05 ? 'Fail to reject normality (p ≥ 0.05)' : 'Reject normality (p < 0.05)' },
        ],
        rowTones: [undefined, undefined, ad.normalAtAlpha05 ? 'good' : 'warning'],
      })
    }

    overview.sectionHeading('Box Plot Summary')
    const bp = result.boxPlot
    overview.table({
      headers: [
        { header: 'Statistic', key: 'k', align: 'left', width: 22 },
        { header: 'Value', key: 'v', align: 'left' },
      ],
      rows: [
        { k: 'Min', v: fmt(bp.min) },
        { k: 'Q1', v: fmt(bp.q1) },
        { k: 'Median', v: fmt(bp.median) },
        { k: 'Q3', v: fmt(bp.q3) },
        { k: 'Max', v: fmt(bp.max) },
        { k: 'Lower Whisker', v: fmt(bp.lowerWhisker) },
        { k: 'Upper Whisker', v: fmt(bp.upperWhisker) },
        { k: 'Outliers', v: bp.outliers.length > 0 ? bp.outliers.map(v => fmt(v)).join(', ') : 'None' },
      ],
      rowTones: bp.outliers.length > 0 ? [undefined, undefined, undefined, undefined, undefined, undefined, undefined, 'warning'] : undefined,
    })
    overview.freezeHeader(2)

    // ── Sheet 2: Histogram Data ──
    if (result.histogram.length > 0) {
      const histSheet = report.addSheet('Histogram')
      histSheet.titleBand('Histogram Bins', `${result.histogram.length} bins`)
      histSheet.table({
        headers: [
          { header: 'Bin Start', key: 'x0', align: 'right', numFmt: '0.0000' },
          { header: 'Bin End', key: 'x1', align: 'right', numFmt: '0.0000' },
          { header: 'Count', key: 'count', align: 'right', numFmt: '#,##0' },
        ],
        rows: result.histogram.map(b => ({ x0: b.x0, x1: b.x1, count: b.count })),
      })
      histSheet.freezeHeader(2)
    }

    // ── Sheet 3: Charts ──
    const chartSheet = report.addSheet('Charts')
    await chartSheet.charts([
      { ref: histogramChartRef, title: t('ds_histogram_boxplot') },
      { ref: boxPlotChartRef, title: t('ds_boxplot_title') },
    ])

    // ── Sheet 4: Raw Data ──
    if (values.length > 0) {
      const rawSheet = report.addSheet('Raw Data')
      rawSheet.titleBand('Raw Data', `${values.length} values`)
      rawSheet.table({
        headers: [
          { header: '#', key: 'i', align: 'center', width: 8 },
          { header: 'Value', key: 'v', align: 'right', numFmt: '0.0000' },
        ],
        rows: values.map((v, i) => ({ i: i + 1, v })),
      })
      rawSheet.freezeHeader(2)
    }

    await report.download('descriptive-statistics.xlsx')
  }, [result, isPro, values, t])

  // ── Export: CSV ─────────────────────────────────────────────────────
  const handleExportCSV = useCallback(() => {
    if (!isLoggedIn) { goToLogin('descriptive-stats', 'csv'); return }
    if (!result) return
    const header = '#,Value\n'
    const body = values.map((v, i) => `${i + 1},${v}`).join('\n')
    const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'descriptive-statistics.csv'
    a.click()
    URL.revokeObjectURL(url)
  }, [isLoggedIn, result, values])

  // ── Export: PNG (summary card, same style as Regression's PNG export) ─
  const handleExportPNG = useCallback(() => {
    if (!isLoggedIn) { goToLogin('descriptive-stats', 'png'); return }
    if (!result) return
    const rows: [string, string][] = [
      ['N', String(result.n)],
      ['Mean', fmt(result.mean)],
      ['StDev', fmt(result.stdev)],
      ['Median', fmt(result.median)],
      ['Min', fmt(result.min)],
      ['Q1', fmt(result.q1)],
      ['Q3', fmt(result.q3)],
      ['Max', fmt(result.max)],
      ['Range', fmt(result.range)],
      ['IQR', fmt(result.iqr)],
    ]
    const width = 520
    const rowH = 26
    const height = 110 + rowH * rows.length + 20
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = '#0A1120'
    ctx.fillRect(0, 0, width, height)
    ctx.fillStyle = '#e2e8f0'
    ctx.font = 'bold 20px system-ui, sans-serif'
    ctx.fillText(t('ds_pdf_report_title'), 16, 34)
    ctx.fillStyle = '#6b89b4'
    ctx.font = '12px system-ui, sans-serif'
    ctx.fillText(`Generated: ${new Date().toLocaleDateString()}`, 16, 54)
    ctx.fillText(`N = ${result.n}`, 16, 74)

    let y = 96
    ctx.fillStyle = '#1e2d40'
    ctx.fillRect(16, y, width - 32, rowH)
    ctx.fillStyle = '#e2e8f0'
    ctx.font = 'bold 12px system-ui, sans-serif'
    ctx.fillText('STATISTIC', 24, y + 17)
    ctx.fillText('VALUE', width - 140, y + 17)
    y += rowH

    rows.forEach(([label, value], i) => {
      ctx.fillStyle = i % 2 === 0 ? '#101A2C' : '#0A1120'
      ctx.fillRect(16, y, width - 32, rowH)
      ctx.fillStyle = '#cbd5e1'
      ctx.font = '12px system-ui, sans-serif'
      ctx.fillText(label, 24, y + 17)
      ctx.fillText(value, width - 140, y + 17)
      y += rowH
    })

    canvas.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'descriptive-statistics.png'
      a.click()
      URL.revokeObjectURL(url)
    })
  }, [isLoggedIn, result, t])

  // ── Export: PDF ─────────────────────────────────────────────────────
  const runExportPDF = useCallback(() => {
    if (!isPro) { goToPricing('descriptive-stats', 'pdf'); return }
    if (!result) return

    const ctx = createPdfReport(t('ds_pdf_report_title'), 'descriptive-stats')

    calloutBox(ctx, `N = ${result.n}   Mean = ${fmt(result.mean)}   StDev = ${fmt(result.stdev)}`, 'info')

    dataTable(
      ctx,
      'Full Statistics',
      [
        { header: 'STATISTIC', width: 160 },
        { header: 'VALUE', width: ctx.pageWidth - ctx.margin * 2 - 160, align: 'right' },
      ],
      [
        ['N', String(result.n)],
        ['Mean', fmt(result.mean)],
        ['StDev', fmt(result.stdev)],
        ['Variance', fmt(result.variance)],
        ['CV (%)', result.cv !== null ? fmt(result.cv, 2) : '—'],
        ['Skewness', result.skewness !== null ? fmt(result.skewness) : '—'],
        ['Kurtosis', result.kurtosis !== null ? fmt(result.kurtosis) : '—'],
        ['Minimum', fmt(result.min)],
        ['Q1', fmt(result.q1)],
        ['Median', fmt(result.median)],
        ['Q3', fmt(result.q3)],
        ['Maximum', fmt(result.max)],
        ['IQR', fmt(result.iqr)],
        ['Range', fmt(result.range)],
      ]
    )

    if (result.andersonDarling) {
      const ad = result.andersonDarling
      calloutBox(
        ctx,
        `Anderson-Darling: A² = ${fmt3(ad.statistic)}   p-value = ${formatPValue(ad.pValue)}   ${ad.normalAtAlpha05 ? 'Fail to reject normality (p ≥ 0.05)' : 'Reject normality (p < 0.05)'}`,
        ad.normalAtAlpha05 ? 'good' : 'warn'
      )
    }

    addChartImage(ctx, histogramChartRef.current, t('ds_histogram_boxplot'))
    addChartImage(ctx, boxPlotChartRef.current, t('ds_boxplot_title'))

    finalizeReport(ctx)
    ctx.pdf.save('descriptive-statistics.pdf')
  }, [isPro, result, t])

  // Pro exports read chart canvases via toBase64Image(); the watermark (kept
  // on the live view for everyone) is switched off just for that call.
  const handleExportExcel = () => (isPro ? withWatermarksDisabled([histogramChartRef.current, boxPlotChartRef.current], runExportExcel) : runExportExcel())
  const handleExportPDF = () => (isPro ? withWatermarksDisabled([histogramChartRef.current, boxPlotChartRef.current], runExportPDF) : runExportPDF())

  const clearAll = () => {
    setRawText('')
    setResult(null)
    setError(null)
  }

  // Shared x-axis bounds so the box plot lines up exactly under the
  // histogram above it — Chart.js auto-scales each chart independently
  // otherwise, which left the box plot's own [min,max] domain much
  // narrower than the histogram's and made it look tiny and off to one side.
  const axisBounds = useMemo(() => {
    if (!result) return null
    const span = (result.max - result.min) || 1
    const pad = span * 0.05
    return { min: result.min - pad, max: result.max + pad }
  }, [result])

  const histogramData = result
    ? {
        labels: result.histogram.map((b) => `${fmt(b.x0, 2)}–${fmt(b.x1, 2)}`),
        datasets: [
          {
            label: t('ds_frequency'),
            data: result.histogram.map((b) => b.count),
            backgroundColor: c.bar,
            borderRadius: 3,
            barPercentage: 1.0,
            categoryPercentage: 0.95,
          },
        ],
      }
    : null

  // ── Box plot as one Chart.js horizontal bar chart: a single bar dataset
  // for the IQR box (Q1→Q3, using Chart.js's native array-pair floating-bar
  // data), a line dataset for the whisker span, a scatter dataset styled
  // as a vertical tick for the median, and a scatter dataset for outliers.
  // Verified directly against the Chart.js source (not just visually):
  // with indexAxis 'y', the bar's floating-range data MUST be a plain
  // [low, high] array keyed to a category label — the {x:[low,high], y}
  // object form silently parses to null and collapses the axis. The other
  // datasets are pinned to that same category label (not y:0) so every
  // dataset lands on the identical row regardless of dataset type. ──────
  const boxPlotData = useMemo(() => {
    if (!result) return null
    const bp = result.boxPlot
    return {
      labels: ['row'],
      datasets: [
        {
          type: 'bar' as const,
          label: 'IQR (Q1–Q3)',
          data: [[bp.q1, bp.q3]],
          backgroundColor: `${c.data}30`,
          borderColor: c.data,
          borderWidth: 2,
          barThickness: 40,
          order: 2,
        },
        {
          type: 'line' as const,
          label: 'Whisker',
          data: [{ x: bp.lowerWhisker, y: 'row' }, { x: bp.upperWhisker, y: 'row' }],
          borderColor: c.muted,
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
          order: 1,
        },
        {
          type: 'scatter' as const,
          label: 'Median',
          data: [{ x: bp.median, y: 'row' }],
          pointStyle: 'line',
          rotation: 90,
          pointRadius: 20,
          borderColor: c.amber,
          borderWidth: 3,
          order: 0,
        },
        {
          type: 'scatter' as const,
          label: 'Outliers',
          data: bp.outliers.map((o) => ({ x: o, y: 'row' })),
          backgroundColor: c.danger,
          pointRadius: 4,
          order: 0,
        },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any
  }, [result, c])

  const boxPlotOptions = useMemo(
    () => ({
      indexAxis: 'y' as const,
      responsive: true,
      maintainAspectRatio: false,
      animation: false as const,
      devicePixelRatio: 2,
      layout: { padding: { left: 8, right: 8 } },
      plugins: { legend: { display: false } },
      scales: {
        x: {
          type: 'linear' as const,
          min: axisBounds?.min,
          max: axisBounds?.max,
          grid: { color: c.grid },
          ticks: { color: c.muted, font: { size: 10 } },
        },
        y: { grid: { display: false }, ticks: { display: false } },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any),
    [c, axisBounds]
  )

  return (
    <div style={s.page}>
      {/* Nav */}
      <Nav theme={theme} setTheme={setTheme} breadcrumbKey="bc_descriptive" />

      {loadedProjectName && (
        <div className="qh-main" style={{ paddingBottom: 0 }}>
          <div style={{ fontSize: 13, color: c.accent, background: c.surface2, border: `1px solid ${c.border}`, borderRadius: 8, padding: '8px 14px', margin: '0 20px' }}>
            {t('ds_loaded_project')} {loadedProjectName}
          </div>
        </div>
      )}
      {loadError && (
        <div className="qh-main" style={{ paddingBottom: 0 }}>
          <div style={{ fontSize: 13, color: c.danger, margin: '8px 20px 0' }}>{loadError}</div>
        </div>
      )}

      <div className="qh-body" style={s.body}>
        {/* Left Panel — input */}
        <div className="qh-left" style={s.left}>
          <div>
            <div style={s.sectionTitle}>{t('ds_data_input')}</div>
            <textarea
              style={{ ...(s.input as CSSProperties), minHeight: 220, resize: 'vertical', fontFamily: 'monospace' }}
              placeholder={t('ds_placeholder')}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
            />
            <div style={{ fontSize: 11, color: c.muted, marginTop: 6 }}>
              {values.length} {values.length === 1 ? t('ds_valid_value') : t('ds_valid_values')} {t('ds_detected')}
            </div>
            <div style={{ fontSize: 11, color: c.muted, marginTop: 2 }}>
              Tip: you can also paste (Ctrl+V) anywhere on this page.
            </div>

            <button
              type="button"
              onClick={gridImport.openFilePicker}
              style={{ ...(s.addBtn as CSSProperties), display: 'block', width: '100%', textAlign: 'center', marginTop: 10, cursor: 'pointer' }}
            >
              {t('ds_upload_csv')}
            </button>
            <gridImport.FileInput />
            {gridImport.fileError && (
              <div style={{ color: 'var(--qh-danger)', fontSize: 11, marginTop: 6 }}>{gridImport.fileError}</div>
            )}
            <SheetPicker
              sheetNames={gridImport.sheetNames}
              activeSheet={gridImport.activeSheet}
              onSelect={gridImport.selectSheet}
              accentColor={c.accent}
              textColor={c.text}
              mutedColor={c.muted}
              borderColor={c.border}
            />

            <button
              style={{
                ...(s.addBtn as CSSProperties),
                marginTop: 10,
                background: BRAND_GRADIENT,
                border: 'none',
                color: BRAND_GRADIENT_TEXT_COLOR,
              }}
              onClick={handleCalculate}
              disabled={loading || values.length < 2}
            >
              {loading ? t('ds_calculating') : t('ds_calculate')}
            </button>

            {(rawText || result) && (
              <button
                style={{
                  ...(s.addBtn as CSSProperties),
                  marginTop: 8,
                  background: 'color-mix(in srgb, var(--qh-danger) 10%, transparent)',
                  border: '1px dashed #ef4444',
                  color: 'var(--qh-danger)',
                }}
                onClick={clearAll}
              >
                {t('ds_clear_all')}
              </button>
            )}

            {error && (
              <div style={{ marginTop: 10, fontSize: 12, color: c.danger, background: `${c.danger}15`, padding: '8px 10px', borderRadius: 8 }}>
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel — results */}
        <div className="qh-right" style={s.right}>
          {!result && !loading && (
            <div style={{ ...(s.card as CSSProperties), textAlign: 'center', color: c.muted, padding: 60 }}>
              {t('ds_empty_state')}
            </div>
          )}

          {result && (
            <>
              {/* Histogram + Box Plot */}
              <div style={s.chartWrap}>
                <div style={s.sectionTitle}>{t('ds_histogram_boxplot')}</div>
                <div style={{ ...(s.chartInner as CSSProperties), height: 280 }}>
                  {histogramData && (
                    <Chart
                      ref={histogramChartRef}
                      type="bar"
                      data={histogramData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        layout: watermarkLayout(),
                        plugins: { legend: { display: false }, watermark: watermarkOptions('light') },
                        scales: {
                          x: { grid: { color: c.grid }, ticks: { color: c.muted, font: { size: 10 } } },
                          y: { grid: { color: c.grid }, ticks: { color: c.muted }, beginAtZero: true },
                        },
                      }}
                    />
                  )}
                </div>
                {boxPlotData && (
                  <div style={{ height: 90, position: 'relative', marginTop: 12 }}>
                    {/* Mixed chart: bar (IQR) + line (whisker) + scatter (median/outliers), same relaxation used on the Regression pages */}
                    <Chart ref={boxPlotChartRef} type="bar" data={boxPlotData} options={boxPlotOptions} />
                  </div>
                )}
              </div>

              {/* Anderson-Darling Normality Test — free */}
              {result.andersonDarling ? (
                <div
                  style={{
                    ...(s.card as CSSProperties),
                    background: `${c.amber}12`,
                    border: `1px solid ${c.amber}40`,
                  }}
                >
                  <div style={{ fontWeight: 700, color: c.amber, marginBottom: 4 }}>
                    {t('ds_ad_test_name')}
                  </div>
                  <div style={{ fontSize: 13, color: c.text }}>
                    A² = {fmt3(result.andersonDarling.statistic)} &nbsp; p-value = {formatPValue(result.andersonDarling.pValue)}
                  </div>
                  <div style={{ fontSize: 12, color: c.muted, marginTop: 6 }}>
                    {result.andersonDarling.normalAtAlpha05
                      ? t('ds_ad_normal')
                      : t('ds_ad_not_normal')}
                  </div>
                </div>
              ) : (
                <div style={s.card}>{t('ds_ad_need_8')}</div>
              )}

              {/* Stats table — free */}
              <div style={s.card}>
                <div style={s.sectionTitle}>{t('ds_detailed_stats')}</div>
                <table style={s.table}>
                  <tbody>
                    <StatRow label={t('ds_stat_n')} value={result.n.toString()} th={s.th} td={s.td} />
                    <StatRow label={t('ds_stat_mean')} value={fmt(result.mean)} th={s.th} td={s.td} />
                    <StatRow label={t('ds_stat_stdev')} value={fmt(result.stdev)} th={s.th} td={s.td} />
                    <StatRow label={t('ds_stat_variance')} value={fmt(result.variance)} th={s.th} td={s.td} />
                    <StatRow label={t('ds_stat_cv')} value={fmt(result.cv, 2)} th={s.th} td={s.td} />
                    <StatRow label={t('ds_stat_skewness')} value={fmt(result.skewness)} th={s.th} td={s.td} />
                    <StatRow label={t('ds_stat_kurtosis')} value={fmt(result.kurtosis)} th={s.th} td={s.td} />
                    <StatRow label={t('ds_stat_min')} value={fmt(result.min)} th={s.th} td={s.td} />
                    <StatRow label={t('ds_stat_q1')} value={fmt(result.q1)} th={s.th} td={s.td} />
                    <StatRow label={t('ds_stat_median')} value={fmt(result.median)} th={s.th} td={s.td} />
                    <StatRow label={t('ds_stat_q3')} value={fmt(result.q3)} th={s.th} td={s.td} />
                    <StatRow label={t('ds_stat_max')} value={fmt(result.max)} th={s.th} td={s.td} />
                    <StatRow label={t('ds_stat_iqr')} value={fmt(result.iqr)} th={s.th} td={s.td} />
                    <StatRow label={t('ds_stat_range')} value={fmt(result.range)} th={s.th} td={s.td} />
                  </tbody>
                </table>
              </div>

              {/* 95% Confidence Intervals — free */}
              <div style={s.card}>
                <div style={s.sectionTitle}>{t('ds_ci_title')}</div>
                <table style={s.table}>
                  <tbody>
                    <StatRow
                      label={t('ds_stat_mean')}
                      value={result.ciMean ? `${fmt(result.ciMean.lower)} ${t('ds_range_to')} ${fmt(result.ciMean.upper)}` : '—'}
                      th={s.th} td={s.td}
                    />
                    <StatRow
                      label={t('ds_stat_median')}
                      value={result.ciMedian ? `${fmt(result.ciMedian.lower)} ${t('ds_range_to')} ${fmt(result.ciMedian.upper)}` : t('ds_ci_need_n6')}
                      th={s.th} td={s.td}
                    />
                    <StatRow
                      label={t('ds_stat_stdev')}
                      value={result.ciStdev ? `${fmt(result.ciStdev.lower)} ${t('ds_range_to')} ${fmt(result.ciStdev.upper)}` : '—'}
                      th={s.th} td={s.td}
                    />
                  </tbody>
                </table>
              </div>

              {/* ── Export & Save ─────────────────────────────────────── */}
              <div style={s.card}>
                <div style={s.sectionTitle}>{t('ds_export_section_title')}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
                  <button style={s.exportBtn} onClick={handleExportCSV}>
                    {isLoggedIn ? '📄' : '🔒'} {t('ds_export_csv')}
                  </button>
                  <button style={s.exportBtn} onClick={handleExportExcel}>
                    {isPro ? t('ds_export_excel') : t('ds_export_excel_pro')}
                  </button>
                  <button style={s.exportBtn} onClick={handleExportPNG}>
                    {isLoggedIn ? '🖼️' : '🔒'} {t('ds_export_png')}
                  </button>
                  <button style={s.exportBtn} onClick={handleExportPDF}>
                    {isPro ? `📕 ${t('ds_export_pdf')}` : `🔒 ${t('ds_export_pdf_pro')}`}
                  </button>
                </div>
                <div style={{ marginTop: 10 }}>
                  <SaveAnalysisButton
                    theme={theme}
                    tool="descriptive_stats"
                    defaultName={`${t('ds_pdf_report_title')} — ${new Date().toLocaleDateString('en-US')}`}
                    getPayload={() => (!result ? null : { input_data: { values }, results: result })}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      <PasteToast show={gridImport.pasteToast} />
    </div>
  )
}

function StatRow({ label, value, th, td }: { label: string; value: string; th: CSSProperties; td: CSSProperties }) {
  return (
    <tr>
      <td style={{ ...td, color: (th as CSSProperties).color, fontWeight: 600 }}>{label}</td>
      <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace' }}>{value}</td>
    </tr>
  )
}

// ── Box plot rendered as a Chart.js floating-bar chart (see boxPlotData
// above): a whisker bar, an IQR box, a thin median bar, and an outlier
// scatter overlay. Chart.js v4 supports two-value [low, high] bar ranges
// natively, so no external box-plot plugin is needed. ──────────────────
