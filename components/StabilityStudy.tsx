'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import 'chart.js/auto'
import { Chart } from 'react-chartjs-2'
import type { Chart as ChartJSInstance } from 'chart.js'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import { COLORS, getSharedStyles, usePersistedTheme } from '@/lib/theme'
import AuthStatus from '@/components/AuthStatus'
import SaveAnalysisButton from '@/components/SaveAnalysisButton'
import { LockedPage } from '@/components/Locked'
import { useSubscription } from '@/lib/useSubscription'
import {
  type BatchData,
  type TrendDirection,
  linearRegression,
  tCritical,
  findShelfLife,
  poolabilityTest,
  STORAGE_CONDITIONS,
} from '@/lib/stability/calc'

// ── Sample dataset — a realistic assay(%) decline over 36 months ──────────
const SAMPLE_TIME_POINTS = [0, 3, 6, 9, 12, 18, 24, 36]
const SAMPLE_BATCH_NAMES = ['Batch 1', 'Batch 2', 'Batch 3']
const SAMPLE_VALUES: (number | null)[][] = [
  [100.2, 100.0, 99.9],
  [99.8, 99.6, 99.7],
  [99.5, 99.4, 99.3],
  [99.1, 99.0, 99.0],
  [98.9, 98.7, 98.6],
  [98.3, 98.0, 97.9],
  [97.8, 97.5, 97.3],
  [96.9, 96.5, 96.4],
]

const BATCH_COLORS = ['#0fd4c8', '#f59e0b', '#a78bfa', '#f472b6', '#60a5fa', '#4ade80']

function fmt(n: number | null | undefined, digits = 3): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return n.toFixed(digits)
}

