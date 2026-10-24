'use client'

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import 'chart.js/auto'
import { Chart } from 'react-chartjs-2'
import type { Chart as ChartJSInstance } from 'chart.js'
import { COLORS, usePersistedTheme, getSharedStyles, tint } from '@/lib/theme'
import { useGridImport } from '@/lib/gridImport'
import { SheetPicker, PasteToast } from '@/components/GridImportControls'
import { createReport, nowStamp } from '@/lib/excelReport'
import { createReport as createPdfReport, dataTable, calloutBox, addChartImage, finalizeReport } from '@/lib/pdf/reportDesign'
import Nav from '@/components/Nav'
import ToolSidebar from '@/components/ToolSidebar'
import ToolStyles from '@/components/tool/ToolStyles'
import { ToolHeader, HelpPanel, PhoneTabs, PhoneBar, ExportRow, ReadingsGrid, DataCardHead, useCompactSave, type MobileTab } from '@/components/tool/ToolParts'
import SaveAnalysisButton from '@/components/SaveAnalysisButton'
import { useSubscription } from '@/lib/useSubscription'
import { goToLogin, goToPricing } from '@/lib/exportGate'
import { watermarkOptions, watermarkLayout, withWatermarksDisabled } from '@/lib/watermarkHelpers'
import { useLanguage } from '@/lib/i18n/context'
import type { DescriptiveResult } from '@/lib/descriptive/stats'
import { formatPValue, fixed } from '@/lib/stats/format'

// ─────────────────────────────────────────────────────────────────────────
// Descriptive Statistics on the shared tool layout (ToolParts / ToolStyles).
// The statistics come from /api/descriptive (lib/descriptive/stats.ts on the
// server); this page only draws them. The normal curve over the histogram is
// drawing only (density at the result's mean and standard deviation).
// ─────────────────────────────────────────────────────────────────────────

// Example: golden set D02 (tests/golden/descriptive/datasets.json), n = 30
const EXAMPLE = [
  '24.921', '24.797', '25.060', '25.074', '24.969', '25.037', '25.171', '25.106', '25.071', '25.069',
  '24.914', '25.096', '24.835', '24.967', '24.956', '24.827', '24.989', '25.164', '24.966', '24.879',
  '24.991', '25.085', '25.019', '25.000', '24.859', '25.050', '25.049', '25.134', '25.149', '25.069',
]

/** Up to 4 decimals, at least 2 — as the old page showed values */
function fmt(v: number | null | undefined, digits = 4): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—'
  return Number(v.toPrecision(12)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: digits })
}
function fmt3(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—'
  return fixed(v, 3)
}
const ltr = (v: string) => `\u2066${v}\u2069`
/** CSV number without float noise (0.11475, not 0.1147500000000008) */
const csvNum = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? '' : String(Number(v.toPrecision(12))))

function normalPdf(x: number, mu: number, sd: number): number {
  return Math.exp(-0.5 * ((x - mu) / sd) ** 2) / (sd * Math.sqrt(2 * Math.PI))
}

