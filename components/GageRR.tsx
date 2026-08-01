'use client'

import { useState, useRef, useMemo } from 'react'
import Link from 'next/link'
import 'chart.js/auto'
import { Chart } from 'react-chartjs-2'
import type { Chart as ChartJSInstance } from 'chart.js'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import { COLORS, getSharedStyles, usePersistedTheme } from '@/lib/theme'
import AuthStatus from '@/components/AuthStatus'

// ── Types — mirror the shape returned by app/api/gage-rr/route.ts ──────────
interface GageResult {
  appraiserNames: string[]
  numAppraisers: number
  numTrials: number
  numParts: number
  avg: number[][]
  rng: number[][]
  rBarByAppraiser: number[]
  rBar: number
  uclR: number
  outOfControlRanges: { appraiser: string; part: number; range: number }[]
  EV: number
  xbarByAppraiser: number[]
  xbarDiff: number
  AV: number
  GRR: number
  partAvg: number[]
  rP: number
  PV: number
  TV: number
  pctOfTV: { EV: number; AV: number; GRR: number; PV: number }
  pctOfTolerance: { EV: number; AV: number; GRR: number; PV: number } | null
  tolerance: number | null
  ndcRaw: number
  ndc: number
  conclusion: 'okay' | 'marginal' | 'unacceptable'
  conclusionText: string
  constants: { D4: number; K1: number; K2: number; K3: number }
}

// Sample dataset (cross-checked against a verified AIAG Gage R&R workbook)
// so the tool is usable out of the box and its output is independently verifiable.
const SAMPLE: number[][][] = [
  [ // Appraiser A
    [70.8, 70.9, 70.8], [71.4, 71.5, 71.5], [71.3, 71.2, 71.3], [70.8, 70.7, 70.8],
    [71.1, 71.2, 71.3], [71.2, 71.2, 71.3], [71.3, 71.2, 71.3], [71.2, 71.2, 71.1],
    [70.8, 70.7, 70.7], [71.4, 71.4, 71.3],
  ],
  [ // Appraiser B
    [70.8, 70.9, 70.9], [71.4, 71.4, 71.5], [71.3, 71.3, 71.2], [70.7, 70.7, 70.7],
    [71.3, 71.2, 71.2], [71.3, 71.3, 71.2], [71.3, 71.3, 71.2], [71.1, 71.2, 71.1],
    [70.7, 70.7, 70.7], [71.3, 71.3, 71.4],
  ],
  [ // Appraiser C
    [70.8, 70.8, 70.8], [71.4, 71.4, 71.4], [71.2, 71.2, 71.3], [70.8, 70.7, 70.8],
    [71.2, 71.2, 71.3], [71.2, 71.2, 71.3], [71.3, 71.3, 71.3], [71.2, 71.2, 71.1],
    [70.7, 70.7, 70.7], [71.3, 71.3, 71.4],
  ],
]

function resizeMeasurements(
  current: (number | null)[][][],
  numAppraisers: number,
  numParts: number,
  numTrials: number
): (number | null)[][][] {
  const next: (number | null)[][][] = []
  for (let a = 0; a < numAppraisers; a++) {
    next.push([])
    for (let p = 0; p < numParts; p++) {
      const trials: (number | null)[] = []
      for (let t = 0; t < numTrials; t++) {
        trials.push(current?.[a]?.[p]?.[t] ?? null)
      }
      next[a].push(trials)
    }
  }
  return next
}

function fmt(n: number | null | undefined, digits = 4) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return n.toFixed(digits)
}
function pct(n: number | null | undefined, digits = 1) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return (n * 100).toFixed(digits) + '%'
}

