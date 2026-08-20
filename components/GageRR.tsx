'use client'

import { useState, useRef, useMemo, useEffect } from 'react'
import 'chart.js/auto'
import { Chart } from 'react-chartjs-2'
import type { Chart as ChartJSInstance } from 'chart.js'
import jsPDF from 'jspdf'
import { COLORS, getSharedStyles, usePersistedTheme } from '@/lib/theme'
import Nav from '@/components/Nav'
import SaveAnalysisButton from '@/components/SaveAnalysisButton'
import { LockedPage } from '@/components/Locked'
import { useSubscription } from '@/lib/useSubscription'
import { goToLogin, goToPricing } from '@/lib/exportGate'
import { useLanguage } from '@/lib/i18n/context'
import { createReport, nowStamp, type Tone } from '@/lib/excelReport'

// ── Types — mirror the shapes returned by app/api/gage-rr/route.ts ─────────
interface AvgRangeResult {
  method: 'average-range'
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

interface AnovaSource {
  source: string
  SS: number
  df: number
  MS: number
  F: number | null
  p: number | null
  significant: boolean | null
}

interface AnovaResult {
  method: 'anova'
  appraiserNames: string[]
  numAppraisers: number
  numTrials: number
  numParts: number
  avg: number[][]
  partAvg: number[]
  xbarByAppraiser: number[]
  grandMean: number
  anovaTable: AnovaSource[]
  unpooledInteraction?: AnovaSource
  pooled: boolean
  poolingAlpha: number
  errorDf: number
  EV: number
  AV: number
  GRR: number
  PV: number
  TV: number
  varComponents: { EV: number; AV: number; GRR: number; PV: number; TV: number }
  pctContribution: { EV: number; AV: number; GRR: number; PV: number }
  pctStudyVar: { EV: number; AV: number; GRR: number; PV: number }
  studyVar: { EV: number; AV: number; GRR: number; PV: number; TV: number }
  pctOfTolerance: { EV: number; AV: number; GRR: number; PV: number } | null
  tolerance: number | null
  ndcRaw: number
  ndc: number
  conclusion: 'okay' | 'marginal' | 'unacceptable'
  conclusionText: string
  significanceNote: string
}

type GageResult = AvgRangeResult | AnovaResult

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
// Std-dev-based "% of Total Variation" — pctOfTV for Average & Range, pctStudyVar for ANOVA.
// These are the equivalent quantity under each method, so callers can treat them uniformly.
function pctTV(r: GageResult) {
  return r.method === 'average-range' ? r.pctOfTV : r.pctStudyVar
}

export default function GageRR() {
  const [theme, setTheme] = usePersistedTheme()
  const { t, lang } = useLanguage()
  const c = COLORS[theme]
  const s = getSharedStyles(theme)
  const { isPro, isLoggedIn, loading: subLoading } = useSubscription()
  const [loadedProjectName, setLoadedProjectName] = useState('')

  const [numAppraisers, setNumAppraisers] = useState<2 | 3>(3)
  const [numTrials, setNumTrials] = useState<2 | 3>(3)
  const [numParts, setNumParts] = useState(10)
  const [appraiserNames, setAppraiserNames] = useState<string[]>(['Appraiser A', 'Appraiser B', 'Appraiser C'])
  const [measurements, setMeasurements] = useState<(number | null)[][][]>(SAMPLE)
  const [USL, setUSL] = useState('72')
  const [LSL, setLSL] = useState('70')
  const [method, setMethod] = useState<'average-range' | 'anova'>('average-range')

  const [result, setResult] = useState<GageResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // ── Load a saved project from the dashboard (?id=...) ──────────────────
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id')
    if (!id) return
    fetch(`/api/saved-analyses/${id}`)
      .then(res => (res.ok ? res.json() : Promise.reject()))
      .then(({ analysis }) => {
        const input = analysis.input_data as {
          numAppraisers: 2 | 3
          numTrials: 2 | 3
          numParts: number
          appraiserNames: string[]
          measurements: (number | null)[][][]
          USL: string
          LSL: string
          method: 'average-range' | 'anova'
        }
        setNumAppraisers(input.numAppraisers)
        setNumTrials(input.numTrials)
        setNumParts(input.numParts)
        setAppraiserNames(input.appraiserNames)
        setMeasurements(input.measurements)
        setUSL(input.USL)
        setLSL(input.LSL)
        setMethod(input.method)
        setResult(analysis.results as GageResult)
        setLoadedProjectName(analysis.name as string)
      })
      .catch(() =>
        setErrorMsg(lang === 'ar' ? 'تعذر تحميل المشروع المحفوظ.' : 'Could not load the saved project.')
      )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    if (!window.confirm(t('grr_confirm_clear'))) return
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
        method,
        poolingAlpha: 0.25,
      }
      const res = await fetch('/api/gage-rr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) {
        setErrorMsg(json.error || t('grr_err_calc_failed'))
      } else {
        setResult(json)
      }
    } catch {
      setErrorMsg(t('grr_err_network'))
    } finally {
      setLoading(false)
    }
  }

  // ── Chart data ─────────────────────────────────────────────────────────
  const contribChartData = useMemo(() => {
    if (!result) return null
    const p = pctTV(result)
    return {
      labels: [t('grr_chart_ev'), t('grr_chart_av'), t('grr_chart_grr'), t('grr_chart_pv')],
      datasets: [{
        label: t('grr_col_pcttotalvar'),
        data: [p.EV, p.AV, p.GRR, p.PV].map(v => +(v * 100).toFixed(2)),
        backgroundColor: [c.bar, c.line, c.danger, c.accent2],
        borderRadius: 6,
      }],
    }
  }, [result, c, t])

  const rangeChartData = useMemo(() => {
    if (!result || result.method !== 'average-range') return null
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
          label: t('grr_axis_range'),
          data,
          borderColor: c.bar,
          backgroundColor: c.bar,
          pointRadius: 2,
          tension: 0,
        },
        {
          type: 'line' as const,
          label: t('grr_chart_ucl'),
          data: labels.map(() => result.uclR),
          borderColor: c.danger,
          borderDash: [6, 4],
          pointRadius: 0,
        },
      ],
    }
  }, [result, c, t])

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
    if (!isLoggedIn) { goToLogin('gage-rr', 'csv'); return }
    if (!result) return
    const p = pctTV(result)
    const lines: string[] = []
    lines.push('Gage R&R Study — Raw Data')
    lines.push(`Method,${result.method === 'anova' ? 'ANOVA' : 'Average & Range'}`)
    lines.push('Appraiser,Part,Trial,Value')
    for (let a = 0; a < numAppraisers; a++) {
      for (let p2 = 0; p2 < numParts; p2++) {
        for (let t = 0; t < numTrials; t++) {
          lines.push(`"${appraiserNames[a]}",${p2 + 1},${t + 1},${measurements[a][p2][t] ?? ''}`)
        }
      }
    }
    lines.push('')
    lines.push('Metric,Value,% of Total Variation' + (result.pctOfTolerance ? ',% of Tolerance' : ''))
    const rows: [string, number, number, number | null][] = [
      ['EV (Repeatability)', result.EV, p.EV, result.pctOfTolerance?.EV ?? null],
      ['AV (Reproducibility)', result.AV, p.AV, result.pctOfTolerance?.AV ?? null],
      ['GRR', result.GRR, p.GRR, result.pctOfTolerance?.GRR ?? null],
      ['PV (Part Variation)', result.PV, p.PV, result.pctOfTolerance?.PV ?? null],
      ['TV (Total Variation)', result.TV, 1, null],
    ]
    rows.forEach(([label, val, tv, tol]) => {
      lines.push(`"${label}",${val.toFixed(5)},${(tv * 100).toFixed(2)}%` + (result.pctOfTolerance ? `,${tol !== null ? (tol * 100).toFixed(2) + '%' : ''}` : ''))
    })
    lines.push('')
    lines.push(`NDC (Number of Distinct Categories),${result.ndc}`)
    lines.push(`Conclusion,"${result.conclusionText}"`)

    if (result.method === 'anova') {
      lines.push('')
      lines.push(`Interaction pooled into error term,${result.pooled ? 'Yes' : 'No'} (alpha=${result.poolingAlpha})`)
      lines.push('')
      lines.push('ANOVA Table')
      lines.push('Source,SS,df,MS,F,p-value,Significant (p<0.05)')
      result.anovaTable.forEach(row => {
        lines.push(`"${row.source}",${row.SS.toFixed(6)},${row.df},${row.MS.toFixed(6)},${row.F !== null ? row.F.toFixed(4) : ''},${row.p !== null ? row.p.toFixed(6) : ''},${row.significant === null ? '' : row.significant ? 'Yes' : 'No'}`)
      })
      lines.push('')
      lines.push(`Statistical interpretation,"${result.significanceNote}"`)
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'gage-rr-data.csv'; a.click()
    URL.revokeObjectURL(url)
  }


  // ── Export: Excel ──────────────────────────────────────────────────────
  const exportExcel = async () => {
    if (!isPro) { goToPricing('gage-rr', 'excel'); return }
    if (!result) return
    const p = pctTV(result)
    const conclusionTone: Tone = result.conclusion === 'okay' ? 'good' : result.conclusion === 'marginal' ? 'warning' : 'danger'
    const report = createReport({ toolName: 'Gage R&R Study' })

    // ── Sheet 1: Overview ──
    const overview = report.addSheet('Overview')
    overview.titleBand('Gage Repeatability & Reproducibility Study', `Method: ${result.method === 'anova' ? 'ANOVA' : 'Average & Range'}`)
    overview.metaStrip([
      ['Generated on', nowStamp()],
      ['Appraisers × Parts × Trials', `${numAppraisers} × ${numParts} × ${numTrials}`],
      ['Standard', 'AIAG MSA 4th Edition'],
    ])

    overview.sectionHeading('Variance Components')
    overview.kpiRow([
      { label: '%GRR (of Total Variation)', value: `${(p.GRR * 100).toFixed(1)}%`, tone: conclusionTone },
      { label: 'NDC', value: result.ndc, sub: 'Number of Distinct Categories', tone: result.ndc >= 5 ? 'good' : 'warning' },
      { label: 'Repeatability (EV)', value: `${(p.EV * 100).toFixed(1)}%`, tone: 'neutral' },
      { label: 'Reproducibility (AV)', value: `${(p.AV * 100).toFixed(1)}%`, tone: 'neutral' },
    ])

    overview.sectionHeading('Detailed Breakdown')
    overview.table({
      headers: [
        { header: 'Metric', key: 'metric', align: 'left', width: 26 },
        { header: 'Value', key: 'value', align: 'right', numFmt: '0.00000' },
        { header: '% of Total Variation', key: 'pctTV', align: 'right' },
        ...(result.pctOfTolerance ? [{ header: '% of Tolerance', key: 'pctTol', align: 'right' as const }] : []),
      ],
      rows: [
        ['EV (Repeatability)', result.EV, `${(p.EV * 100).toFixed(2)}%`, result.pctOfTolerance ? `${(result.pctOfTolerance.EV * 100).toFixed(2)}%` : ''],
        ['AV (Reproducibility)', result.AV, `${(p.AV * 100).toFixed(2)}%`, result.pctOfTolerance ? `${(result.pctOfTolerance.AV * 100).toFixed(2)}%` : ''],
        ['GRR', result.GRR, `${(p.GRR * 100).toFixed(2)}%`, result.pctOfTolerance ? `${(result.pctOfTolerance.GRR * 100).toFixed(2)}%` : ''],
        ['PV (Part Variation)', result.PV, `${(p.PV * 100).toFixed(2)}%`, result.pctOfTolerance ? `${(result.pctOfTolerance.PV * 100).toFixed(2)}%` : ''],
        ['TV (Total Variation)', result.TV, '100.00%', ''],
      ],
      rowTones: [undefined, undefined, conclusionTone, undefined, undefined],
    })

    overview.note(`Conclusion: ${result.conclusionText}`, conclusionTone)

    if (result.method === 'anova' && result.significanceNote) {
      overview.note(result.significanceNote, 'neutral')
    }
    overview.freezeHeader(2)

    // ── Sheet 2: Raw Data ──
    const dataSheet = report.addSheet('Raw Data')
    dataSheet.titleBand('Raw Measurements', 'As entered into the study')
    const rawRows: (string | number)[][] = []
    for (let a = 0; a < numAppraisers; a++) {
      for (let p2 = 0; p2 < numParts; p2++) {
        for (let t = 0; t < numTrials; t++) {
          rawRows.push([appraiserNames[a], p2 + 1, t + 1, measurements[a][p2][t] ?? ''])
        }
      }
    }
    dataSheet.table({
      headers: [
        { header: 'Appraiser', key: 'appraiser', align: 'left', width: 18 },
        { header: 'Part', key: 'part', align: 'center' },
        { header: 'Trial', key: 'trial', align: 'center' },
        { header: 'Value', key: 'value', align: 'right', numFmt: '0.0000' },
      ],
      rows: rawRows,
    })
    dataSheet.freezeHeader(2)

    // ── Sheet 3: ANOVA Table (only for ANOVA method) ──
    if (result.method === 'anova') {
      const anovaSheet = report.addSheet('ANOVA Table')
      anovaSheet.titleBand('ANOVA Table', result.pooled ? `Interaction pooled into error (α = ${result.poolingAlpha})` : 'Interaction not pooled')
      anovaSheet.table({
        headers: [
          { header: 'Source', key: 'source', align: 'left', width: 22 },
          { header: 'SS', key: 'ss', align: 'right', numFmt: '0.000000' },
          { header: 'df', key: 'df', align: 'center' },
          { header: 'MS', key: 'ms', align: 'right', numFmt: '0.000000' },
          { header: 'F', key: 'f', align: 'right', numFmt: '0.0000' },
          { header: 'p-value', key: 'p', align: 'right', numFmt: '0.000000' },
          { header: 'Significant (p<0.05)', key: 'sig', align: 'center' },
        ],
        rows: result.anovaTable.map(row => [
          row.source, row.SS, row.df, row.MS,
          row.F ?? '', row.p ?? '',
          row.significant === null ? '' : row.significant ? 'Yes' : 'No',
        ]),
        rowTones: result.anovaTable.map(row => row.significant ? 'warning' : undefined),
      })
      anovaSheet.freezeHeader(2)
    }

    await report.download('gage-rr-results.xlsx')
  }


  // ── Export: PNG (contribution chart) ─────────────────────────────────
  const exportPNG = () => {
    if (!isLoggedIn) { goToLogin('gage-rr', 'png'); return }
    const chart = contribChartRef.current
    if (!chart) return
    const url = chart.toBase64Image('image/png', 1)
    const a = document.createElement('a')
    a.href = url; a.download = 'gage-rr-contribution.png'; a.click()
  }

  // ── Export: PDF ─────────────────────────────────────────────────────
  const exportPDF = () => {
    if (!isPro) { goToPricing('gage-rr', 'pdf'); return }
    if (!result) return
    const p = pctTV(result)
    const chart = contribChartRef.current
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 40
    let y = margin

    pdf.setFontSize(18); pdf.setFont('helvetica', 'bold')
    pdf.text('Gage R&R Study Report', margin, y); y += 20
    pdf.setFontSize(10); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(100)
    pdf.text(`Generated: ${new Date().toLocaleDateString()}   Method: ${result.method === 'anova' ? 'ANOVA' : 'Average & Range'}`, margin, y); y += 24

    pdf.setFontSize(11); pdf.setTextColor(0); pdf.setFont('helvetica', 'bold')
    pdf.text(`Appraisers: ${result.numAppraisers}   Trials: ${result.numTrials}   Parts: ${result.numParts}`, margin, y)
    y += 20

    const rows: [string, string][] = [
      ['EV (Repeatability)', `${fmt(result.EV)}  (${pct(p.EV)} of TV${result.pctOfTolerance ? `, ${pct(result.pctOfTolerance.EV)} of Tol.` : ''})`],
      ['AV (Reproducibility)', `${fmt(result.AV)}  (${pct(p.AV)} of TV${result.pctOfTolerance ? `, ${pct(result.pctOfTolerance.AV)} of Tol.` : ''})`],
      ['Gage R&R', `${fmt(result.GRR)}  (${pct(p.GRR)} of TV${result.pctOfTolerance ? `, ${pct(result.pctOfTolerance.GRR)} of Tol.` : ''})`],
      ['Part Variation', `${fmt(result.PV)}  (${pct(p.PV)} of TV${result.pctOfTolerance ? `, ${pct(result.pctOfTolerance.PV)} of Tol.` : ''})`],
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

    if (result.method === 'anova') {
      if (y > pageHeight - 180) { pdf.addPage(); y = margin }
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(12)
      pdf.text('ANOVA Table' + (result.pooled ? ` (interaction pooled into error, α=${result.poolingAlpha})` : ''), margin, y)
      y += 18
      pdf.setFontSize(9)
      const colX = [margin, margin + 150, margin + 190, margin + 230, margin + 300, margin + 360, margin + 420]
      const headers = ['Source', 'SS', 'df', 'MS', 'F', 'p-value', 'Sig.']
      pdf.setFont('helvetica', 'bold')
      headers.forEach((h, i) => pdf.text(h, colX[i], y))
      y += 14
      pdf.setFont('helvetica', 'normal')
      result.anovaTable.forEach(row => {
        pdf.text(row.source, colX[0], y)
        pdf.text(row.SS.toFixed(4), colX[1], y)
        pdf.text(String(row.df), colX[2], y)
        pdf.text(row.MS.toFixed(4), colX[3], y)
        pdf.text(row.F !== null ? row.F.toFixed(3) : '—', colX[4], y)
        pdf.text(row.p !== null ? row.p.toFixed(4) : '—', colX[5], y)
        pdf.text(row.significant === null ? '—' : row.significant ? 'Yes' : 'No', colX[6], y)
        y += 14
      })
      y += 10
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10)
      pdf.text('Statistical interpretation:', margin, y); y += 14
      pdf.setFont('helvetica', 'normal')
      const noteWrapped = pdf.splitTextToSize(result.significanceNote, pageWidth - margin * 2)
      pdf.text(noteWrapped, margin, y)
      y += noteWrapped.length * 14 + 14
    }

    if (chart) {
      if (y > pageHeight - 200) { pdf.addPage(); y = margin }
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
      <Nav theme={theme} setTheme={setTheme} breadcrumbKey="bc_gagerr" />

      {loadedProjectName && (
        <div className="qh-main" style={{ ...s.main, paddingBottom: 0 }}>
          <div style={{ fontSize: 13, color: c.accent, background: c.surface2, border: `1px solid ${c.border}`, borderRadius: 8, padding: '8px 14px' }}>
            {lang === 'ar' ? `تم تحميل المشروع المحفوظ: ${loadedProjectName}` : `Loaded saved project: ${loadedProjectName}`}
          </div>
        </div>
      )}

      {!subLoading && !isPro ? (
        <LockedPage
          theme={theme}
          feature={t('bc_gagerr')}
          description={t('grr_locked_desc')}
          bullets={[
            t('grr_locked_b1'),
            t('grr_locked_b2'),
            t('grr_locked_b3'),
            t('grr_locked_b4'),
          ]}
        />
      ) : (
      <div className="qh-body" style={s.body}>
        {/* ── LEFT: Configuration + Data Entry ─────────────────────────── */}
        <div style={{ ...s.left, width: 460 }}>
          <div>
            <div style={s.sectionTitle}>{t('grr_study_setup')}</div>

            <div style={{ marginBottom: 14 }}>
              <div style={s.label}>{t('grr_analysis_method')}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  style={{ ...s.exportBtn, flex: 1, ...(method === 'average-range' ? { background: c.accent, color: '#fff', borderColor: c.accent } : {}) }}
                  onClick={() => setMethod('average-range')}
                >
                  {t('grr_method_avgrange')}
                </button>
                <button
                  style={{ ...s.exportBtn, flex: 1, ...(method === 'anova' ? { background: c.accent, color: '#fff', borderColor: c.accent } : {}) }}
                  onClick={() => setMethod('anova')}
                >
                  {t('grr_method_anova')}
                </button>
              </div>
              <div style={{ fontSize: 11, color: c.muted, marginTop: 6 }}>
                {method === 'average-range' ? t('grr_method_avgrange_desc') : t('grr_method_anova_desc')}
              </div>
            </div>

            <div className="qh-input-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
              <div>
                <div style={s.label}>{t('grr_appraisers')}</div>
                <select style={s.select} value={numAppraisers} onChange={e => setNumAppraisersAndResize(Number(e.target.value) as 2 | 3)}>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                </select>
              </div>
              <div>
                <div style={s.label}>{t('grr_trials')}</div>
                <select style={s.select} value={numTrials} onChange={e => setNumTrialsAndResize(Number(e.target.value) as 2 | 3)}>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                </select>
              </div>
              <div>
                <div style={s.label}>{t('grr_parts')}</div>
                <select style={s.select} value={numParts} onChange={e => setNumPartsAndResize(Number(e.target.value))}>
                  {Array.from({ length: 9 }, (_, i) => i + 2).map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${numAppraisers}, 1fr)`, gap: 8, marginBottom: 12 }}>
              {Array.from({ length: numAppraisers }, (_, a) => (
                <div key={a}>
                  <div style={s.label}>{t('grr_appraiser_name').replace('{n}', String(a + 1))}</div>
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
                <div style={s.label}>{t('grr_lsl')}</div>
                <input style={s.input} type="number" value={LSL} onChange={e => setLSL(e.target.value)} />
              </div>
              <div>
                <div style={s.label}>{t('grr_usl')}</div>
                <input style={s.input} type="number" value={USL} onChange={e => setUSL(e.target.value)} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button style={{ ...s.exportBtn, flex: 1 }} onClick={loadSample}>{t('grr_load_sample')}</button>
              <button style={{ ...s.exportBtn, flex: 1, color: c.danger }} onClick={clearAll}>{t('grr_clear')}</button>
            </div>
          </div>

          <div>
            <div style={s.sectionTitle}>{t('grr_measurement_data')}</div>
            <div style={{ fontSize: 11, color: c.muted, marginBottom: 8 }}>
              {t('grr_paste_tip')}
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
                      {Array.from({ length: numTrials }, (_, t2) => (
                        <tr key={t2}>
                          <td style={{ ...s.td, padding: '4px 6px', color: c.muted, whiteSpace: 'nowrap' }}>{t('grr_trial_label').replace('{n}', String(t2 + 1))}</td>
                          {Array.from({ length: numParts }, (_, p) => (
                            <td key={p} style={{ ...s.td, padding: '2px 3px' }}>
                              <input
                                style={{ ...s.input, padding: '4px 5px', fontSize: 11, width: 52, textAlign: 'center' }}
                                type="number"
                                step="any"
                                value={measurements[a]?.[p]?.[t2] ?? ''}
                                onChange={e => setCell(a, p, t2, e.target.value)}
                                onPaste={e => handlePaste(a, p, t2, e)}
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
            {loading ? t('grr_calculating') : t('grr_run_analysis')}
          </button>
          {errorMsg && (
            <div style={{ color: c.danger, fontSize: 12, marginTop: 8 }}>{errorMsg}</div>
          )}
        </div>

        {/* ── RIGHT: Results ────────────────────────────────────────────── */}
        <div className="qh-right" style={s.right}>
          {!result && !loading && (
            <div style={{ ...s.card, textAlign: 'center', color: c.muted, padding: 60 }}>
              {t('grr_empty_state')}
              <div style={{ marginTop: 8, fontSize: 12 }}>{t('grr_empty_state_2')}</div>
            </div>
          )}

          {result && (
            <>
              {/* Export bar */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <button style={s.exportBtn} onClick={exportCSV}>{isLoggedIn ? t('common_export_csv') : t('common_export_csv_locked')}</button>
                <button style={s.exportBtn} onClick={exportExcel}>{isPro ? t('common_export_excel') : t('common_export_excel_locked')}</button>
                <button style={s.exportBtn} onClick={exportPNG}>{isLoggedIn ? t('common_export_png') : t('common_export_png_locked')}</button>
                <button style={s.exportBtn} onClick={exportPDF}>{isPro ? t('common_export_pdf') : t('common_export_pdf_locked')}</button>
                <SaveAnalysisButton
                  theme={theme}
                  tool="gage_rr"
                  defaultName={`Gage R&R — ${new Date().toLocaleDateString('en-US')}`}
                  getPayload={() => ({
                    input_data: { numAppraisers, numTrials, numParts, appraiserNames, measurements, USL, LSL, method },
                    results: result,
                  })}
                />
              </div>

              {/* Summary stat cards */}
              <div className="qh-stats-row" style={s.statsRow}>
                <div style={s.statCard}>
                  <div style={s.statVal}>{fmt(result.EV, 4)}</div>
                  <div style={s.statLabel}>{t('grr_stat_ev')}</div>
                </div>
                <div style={s.statCard}>
                  <div style={s.statVal}>{fmt(result.AV, 4)}</div>
                  <div style={s.statLabel}>{t('grr_stat_av')}</div>
                </div>
                <div style={s.statCard}>
                  <div style={s.statVal}>{fmt(result.GRR, 4)}</div>
                  <div style={s.statLabel}>{t('grr_stat_grr')}</div>
                </div>
                <div style={s.statCard}>
                  <div style={s.statVal}>{fmt(result.PV, 4)}</div>
                  <div style={s.statLabel}>{t('grr_stat_pv')}</div>
                </div>
                <div style={s.statCard}>
                  <div style={s.statVal}>{fmt(result.TV, 4)}</div>
                  <div style={s.statLabel}>{t('grr_stat_tv')}</div>
                </div>
                <div style={s.statCard}>
                  <div style={s.statVal}>{result.ndc}</div>
                  <div style={s.statLabel}>{t('grr_stat_ndc')}</div>
                </div>
              </div>

              {/* Conclusion banner */}
              {conclusionStyle && (
                <div style={{ ...s.card, background: conclusionStyle.bg, border: `1px solid ${conclusionStyle.color}40`, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 22 }}>{conclusionStyle.icon}</span>
                  <div>
                    <div style={{ fontWeight: 700, color: conclusionStyle.color }}>
                      %GRR {result.pctOfTolerance ? t('grr_pct_of_tolerance') : t('grr_pct_of_totalvar')}: {pct(result.pctOfTolerance ? result.pctOfTolerance.GRR : pctTV(result).GRR)}
                    </div>
                    <div style={{ fontSize: 13, color: c.text, marginTop: 2 }}>{result.conclusionText}</div>
                  </div>
                </div>
              )}

              {/* ANOVA — statistical significance */}
              {result.method === 'anova' && (
                <div style={s.card}>
                  <div style={s.sectionTitle}>{t('grr_anova_title')}</div>
                  <div style={{
                    fontSize: 13, lineHeight: 1.6, padding: 12, borderRadius: 8, marginBottom: 14,
                    background: 'rgba(15,212,200,.06)', border: '1px solid rgba(15,212,200,.15)', color: c.text,
                  }}>
                    {result.significanceNote}
                  </div>
                  {result.pooled && (
                    <div style={{ fontSize: 12, color: c.muted, marginBottom: 10 }}>
                      {t('grr_anova_pooled_note')
                        .replace('{p}', result.unpooledInteraction?.p !== null && result.unpooledInteraction?.p !== undefined ? result.unpooledInteraction.p.toFixed(4) : '—')
                        .replace('{alpha}', String(result.poolingAlpha))}
                    </div>
                  )}
                  <div className="qh-table-wrap" style={{ overflowX: 'auto' }}>
                  <table style={s.table}>
                    <thead>
                      <tr>
                        <th style={s.th}>{t('grr_col_source')}</th>
                        <th style={s.th}>{t('grr_col_ss')}</th>
                        <th style={s.th}>{t('grr_col_df')}</th>
                        <th style={s.th}>{t('grr_col_ms')}</th>
                        <th style={s.th}>{t('grr_col_f')}</th>
                        <th style={s.th}>{t('grr_col_pvalue')}</th>
                        <th style={s.th}>{t('grr_col_significant')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.anovaTable.map((row, i) => (
                        <tr key={i}>
                          <td style={s.td}>{row.source}</td>
                          <td style={s.td}>{row.SS.toFixed(5)}</td>
                          <td style={s.td}>{row.df}</td>
                          <td style={s.td}>{row.MS.toFixed(5)}</td>
                          <td style={s.td}>{row.F !== null ? row.F.toFixed(3) : '—'}</td>
                          <td style={s.td}>{row.p !== null ? row.p.toFixed(4) : '—'}</td>
                          <td style={s.td}>
                            {row.significant === null ? '—' : (
                              <span style={{ color: row.significant ? '#ef4444' : '#4ade80', fontWeight: 700 }}>
                                {row.significant ? t('grr_sig_yes') : t('grr_sig_no')}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>
              )}

              {/* % Contribution table */}
              <div style={s.card}>
                <div style={s.sectionTitle}>{t('grr_variation_contribution')}</div>
                <div className="qh-table-wrap" style={{ overflowX: 'auto' }}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>{t('grr_col_source')}</th>
                      <th style={s.th}>{t('grr_col_value')}</th>
                      <th style={s.th}>{t('grr_col_pcttotalvar')}</th>
                      {result.pctOfTolerance && <th style={s.th}>{t('grr_col_pcttolerance')}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      [t('grr_row_ev'), result.EV, pctTV(result).EV, result.pctOfTolerance?.EV],
                      [t('grr_row_av'), result.AV, pctTV(result).AV, result.pctOfTolerance?.AV],
                      [t('grr_row_grr'), result.GRR, pctTV(result).GRR, result.pctOfTolerance?.GRR],
                      [t('grr_row_pv'), result.PV, pctTV(result).PV, result.pctOfTolerance?.PV],
                      [t('grr_row_tv'), result.TV, 1, null],
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
                </div>
                <div style={{ height: 220, marginTop: 16 }}>
                  {contribChartData && (
                    <Chart
                      ref={contribChartRef}
                      type="bar"
                      data={contribChartData}
                      options={{ ...chartOpts(t('grr_col_pcttotalvar')), plugins: { legend: { display: false } } } as never}
                    />
                  )}
                </div>
              </div>

              {/* Range chart — Average & Range method only (UCL/D4 concept doesn't apply to ANOVA) */}
              {result.method === 'average-range' && (
                <div className="qh-chart-wrap" style={s.chartWrap}>
                  <div style={s.sectionTitle}>{t('grr_range_chart_title').replace('{n}', fmt(result.uclR, 4))}</div>
                  <div className="qh-chart-inner" style={s.chartInner}>
                    {rangeChartData && (
                      <Chart ref={rangeChartRef} type="line" data={rangeChartData as never} options={chartOpts(t('grr_axis_range')) as never} />
                    )}
                  </div>
                  {result.outOfControlRanges.length > 0 && (
                    <div style={{ marginTop: 10, fontSize: 12, color: c.danger }}>
                      {t('grr_range_ooc_warning').replace('{n}', String(result.outOfControlRanges.length))}{' '}
                      {result.outOfControlRanges.map(r => `${r.appraiser} / Part ${r.part}`).join(', ')}
                    </div>
                  )}
                </div>
              )}

              {/* Xbar comparison chart */}
              <div className="qh-chart-wrap" style={s.chartWrap}>
                <div style={s.sectionTitle}>{t('grr_xbar_chart_title')}</div>
                <div className="qh-chart-inner" style={s.chartInner}>
                  {xbarChartData && (
                    <Chart ref={xbarChartRef} type="line" data={xbarChartData as never} options={chartOpts(t('grr_axis_avgmeasurement')) as never} />
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      )}
    </div>
  )
}