export default function StabilityStudy() {
  const [theme, setTheme] = usePersistedTheme()
  const c = COLORS[theme]
  const s = getSharedStyles(theme)
  const { isPro, loading: subLoading } = useSubscription()

  // ── Study setup ──────────────────────────────────────────────────────
  const [attributeName, setAttributeName] = useState('Assay')
  const [unit, setUnit] = useState('%')
  const [storageCondition, setStorageCondition] = useState<string>('long-term')
  const [direction, setDirection] = useState<TrendDirection>('decreasing')
  const [specLower, setSpecLower] = useState('95.0')
  const [specUpper, setSpecUpper] = useState('')
  const [confidence, setConfidence] = useState<90 | 95 | 99>(95)

  // ── Data grid: rows = time points (months), columns = batches ─────────
  const [timePoints, setTimePoints] = useState<number[]>(SAMPLE_TIME_POINTS)
  const [batchNames, setBatchNames] = useState<string[]>(SAMPLE_BATCH_NAMES)
  const [values, setValues] = useState<(number | null)[][]>(SAMPLE_VALUES)

  const chartRef = useRef<ChartJSInstance | null>(null)

  // ── Grid mutation helpers ──────────────────────────────────────────────
  const addTimePoint = () => {
    const last = timePoints[timePoints.length - 1] ?? 0
    setTimePoints((prev) => [...prev, last + 3])
    setValues((prev) => [...prev, batchNames.map(() => null)])
  }
  const removeTimePoint = (idx: number) => {
    if (timePoints.length <= 2) return
    setTimePoints((prev) => prev.filter((_, i) => i !== idx))
    setValues((prev) => prev.filter((_, i) => i !== idx))
  }
  const updateTimePoint = (idx: number, val: string) => {
    const n = val === '' ? 0 : Number(val)
    setTimePoints((prev) => prev.map((t, i) => (i === idx ? n : t)))
  }
  const addBatch = () => {
    setBatchNames((prev) => [...prev, `Batch ${prev.length + 1}`])
    setValues((prev) => prev.map((row) => [...row, null]))
  }
  const removeBatch = (bIdx: number) => {
    if (batchNames.length <= 1) return
    setBatchNames((prev) => prev.filter((_, i) => i !== bIdx))
    setValues((prev) => prev.map((row) => row.filter((_, i) => i !== bIdx)))
  }
  const updateBatchName = (bIdx: number, name: string) => {
    setBatchNames((prev) => prev.map((n, i) => (i === bIdx ? name : n)))
  }
  const updateValue = (tIdx: number, bIdx: number, val: string) => {
    const n = val === '' ? null : Number(val)
    setValues((prev) => prev.map((row, i) => (i === tIdx ? row.map((v, j) => (j === bIdx ? n : v)) : row)))
  }
  const loadSample = () => {
    setAttributeName('Assay'); setUnit('%'); setDirection('decreasing')
    setSpecLower('95.0'); setSpecUpper(''); setConfidence(95)
    setTimePoints(SAMPLE_TIME_POINTS); setBatchNames(SAMPLE_BATCH_NAMES); setValues(SAMPLE_VALUES)
  }
  const clearAll = () => {
    setTimePoints([0, 3, 6]); setBatchNames(['Batch 1'])
    setValues([[null], [null], [null]])
  }

  // ── Core analysis ───────────────────────────────────────────────────────
  const analysis = useMemo(() => {
    const specLimit = direction === 'decreasing' ? parseFloat(specLower) : parseFloat(specUpper)
    const hasSpec = !Number.isNaN(specLimit)
    const confLevel = confidence / 100

    const batches: BatchData[] = batchNames
      .map((name, bIdx) => ({
        id: `b${bIdx}`,
        name,
        points: timePoints
          .map((t, tIdx) => ({ time: t, value: values[tIdx]?.[bIdx] ?? null }))
          .filter((p): p is { time: number; value: number } => p.value !== null),
      }))
      .filter((b) => b.points.length >= 2)

    const maxObservedMonth = Math.max(0, ...batches.flatMap((b) => b.points.map((p) => p.time)))

    const individual = batches.map((b) => {
      const reg = linearRegression(b.points)
      if (!reg) return { batch: b, reg: null, shelfLife: null as number | null, extrapolated: false, tCrit: 0 }
      const tCrit = tCritical(confLevel, reg.df)
      const sl = hasSpec ? findShelfLife(reg, tCrit, specLimit, direction, maxObservedMonth) : { shelfLifeMonths: null, extrapolated: false }
      return { batch: b, reg, shelfLife: sl.shelfLifeMonths, extrapolated: sl.extrapolated, tCrit }
    })

    const allPoints = batches.flatMap((b) => b.points)
    const pooledReg = batches.length >= 1 ? linearRegression(allPoints) : null
    const pooledTCrit = pooledReg ? tCritical(confLevel, pooledReg.df) : 0
    const pooledShelfLifeRaw = pooledReg && hasSpec
      ? findShelfLife(pooledReg, pooledTCrit, specLimit, direction, maxObservedMonth)
      : { shelfLifeMonths: null, extrapolated: false }

    const poolability = batches.length >= 2 ? poolabilityTest(batches) : null

    const validIndividualShelfLives = individual
      .map((r) => r.shelfLife)
      .filter((v): v is number => v !== null)

    let recommended: number | null = null
    let basis: 'pooled' | 'individual-min' | 'none' = 'none'
    if (poolability?.fullyPoolable && pooledShelfLifeRaw.shelfLifeMonths !== null) {
      recommended = pooledShelfLifeRaw.shelfLifeMonths
      basis = 'pooled'
    } else if (batches.length === 1 && individual[0]?.shelfLife !== null) {
      recommended = individual[0].shelfLife
      basis = 'individual-min'
    } else if (validIndividualShelfLives.length > 0) {
      recommended = Math.min(...validIndividualShelfLives)
      basis = 'individual-min'
    }

    return {
      hasSpec, specLimit, batches, individual, pooledReg, pooledTCrit, pooledShelfLifeRaw,
      poolability, recommended, basis, maxObservedMonth,
    }
  }, [batchNames, values, timePoints, direction, specLower, specUpper, confidence])

  // ── Chart data ───────────────────────────────────────────────────────
  const chartXMax = Math.max(analysis.maxObservedMonth * 1.15, (analysis.recommended ?? 0) * 1.15, 6)

  const chartData = {
    datasets: [
      ...analysis.batches.map((b, i) => ({
        label: `${b.name} (data)`,
        data: b.points.map((p) => ({ x: p.time, y: p.value })),
        showLine: false,
        pointRadius: 5,
        pointBackgroundColor: BATCH_COLORS[i % BATCH_COLORS.length],
        borderColor: BATCH_COLORS[i % BATCH_COLORS.length],
      })),
      ...analysis.individual
        .filter((r) => r.reg)
        .map((r, i) => ({
          label: `${r.batch.name} (fit)`,
          data: [
            { x: 0, y: r.reg!.intercept },
            { x: chartXMax, y: r.reg!.intercept + r.reg!.slope * chartXMax },
          ],
          showLine: true,
          pointRadius: 0,
          borderColor: BATCH_COLORS[i % BATCH_COLORS.length],
          borderWidth: 1.5,
          borderDash: [4, 3],
        })),
      ...(analysis.hasSpec
        ? [
            {
              label: `Spec limit (${analysis.specLimit})`,
              data: [
                { x: 0, y: analysis.specLimit },
                { x: chartXMax, y: analysis.specLimit },
              ],
              showLine: true,
              pointRadius: 0,
              borderColor: c.danger,
              borderWidth: 2,
            },
          ]
        : []),
    ],
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false as const,
    plugins: {
      legend: { position: 'bottom' as const, labels: { color: c.text, font: { size: 11 }, boxWidth: 12 } },
    },
    scales: {
      x: {
        type: 'linear' as const,
        title: { display: true, text: 'Time (months)', color: c.muted },
        ticks: { color: c.muted },
        grid: { color: c.grid },
      },
      y: {
        title: { display: true, text: `${attributeName} (${unit})`, color: c.muted },
        ticks: { color: c.muted },
        grid: { color: c.grid },
      },
    },
  }

  // ── Export: CSV ──────────────────────────────────────────────────────
  const exportCSV = () => {
    const lines: string[] = []
    lines.push(`Stability Study — ${attributeName} (${unit})`)
    lines.push(`Storage condition,${STORAGE_CONDITIONS.find((sc) => sc.key === storageCondition)?.label ?? storageCondition}`)
    lines.push(`Direction,${direction}`)
    lines.push(`Spec limit,${analysis.hasSpec ? analysis.specLimit : 'n/a'}`)
    lines.push(`Confidence,${confidence}%`)
    lines.push('')
    lines.push(['Time (months)', ...batchNames].join(','))
    timePoints.forEach((t, tIdx) => {
      lines.push([t, ...values[tIdx].map((v) => (v === null ? '' : v))].join(','))
    })
    lines.push('')
    lines.push('Batch,Slope,Intercept,R2,Shelf life (months),Extrapolated')
    analysis.individual.forEach((r) => {
      lines.push([
        r.batch.name,
        r.reg ? fmt(r.reg.slope, 5) : '',
        r.reg ? fmt(r.reg.intercept, 5) : '',
        r.reg ? fmt(r.reg.r2, 4) : '',
        r.shelfLife !== null ? fmt(r.shelfLife, 1) : 'not reached',
        r.extrapolated ? 'yes' : 'no',
      ].join(','))
    })
    lines.push('')
    lines.push(`Recommended shelf life (months),${analysis.recommended !== null ? fmt(analysis.recommended, 1) : 'n/a'}`)
    lines.push(`Basis,${analysis.basis}`)
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'stability-study-data.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  // ── Export: Excel ────────────────────────────────────────────────────
  const exportExcel = () => {
    const wb = XLSX.utils.book_new()
    const rawRows: Record<string, string | number>[] = timePoints.map((t, tIdx) => {
      const row: Record<string, string | number> = { 'Time (months)': t }
      batchNames.forEach((name, bIdx) => { row[name] = values[tIdx][bIdx] ?? '' })
      return row
    })
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rawRows), 'Raw Data')

    const summaryRows = analysis.individual.map((r) => ({
      Batch: r.batch.name,
      Slope: r.reg?.slope ?? '',
      Intercept: r.reg?.intercept ?? '',
      'R²': r.reg?.r2 ?? '',
      'Shelf life (months)': r.shelfLife ?? 'not reached',
      Extrapolated: r.extrapolated ? 'Yes' : 'No',
    }))
    summaryRows.push({
      Batch: 'RECOMMENDED', Slope: '', Intercept: '', 'R²': '',
      'Shelf life (months)': analysis.recommended ?? 'n/a', Extrapolated: analysis.basis,
    })
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'Summary')
    XLSX.writeFile(wb, 'stability-study-results.xlsx')
  }

  // ── Export: PNG ──────────────────────────────────────────────────────
  const exportPNG = () => {
    const chart = chartRef.current
    if (!chart) return
    const url = chart.toBase64Image('image/png', 1)
    const a = document.createElement('a')
    a.href = url; a.download = 'stability-study-chart.png'; a.click()
  }

  // ── Export: PDF ──────────────────────────────────────────────────────
  const exportPDF = () => {
    const chart = chartRef.current
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const margin = 40
    let y = margin

    pdf.setFontSize(18); pdf.setFont('helvetica', 'bold')
    pdf.text('Stability Study Report', margin, y); y += 20
    pdf.setFontSize(10); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(100)
    pdf.text(`Generated: ${new Date().toLocaleDateString()}`, margin, y); y += 24

    pdf.setFontSize(11); pdf.setTextColor(0); pdf.setFont('helvetica', 'bold')
    pdf.text(`Attribute: ${attributeName} (${unit})   Condition: ${STORAGE_CONDITIONS.find((sc) => sc.key === storageCondition)?.label ?? storageCondition}`, margin, y)
    y += 20

    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10)
    const infoRows: [string, string][] = [
      ['Direction', direction],
      ['Spec limit', analysis.hasSpec ? String(analysis.specLimit) : 'n/a'],
      ['Confidence level', `${confidence}%`],
      ['Recommended shelf life', analysis.recommended !== null ? `${fmt(analysis.recommended, 1)} months (${analysis.basis})` : 'n/a'],
    ]
    infoRows.forEach(([label, val]) => {
      pdf.text(label + ':', margin, y)
      pdf.text(val, margin + 160, y)
      y += 16
    })
    y += 8

    if (analysis.poolability) {
      pdf.setFont('helvetica', 'bold'); pdf.text('Poolability test:', margin, y); y += 16
      pdf.setFont('helvetica', 'normal')
      pdf.text(`Equal slopes: p = ${fmt(analysis.poolability.slopesP, 4)} (${analysis.poolability.slopesPoolable ? 'poolable' : 'not poolable'})`, margin, y); y += 14
      pdf.text(`Equal intercepts: p = ${fmt(analysis.poolability.interceptsP, 4)} (${analysis.poolability.interceptsPoolable ? 'poolable' : 'not poolable'})`, margin, y); y += 20
    }

    pdf.setFont('helvetica', 'bold'); pdf.text('Per-batch results:', margin, y); y += 16
    pdf.setFont('helvetica', 'normal')
    analysis.individual.forEach((r) => {
      const line = `${r.batch.name}: slope=${r.reg ? fmt(r.reg.slope, 4) : '—'}  R²=${r.reg ? fmt(r.reg.r2, 3) : '—'}  shelf life=${r.shelfLife !== null ? fmt(r.shelfLife, 1) + ' mo' : 'not reached'}${r.extrapolated ? ' (extrapolated)' : ''}`
      pdf.text(line, margin, y); y += 14
    })
    y += 10

    if (chart) {
      const imgData = chart.toBase64Image('image/png', 1)
      const imgWidth = pageWidth - margin * 2
      const imgHeight = (chart.height / chart.width) * imgWidth
      pdf.addImage(imgData, 'PNG', margin, y, imgWidth, imgHeight)
    }
    pdf.save('stability-study-report.pdf')
  }

  return (
    <div style={s.page}>
      <nav className="qh-nav" style={s.nav}>
        <div className="qh-nav-left" style={s.navLeft}>
          <Link href="/" style={s.logo}>
            <div style={s.logoIcon}>σ</div>
            QualityTools
          </Link>
          <span className="qh-breadcrumb-sep" style={s.separator}>/</span>
          <span className="qh-breadcrumb" style={s.breadcrumb}>Stability Study</span>
        </div>
        <div className="qh-nav-right" style={s.navRight}>
          <button style={s.themeBtn} onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}>
            {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </button>
          <AuthStatus />
          <Link href="/pricing" style={s.ctaBtn}>Get Pro →</Link>
        </div>
      </nav>

      {!subLoading && !isPro ? (
        <LockedPage
          theme={theme}
          feature="Stability Study"
          description="Shelf-life / stability trend analysis is part of the Pro toolkit."
          bullets={[
            'Regression-based trend analysis',
            'Confidence intervals & shelf-life estimate',
            'Spec-limit crossing detection',
            'Excel / PDF export, no watermark',
          ]}
        />
      ) : (
      <div className="qh-body" style={s.body}>
        {/* ── LEFT: Setup + Data Entry ─────────────────────────────────── */}
        <div style={{ ...s.left, width: 460 }}>
          <div>
            <div style={s.sectionTitle}>Study Setup</div>
            <div className="qh-input-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8, marginBottom: 12 }}>
              <div>
                <div style={s.label}>Attribute</div>
                <input style={s.input} value={attributeName} onChange={(e) => setAttributeName(e.target.value)} />
              </div>
              <div>
                <div style={s.label}>Unit</div>
                <input style={s.input} value={unit} onChange={(e) => setUnit(e.target.value)} />
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={s.label}>Storage condition</div>
              <select style={s.select} value={storageCondition} onChange={(e) => setStorageCondition(e.target.value)}>
                {STORAGE_CONDITIONS.map((sc) => (
                  <option key={sc.key} value={sc.key}>{sc.label}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
              <div>
                <div style={s.label}>Trend direction</div>
                <select style={s.select} value={direction} onChange={(e) => setDirection(e.target.value as TrendDirection)}>
                  <option value="decreasing">Decreasing (Assay, Potency)</option>
                  <option value="increasing">Increasing (Impurity, Degradant)</option>
                </select>
              </div>
              <div>
                <div style={s.label}>Confidence</div>
                <select style={s.select} value={confidence} onChange={(e) => setConfidence(Number(e.target.value) as 90 | 95 | 99)}>
                  <option value={90}>90%</option>
                  <option value={95}>95% (ICH default)</option>
                  <option value={99}>99%</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
              <div>
                <div style={s.label}>Lower spec limit</div>
                <input style={s.input} type="number" value={specLower} onChange={(e) => setSpecLower(e.target.value)} placeholder="e.g. 95.0" />
              </div>
              <div>
                <div style={s.label}>Upper spec limit</div>
                <input style={s.input} type="number" value={specUpper} onChange={(e) => setSpecUpper(e.target.value)} placeholder="optional" />
              </div>
            </div>
            <div style={{ fontSize: 11, color: c.muted, marginBottom: 16 }}>
              💡 The limit used for shelf-life estimation is the one matching the trend direction above (lower limit for a decreasing trend, upper limit for an increasing one).
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <button style={{ ...s.exportBtn, flex: 1 }} onClick={loadSample}>↺ Load Sample</button>
              <button style={{ ...s.exportBtn, flex: 1, color: c.danger }} onClick={clearAll}>🗑 Clear</button>
            </div>
          </div>

          <div>
            <div style={s.sectionTitle}>Batches</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {batchNames.map((name, bIdx) => (
                <div key={bIdx} style={{ display: 'flex', alignItems: 'center', gap: 4, background: c.surface2, border: `1px solid ${c.border}`, borderRadius: 8, padding: '4px 6px' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: BATCH_COLORS[bIdx % BATCH_COLORS.length], flexShrink: 0 }} />
                  <input
                    style={{ ...s.input, width: 90, padding: '3px 6px', border: 'none', background: 'transparent' }}
                    value={name}
                    onChange={(e) => updateBatchName(bIdx, e.target.value)}
                  />
                  <button style={s.removeBtn} onClick={() => removeBatch(bIdx)}>✕</button>
                </div>
              ))}
            </div>
            <button style={s.addBtn} onClick={addBatch}>+ Add Batch</button>
          </div>

          <div>
            <div style={s.sectionTitle}>Stability Data</div>
            <div style={{ overflowX: 'auto' }}>
              <div className="qh-table-wrap" style={{ overflowX: 'auto' }}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>Month</th>
                    {batchNames.map((name, bIdx) => (
                      <th key={bIdx} style={s.th}>{name}</th>
                    ))}
                    <th style={s.th}></th>
                  </tr>
                </thead>
                <tbody>
                  {timePoints.map((t, tIdx) => (
                    <tr key={tIdx}>
                      <td style={s.td}>
                        <input
                          style={{ ...s.input, width: 60 }}
                          type="number"
                          value={t}
                          onChange={(e) => updateTimePoint(tIdx, e.target.value)}
                        />
                      </td>
                      {batchNames.map((_, bIdx) => (
                        <td key={bIdx} style={s.td}>
                          <input
                            style={{ ...s.input, width: 70 }}
                            type="number"
                            value={values[tIdx]?.[bIdx] ?? ''}
                            onChange={(e) => updateValue(tIdx, bIdx, e.target.value)}
                          />
                        </td>
                      ))}
                      <td style={s.td}>
                        <button style={s.removeBtn} onClick={() => removeTimePoint(tIdx)}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
            <button style={{ ...s.addBtn, marginTop: 8 }} onClick={addTimePoint}>+ Add Time Point</button>
          </div>
        </div>

        {/* ── RIGHT: Results ────────────────────────────────────────────── */}
        <div className="qh-main" style={s.main}>
          <div className="qh-stats-row" style={s.statsRow}>
            <div style={s.statCard}>
              <div style={{ ...s.statVal, color: analysis.recommended !== null ? c.accent : c.muted }}>
                {analysis.recommended !== null ? `${fmt(analysis.recommended, 1)} mo` : '—'}
              </div>
              <div style={s.statLabel}>Recommended Shelf Life</div>
            </div>
            <div style={s.statCard}>
              <div style={s.statVal}>{analysis.batches.length}</div>
              <div style={s.statLabel}>Batches Analyzed</div>
            </div>
            <div style={s.statCard}>
              <div style={s.statVal}>{confidence}%</div>
              <div style={s.statLabel}>Confidence Level</div>
            </div>
            <div style={s.statCard}>
              <div style={{ ...s.statVal, fontSize: 15 }}>
                {analysis.basis === 'pooled' ? '✅ Pooled' : analysis.basis === 'individual-min' ? '⚠️ Worst batch' : '—'}
              </div>
              <div style={s.statLabel}>Basis</div>
            </div>
          </div>

          {analysis.recommended !== null && analysis.individual.some((r) => r.extrapolated && r.shelfLife === analysis.recommended) && (
            <div style={{ ...s.card, borderColor: c.amber, color: c.amber, fontSize: 12 }}>
              ⚠️ The recommended shelf life extrapolates beyond the last observed time point. Per ICH Q1E, extrapolation should generally not exceed the amount of long-term data available (typically up to 2× or +12 months).
            </div>
          )}
          {!analysis.hasSpec && (
            <div style={{ ...s.card, borderColor: c.amber, color: c.amber, fontSize: 12 }}>
              ⚠️ Enter a specification limit matching the trend direction to calculate a shelf life.
            </div>
          )}

          <div className="qh-chart-wrap" style={s.chartWrap}>
            <div style={s.sectionTitle}>Regression Plot</div>
            <div className="qh-chart-inner" style={s.chartInner}>
              <Chart
                ref={chartRef}
                type="line"
                data={chartData}
                options={chartOptions}
              />
            </div>
          </div>

          <div style={s.card}>
            <div style={s.sectionTitle}>Per-Batch Regression</div>
            <div className="qh-table-wrap" style={{ overflowX: 'auto' }}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Batch</th>
                  <th style={s.th}>Slope</th>
                  <th style={s.th}>Intercept</th>
                  <th style={s.th}>R²</th>
                  <th style={s.th}>Shelf Life</th>
                </tr>
              </thead>
              <tbody>
                {analysis.individual.map((r, i) => (
                  <tr key={i}>
                    <td style={s.td}>{r.batch.name}</td>
                    <td style={s.td}>{r.reg ? fmt(r.reg.slope, 4) : '—'}</td>
                    <td style={s.td}>{r.reg ? fmt(r.reg.intercept, 3) : '—'}</td>
                    <td style={s.td}>{r.reg ? fmt(r.reg.r2, 4) : '—'}</td>
                    <td style={s.td}>
                      {r.shelfLife !== null ? `${fmt(r.shelfLife, 1)} mo${r.extrapolated ? ' *' : ''}` : 'not reached'}
                    </td>
                  </tr>
                ))}
                {analysis.pooledReg && (
                  <tr style={{ fontWeight: 700 }}>
                    <td style={s.td}>Pooled (all batches)</td>
                    <td style={s.td}>{fmt(analysis.pooledReg.slope, 4)}</td>
                    <td style={s.td}>{fmt(analysis.pooledReg.intercept, 3)}</td>
                    <td style={s.td}>{fmt(analysis.pooledReg.r2, 4)}</td>
                    <td style={s.td}>
                      {analysis.pooledShelfLifeRaw.shelfLifeMonths !== null
                        ? `${fmt(analysis.pooledShelfLifeRaw.shelfLifeMonths, 1)} mo${analysis.pooledShelfLifeRaw.extrapolated ? ' *' : ''}`
                        : 'not reached'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
            <div style={{ fontSize: 10, color: c.muted, marginTop: 6 }}>* extrapolated beyond last observed time point</div>
          </div>

          {analysis.poolability && (
            <div style={s.card}>
              <div style={s.sectionTitle}>Poolability Test (ANCOVA, α = 0.25)</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={s.rowCard}>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>Equal slopes</div>
                  <div style={{ fontSize: 12, color: c.muted }}>F({analysis.poolability.slopesDf1}, {analysis.poolability.slopesDf2}) = {fmt(analysis.poolability.slopesF, 3)}, p = {fmt(analysis.poolability.slopesP, 4)}</div>
                  <span style={{ ...s.badge, background: analysis.poolability.slopesPoolable ? 'rgba(74,222,128,0.15)' : 'rgba(239,68,68,0.15)', color: analysis.poolability.slopesPoolable ? '#4ade80' : c.danger, width: 'fit-content' }}>
                    {analysis.poolability.slopesPoolable ? 'Poolable' : 'Not poolable'}
                  </span>
                </div>
                <div style={s.rowCard}>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>Equal intercepts</div>
                  <div style={{ fontSize: 12, color: c.muted }}>F({analysis.poolability.interceptsDf1}, {analysis.poolability.interceptsDf2}) = {fmt(analysis.poolability.interceptsF, 3)}, p = {fmt(analysis.poolability.interceptsP, 4)}</div>
                  <span style={{ ...s.badge, background: analysis.poolability.interceptsPoolable ? 'rgba(74,222,128,0.15)' : 'rgba(239,68,68,0.15)', color: analysis.poolability.interceptsPoolable ? '#4ade80' : c.danger, width: 'fit-content' }}>
                    {analysis.poolability.interceptsPoolable ? 'Poolable' : 'Not poolable'}
                  </span>
                </div>
              </div>
              <div style={{ fontSize: 11, color: c.muted, marginTop: 10 }}>
                {analysis.poolability.fullyPoolable
                  ? 'Batches may be pooled into a single regression — the pooled shelf life above is used.'
                  : 'Batches show a significant difference in slope and/or intercept — the shortest individual-batch shelf life is used (conservative, per ICH Q1E).'}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <button style={s.exportBtn} onClick={exportCSV}>📄 CSV</button>
            <button style={s.exportBtn} onClick={exportExcel}>📊 Excel</button>
            <button style={s.exportBtn} onClick={exportPNG}>🖼️ PNG</button>
            <button style={s.exportBtn} onClick={exportPDF}>📑 PDF</button>
            <SaveAnalysisButton
              theme={theme}
              tool="stability"
              defaultName={`Stability — ${new Date().toLocaleDateString('en-US')}`}
              getPayload={() => ({
                input_data: { storageCondition, direction, confidence, timePoints, batchNames, values, specLower, specUpper },
                results: analysis,
              })}
            />
          </div>
        </div>
      </div>
      )}
    </div>
  )
}
