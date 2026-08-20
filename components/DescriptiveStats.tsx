'use client'

import { useState, useCallback, type CSSProperties } from 'react'
import 'chart.js/auto'
import { Chart } from 'react-chartjs-2'
import * as XLSX from 'xlsx'
import { COLORS, usePersistedTheme, getSharedStyles, BRAND_GRADIENT, BRAND_GRADIENT_TEXT_COLOR } from '@/lib/theme'
import { createReport, nowStamp } from '@/lib/excelReport'

type PaletteColors = (typeof COLORS)[keyof typeof COLORS]
import Nav from '@/components/Nav'
import { useSubscription } from '@/lib/useSubscription'
import { goToPricing } from '@/lib/exportGate'
import { useLanguage } from '@/lib/i18n/context'
import type { DescriptiveResult } from '@/lib/descriptive/stats'

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
  const { isPro } = useSubscription()
  const [theme, setTheme] = usePersistedTheme()
  const { t } = useLanguage()
  const c = COLORS[theme]
  const s = getSharedStyles(theme)

  const [rawText, setRawText] = useState('')
  const [result, setResult] = useState<DescriptiveResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const values = parseValues(rawText)

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

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      const data = evt.target?.result
      try {
        const workbook = XLSX.read(data, { type: 'binary' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const json: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 })
        const nums = json
          .flat()
          .map((v) => (typeof v === 'number' ? v : parseFloat(String(v))))
          .filter((v) => Number.isFinite(v))
        setRawText(nums.join('\n'))
      } catch {
        setError(t('ds_err_file_read'))
      }
    }
    reader.readAsBinaryString(file)
    e.target.value = ''
  }, [t])

  const handleExportExcel = useCallback(async () => {
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
        { header: 'Value', key: 'v', align: 'right' },
      ],
      rows: [
        ['N', result.n],
        ['Mean', fmt(result.mean)],
        ['StDev', fmt(result.stdev)],
        ['Variance', fmt(result.variance)],
        ['CV (%)', result.cv !== null ? fmt(result.cv) : '—'],
        ['Skewness', result.skewness !== null ? fmt(result.skewness) : '—'],
        ['Kurtosis', result.kurtosis !== null ? fmt(result.kurtosis) : '—'],
        ['Minimum', fmt(result.min)],
        ['Q1', fmt(result.q1)],
        ['Median', fmt(result.median)],
        ['Q3', fmt(result.q3)],
        ['Maximum', fmt(result.max)],
        ['IQR', fmt(result.iqr)],
        ['Range', fmt(result.range)],
      ],
    })

    if (result.ciMean || result.ciMedian || result.ciStdev) {
      overview.sectionHeading('95% Confidence Intervals')
      overview.table({
        headers: [
          { header: 'Statistic', key: 'k', align: 'left', width: 20 },
          { header: 'Lower', key: 'lo', align: 'right' },
          { header: 'Upper', key: 'hi', align: 'right' },
        ],
        rows: [
          ...(result.ciMean ? [['Mean', fmt(result.ciMean.lower), fmt(result.ciMean.upper)]] : []),
          ...(result.ciMedian ? [['Median', fmt(result.ciMedian.lower), fmt(result.ciMedian.upper)]] : []),
          ...(result.ciStdev ? [['StDev', fmt(result.ciStdev.lower), fmt(result.ciStdev.upper)]] : []),
        ],
      })
    }

    if (result.andersonDarling) {
      const ad = result.andersonDarling
      overview.sectionHeading('Normality Test (Anderson-Darling)')
      overview.table({
        headers: [
          { header: 'Statistic', key: 'k', align: 'left', width: 22 },
          { header: 'Value', key: 'v', align: 'right' },
        ],
        rows: [
          ['A² (adjusted)', fmt3(ad.statistic)],
          ['p-value', fmt3(ad.pValue)],
          ['Conclusion', ad.normalAtAlpha05 ? 'Fail to reject normality (p ≥ 0.05)' : 'Reject normality (p < 0.05)'],
        ],
        rowTones: [undefined, undefined, ad.normalAtAlpha05 ? 'good' : 'warning'],
      })
    }

    overview.sectionHeading('Box Plot Summary')
    const bp = result.boxPlot
    overview.table({
      headers: [
        { header: 'Statistic', key: 'k', align: 'left', width: 22 },
        { header: 'Value', key: 'v', align: 'right' },
      ],
      rows: [
        ['Min', fmt(bp.min)],
        ['Q1', fmt(bp.q1)],
        ['Median', fmt(bp.median)],
        ['Q3', fmt(bp.q3)],
        ['Max', fmt(bp.max)],
        ['Lower Whisker', fmt(bp.lowerWhisker)],
        ['Upper Whisker', fmt(bp.upperWhisker)],
        ['Outliers', bp.outliers.length > 0 ? bp.outliers.map(v => fmt(v)).join(', ') : 'None'],
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
          { header: 'Bin Start', key: 'x0', align: 'right' },
          { header: 'Bin End', key: 'x1', align: 'right' },
          { header: 'Count', key: 'count', align: 'right' },
        ],
        rows: result.histogram.map(b => [fmt(b.x0), fmt(b.x1), b.count]),
      })
      histSheet.freezeHeader(2)
    }

    // ── Sheet 3: Raw Data ──
    if (values.length > 0) {
      const rawSheet = report.addSheet('Raw Data')
      rawSheet.titleBand('Raw Data', `${values.length} values`)
      rawSheet.table({
        headers: [
          { header: '#', key: 'i', align: 'center', width: 8 },
          { header: 'Value', key: 'v', align: 'right', numFmt: '0.0000' },
        ],
        rows: values.map((v, i) => [i + 1, v]),
      })
      rawSheet.freezeHeader(2)
    }

    await report.download('descriptive-statistics.xlsx')
  }, [result, isPro, values])

  const clearAll = () => {
    setRawText('')
    setResult(null)
    setError(null)
  }

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

  return (
    <div style={s.page}>
      {/* Nav */}
      <Nav theme={theme} setTheme={setTheme} breadcrumbKey="bc_descriptive" />

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

            <label style={{ ...(s.addBtn as CSSProperties), display: 'block', textAlign: 'center', marginTop: 10, cursor: 'pointer' }}>
              {t('ds_upload_csv')}
              <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} style={{ display: 'none' }} />
            </label>

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
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px dashed #ef4444',
                  color: '#ef4444',
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

          {result && (
            <button style={s.exportBtn} onClick={handleExportExcel}>
              {isPro ? t('ds_export_excel') : t('ds_export_excel_pro')}
            </button>
          )}
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
                      type="bar"
                      data={histogramData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                          x: { grid: { color: c.grid }, ticks: { color: c.muted, font: { size: 10 } } },
                          y: { grid: { color: c.grid }, ticks: { color: c.muted }, beginAtZero: true },
                        },
                      }}
                    />
                  )}
                </div>
                <BoxPlotSVG box={result.boxPlot} min={result.min} max={result.max} colors={c} />
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
                    A² = {fmt3(result.andersonDarling.statistic)} &nbsp; p-value = {fmt3(result.andersonDarling.pValue)}
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
            </>
          )}
        </div>
      </div>
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

