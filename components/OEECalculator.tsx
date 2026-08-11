'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import 'chart.js/auto'
import { Chart } from 'react-chartjs-2'
import type { Chart as ChartJSInstance } from 'chart.js'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import { COLORS, usePersistedTheme } from '@/lib/theme'
import AuthStatus from '@/components/AuthStatus'
import SaveAnalysisButton from '@/components/SaveAnalysisButton'
import { useSubscription } from '@/lib/useSubscription'
import { goToLogin, goToPricing } from '@/lib/exportGate'

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

function classify(oee: number): { label: string; type: Classification } {
  if (oee >= 85) return { label: 'World-class performance', type: 'world-class' }
  if (oee >= 60) return { label: 'Typical performance — room to improve', type: 'good' }
  if (oee >= 40) return { label: 'Below average — focus on the weakest factor', type: 'average' }
  return { label: 'Significant losses — investigate root causes', type: 'poor' }
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

function validate(i: OEEInputs): string | null {
  if (i.plannedTime <= 0) return 'Planned production time must be greater than 0'
  if (i.plannedTime - i.breaks <= 0) return 'Breaks cannot equal or exceed planned time'
  if (i.downtime >= i.plannedTime - i.breaks) return 'Unplanned downtime cannot equal or exceed net planned time'
  if (i.goodCount > i.totalCount) return 'Good parts cannot exceed total parts produced'
  if (i.cycleTime <= 0) return 'Ideal cycle time must be greater than 0'
  return null
}

const BENCH = [
  { key: 'availability', label: 'Availability', wc: 90, note: 'A ≥ 90%' },
  { key: 'performanceCapped', label: 'Performance', wc: 95, note: 'P ≥ 95%' },
  { key: 'quality', label: 'Quality', wc: 99.9, note: 'Q ≥ 99.9%' },
  { key: 'oee', label: 'OEE', wc: 85, note: 'OEE ≥ 85%' },
] as const

export default function OEECalculator() {
  const { isPro, isLoggedIn } = useSubscription()
  const [theme, setTheme] = usePersistedTheme()
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

  const setField = (field: keyof OEEInputs, val: string) => {
    setInputs(prev => ({ ...prev, [field]: parseFloat(val) || 0 }))
  }

  const error = validate(inputs)
  const result = error ? null : calcOEE(inputs)
  const cls = result ? classify(result.oee) : null

  const classColor: Record<Classification, string> = {
    'world-class': '#22c55e',
    good: c.accent,
    average: c.amber,
    poor: c.danger,
  }

  const lossData = result
    ? [
        { label: 'Downtime Loss', sub: 'Breakdown + Changeover', value: result.downtimeLoss, color: c.danger },
        { label: 'Speed Loss', sub: 'Minor Stops + Reduced Speed', value: result.speedLoss, color: c.amber },
        { label: 'Quality Loss', sub: 'Defects + Startup Rejects', value: result.qualityLoss, color: c.accent },
      ]
    : []

  const chartData = {
    labels: lossData.map(l => l.label),
    datasets: [
      {
        label: 'Loss %',
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
      ...lossData.map(l => `${l.label},${l.value.toFixed(2)},%`),
      '',
      'Benchmark,Your Value,World-Class,Gap',
      ...BENCH.map(b => {
        const yours = result[b.key]
        const gap = yours - b.wc
        return `${b.label},${yours.toFixed(2)}%,${b.wc}%,${gap >= 0 ? '+' : ''}${gap.toFixed(2)}%`
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

  const exportExcel = () => {
    if (!isPro) { goToPricing(); return }
    if (!result || !cls) return
    const indices = [
      { Metric: 'OEE (Overall)', 'Value (%)': result.oee.toFixed(2) },
      { Metric: 'Availability', 'Value (%)': result.availability.toFixed(2) },
      { Metric: 'Performance', 'Value (%)': result.performanceCapped.toFixed(2) },
      { Metric: 'Quality (First Pass Yield)', 'Value (%)': result.quality.toFixed(2) },
    ]
    const losses = lossData.map(l => ({ 'Loss Category': l.label, Description: l.sub, 'Value (%)': l.value.toFixed(2) }))
    const bench = BENCH.map(b => {
      const yours = result[b.key]
      return {
        Metric: b.label,
        'Your Value (%)': yours.toFixed(2),
        'World-Class (%)': b.wc,
        'Gap (%)': (yours - b.wc).toFixed(2),
      }
    })
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(indices), 'OEE Indices')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(losses), 'Six Big Losses')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(bench), 'Benchmark')
    XLSX.writeFile(wb, 'oee-analysis.xlsx')
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
    pdf.text(`OEE: ${result.oee.toFixed(2)}%  —  ${cls.label}`, margin, y)
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
        `${b.label}: ${yours.toFixed(2)}%  (World-class ${b.wc}%, gap ${gap >= 0 ? '+' : ''}${gap.toFixed(2)}%)`,
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

  const fields: { key: keyof OEEInputs; label: string; step?: string }[] = [
    { key: 'plannedTime', label: 'Planned Production Time (min)' },
    { key: 'breaks', label: 'Planned Downtime / Breaks (min)' },
    { key: 'downtime', label: 'Unplanned Downtime (min)' },
    { key: 'cycleTime', label: 'Ideal Cycle Time (sec/part)', step: '0.1' },
    { key: 'totalCount', label: 'Total Parts Produced' },
    { key: 'goodCount', label: 'Good Parts (first pass)' },
  ]

  return (
    <div style={s.page}>
      <nav className="qh-nav" style={s.nav}>
        <div className="qh-nav-left" style={s.navLeft}>
          <Link href="/" style={s.logo}>
            <div style={s.logoIcon}>σ</div>
            QualityTools
          </Link>
          <span className="qh-breadcrumb-sep" style={s.separator}>/</span>
          <span className="qh-breadcrumb" style={s.breadcrumb}>OEE Calculator</span>
        </div>
        <div className="qh-nav-right" style={s.navRight}>
          <button style={s.themeBtn} onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </button>
          <AuthStatus />
          <Link href="/pricing" style={{
            background: 'linear-gradient(135deg,#0fd4c8,#00a896)',
            color: '#060d1a', fontWeight: 700, fontSize: 12,
            padding: '7px 16px', borderRadius: 7, textDecoration: 'none',
          }}>
            Get Pro →
          </Link>
        </div>
      </nav>

      <div className="qh-body" style={s.body}>
        <div className="qh-left" style={s.left}>
          <div>
            <div style={s.sectionTitle}>⚙️ Production Data</div>
            {fields.map(f => (
              <div key={f.key} style={s.field}>
                <div style={s.label}>{f.label}</div>
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
              Ideal cycle time is the design rate — fastest achievable without compromise.
              Planned downtime (breaks, scheduled maintenance) is excluded from the OEE base.
            </div>
            {error && (
              <div style={{ color: c.danger, fontSize: 12, marginTop: 10, fontWeight: 600 }}>
                {error}
              </div>
            )}
          </div>

          {result && (
            <div>
              <div style={s.sectionTitle}>📤 Export</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button style={s.exportBtn} onClick={exportCSV}>{isLoggedIn ? '📄 CSV' : '🔒 CSV'}</button>
                <button style={s.exportBtn} onClick={exportExcel}>{isPro ? '📊 Excel' : '🔒 Excel'}</button>
                <button style={s.exportBtn} onClick={exportPNG}>{isLoggedIn ? '🖼️ PNG' : '🔒 PNG'}</button>
                <button style={s.exportBtn} onClick={exportPDF}>{isPro ? '📑 PDF' : '🔒 PDF'}</button>
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
                {cls.label} — OEE {result.oee.toFixed(2)}%
              </div>

              <div className="qh-stats-row" style={s.statsRow}>
                <div style={s.statCard}>
                  <div style={{ ...s.statVal, color: classColor[cls.type] }}>{result.oee.toFixed(1)}%</div>
                  <div style={s.statLabel}>OEE (Overall)</div>
                </div>
                <div style={s.statCard}>
                  <div style={s.statVal}>{result.availability.toFixed(1)}%</div>
                  <div style={s.statLabel}>Availability</div>
                </div>
                <div style={s.statCard}>
                  <div style={s.statVal}>{result.performanceCapped.toFixed(1)}%</div>
                  <div style={s.statLabel}>Performance</div>
                </div>
                <div style={s.statCard}>
                  <div style={s.statVal}>{result.quality.toFixed(1)}%</div>
                  <div style={s.statLabel}>Quality (FPY)</div>
                </div>
              </div>

              <div className="qh-chart-wrap" style={s.chartWrap}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Six Big Losses</div>
                <div style={{ color: c.muted, fontSize: 12, marginBottom: 16 }}>
                  Downtime · Speed · Quality — as a % of net planned time
                </div>
                <div className="qh-chart-inner" style={s.chartInner}>
                  <Chart ref={chartRef} type="bar" data={chartData} options={chartOptions} />
                </div>
              </div>

              <div style={s.card}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>World-Class Benchmark</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={s.table}>
                    <thead>
                      <tr>
                        <th style={s.th}>Metric</th>
                        <th style={{ ...s.th, textAlign: 'right' }}>Your Value</th>
                        <th style={{ ...s.th, textAlign: 'right' }}>World-Class</th>
                        <th style={{ ...s.th, textAlign: 'right' }}>Gap</th>
                      </tr>
                    </thead>
                    <tbody>
                      {BENCH.map(b => {
                        const yours = result[b.key]
                        const gap = yours - b.wc
                        return (
                          <tr key={b.key}>
                            <td style={s.td}>
                              {b.label}
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
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Conditions at Analysis</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={s.table}>
                    <tbody>
                      <tr><td style={{ ...s.td, color: c.muted }}>Planned Time</td><td style={s.td}>{inputs.plannedTime} min (net: {result.netPlanned} min)</td></tr>
                      <tr><td style={{ ...s.td, color: c.muted }}>Unplanned Downtime</td><td style={s.td}>{inputs.downtime} min</td></tr>
                      <tr><td style={{ ...s.td, color: c.muted }}>Ideal Cycle Time</td><td style={s.td}>{inputs.cycleTime} sec/part</td></tr>
                      <tr><td style={{ ...s.td, color: c.muted }}>Total Produced</td><td style={s.td}>{Math.round(inputs.totalCount).toLocaleString()} parts</td></tr>
                      <tr><td style={{ ...s.td, color: c.muted }}>Good Parts</td><td style={s.td}>{Math.round(inputs.goodCount).toLocaleString()} parts ({result.quality.toFixed(2)}%)</td></tr>
                      <tr><td style={{ ...s.td, color: c.muted, borderBottom: 'none' }}>Formula</td><td style={{ ...s.td, borderBottom: 'none' }}>OEE = A × P × Q</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div style={{ ...s.card, textAlign: 'center', padding: 60, color: c.muted }}>
              {error || 'Enter production data on the left to calculate OEE'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