export default function DescriptiveStats() {
  const { isPro, isLoggedIn } = useSubscription()
  const [theme, setTheme] = usePersistedTheme()
  const { t } = useLanguage()
  const c = COLORS[theme]
  const s = getSharedStyles(theme)
  const compactSave = useCompactSave()

  const [cells, setCells] = useState<string[]>([])
  const [result, setResult] = useState<DescriptiveResult | null>(null)
  const [analyzed, setAnalyzed] = useState<number[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mobileTab, setMobileTab] = useState<MobileTab>('data')
  const [helpOpen, setHelpOpen] = useState(false)
  const [loadedProjectName, setLoadedProjectName] = useState('')
  const [loadError, setLoadError] = useState('')

  const histogramChartRef = useRef<ChartJSInstance<'bar'> | null>(null)
  const boxPlotChartRef = useRef<ChartJSInstance<'bar' | 'line' | 'scatter'> | null>(null)
  const ciChartRef = useRef<ChartJSInstance<'bar'> | null>(null)

  const values = useMemo(() => cells.map(v => parseFloat(v)).filter(v => Number.isFinite(v)), [cells])

  const runAnalysis = useCallback(async (vals: number[]) => {
    setError(null)
    if (vals.length < 2) { setError(t('ds_err_min2')); return }
    setLoading(true)
    try {
      const res = await fetch('/api/descriptive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: vals }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(res.status === 429 ? t('tool_rate_limited') : json.error || t('ds_err_calc_failed'))
        setResult(null)
      } else {
        setResult(json as DescriptiveResult)
        setAnalyzed(vals)
        setMobileTab('results')
      }
    } catch {
      setError(t('ds_err_network'))
    } finally {
      setLoading(false)
    }
  }, [t])

  // ── Load a saved project from the dashboard (?id=...) ─────────────────
  // Only the raw input is restored; the stats are recomputed, never read
  // from a saved results blob.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id')
    if (!id) return
    fetch(`/api/saved-analyses/${id}`)
      .then(res => (res.ok ? res.json() : Promise.reject()))
      .then(({ analysis }) => {
        const loaded = (analysis.input_data as { values: number[] }).values
        setCells(loaded.map(String))
        setLoadedProjectName(analysis.name as string)
        if (loaded.length >= 2) runAnalysis(loaded)
      })
      .catch(() => setLoadError(t('ds_load_error')))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // One column of values: every cell of a paste or upload is flattened to numbers
  const gridImport = useGridImport({
    onGrid: grid => {
      const nums = grid.flat().map(v => parseFloat(v)).filter(v => Number.isFinite(v))
      if (nums.length > 0) { setCells(nums.map(String)); setResult(null) }
    },
    onError: msg => setError(msg),
  })

  const analyze = () => runAnalysis(values)
  const loadExample = () => { setCells(EXAMPLE); runAnalysis(EXAMPLE.map(Number)) }
  const clearAll = () => { setCells([]); setResult(null); setError(null) }

  // ── Charts ───────────────────────────────────────────────────────────────
  // Shared x-axis bounds so the box plot lines up under the histogram
  const axisBounds = useMemo(() => {
    if (!result) return null
    const bins = result.histogram
    if (bins.length) return { min: bins[0].x0, max: bins[bins.length - 1].x1 }
    const span = (result.max - result.min) || 1
    return { min: result.min - span * 0.05, max: result.max + span * 0.05 }
  }, [result])
  // Same y-axis width on the histogram and the box plot so their x axes line up
  const Y_AXIS_WIDTH = 44
  const fixYWidth = (scale: { width: number }) => { scale.width = Y_AXIS_WIDTH }

  const histogramData = useMemo(() => {
    if (!result || !axisBounds) return null
    const bins = result.histogram
    const w = bins.length ? bins[0].x1 - bins[0].x0 : 1
    const curve: { x: number; y: number }[] = []
    if (result.stdev > 0) {
      for (let i = 0; i <= 120; i++) {
        curve.push({ x: axisBounds.min + ((axisBounds.max - axisBounds.min) * i) / 120, y: result.n * w * normalPdf(axisBounds.min + ((axisBounds.max - axisBounds.min) * i) / 120, result.mean, result.stdev) })
      }
    }
    // Bars on a category axis (one category per bin, touching); the curve on a
    // hidden linear axis spanning exactly the same edges (x0 of the first bin
    // to x1 of the last), so both line up.
    return {
      labels: bins.map(b => (b.x0 + b.x1) / 2),
      datasets: [
        {
          type: 'bar' as const,
          label: t('ds_frequency'),
          data: bins.map(b => b.count),
          xAxisID: 'x',
          backgroundColor: tint(c.data, 55),
          borderColor: c.data,
          borderWidth: 1,
          barPercentage: 1,
          categoryPercentage: 1,
          // the curve is not a bar, but Chart.js would still split the
          // category between the two datasets without this
          grouped: false,
          order: 2,
        },
        {
          type: 'line' as const,
          label: t('ds_curve'),
          data: curve,
          xAxisID: 'xCurve',
          // red, as in a graphical summary; also readable on the white report page
          borderColor: c.danger,
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.3,
          order: 1,
        },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any
  }, [result, axisBounds, c, t])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const histogramOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    devicePixelRatio: 2,
    parsing: true,
    layout: watermarkLayout(),
    plugins: {
      watermark: watermarkOptions('light'),
      legend: { position: 'bottom', labels: { color: c.muted, font: { size: 11 }, boxWidth: 12 } },
      tooltip: {
        filter: (item: { dataset: { type?: string } }) => item.dataset.type === 'bar',
        callbacks: {
          title: (items: { dataIndex: number }[]) => {
            const b = result?.histogram[items[0]?.dataIndex ?? 0]
            return b ? `${fmt(b.x0)} – ${fmt(b.x1)}` : ''
          },
        },
      },
    },
    scales: {
      x: { type: 'category', offset: true, grid: { display: false }, ticks: { display: false } },
      xCurve: { type: 'linear', position: 'bottom', offset: false, min: axisBounds?.min, max: axisBounds?.max, grid: { color: c.grid }, ticks: { color: c.muted, font: { size: 10 }, includeBounds: false } },
      y: { beginAtZero: true, grid: { color: c.grid }, ticks: { color: c.muted, precision: 0 }, afterFit: fixYWidth },
    },
  }

  // Box plot: one horizontal row — IQR box, whisker line, median tick, outliers
  const boxPlotData = useMemo(() => {
    if (!result) return null
    const bp = result.boxPlot
    return {
      labels: ['row'],
      datasets: [
        { type: 'bar' as const, label: 'IQR (Q1–Q3)', data: [[bp.q1, bp.q3]], backgroundColor: tint(c.data, 20), borderColor: c.data, borderWidth: 2, barThickness: 34, order: 2 },
        { type: 'line' as const, label: 'Whisker', data: [{ x: bp.lowerWhisker, y: 'row' }, { x: bp.upperWhisker, y: 'row' }], borderColor: c.muted, borderWidth: 1.5, pointRadius: 0, fill: false, order: 1 },
        { type: 'scatter' as const, label: 'Median', data: [{ x: bp.median, y: 'row' }], pointStyle: 'line', rotation: 90, pointRadius: 17, borderColor: c.amber, borderWidth: 3, order: 0 },
        { type: 'scatter' as const, label: 'Outliers', data: bp.outliers.map(o => ({ x: o, y: 'row' })), backgroundColor: c.danger, pointRadius: 4, order: 0, clip: false },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any
  }, [result, c])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const boxPlotOptions: any = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    devicePixelRatio: 2,
    // the tall median marker would otherwise make Chart.js pad both sides,
    // pulling this axis out of line with the histogram above
    layout: { autoPadding: false },
    plugins: { legend: { display: false } },
    scales: {
      // round numbers only: the bin edges at both ends would crowd the next label
      x: { type: 'linear', min: axisBounds?.min, max: axisBounds?.max, grid: { color: c.grid }, ticks: { color: c.muted, font: { size: 10 }, includeBounds: false } },
      y: { grid: { display: false }, ticks: { display: false }, afterFit: fixYWidth },
    },
  }

  // Interval plot: 95% CI for the mean and the median, side by side
  const ciData = useMemo(() => {
    if (!result || !result.ciMean) return null
    const rows = [t('ds_stat_mean'), t('ds_stat_median')]
    const ranges = [[result.ciMean.lower, result.ciMean.upper], result.ciMedian ? [result.ciMedian.lower, result.ciMedian.upper] : null]
    return {
      labels: rows,
      datasets: [
        { type: 'bar' as const, label: '95% CI', data: ranges, backgroundColor: tint(c.data, 22), borderColor: c.data, borderWidth: 1.5, barThickness: 18, order: 2 },
        { type: 'scatter' as const, label: 'Estimate', data: [{ x: result.mean, y: rows[0] }, { x: result.median, y: rows[1] }], pointStyle: 'line', rotation: 90, pointRadius: 11, borderColor: c.amber, borderWidth: 3, order: 1 },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any
  }, [result, c, t])

  const ciBounds = useMemo(() => {
    if (!result?.ciMean) return null
    const lo = Math.min(result.ciMean.lower, result.ciMedian?.lower ?? Infinity)
    const hi = Math.max(result.ciMean.upper, result.ciMedian?.upper ?? -Infinity)
    const pad = (hi - lo) * 0.15 || Math.abs(hi) * 0.01 || 1
    return { min: lo - pad, max: hi + pad }
  }, [result])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ciOptions: any = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    devicePixelRatio: 2,
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: {
      x: { type: 'linear', min: ciBounds?.min, max: ciBounds?.max, grid: { color: c.grid }, ticks: { color: c.muted, font: { size: 10 } } },
      y: { grid: { display: false }, ticks: { color: c.text, font: { size: 12 } } },
    },
  }

  // ── Exports (file content stays in English) ─────────────────────────────
  const REPORT_TITLE = 'Descriptive Statistics — Study Report'

  const runExportExcel = useCallback(async () => {
    if (!isPro) { goToPricing('descriptive-stats', 'excel'); return }
    if (!result) return
    const report = createReport({ toolName: 'Descriptive Statistics' })
    const overview = report.addSheet('Overview')
    overview.titleBand('Descriptive Statistics Report', `N = ${result.n} data points`)
    overview.metaStrip([['Generated on', nowStamp()], ['Sample size (n)', result.n]])

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

    const chartSheet = report.addSheet('Charts')
    await chartSheet.charts([
      { ref: histogramChartRef, title: 'Histogram with Normal Curve' },
      { ref: boxPlotChartRef, title: 'Box Plot' },
      { ref: ciChartRef, title: '95% CI for Mean and Median' },
    ])

    if (analyzed.length > 0) {
      const rawSheet = report.addSheet('Raw Data')
      rawSheet.titleBand('Raw Data', `${analyzed.length} values`)
      rawSheet.table({
        headers: [
          { header: '#', key: 'i', align: 'center', width: 8 },
          { header: 'Value', key: 'v', align: 'right', numFmt: '0.0000' },
        ],
        rows: analyzed.map((v, i) => ({ i: i + 1, v })),
      })
      rawSheet.freezeHeader(2)
    }

    await report.download('descriptive-statistics.xlsx')
  }, [result, isPro, analyzed])

  const exportCSV = () => {
    if (!isLoggedIn) { goToLogin('descriptive-stats', 'csv'); return }
    if (!result) return
    const lines = [
      'Statistic,Value',
      `N,${csvNum(result.n)}`,
      `Mean,${csvNum(result.mean)}`,
      `StDev,${csvNum(result.stdev)}`,
      `Variance,${csvNum(result.variance)}`,
      `CV (%),${csvNum(result.cv)}`,
      `Skewness,${csvNum(result.skewness)}`,
      `Kurtosis,${csvNum(result.kurtosis)}`,
      `Minimum,${csvNum(result.min)}`,
      `Q1,${csvNum(result.q1)}`,
      `Median,${csvNum(result.median)}`,
      `Q3,${csvNum(result.q3)}`,
      `Maximum,${csvNum(result.max)}`,
      `IQR,${csvNum(result.iqr)}`,
      `Range,${csvNum(result.range)}`,
      `AD (A²),${csvNum(result.andersonDarling?.statistic)}`,
      `AD p-value,${result.andersonDarling ? formatPValue(result.andersonDarling.pValue) : ''}`,
      '',
      '#,Value',
      ...analyzed.map((v, i) => `${i + 1},${v}`),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'descriptive-statistics.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const downloadChart = (chart: ChartJSInstance | null, name: string) => {
    if (!chart) return false
    const a = document.createElement('a')
    a.href = chart.toBase64Image('image/png', 1)
    a.download = name
    a.click()
    return true
  }
  const runExportPNG = () => {
    if (!isLoggedIn) { goToLogin('descriptive-stats', 'png'); return }
    downloadChart(histogramChartRef.current as ChartJSInstance | null, 'descriptive-histogram.png')
    downloadChart(boxPlotChartRef.current as ChartJSInstance | null, 'descriptive-boxplot.png')
  }

  const runExportPDF = useCallback(() => {
    if (!isPro) { goToPricing('descriptive-stats', 'pdf'); return }
    if (!result) return
    const ctx = createPdfReport(REPORT_TITLE, 'descriptive-stats')
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
    } else {
      calloutBox(ctx, 'Normality test not run: it needs at least 8 data points.', 'info')
    }

    if (result.ciMean || result.ciMedian || result.ciStdev) {
      dataTable(
        ctx,
        '95% Confidence Intervals',
        [
          { header: 'STATISTIC', width: 160 },
          { header: 'LOWER', width: 140, align: 'right' },
          { header: 'UPPER', width: ctx.pageWidth - ctx.margin * 2 - 300, align: 'right' },
        ],
        [
          ...(result.ciMean ? [['Mean', fmt(result.ciMean.lower), fmt(result.ciMean.upper)]] : []),
          ...(result.ciMedian ? [['Median', fmt(result.ciMedian.lower), fmt(result.ciMedian.upper)]] : []),
          ...(result.ciStdev ? [['StDev', fmt(result.ciStdev.lower), fmt(result.ciStdev.upper)]] : []),
        ]
      )
    }

    // same render width for both, so the fixed y-axis width keeps their x axes aligned
    addChartImage(ctx, histogramChartRef.current, 'Histogram with Normal Curve', { width: 760, height: 320 })
    addChartImage(ctx, boxPlotChartRef.current, 'Box Plot', { width: 760, height: 130 })

    finalizeReport(ctx)
    ctx.pdf.save('descriptive-statistics.pdf')
  }, [isPro, result])

  const charts = () => [histogramChartRef.current, boxPlotChartRef.current, ciChartRef.current]
  const exportExcel = () => (isPro ? withWatermarksDisabled(charts(), runExportExcel) : runExportExcel())
  const exportPDF = () => (isPro ? withWatermarksDisabled(charts(), runExportPDF) : runExportPDF())
  const exportPNG = () => (isLoggedIn ? withWatermarksDisabled(charts(), runExportPNG) : runExportPNG())

  // ── Page ──────────────────────────────────────────────────────────────────
  const helpSteps = [
    { t: t('ds_help_s1_t'), d: t('ds_help_s1_d') },
    { t: t('ds_help_s2_t'), d: t('ds_help_s2_d') },
    { t: t('ds_help_s3_t'), d: t('ds_help_s3_d') },
    { t: t('ds_help_s4_t'), d: t('ds_help_s4_d') },
  ]
  const ad = result?.andersonDarling ?? null
  const nc = ad ? (ad.normalAtAlpha05 ? 'var(--qh-good)' : 'var(--qh-amber)') : 'var(--qh-muted)'
  const kpis: [string, number | null][] = result
    ? [
        [t('ds_stat_mean'), result.mean], [t('ds_stat_stdev'), result.stdev], [t('ds_stat_median'), result.median], [t('ds_stat_skewness'), result.skewness], [t('ds_stat_kurtosis'), result.kurtosis],
        [t('ds_stat_min'), result.min], [t('ds_stat_q1'), result.q1], [t('ds_stat_q3'), result.q3], [t('ds_stat_max'), result.max], [t('ds_stat_iqr'), result.iqr],
      ]
    : []

  return (
    <div style={s.page}>
      <ToolStyles />
      <Nav theme={theme} setTheme={setTheme} breadcrumbKey="bc_descriptive" />

      {(loadedProjectName || loadError) && (
        <div className="qh-main" style={{ ...s.main, paddingBottom: 0 }}>
          {loadedProjectName && (
            <div style={{ fontSize: 13, color: c.accent, background: c.surface2, border: `1px solid ${c.border}`, borderRadius: 8, padding: '8px 14px' }}>
              {t('ds_loaded_project')} {loadedProjectName}
            </div>
          )}
          {loadError && <div className="tl-error">{loadError}</div>}
        </div>
      )}

      <div className="tl-shell">
        <ToolSidebar current="/descriptive" />

        <div className="tl-main">
          <ToolHeader
            title={t('descriptive_title')}
            intro={t('ds_intro')}
            route={{ text: t('ds_route_text'), href: '/imr-chart', label: t('ds_route_link') }}
            onHelp={() => setHelpOpen(true)}
            onExample={loadExample}
            exampleDisabled={loading}
          />
          <HelpPanel open={helpOpen} onClose={() => setHelpOpen(false)} title={t('ds_help_title')} steps={helpSteps} onExample={loadExample} showCapability={false} tip={t('ds_help_tip')} />
          <PhoneTabs tab={mobileTab} onTab={setMobileTab} dataCount={cells.length} hideSetup />

          <div className="tl-top">
            {/* ── DATA ─────────────────────────────────────────────────── */}
            <section className="tl-panel tl-setup tl-card" data-active={mobileTab === 'data'} aria-label={t('spc_tab_data')}>
              <div>
                <DataCardHead
                  countLabel={t('spc_readings_count').replace('{n}', String(values.length))}
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
                <ReadingsGrid
                  values={cells}
                  onChange={(i, v) => setCells(prev => prev.map((x, k) => (k === i ? v : x)))}
                  onRemove={i => setCells(prev => prev.filter((_, k) => k !== i))}
                  onAdd={() => setCells(prev => [...prev, ''])}
                />
              </div>
              <div className="tl-setup-analyze">
                <button className="tl-analyze" onClick={analyze} disabled={loading}>{loading ? t('ds_calculating') : t('ds_analyze')}</button>
              </div>
              {error && <div className="tl-error">{error}</div>}
            </section>

            {/* ── RESULTS ──────────────────────────────────────────────── */}
            <section className="tl-panel tl-results tl-col" data-active={mobileTab === 'results'} aria-label={t('spc_tab_results')}>
              {result ? (
                <>
                  <div className="tl-verdicts">
                    <div className="tl-verdict" style={{ background: tint(nc, 8), border: `1px solid ${tint(nc, 35)}` }}>
                      <span className="tl-verdict-icon" aria-hidden="true" style={{ background: tint(nc, 16), color: nc }}>{ad?.normalAtAlpha05 ? '✓' : ad ? '!' : '–'}</span>
                      <div>
                        <div style={{ fontSize: 12, color: 'var(--qh-muted)', marginBottom: 2 }}>{t('ds_verdict_normality')}</div>
                        <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 4, color: ad ? nc : undefined }}>
                          {ad ? (ad.normalAtAlpha05 ? t('ds_normal_yes') : t('ds_normal_no')) : t('ds_normal_need8')}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--qh-muted)', lineHeight: 1.6 }}>
                          {ad ? <span dir="ltr">A² = {fmt3(ad.statistic)} · p {formatPValue(ad.pValue).startsWith('<') ? formatPValue(ad.pValue) : `= ${formatPValue(ad.pValue)}`}</span> : t('ds_normal_need8_sub')}
                        </div>
                      </div>
                    </div>
                    <div className="tl-verdict" style={{ background: 'var(--qh-surface)', border: '1px solid var(--qh-border)' }}>
                      <span className="tl-verdict-icon" aria-hidden="true" style={{ background: tint(c.accent, 14), color: 'var(--qh-accent)' }}>x̄</span>
                      <div>
                        <div style={{ fontSize: 12, color: 'var(--qh-muted)', marginBottom: 2 }}>{t('ds_verdict_center')}</div>
                        <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 4, fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace" }} dir="ltr">{fmt(result.mean)} ± {fmt(result.stdev)}</div>
                        <div style={{ fontSize: 13, color: 'var(--qh-muted)', lineHeight: 1.6 }}>
                          {t('ds_center_sub').replace('{n}', ltr(String(result.n))).replace('{min}', ltr(fmt(result.min))).replace('{max}', ltr(fmt(result.max)))}
                        </div>
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
                          tool="descriptive_stats"
                          defaultName={`Descriptive Statistics — ${new Date().toLocaleDateString('en-US')}`}
                          compact={compactSave}
                          getPayload={() => (!result ? null : { input_data: { values: analyzed }, results: result })}
                        />
                      }
                    />
                  </div>

                  <div className="tl-kpis">
                    {kpis.map(([label, v]) => (
                      <div key={label} className="tl-kpi"><span>{label}</span><b>{fmt(v)}</b></div>
                    ))}
                  </div>

                  <div className="tl-chart">
                    <h3>{t('ds_hist_title')}</h3>
                    <div className="tl-chart-sub">{t('ds_hist_sub')}</div>
                    <div className="tl-chart-inner" style={{ height: 280 }}>
                      {histogramData && <Chart ref={histogramChartRef} type="bar" data={histogramData} options={histogramOptions} />}
                    </div>
                    <div style={{ height: 80, position: 'relative', marginTop: 10 }}>
                      {boxPlotData && <Chart ref={boxPlotChartRef} type="bar" data={boxPlotData} options={boxPlotOptions} />}
                    </div>
                  </div>

                  <div className="tl-card">
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>{t('ds_ci_title')}</div>
                    <div style={{ overflowX: 'auto' }}>
                      <table className="tl-table">
                        <thead>
                          <tr><th>{t('ds_ci_for')}</th><th className="num">{t('ds_ci_lower')}</th><th className="num">{t('ds_ci_upper')}</th></tr>
                        </thead>
                        <tbody>
                          <tr><td>{t('ds_stat_mean')}</td><td className="num">{fmt(result.ciMean?.lower)}</td><td className="num">{fmt(result.ciMean?.upper)}</td></tr>
                          <tr>
                            <td>{t('ds_stat_median')}</td>
                            {result.ciMedian
                              ? <><td className="num">{fmt(result.ciMedian.lower)}</td><td className="num">{fmt(result.ciMedian.upper)}</td></>
                              : <td className="num" colSpan={2}>{t('ds_ci_need_n6')}</td>}
                          </tr>
                          <tr><td>{t('ds_stat_stdev')}</td><td className="num">{fmt(result.ciStdev?.lower)}</td><td className="num">{fmt(result.ciStdev?.upper)}</td></tr>
                        </tbody>
                      </table>
                    </div>
                    {ciData && (
                      <>
                        <div style={{ height: 110, position: 'relative', marginTop: 12 }}>
                          <Chart ref={ciChartRef} type="bar" data={ciData} options={ciOptions} />
                        </div>
                        <div className="tl-hint">{t('ds_ci_chart_note')}</div>
                      </>
                    )}
                  </div>

                  <details className="tl-more">
                    <summary>{t('ds_more_title')}</summary>
                    <div className="tl-more-body">
                      <table className="tl-table">
                        <tbody>
                          <tr><td>{t('ds_stat_n')}</td><td className="num">{result.n}</td></tr>
                          <tr><td>{t('ds_stat_variance')}</td><td className="num">{fmt(result.variance, 6)}</td></tr>
                          <tr><td>{t('ds_stat_cv')}</td><td className="num">{fmt(result.cv, 2)}</td></tr>
                          <tr><td>{t('ds_stat_range')}</td><td className="num">{fmt(result.range)}</td></tr>
                        </tbody>
                      </table>
                    </div>
                  </details>
                </>
              ) : (
                <div className="tl-card tl-empty">{t('ds_empty_state')}</div>
              )}
            </section>
          </div>
        </div>
      </div>

      <PhoneBar showResultActions={mobileTab === 'results' && !!result} loading={loading} onAnalyze={analyze} onEdit={() => setMobileTab('data')} analyzeLabel={t('ds_analyze')} />
      <PasteToast show={gridImport.pasteToast} />
    </div>
  )
}