// ── Box plot rendered as a lightweight inline SVG (no chart library has a
// well-supported box-plot type for Chart.js v4 without an extra plugin
// dependency, so this keeps the tool dependency-free). ──────────────────
function BoxPlotSVG({
  box,
  min,
  max,
  colors,
}: {
  box: DescriptiveResult['boxPlot']
  min: number
  max: number
  colors: PaletteColors
}) {
  const width = 100 // percent-based viewBox, scales with container
  const pad = 4
  const span = max - min || 1
  const scale = (v: number) => pad + ((v - min) / span) * (width - 2 * pad)

  const boxX0 = scale(box.q1)
  const boxX1 = scale(box.q3)
  const medianX = scale(box.median)
  const lowerWX = scale(box.lowerWhisker)
  const upperWX = scale(box.upperWhisker)

  return (
    <div style={{ marginTop: 12 }}>
      <svg viewBox="0 0 100 36" width="100%" height="70" preserveAspectRatio="none">
        {/* whisker line */}
        <line x1={lowerWX} y1={18} x2={upperWX} y2={18} stroke={colors.muted} strokeWidth={0.4} />
        {/* whisker caps */}
        <line x1={lowerWX} y1={10} x2={lowerWX} y2={26} stroke={colors.muted} strokeWidth={0.4} />
        <line x1={upperWX} y1={10} x2={upperWX} y2={26} stroke={colors.muted} strokeWidth={0.4} />
        {/* box */}
        <rect
          x={boxX0}
          y={8}
          width={Math.max(boxX1 - boxX0, 0.5)}
          height={20}
          fill={`${colors.accent}30`}
          stroke={colors.accent}
          strokeWidth={0.5}
        />
        {/* median line */}
        <line x1={medianX} y1={8} x2={medianX} y2={28} stroke={colors.amber} strokeWidth={0.8} />
        {/* outliers */}
        {box.outliers.map((o, i) => (
          <circle key={i} cx={scale(o)} cy={18} r={0.8} fill={colors.danger} />
        ))}
      </svg>
    </div>
  )
}
