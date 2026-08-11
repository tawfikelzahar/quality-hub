'use client'

import { useState, useCallback, type CSSProperties } from 'react'
import Link from 'next/link'
import 'chart.js/auto'
import { Chart } from 'react-chartjs-2'
import * as XLSX from 'xlsx'
import { COLORS, usePersistedTheme, getSharedStyles, BRAND_GRADIENT, BRAND_GRADIENT_TEXT_COLOR } from '@/lib/theme'

type PaletteColors = (typeof COLORS)[keyof typeof COLORS]
import AuthStatus from '@/components/AuthStatus'
import { LockedSection } from '@/components/Locked'
import { useSubscription } from '@/lib/useSubscription'
import { goToPricing } from '@/lib/exportGate'
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
      setError('Need at least 2 valid numeric values.')
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
        setError(json.error || 'Calculation failed.')
        setResult(null)
      } else {
        setResult(json as DescriptiveResult)
      }
    } catch {
      setError('Network error while calculating.')
    } finally {
      setLoading(false)
    }
  }, [values])

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
        setError('Could not read the uploaded file.')
      }
    }
    reader.readAsBinaryString(file)
    e.target.value = ''
  }, [])

  const handleExportExcel = useCallback(() => {
    if (!isPro) { goToPricing(); return }
    if (!result) return
    const rows = [
      { Statistic: 'N', Value: result.n },
      { Statistic: 'Mean', Value: result.mean },
      { Statistic: 'StDev', Value: result.stdev },
      { Statistic: 'Variance', Value: result.variance },
      { Statistic: 'CV (%)', Value: result.cv },
      { Statistic: 'Skewness', Value: result.skewness },
      { Statistic: 'Kurtosis', Value: result.kurtosis },
      { Statistic: 'Minimum', Value: result.min },
      { Statistic: 'Q1', Value: result.q1 },
      { Statistic: 'Median', Value: result.median },
      { Statistic: 'Q3', Value: result.q3 },
      { Statistic: 'Maximum', Value: result.max },
      { Statistic: 'IQR', Value: result.iqr },
      { Statistic: 'Range', Value: result.range },
    ]
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Descriptive Stats')
    XLSX.writeFile(wb, 'descriptive-statistics.xlsx')
  }, [result, isPro])

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
            label: 'Frequency',
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
      <nav className="qh-nav" style={s.nav}>
        <div className="qh-nav-left" style={s.navLeft}>
          <Link href="/" style={s.logo}>
            <div style={s.logoIcon}>σ</div>
            QualityTools
          </Link>
          <span className="qh-breadcrumb-sep" style={s.separator}>/</span>
          <span className="qh-breadcrumb" style={s.breadcrumb}>Descriptive Statistics</span>
        </div>
        <div className="qh-nav-right" style={s.navRight}>
          <button style={s.themeBtn} onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}>
            {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </button>
          <AuthStatus />
          <Link href="/pricing" style={{ ...(s.ctaBtn as CSSProperties) }}>
            Get Pro →
          </Link>
        </div>
      </nav>

      <div className="qh-body" style={s.body}>
        {/* Left Panel — input */}
        <div className="qh-left" style={s.left}>
          <div>
            <div style={s.sectionTitle}>📋 Data Input</div>
            <textarea
              style={{ ...(s.input as CSSProperties), minHeight: 220, resize: 'vertical', fontFamily: 'monospace' }}
              placeholder={'Paste one number per line (or comma/tab separated)\ne.g.\n24.3\n25.1\n25.6\n...'}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
            />
            <div style={{ fontSize: 11, color: c.muted, marginTop: 6 }}>
              {values.length} valid value{values.length === 1 ? '' : 's'} detected
            </div>

            <label style={{ ...(s.addBtn as CSSProperties), display: 'block', textAlign: 'center', marginTop: 10, cursor: 'pointer' }}>
              📁 Upload CSV / Excel
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
              {loading ? 'Calculating…' : '▶ Calculate'}
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
                🗑️ Clear All Data
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
              {isPro ? '📊 Export to Excel' : '🔒 Export to Excel (Pro)'}
            </button>
          )}
        </div>

        {/* Right Panel — results */}
        <div className="qh-right" style={s.right}>
          {!result && !loading && (
            <div style={{ ...(s.card as CSSProperties), textAlign: 'center', color: c.muted, padding: 60 }}>
              Paste or upload your measurement data, then hit Calculate to see the full
              statistical breakdown, histogram, and box plot.
            </div>
          )}

          {result && (
            <>
              {/* Histogram + Box Plot */}
              <div style={s.chartWrap}>
                <div style={s.sectionTitle}>📊 Histogram + Box Plot</div>
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

              {/* Anderson-Darling Normality Test — Pro */}
              <LockedSection theme={theme} feature="Anderson-Darling Normality Test" minHeight={110}>
                {result.andersonDarling ? (
                  <div
                    style={{
                      ...(s.card as CSSProperties),
                      background: `${c.amber}12`,
                      border: `1px solid ${c.amber}40`,
                    }}
                  >
                    <div style={{ fontWeight: 700, color: c.amber, marginBottom: 4 }}>
                      Anderson-Darling Normality Test
                    </div>
                    <div style={{ fontSize: 13, color: c.text }}>
                      A² = {fmt3(result.andersonDarling.statistic)} &nbsp; p-value = {fmt3(result.andersonDarling.pValue)}
                    </div>
                    <div style={{ fontSize: 12, color: c.muted, marginTop: 6 }}>
                      {result.andersonDarling.normalAtAlpha05
                        ? 'p ≥ 0.05 — no significant evidence against normality (α = 0.05).'
                        : 'p < 0.05 — data significantly deviates from a normal distribution (α = 0.05).'}
                    </div>
                  </div>
                ) : (
                  <div style={s.card}>Need at least 8 data points to run the normality test.</div>
                )}
              </LockedSection>

              {/* Stats table — free */}
              <div style={s.card}>
                <div style={s.sectionTitle}>Detailed Statistics</div>
                <table style={s.table}>
                  <tbody>
                    <StatRow label="N" value={result.n.toString()} th={s.th} td={s.td} />
                    <StatRow label="Mean" value={fmt(result.mean)} th={s.th} td={s.td} />
                    <StatRow label="StDev" value={fmt(result.stdev)} th={s.th} td={s.td} />
                    <StatRow label="Variance" value={fmt(result.variance)} th={s.th} td={s.td} />
                    <StatRow label="CV (%)" value={fmt(result.cv, 2)} th={s.th} td={s.td} />
                    <StatRow label="Skewness" value={fmt(result.skewness)} th={s.th} td={s.td} />
                    <StatRow label="Kurtosis" value={fmt(result.kurtosis)} th={s.th} td={s.td} />
                    <StatRow label="Minimum" value={fmt(result.min)} th={s.th} td={s.td} />
                    <StatRow label="Q1" value={fmt(result.q1)} th={s.th} td={s.td} />
                    <StatRow label="Median" value={fmt(result.median)} th={s.th} td={s.td} />
                    <StatRow label="Q3" value={fmt(result.q3)} th={s.th} td={s.td} />
                    <StatRow label="Maximum" value={fmt(result.max)} th={s.th} td={s.td} />
                    <StatRow label="IQR" value={fmt(result.iqr)} th={s.th} td={s.td} />
                    <StatRow label="Range" value={fmt(result.range)} th={s.th} td={s.td} />
                  </tbody>
                </table>
              </div>

              {/* 95% Confidence Intervals — Pro */}
              <LockedSection theme={theme} feature="95% Confidence Intervals" minHeight={150}>
                <div style={s.card}>
                  <div style={s.sectionTitle}>95% Confidence Intervals</div>
                  <table style={s.table}>
                    <tbody>
                      <StatRow
                        label="Mean"
                        value={result.ciMean ? `${fmt(result.ciMean.lower)} to ${fmt(result.ciMean.upper)}` : '—'}
                        th={s.th} td={s.td}
                      />
                      <StatRow
                        label="Median"
                        value={result.ciMedian ? `${fmt(result.ciMedian.lower)} to ${fmt(result.ciMedian.upper)}` : 'Need N ≥ 6'}
                        th={s.th} td={s.td}
                      />
                      <StatRow
                        label="StDev"
                        value={result.ciStdev ? `${fmt(result.ciStdev.lower)} to ${fmt(result.ciStdev.upper)}` : '—'}
                        th={s.th} td={s.td}
                      />
                    </tbody>
                  </table>
                </div>
              </LockedSection>
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