export default function GageRR() {
  const [theme, setTheme] = usePersistedTheme()
  const c = COLORS[theme]
  const s = getSharedStyles(theme)

  const [numAppraisers, setNumAppraisers] = useState<2 | 3>(3)
  const [numTrials, setNumTrials] = useState<2 | 3>(3)
  const [numParts, setNumParts] = useState(10)
  const [appraiserNames, setAppraiserNames] = useState<string[]>(['Appraiser A', 'Appraiser B', 'Appraiser C'])
  const [measurements, setMeasurements] = useState<(number | null)[][][]>(SAMPLE)
  const [USL, setUSL] = useState('72')
  const [LSL, setLSL] = useState('70')

  const [result, setResult] = useState<GageResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const contribChartRef = useRef<ChartJSInstance<'bar'>>(null)
  const rangeChartRef = useRef<ChartJSInstance<'line' | 'bar'>>(null)
  const xbarChartRef = useRef<ChartJSInstance<'line'>>(null)

  const applyDims = (a: number, t: number, p: number) => {
    setMeasurements(prev => resizeMeasurements(prev, a, p, t))
    setAppraiserNames(prev => {
      const defaults = ['Appraiser A', 'Appraiser B', 'Appraiser C']
      const next = [...prev]
      while (next.length < a) next.push(defaults[next.length] || `Appraiser ${next.length + 1}`)
      return next.slice(0, a)
    })
  }

  const setNumAppraisersAndResize = (v: 2 | 3) => { setNumAppraisers(v); applyDims(v, numTrials, numParts) }
  const setNumTrialsAndResize = (v: 2 | 3) => { setNumTrials(v); applyDims(numAppraisers, v, numParts) }
  const setNumPartsAndResize = (v: number) => { setNumParts(v); applyDims(numAppraisers, numTrials, v) }

  const setCell = (a: number, p: number, t: number, val: string) => {
    const num = val === '' ? null : parseFloat(val)
    setMeasurements(prev => {
      const next = prev.map(rowA => rowA.map(rowP => [...rowP]))
      next[a][p][t] = num === null || Number.isNaN(num) ? null : num
      return next
    })
  }

  // Parse a pasted block from Excel/Sheets: rows separated by newlines, cells by tab
  // (falls back to comma if no tabs are present, e.g. CSV paste).
  const parsePasteGrid = (text: string): (number | null)[][] => {
    const rows = text.replace(/\r/g, '').split('\n').filter(r => r.trim() !== '')
    return rows.map(row => {
      const cells = row.includes('\t') ? row.split('\t') : row.split(',')
      return cells.map(cell => {
        const n = parseFloat(cell.trim())
        return Number.isNaN(n) ? null : n
      })
    })
  }

  // Fill one appraiser's block starting at the pasted cell.
  // Pasted rows map to trials, pasted columns map to parts — same layout as the Excel sheet.
  const handlePaste = (a: number, startP: number, startT: number, e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text')
    if (!text || (!text.includes('\t') && !text.includes('\n') && !text.includes(','))) return // single value — let the default paste happen
    e.preventDefault()
    const grid = parsePasteGrid(text)
    setMeasurements(prev => {
      const next = prev.map(rowA => rowA.map(rowP => [...rowP]))
      grid.forEach((row, i) => {
        const t = startT + i
        if (t >= numTrials) return
        row.forEach((val, j) => {
          const p = startP + j
          if (p >= numParts) return
          next[a][p][t] = val
        })
      })
      return next
    })
  }

  const loadSample = () => {
    setNumAppraisers(3); setNumTrials(3); setNumParts(10)
    setAppraiserNames(['Appraiser A', 'Appraiser B', 'Appraiser C'])
    setMeasurements(SAMPLE)
    setUSL('72'); setLSL('70')
  }

  const clearAll = () => {
    if (!window.confirm('Clear all measurement data? This cannot be undone.')) return
    setMeasurements(resizeMeasurements([], numAppraisers, numParts, numTrials))
    setResult(null)
  }

  const runAnalysis = async () => {
    setErrorMsg('')
    setLoading(true)
    setResult(null)
    try {
      const body = {
        appraiserNames,
        numTrials,
        numParts,
        measurements,
        USL: USL !== '' ? parseFloat(USL) : null,
        LSL: LSL !== '' ? parseFloat(LSL) : null,
      }
      const res = await fetch('/api/gage-rr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) {
        setErrorMsg(json.error || 'Calculation failed.')
      } else {
        setResult(json)
      }
    } catch {
      setErrorMsg('Could not reach the analysis engine. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // ── Chart data ─────────────────────────────────────────────────────────
  const contribChartData = useMemo(() => {
    if (!result) return null
    return {
      labels: ['EV\n(Repeatability)', 'AV\n(Reproducibility)', 'GRR', 'PV\n(Part Variation)'],
      datasets: [{
        label: '% of Total Variation',
        data: [result.pctOfTV.EV, result.pctOfTV.AV, result.pctOfTV.GRR, result.pctOfTV.PV].map(v => +(v * 100).toFixed(2)),
        backgroundColor: [c.bar, c.line, c.danger, c.accent2],
        borderRadius: 6,
      }],
    }
  }, [result, c])

  const rangeChartData = useMemo(() => {
    if (!result) return null
    const labels: string[] = []
    const data: number[] = []
    for (let a = 0; a < result.numAppraisers; a++) {
      for (let p = 0; p < result.numParts; p++) {
        labels.push(`${result.appraiserNames[a]}-P${p + 1}`)
        data.push(result.rng[a][p])
      }
    }
    return {
      labels,
      datasets: [
        {
          type: 'line' as const,
          label: 'Range',
          data,
          borderColor: c.bar,
          backgroundColor: c.bar,
          pointRadius: 2,
          tension: 0,
        },
        {
          type: 'line' as const,
          label: 'UCL',
          data: labels.map(() => result.uclR),
          borderColor: c.danger,
          borderDash: [6, 4],
          pointRadius: 0,
        },
      ],
    }
  }, [result, c])

  const xbarChartData = useMemo(() => {
    if (!result) return null
    const labels = Array.from({ length: result.numParts }, (_, i) => `Part ${i + 1}`)
    const palette = [c.bar, c.line, c.danger]
    return {
      labels,
      datasets: result.appraiserNames.map((name, a) => ({
        label: name,
        data: result.avg[a],
        borderColor: palette[a % palette.length],
        backgroundColor: palette[a % palette.length],
        pointRadius: 3,
        tension: 0.2,
        fill: false,
      })),
    }
  }, [result, c])

  const chartOpts = (yLabel: string) => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: c.text, font: { size: 11 } } } },
    scales: {
      x: { ticks: { color: c.muted, font: { size: 9 } }, grid: { color: c.grid } },
      y: { title: { display: true, text: yLabel, color: c.muted }, ticks: { color: c.muted }, grid: { color: c.grid } },
    },
  })

  // ── Export: CSV ────────────────────────────────────────────────────────
  const exportCSV = () => {
    if (!result) return
    const lines: string[] = []
    lines.push('Gage R&R Study — Raw Data')
    lines.push('Appraiser,Part,Trial,Value')
    for (let a = 0; a < numAppraisers; a++) {
      for (let p = 0; p < numParts; p++) {
        for (let t = 0; t < numTrials; t++) {
          lines.push(`"${appraiserNames[a]}",${p + 1},${t + 1},${measurements[a][p][t] ?? ''}`)
        }
      }
    }
    lines.push('')
    lines.push('Metric,Value,% of Total Variation' + (result.pctOfTolerance ? ',% of Tolerance' : ''))
    const rows: [string, number, number, number | null][] = [
      ['EV (Repeatability)', result.EV, result.pctOfTV.EV, result.pctOfTolerance?.EV ?? null],
      ['AV (Reproducibility)', result.AV, result.pctOfTV.AV, result.pctOfTolerance?.AV ?? null],
      ['GRR', result.GRR, result.pctOfTV.GRR, result.pctOfTolerance?.GRR ?? null],
      ['PV (Part Variation)', result.PV, result.pctOfTV.PV, result.pctOfTolerance?.PV ?? null],
      ['TV (Total Variation)', result.TV, 1, null],
    ]
    rows.forEach(([label, val, tv, tol]) => {
      lines.push(`"${label}",${val.toFixed(5)},${(tv * 100).toFixed(2)}%` + (result.pctOfTolerance ? `,${tol !== null ? (tol * 100).toFixed(2) + '%' : ''}` : ''))
    })
    lines.push('')
    lines.push(`NDC (Number of Distinct Categories),${result.ndc}`)
    lines.push(`Conclusion,"${result.conclusionText}"`)
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'gage-rr-data.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  // ── Export: Excel ──────────────────────────────────────────────────────
  const exportExcel = () => {
    if (!result) return
    const wb = XLSX.utils.book_new()
    const rawRows: Record<string, string | number>[] = []
    for (let a = 0; a < numAppraisers; a++) {
      for (let p = 0; p < numParts; p++) {
        for (let t = 0; t < numTrials; t++) {
          rawRows.push({ Appraiser: appraiserNames[a], Part: p + 1, Trial: t + 1, Value: measurements[a][p][t] ?? '' })
        }
      }
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rawRows), 'Raw Data')

    const summaryRows = [
      { Metric: 'EV (Repeatability)', Value: result.EV, '% of Total Variation': result.pctOfTV.EV, '% of Tolerance': result.pctOfTolerance?.EV ?? '' },
      { Metric: 'AV (Reproducibility)', Value: result.AV, '% of Total Variation': result.pctOfTV.AV, '% of Tolerance': result.pctOfTolerance?.AV ?? '' },
      { Metric: 'GRR', Value: result.GRR, '% of Total Variation': result.pctOfTV.GRR, '% of Tolerance': result.pctOfTolerance?.GRR ?? '' },
      { Metric: 'PV (Part Variation)', Value: result.PV, '% of Total Variation': result.pctOfTV.PV, '% of Tolerance': result.pctOfTolerance?.PV ?? '' },
      { Metric: 'TV (Total Variation)', Value: result.TV, '% of Total Variation': 1, '% of Tolerance': '' },
      { Metric: 'NDC', Value: result.ndc, '% of Total Variation': '', '% of Tolerance': '' },
      { Metric: 'Conclusion', Value: result.conclusionText, '% of Total Variation': '', '% of Tolerance': '' },
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'Summary')
    XLSX.writeFile(wb, 'gage-rr-results.xlsx')
  }

  // ── Export: PNG (contribution chart) ─────────────────────────────────
  const exportPNG = () => {
    const chart = contribChartRef.current
    if (!chart) return
    const url = chart.toBase64Image('image/png', 1)
    const a = document.createElement('a')
    a.href = url; a.download = 'gage-rr-contribution.png'; a.click()
  }

  // ── Export: PDF ─────────────────────────────────────────────────────
  const exportPDF = () => {
    if (!result) return
    const chart = contribChartRef.current
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const margin = 40
    let y = margin

    pdf.setFontSize(18); pdf.setFont('helvetica', 'bold')
    pdf.text('Gage R&R Study Report', margin, y); y += 20
    pdf.setFontSize(10); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(100)
    pdf.text(`Generated: ${new Date().toLocaleDateString()}`, margin, y); y += 24

    pdf.setFontSize(11); pdf.setTextColor(0); pdf.setFont('helvetica', 'bold')
    pdf.text(`Appraisers: ${result.numAppraisers}   Trials: ${result.numTrials}   Parts: ${result.numParts}`, margin, y)
    y += 20

    const rows: [string, string][] = [
      ['EV (Repeatability)', `${fmt(result.EV)}  (${pct(result.pctOfTV.EV)} of TV${result.pctOfTolerance ? `, ${pct(result.pctOfTolerance.EV)} of Tol.` : ''})`],
      ['AV (Reproducibility)', `${fmt(result.AV)}  (${pct(result.pctOfTV.AV)} of TV${result.pctOfTolerance ? `, ${pct(result.pctOfTolerance.AV)} of Tol.` : ''})`],
      ['Gage R&R', `${fmt(result.GRR)}  (${pct(result.pctOfTV.GRR)} of TV${result.pctOfTolerance ? `, ${pct(result.pctOfTolerance.GRR)} of Tol.` : ''})`],
      ['Part Variation', `${fmt(result.PV)}  (${pct(result.pctOfTV.PV)} of TV${result.pctOfTolerance ? `, ${pct(result.pctOfTolerance.PV)} of Tol.` : ''})`],
      ['Total Variation', fmt(result.TV)],
      ['NDC', String(result.ndc)],
    ]
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10)
    rows.forEach(([label, val]) => {
      pdf.text(label + ':', margin, y)
      pdf.text(val, margin + 160, y)
      y += 16
    })
    y += 10
    pdf.setFont('helvetica', 'bold')
    pdf.text('Conclusion:', margin, y); y += 14
    pdf.setFont('helvetica', 'normal')
    const wrapped = pdf.splitTextToSize(result.conclusionText, pageWidth - margin * 2)
    pdf.text(wrapped, margin, y)
    y += wrapped.length * 14 + 14

    if (chart) {
      const imgData = chart.toBase64Image('image/png', 1)
      const imgWidth = pageWidth - margin * 2
      const imgHeight = (chart.height / chart.width) * imgWidth
      pdf.addImage(imgData, 'PNG', margin, y, imgWidth, imgHeight)
    }
    pdf.save('gage-rr-report.pdf')
  }

  const conclusionStyle = !result ? null : result.conclusion === 'okay'
    ? { icon: '✅', color: '#4ade80', bg: 'rgba(74,222,128,0.1)' }
    : result.conclusion === 'marginal'
    ? { icon: '⚠️', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' }
    : { icon: '❌', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' }

  return (
    <div style={s.page}>
      <nav style={s.nav}>
        <div style={s.navLeft}>
          <Link href="/" style={s.logo}>
            <div style={s.logoIcon}>σ</div>
            QualityTools
          </Link>
          <span style={s.separator}>/</span>
          <span style={s.breadcrumb}>Gage R&R</span>
        </div>
        <div style={s.navRight}>
          <button style={s.themeBtn} onClick={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}>
            {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </button>
          <AuthStatus />
          <Link href="/pricing" style={s.ctaBtn}>Get Pro →</Link>
        </div>
      </nav>

      <div style={s.body}>
        {/* ── LEFT: Configuration + Data Entry ─────────────────────────── */}
        <div style={{ ...s.left, width: 460 }}>
          <div>
            <div style={s.sectionTitle}>Study Setup</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
              <div>
                <div style={s.label}>Appraisers</div>
                <select style={s.select} value={numAppraisers} onChange={e => setNumAppraisersAndResize(Number(e.target.value) as 2 | 3)}>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                </select>
              </div>
              <div>
                <div style={s.label}>Trials</div>
                <select style={s.select} value={numTrials} onChange={e => setNumTrialsAndResize(Number(e.target.value) as 2 | 3)}>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                </select>
              </div>
              <div>
                <div style={s.label}>Parts</div>
                <select style={s.select} value={numParts} onChange={e => setNumPartsAndResize(Number(e.target.value))}>
                  {Array.from({ length: 9 }, (_, i) => i + 2).map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${numAppraisers}, 1fr)`, gap: 8, marginBottom: 12 }}>
              {Array.from({ length: numAppraisers }, (_, a) => (
                <div key={a}>
                  <div style={s.label}>Appraiser {a + 1} Name</div>
                  <input
                    style={s.input}
                    value={appraiserNames[a] || ''}
                    onChange={e => setAppraiserNames(prev => { const n = [...prev]; n[a] = e.target.value; return n })}
                  />
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
              <div>
                <div style={s.label}>LSL (optional)</div>
                <input style={s.input} type="number" value={LSL} onChange={e => setLSL(e.target.value)} />
              </div>
              <div>
                <div style={s.label}>USL (optional)</div>
                <input style={s.input} type="number" value={USL} onChange={e => setUSL(e.target.value)} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button style={{ ...s.exportBtn, flex: 1 }} onClick={loadSample}>↺ Load Sample</button>
              <button style={{ ...s.exportBtn, flex: 1, color: c.danger }} onClick={clearAll}>🗑 Clear</button>
            </div>
          </div>

          <div>
            <div style={s.sectionTitle}>Measurement Data</div>
            <div style={{ fontSize: 11, color: c.muted, marginBottom: 8 }}>
              💡 Tip: click a cell (e.g. Trial 1 / P1) then paste (Ctrl+V) a block copied from Excel for that appraiser — it fills forward automatically.
            </div>
            <div style={{ overflowX: 'auto' }}>
              {Array.from({ length: numAppraisers }, (_, a) => (
                <div key={a} style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: c.accent, marginBottom: 6 }}>{appraiserNames[a] || `Appraiser ${a + 1}`}</div>
                  <table style={{ ...s.table, fontSize: 11 }}>
                    <thead>
                      <tr>
                        <th style={{ ...s.th, padding: '4px 6px' }}></th>
                        {Array.from({ length: numParts }, (_, p) => (
                          <th key={p} style={{ ...s.th, padding: '4px 6px', textAlign: 'center' }}>P{p + 1}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: numTrials }, (_, t) => (
                        <tr key={t}>
                          <td style={{ ...s.td, padding: '4px 6px', color: c.muted, whiteSpace: 'nowrap' }}>Trial {t + 1}</td>
                          {Array.from({ length: numParts }, (_, p) => (
                            <td key={p} style={{ ...s.td, padding: '2px 3px' }}>
                              <input
                                style={{ ...s.input, padding: '4px 5px', fontSize: 11, width: 52, textAlign: 'center' }}
                                type="number"
                                step="any"
                                value={measurements[a]?.[p]?.[t] ?? ''}
                                onChange={e => setCell(a, p, t, e.target.value)}
                                onPaste={e => handlePaste(a, p, t, e)}
                                title="Click here, then paste an Excel block (rows = trials, columns = parts) starting from this cell"
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </div>

          <button style={s.addBtn} onClick={runAnalysis} disabled={loading}>
            {loading ? 'Calculating…' : '▶ Run Gage R&R Analysis'}
          </button>
          {errorMsg && (
            <div style={{ color: c.danger, fontSize: 12, marginTop: 8 }}>{errorMsg}</div>
          )}
        </div>

        {/* ── RIGHT: Results ────────────────────────────────────────────── */}
        <div style={s.right}>
          {!result && !loading && (
            <div style={{ ...s.card, textAlign: 'center', color: c.muted, padding: 60 }}>
              Configure your study and click <strong>Run Gage R&amp;R Analysis</strong> to see results.
              <div style={{ marginTop: 8, fontSize: 12 }}>A verified sample dataset is preloaded — try it first.</div>
            </div>
          )}

          {result && (
            <>
              {/* Export bar */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={s.exportBtn} onClick={exportCSV}>📄 CSV</button>
                <button style={s.exportBtn} onClick={exportExcel}>📊 Excel</button>
                <button style={s.exportBtn} onClick={exportPNG}>🖼️ PNG</button>
                <button style={s.exportBtn} onClick={exportPDF}>📑 PDF</button>
              </div>

              {/* Summary stat cards */}
              <div style={s.statsRow}>
                <div style={s.statCard}>
                  <div style={s.statVal}>{fmt(result.EV, 4)}</div>
                  <div style={s.statLabel}>EV — Repeatability</div>
                </div>
                <div style={s.statCard}>
                  <div style={s.statVal}>{fmt(result.AV, 4)}</div>
                  <div style={s.statLabel}>AV — Reproducibility</div>
                </div>
                <div style={s.statCard}>
                  <div style={s.statVal}>{fmt(result.GRR, 4)}</div>
                  <div style={s.statLabel}>Gage R&R</div>
                </div>
                <div style={s.statCard}>
                  <div style={s.statVal}>{fmt(result.PV, 4)}</div>
                  <div style={s.statLabel}>PV — Part Variation</div>
                </div>
                <div style={s.statCard}>
                  <div style={s.statVal}>{fmt(result.TV, 4)}</div>
                  <div style={s.statLabel}>TV — Total Variation</div>
                </div>
                <div style={s.statCard}>
                  <div style={s.statVal}>{result.ndc}</div>
                  <div style={s.statLabel}>NDC (ndc ≥ 5 preferred)</div>
                </div>
              </div>

              {/* Conclusion banner */}
              {conclusionStyle && (
                <div style={{ ...s.card, background: conclusionStyle.bg, border: `1px solid ${conclusionStyle.color}40`, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 22 }}>{conclusionStyle.icon}</span>
                  <div>
                    <div style={{ fontWeight: 700, color: conclusionStyle.color }}>
                      %GRR {result.pctOfTolerance ? 'of Tolerance' : 'of Total Variation'}: {pct(result.pctOfTolerance ? result.pctOfTolerance.GRR : result.pctOfTV.GRR)}
                    </div>
                    <div style={{ fontSize: 13, color: c.text, marginTop: 2 }}>{result.conclusionText}</div>
                  </div>
                </div>
              )}

              {/* % Contribution table */}
              <div style={s.card}>
                <div style={s.sectionTitle}>Variation Contribution</div>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>Source</th>
                      <th style={s.th}>Value</th>
                      <th style={s.th}>% of Total Variation</th>
                      {result.pctOfTolerance && <th style={s.th}>% of Tolerance</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['EV (Repeatability)', result.EV, result.pctOfTV.EV, result.pctOfTolerance?.EV],
                      ['AV (Reproducibility)', result.AV, result.pctOfTV.AV, result.pctOfTolerance?.AV],
                      ['Gage R&R', result.GRR, result.pctOfTV.GRR, result.pctOfTolerance?.GRR],
                      ['PV (Part Variation)', result.PV, result.pctOfTV.PV, result.pctOfTolerance?.PV],
                      ['TV (Total Variation)', result.TV, 1, null],
                    ].map((row, i) => (
                      <tr key={i}>
                        <td style={s.td}>{row[0] as string}</td>
                        <td style={s.td}>{fmt(row[1] as number)}</td>
                        <td style={s.td}>{pct(row[2] as number)}</td>
                        {result.pctOfTolerance && <td style={s.td}>{row[3] != null ? pct(row[3] as number) : '—'}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ height: 220, marginTop: 16 }}>
                  {contribChartData && (
                    <Chart
                      ref={contribChartRef}
                      type="bar"
                      data={contribChartData}
                      options={{ ...chartOpts('% of Total Variation'), plugins: { legend: { display: false } } } as never}
                    />
                  )}
                </div>
              </div>

              {/* Range chart */}
              <div style={s.chartWrap}>
                <div style={s.sectionTitle}>Range Chart by Appraiser × Part (UCL = {fmt(result.uclR, 4)})</div>
                <div style={s.chartInner}>
                  {rangeChartData && (
                    <Chart ref={rangeChartRef} type="line" data={rangeChartData as never} options={chartOpts('Range') as never} />
                  )}
                </div>
                {result.outOfControlRanges.length > 0 && (
                  <div style={{ marginTop: 10, fontSize: 12, color: c.danger }}>
                    ⚠ {result.outOfControlRanges.length} range(s) beyond UCL — investigate appraiser consistency:{' '}
                    {result.outOfControlRanges.map(r => `${r.appraiser} / Part ${r.part}`).join(', ')}
                  </div>
                )}
              </div>

              {/* Xbar comparison chart */}
              <div style={s.chartWrap}>
                <div style={s.sectionTitle}>Average by Part — Appraiser Comparison</div>
                <div style={s.chartInner}>
                  {xbarChartData && (
                    <Chart ref={xbarChartRef} type="line" data={xbarChartData as never} options={chartOpts('Average Measurement') as never} />
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
