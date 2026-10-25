'use client'

import { useState, useRef, useMemo, useEffect } from 'react'
import 'chart.js/auto'
import { Chart } from 'react-chartjs-2'
import type { Chart as ChartJSInstance } from 'chart.js'
import { COLORS, getSharedStyles, usePersistedTheme, tint } from '@/lib/theme'
import Nav from '@/components/Nav'
import SaveAnalysisButton from '@/components/SaveAnalysisButton'
import ToolSidebar from '@/components/ToolSidebar'
import ToolStyles from '@/components/tool/ToolStyles'
import { ToolHeader, HelpPanel, PhoneTabs, PhoneBar, ExportRow, useCompactSave, type MobileTab } from '@/components/tool/ToolParts'
import { GAGE_SAMPLE_DATA, GAGE_SAMPLE_RESULT } from '@/lib/gage/sample'
import { translations, type TKey } from '@/lib/i18n/translations'
import { formatPValue } from '@/lib/stats/format'
import { useSubscription } from '@/lib/useSubscription'
import { goToLogin, goToPricing } from '@/lib/exportGate'
import { useLanguage } from '@/lib/i18n/context'
import { createReport, nowStamp, type Tone } from '@/lib/excelReport'
import {
  createReport as createPdfReport,
  classifyGageConclusion,
  classificationBanner,
  twoColumnTables,
  dataTable,
  capabilityGauge,
  interpretationBox,
  calloutBox,
  summaryBox,
  criteriaReferenceTable,
  addChartImage,
  addChartImagePair,
  chartSnapshot,
  finalizeReport,
  REPORT_COLORS,
  type KVRow,
} from '@/lib/pdf/reportDesign'

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

// Report interpretation written on the server (lib/gage/diagnosis.server.ts)
type DiagTone = 'good' | 'warn' | 'bad' | 'info'
interface GageDiagnosis {
  rows: { dimension: string; result: string; assessment: string; tone: DiagTone }[]
  summary: Array<[string, string]>
  recommendedAction: string
  conclusion?: string
  averagesNote?: string
  tone: DiagTone
}

type GageResult = (AvgRangeResult | AnovaResult) & { diagnosis?: GageDiagnosis }

const diagToneColor = (tone: DiagTone) =>
  tone === 'good' ? REPORT_COLORS.good : tone === 'bad' ? REPORT_COLORS.bad : tone === 'warn' ? REPORT_COLORS.warn : null

// Charts are drawn at a fixed size for the report, so fonts stay readable and
// each chart takes a third of a page instead of a full page.
const REPORT_CHART_SIZE = { width: 900, height: 340 }

// Sample study (lib/gage/sample.ts) — its result there is the faded example free visitors see.
const SAMPLE: number[][][] = GAGE_SAMPLE_DATA.map(a => a.map(p => [...p]))
const EN = translations.en
const fill = (str: string, vars: Record<string, string | number>) => Object.entries(vars).reduce((a, [k, v]) => a.split(`{${k}}`).join(String(v)), str)
const ltr = (v: string) => `\u2066${v}\u2069`
const POOLING_ALPHA = 0.25

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
  const [mobileTab, setMobileTab] = useState<MobileTab>('data')
  const [helpOpen, setHelpOpen] = useState(false)
  const compactSave = useCompactSave()

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
    setMobileTab('results')
  }

  const clearAll = () => {
    if (!window.confirm(t('grr_confirm_clear'))) return
    setMeasurements(resizeMeasurements([], numAppraisers, numParts, numTrials))
    setResult(null)
  }

  // ── Live analysis (Pro): the server recalculates shortly after each change ──
  const filled = measurements.flat(2).filter(v => v !== null && Number.isFinite(v)).length
  const totalCells = numAppraisers * numParts * numTrials
  const complete = filled === totalCells
  const lslNum = LSL.trim() !== '' ? Number(LSL) : null
  const uslNum = USL.trim() !== '' ? Number(USL) : null
  const limitsBad = lslNum !== null && uslNum !== null && !(uslNum > lslNum)
  const requestKey = isPro && complete && !limitsBad
    ? JSON.stringify({ appraiserNames, numTrials, numParts, measurements, USL: uslNum, LSL: lslNum, method, poolingAlpha: POOLING_ALPHA })
    : null
  useEffect(() => {
    if (!requestKey) return
    const ctrl = new AbortController()
    const timer = setTimeout(() => {
      setLoading(true)
      fetch('/api/gage-rr', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: requestKey, signal: ctrl.signal })
        .then(async res => {
          const json = await res.json().catch(() => ({}))
          if (!res.ok) setErrorMsg(res.status === 429 ? t('tool_rate_limited') : json.error || t('grr_err_calc_failed'))
          else { setErrorMsg(''); setResult(json) }
        })
        .catch(() => { if (!ctrl.signal.aborted) setErrorMsg(t('grr_err_network')) })
        .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    }, 350)
    return () => { clearTimeout(timer); ctrl.abort() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey])
  const shown = requestKey ? result : null

  // ── Chart data ─────────────────────────────────────────────────────────
  const contribChartData = useMemo(() => {
    if (!result) return null
    const p = pctTV(result)
    return {
      labels: ['EV', 'AV', 'GRR', 'PV'],
      datasets: [{
        label: t('grr_col_pcttotalvar'),
        data: [p.EV, p.AV, p.GRR, p.PV].map(v => +(v * 100).toFixed(2)),
        backgroundColor: [c.bar, c.line, c.danger, c.muted],
        borderRadius: 6,
      }],
    }
  }, [result, c, t])

  // Range chart: one coloured line per appraiser over the parts (same colours
  // as the averages chart), so the x axis only needs the part numbers.
  const rangeChartData = useMemo(() => {
    if (!result || result.method !== 'average-range') return null
    const labels = Array.from({ length: result.numParts }, (_, i) => `Part ${i + 1}`)
    const palette = [c.bar, c.line, c.danger]
    return {
      labels,
      datasets: [
        ...result.appraiserNames.map((name, a) => ({
          type: 'line' as const,
          label: name,
          data: result.rng[a],
          borderColor: palette[a % palette.length],
          backgroundColor: palette[a % palette.length],
          pointRadius: result.rng[a].map(v => (v > result.uclR ? 5 : 3)),
          pointBackgroundColor: result.rng[a].map(v => (v > result.uclR ? c.danger : palette[a % palette.length])),
          tension: 0,
        })),
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

    const blob = new Blob(['\uFEFF', lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
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
      ...(result.pctOfTolerance
        ? [{ label: '%GRR (of Tolerance)', value: `${(result.pctOfTolerance.GRR * 100).toFixed(1)}%`, tone: conclusionTone }]
        : []),
      { label: '%GRR (of Total Variation)', value: `${(p.GRR * 100).toFixed(1)}%`, tone: result.pctOfTolerance ? 'neutral' : conclusionTone },
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

    if (result.diagnosis) {
      const xlTone = (t: DiagTone): Tone => (t === 'good' ? 'good' : t === 'warn' ? 'warning' : t === 'bad' ? 'danger' : 'neutral')
      overview.table({
        title: 'Measurement System Diagnosis',
        headers: [
          { header: 'Dimension', key: 'dimension', align: 'left', width: 26 },
          { header: 'Result', key: 'result', align: 'left', width: 34 },
          { header: 'Assessment', key: 'assessment', align: 'left', width: 70 },
        ],
        rows: result.diagnosis.rows.map(r => [r.dimension, r.result, r.assessment]),
        rowTones: result.diagnosis.rows.map(r => xlTone(r.tone)),
      })
      overview.note(`Recommended action: ${result.diagnosis.recommendedAction}`, xlTone(result.diagnosis.tone))
    }

    if (result.method === 'anova' && result.significanceNote) {
      overview.note(result.significanceNote, 'neutral')
    }

    // ── Variance contribution chart image (same canvas as the PNG export
    // button and the PDF report) — lets the reader see the %GRR breakdown
    // without leaving the spreadsheet. ──
    overview.sectionHeading('Variation by Source')
    if (contribChartRef.current) {
      await overview.image(chartSnapshot(contribChartRef.current, { width: 900, height: 450 }).data, { widthCm: 16, heightCm: 8 })
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
    const url = chartSnapshot(chart).data
    const a = document.createElement('a')
    a.href = url; a.download = 'gage-rr-contribution.png'; a.click()
  }

  // ── Export: PDF ─────────────────────────────────────────────────────
  const exportPDF = () => {
    if (!isPro) { goToPricing('gage-rr', 'pdf'); return }
    if (!result) return
    const p = pctTV(result)
    const cls = classifyGageConclusion(result.conclusion)
    // The engine bases its verdict on %GRR of Tolerance when specs were
    // given, falling back to %GRR of Total Variation otherwise — mirror
    // that exact choice here so the gauge always agrees with the badge.
    const gaugeBasisPct = (result.pctOfTolerance ? result.pctOfTolerance.GRR : p.GRR) * 100
    const gaugeBasisLabel = result.pctOfTolerance ? '% GRR of Tolerance' : '% GRR of Total Variation'

    const ctx = createPdfReport('Gage R&R Study Report', 'gage-rr')
    classificationBanner(ctx, cls, 'Measurement System Assessment')
    if (result.diagnosis) {
      summaryBox(ctx, 'Summary', result.diagnosis.summary, result.diagnosis.tone)
    }

    const studyRows: KVRow[] = [
      ['Method', result.method === 'anova' ? 'ANOVA' : 'Average & Range'],
      ['Appraisers', String(result.numAppraisers)],
      ['Trials', String(result.numTrials)],
      ['Parts', String(result.numParts)],
      ['Tolerance', result.tolerance !== null ? fmt(result.tolerance) : '—'],
      ...(result.method === 'anova' ? [['Interaction Pooling', result.pooled ? `Pooled (α=${result.poolingAlpha})` : 'Not pooled'] as KVRow] : []),
    ]

    const metricRows: KVRow[] = [
      ['EV (Repeatability)', fmt(result.EV)],
      ['AV (Reproducibility)', fmt(result.AV)],
      ['Gage R&R', fmt(result.GRR)],
      ['Part Variation (PV)', fmt(result.PV)],
      ['Total Variation (TV)', fmt(result.TV)],
      ['Number of Distinct Categories (ndc)', String(result.ndc)],
    ]

    twoColumnTables(ctx, 'Study Information', studyRows, 'Key Metrics', metricRows)

    const rowValue = (frac: number, tolFrac: number | null) =>
      tolFrac !== null ? `${pct(tolFrac)} of Tolerance  ·  ${pct(frac)} of TV` : `${pct(frac)} of TV`

    dataTable(
      ctx,
      'Variation Summary',
      [
        { header: 'SOURCE', width: 200 },
        { header: 'RESULT', width: ctx.pageWidth - ctx.margin * 2 - 200 },
      ],
      [
        ['EV — Repeatability', rowValue(p.EV, result.pctOfTolerance?.EV ?? null)],
        ['AV — Reproducibility', rowValue(p.AV, result.pctOfTolerance?.AV ?? null)],
        ['GRR — Combined', rowValue(p.GRR, result.pctOfTolerance?.GRR ?? null)],
        ['PV — Part Variation', rowValue(p.PV, result.pctOfTolerance?.PV ?? null)],
      ],
      { cellColors: [[], [], [null, cls.color], []] }
    )

    capabilityGauge(ctx, {
      title: 'Measurement System Gauge',
      value: gaugeBasisPct,
      min: 0,
      max: 60,
      bands: [
        { upTo: 10, color: REPORT_COLORS.goodBg },
        { upTo: 30, color: REPORT_COLORS.warnBg },
        { upTo: 60, color: REPORT_COLORS.badBg },
      ],
      ticks: [
        { value: 0, label: '0%' },
        { value: 10, label: '10%' },
        { value: 30, label: '30%' },
        { value: 60, label: '60%+' },
      ],
      caption: `${gaugeBasisLabel} = ${gaugeBasisPct.toFixed(1)}% (AIAG: <10% acceptable, 10–30% marginal, >30% unacceptable)`,
    })

    addChartImage(ctx, contribChartRef.current, 'Variation by Source', REPORT_CHART_SIZE)

    if (result.method === 'average-range') {
      addChartImagePair(
        ctx,
        'Repeatability and Appraiser Consistency',
        { chart: rangeChartRef.current, title: `Range Chart by Appraiser (UCL = ${fmt(result.uclR, 4)})` },
        { chart: xbarChartRef.current, title: 'Part Averages by Appraiser' },
        REPORT_CHART_SIZE
      )
      if (result.diagnosis?.averagesNote) calloutBox(ctx, result.diagnosis.averagesNote, 'info')
      calloutBox(
        ctx,
        result.outOfControlRanges.length === 0
          ? 'No out-of-control ranges were detected — appraisers are applying the gage consistently.'
          : `${result.outOfControlRanges.length} out-of-control range(s) detected — see the detailed table below.`,
        result.outOfControlRanges.length === 0 ? 'good' : 'warn'
      )
      if (result.outOfControlRanges.length > 0) {
        dataTable(
          ctx,
          'Out-of-Control Ranges',
          [
            { header: 'APPRAISER', width: 200 },
            { header: 'PART', width: 100 },
            { header: 'RANGE', width: ctx.pageWidth - ctx.margin * 2 - 300 },
          ],
          result.outOfControlRanges.map(r => [r.appraiser, String(r.part), fmt(r.range)])
        )
      }
    } else {
      addChartImage(ctx, xbarChartRef.current, 'Part Averages by Appraiser', REPORT_CHART_SIZE)
      if (result.diagnosis?.averagesNote) calloutBox(ctx, result.diagnosis.averagesNote, 'info')
    }

    if (result.method === 'anova') {
      dataTable(
        ctx,
        result.pooled ? `ANOVA Table (interaction pooled into error, α=${result.poolingAlpha})` : 'ANOVA Table',
        [
          { header: 'SOURCE', width: 140 },
          { header: 'SS', width: 75, align: 'right' },
          { header: 'DF', width: 40, align: 'right' },
          { header: 'MS', width: 75, align: 'right' },
          { header: 'F', width: 60, align: 'right' },
          { header: 'P-VALUE', width: 65, align: 'right' },
          { header: 'SIG.', width: ctx.pageWidth - ctx.margin * 2 - 455, align: 'right' },
        ],
        result.anovaTable.map(row => [
          row.source,
          row.SS.toFixed(4),
          String(row.df),
          row.MS.toFixed(4),
          row.F !== null ? row.F.toFixed(3) : '—',
          row.p !== null ? row.p.toFixed(4) : '—',
          row.significant === null ? '—' : row.significant ? 'Yes' : 'No',
        ])
      )
      interpretationBox(ctx, 'Statistical Interpretation', result.significanceNote, 'info')
    }

    if (result.diagnosis) {
      const d = result.diagnosis
      dataTable(
        ctx,
        'Measurement System Diagnosis',
        [
          { header: 'DIMENSION', width: 120 },
          { header: 'RESULT', width: 150 },
          { header: 'ASSESSMENT', width: ctx.pageWidth - ctx.margin * 2 - 270 },
        ],
        d.rows.map(r => [r.dimension, r.result, r.assessment]),
        { cellColors: d.rows.map(r => [null, null, diagToneColor(r.tone)]) }
      )
      interpretationBox(ctx, 'Recommended Action', d.recommendedAction, d.tone)
    }

    const tone = result.conclusion === 'okay' ? 'good' : result.conclusion === 'marginal' ? 'warn' : 'bad'
    interpretationBox(ctx, 'Study Conclusion', result.diagnosis?.conclusion ?? result.conclusionText, tone)
    criteriaReferenceTable(
      ctx,
      'Gage R&R Acceptance Criteria (AIAG)',
      [
        ['< 10%', 'Acceptable', 'Measurement system is acceptable for most applications.'],
        ['10% to 30%', 'Marginal', 'May be acceptable depending on application importance and cost of measurement.'],
        ['> 30%', 'Unacceptable', 'Measurement system needs improvement — investigate repeatability and reproducibility sources.'],
      ],
      ['% GRR', 'CLASSIFICATION', 'GENERAL INTERPRETATION']
    )

    finalizeReport(ctx)
    ctx.pdf.save('gage-rr-report.pdf')
  }

  // exports are in English: the axis titles switch for the snapshot
  const withEnglishAxes = async <T,>(fn: () => T | Promise<T>): Promise<T> => {
    type Sc = { y?: { title?: { text?: string } } }
    const jobs: { ch: ChartJSInstance; title: { text?: string }; keep?: string; text: string }[] = []
    const add = (ch: unknown, text: string) => {
      const chart = ch as ChartJSInstance | null
      const title = (chart?.options.scales as Sc | undefined)?.y?.title
      if (chart && title) jobs.push({ ch: chart, title, keep: title.text, text })
    }
    add(contribChartRef.current, EN.grr_col_pcttotalvar)
    add(rangeChartRef.current, EN.grr_axis_range)
    add(xbarChartRef.current, EN.grr_axis_avgmeasurement)
    jobs.forEach(j => { j.title.text = j.text; j.ch.update('none') })
    try {
      return await fn()
    } finally {
      jobs.forEach(j => { j.title.text = j.keep; j.ch.update('none') })
    }
  }

  // ── Words ──
  const iso = lang === 'ar'
  const verdictOf = (c0: 'okay' | 'marginal' | 'unacceptable') => (c0 === 'okay' ? 'var(--qh-good)' : c0 === 'marginal' ? 'var(--qh-amber)' : 'var(--qh-danger)')
  const verdictText = (c0: 'okay' | 'marginal' | 'unacceptable') => t(c0 === 'okay' ? 'gr_v_okay' : c0 === 'marginal' ? 'gr_v_marginal' : 'gr_v_bad')
  const grrBasis = (r: { pctOfTolerance: { GRR: number } | null; pctOfTV?: { GRR: number }; pctStudyVar?: { GRR: number } }) => (r.pctOfTolerance ? r.pctOfTolerance.GRR : (r.pctOfTV ?? r.pctStudyVar)!.GRR)
  const helpSteps = [1, 2, 3, 4].map(n => ({ t: t(`gr_help_s${n}_t` as TKey), d: t(`gr_help_s${n}_d` as TKey) }))
  const dominant = (r: GageResult) => (r.GRR > 0 ? (r.EV >= r.AV ? t('gr_dominant_ev') : t('gr_dominant_av')) : '')

  const seg = (value: number, options: number[], on: (v: number) => void, label: string) => (
    <div className="gr-seg" role="group" aria-label={label}>
      {options.map(o => <button key={o} type="button" aria-pressed={value === o} onClick={() => on(o)}>{o}</button>)}
    </div>
  )

  const verdictCards = (r: { conclusion: 'okay' | 'marginal' | 'unacceptable'; pctOfTolerance: { GRR: number } | null; pctOfTV?: { GRR: number }; pctStudyVar?: { GRR: number }; ndc: number }, extra?: string) => {
    const vc = verdictOf(r.conclusion)
    const nc = r.ndc >= 5 ? 'var(--qh-good)' : 'var(--qh-amber)'
    return (
      <div className="tl-verdicts">
        <div className="tl-verdict" style={{ background: tint(vc, 8), border: `1px solid ${tint(vc, 35)}` }}>
          <span className="tl-verdict-icon" aria-hidden="true" style={{ background: tint(vc, 16), color: vc }}>{r.conclusion === 'okay' ? '✓' : '!'}</span>
          <div>
            <div style={{ fontSize: 12, color: 'var(--qh-muted)', marginBottom: 2 }}>{t('gr_v_system')}</div>
            <div className="gr-big" style={{ color: vc }}>{verdictText(r.conclusion)} <span>{ltr(pct(grrBasis(r)))}</span></div>
            <div style={{ fontSize: 13, color: 'var(--qh-muted)', lineHeight: 1.6 }}>{fill(t(r.pctOfTolerance ? 'gr_v_sub_tol' : 'gr_v_sub_tv'), { v: iso ? ltr(pct(grrBasis(r))) : pct(grrBasis(r)) })}{extra ? ` ${extra}` : ''}</div>
          </div>
        </div>
        <div className="tl-verdict" style={{ background: tint(nc, 8), border: `1px solid ${tint(nc, 35)}` }}>
          <span className="tl-verdict-icon" aria-hidden="true" style={{ background: tint(nc, 16), color: nc }}>{r.ndc >= 5 ? '✓' : '!'}</span>
          <div>
            <div style={{ fontSize: 12, color: 'var(--qh-muted)', marginBottom: 2 }}>{t('gr_v_ndc')}</div>
            <div className="gr-big" style={{ color: nc }}>{r.ndc}</div>
            <div style={{ fontSize: 13, color: 'var(--qh-muted)', lineHeight: 1.6 }}>{fill(t(r.ndc >= 5 ? 'gr_ndc_ok' : 'gr_ndc_low'), { n: r.ndc })}</div>
          </div>
        </div>
      </div>
    )
  }

  const r = shown
  const tvOf = (x: GageResult) => pctTV(x)

  return (
    <div style={s.page}>
      <ToolStyles />
      <style>{`
        .gr-seg { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); border: 1px solid var(--qh-border); border-radius: 8px; overflow: hidden; }
        .gr-seg button { border: 0; background: transparent; color: var(--qh-text); font: inherit; font-size: 13px; font-weight: 600; padding: 8px 4px; cursor: pointer; }
        .gr-seg button + button { border-inline-start: 1px solid var(--qh-border); }
        .gr-seg button[aria-pressed="true"] { background: var(--qh-accent); color: var(--qh-onAccent); }
        .gr-three { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
        .gr-two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
        .gr-sel, .gr-txt { width: 100%; box-sizing: border-box; background: color-mix(in srgb, var(--qh-bg) 70%, var(--qh-surface)); border: 1px solid var(--qh-border); border-radius: 7px; color: var(--qh-text); padding: 8px 10px; font: inherit; font-size: 14px; outline: none; }
        .gr-sel:focus, .gr-txt:focus { border-color: var(--qh-accent); }
        .gr-names { display: flex; flex-direction: column; gap: 6px; }
        .gr-name { display: grid; grid-template-columns: 22px minmax(0, 1fr); gap: 8px; align-items: center; }
        .gr-name i { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
        .gr-block + .gr-block { margin-top: 14px; }
        .gr-block-t { font-weight: 700; font-size: 13px; margin-bottom: 6px; display: flex; align-items: center; gap: 8px; }
        .gr-block-t i { width: 10px; height: 10px; border-radius: 50%; }
        .gr-grid td input { text-align: center; min-width: 58px; }
        .gr-grid th { white-space: nowrap; }
        .gr-grid td.gr-tl { color: var(--qh-muted); font-size: 12px; white-space: nowrap; padding: 0 8px; }
        .gr-big { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
        .gr-big span { font: 700 18px ui-monospace, 'SF Mono', Menlo, monospace; margin-inline-start: 6px; }
        .gr-locked { position: relative; }
        .gr-locked .gr-fade { opacity: .45; pointer-events: none; user-select: none; }
        .gr-cta { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
        .gr-tag { font-size: 11px; color: var(--qh-muted); text-transform: uppercase; letter-spacing: .5px; }
      `}</style>
      <Nav theme={theme} setTheme={setTheme} breadcrumbKey="bc_gagerr" />

      {loadedProjectName && (
        <div className="qh-main" style={{ ...s.main, paddingBottom: 0 }}>
          <div style={{ fontSize: 13, color: c.accent, background: c.surface2, border: `1px solid ${c.border}`, borderRadius: 8, padding: '8px 14px' }}>
            {lang === 'ar' ? `تم تحميل المشروع المحفوظ: ${loadedProjectName}` : `Loaded saved project: ${loadedProjectName}`}
          </div>
        </div>
      )}

      <div className="tl-shell">
        <ToolSidebar current="/gage-rr" />

        <div className="tl-main">
          <ToolHeader title={t('gagerr_title')} intro={t('gr_intro')} onHelp={() => setHelpOpen(true)} onExample={loadSample} />
          <HelpPanel open={helpOpen} onClose={() => setHelpOpen(false)} title={t('gr_help_title')} steps={helpSteps} onExample={loadSample} showCapability={false} tip={t('gr_help_tip')} />
          <PhoneTabs tab={mobileTab} onTab={setMobileTab} dataCount={filled} />

          <div className="tl-top">
            {/* ── SETUP ───────────────────────────────────────────────── */}
            <section className="tl-panel tl-setup tl-card" data-active={mobileTab === 'setup'} aria-label={t('spc_tab_setup')}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{t('grr_study_setup')}</div>
              <div>
                <div className="tl-label">{t('grr_analysis_method')}</div>
                <div className="gr-seg" role="group" aria-label={t('grr_analysis_method')}>
                  <button type="button" aria-pressed={method === 'average-range'} onClick={() => setMethod('average-range')}>{t('grr_method_avgrange')}</button>
                  <button type="button" aria-pressed={method === 'anova'} onClick={() => setMethod('anova')}>{t('grr_method_anova')}</button>
                </div>
                <div className="tl-hint">{method === 'average-range' ? t('grr_method_avgrange_desc') : t('grr_method_anova_desc')}</div>
              </div>
              <div className="gr-three">
                <div><div className="tl-label">{t('grr_appraisers')}</div>{seg(numAppraisers, [2, 3], v => setNumAppraisersAndResize(v as 2 | 3), t('grr_appraisers'))}</div>
                <div><div className="tl-label">{t('grr_trials')}</div>{seg(numTrials, [2, 3], v => setNumTrialsAndResize(v as 2 | 3), t('grr_trials'))}</div>
                <div>
                  <div className="tl-label">{t('grr_parts')}</div>
                  <select className="gr-sel" value={numParts} onChange={e => setNumPartsAndResize(Number(e.target.value))}>
                    {Array.from({ length: 9 }, (_, i) => i + 2).map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <div className="tl-label">{t('gr_names')}</div>
                <div className="gr-names">
                  {Array.from({ length: numAppraisers }, (_, a) => (
                    <label key={a} className="gr-name">
                      <i style={{ background: [c.bar, c.line, c.danger][a] }} aria-hidden="true" />
                      <input className="gr-txt" value={appraiserNames[a] || ''} aria-label={t('grr_appraiser_name').replace('{n}', String(a + 1))} onChange={e => setAppraiserNames(prev => { const n = [...prev]; n[a] = e.target.value; return n })} />
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <div className="tl-label">{t('gr_tolerance')}</div>
                <div className="gr-two">
                  <label className="tl-field"><span>LSL</span><input inputMode="decimal" value={LSL} placeholder="—" onChange={e => setLSL(e.target.value)} /></label>
                  <label className="tl-field"><span>USL</span><input inputMode="decimal" value={USL} placeholder="—" onChange={e => setUSL(e.target.value)} /></label>
                </div>
                <div className="tl-hint">{t('gr_tol_hint')}</div>
                {limitsBad && <div className="tl-error" style={{ marginTop: 8 }}>{t('stb_err_limits')}</div>}
              </div>
            </section>

            <div className="tl-col">
              {/* ── DATA ──────────────────────────────────────────────── */}
              <section className="tl-panel tl-card" data-active={mobileTab === 'data'} aria-label={t('spc_tab_data')}>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>
                    {t('spc_tab_data')}
                    <span style={{ fontWeight: 400, fontSize: 13, color: 'var(--qh-muted)' }}>{' · '}{fill(t('gr_data_count'), { a: numAppraisers, p: numParts, t: numTrials, n: filled, total: totalCells })}</span>
                  </div>
                  <button type="button" className="tl-xbtn tl-xbtn-sm" style={{ color: 'var(--qh-danger)' }} onClick={clearAll}>{t('spc_clear_short')}</button>
                </div>
                {Array.from({ length: numAppraisers }, (_, a) => (
                  <div key={a} className="gr-block">
                    <div className="gr-block-t"><i style={{ background: [c.bar, c.line, c.danger][a] }} aria-hidden="true" />{appraiserNames[a] || `Appraiser ${a + 1}`}</div>
                    <div className="tl-sg-wrap">
                      <table className="tl-sg gr-grid">
                        <thead>
                          <tr>
                            <th></th>
                            {Array.from({ length: numParts }, (_, p) => <th key={p}>P{p + 1}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {Array.from({ length: numTrials }, (_, t2) => (
                            <tr key={t2}>
                              <td className="gr-tl">{t('grr_trial_label').replace('{n}', String(t2 + 1))}</td>
                              {Array.from({ length: numParts }, (_, p) => (
                                <td key={p}>
                                  <input
                                    inputMode="decimal"
                                    value={measurements[a]?.[p]?.[t2] ?? ''}
                                    aria-label={`${appraiserNames[a] || a + 1} · P${p + 1} · ${t2 + 1}`}
                                    onChange={e => setCell(a, p, t2, e.target.value)}
                                    onPaste={e => handlePaste(a, p, t2, e)}
                                  />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
                <div className="tl-paste">{t('gr_block_hint')}</div>
              </section>

              {/* ── RESULTS ───────────────────────────────────────────── */}
              <section className="tl-panel tl-results" data-active={mobileTab === 'results'} aria-label={t('spc_tab_results')}>
                {!subLoading && !isPro ? (
                  <div className="tl-card gr-locked">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <span className="gr-tag">{t('gr_pro_sample')}</span>
                      <span className="tl-pro">PRO</span>
                    </div>
                    <div className="gr-fade" aria-hidden="true">{verdictCards(GAGE_SAMPLE_RESULT)}</div>
                    <div className="gr-fade tl-kpis tl-kpis-4" aria-hidden="true" style={{ marginTop: 10 }}>
                      <div className="tl-kpi"><span>{t('gr_kpi_grr_tol')}</span><b>{pct(GAGE_SAMPLE_RESULT.pctOfTolerance.GRR)}</b></div>
                      <div className="tl-kpi"><span>{t('gr_kpi_grr_tv')}</span><b>{pct(GAGE_SAMPLE_RESULT.pctOfTV.GRR)}</b></div>
                      <div className="tl-kpi"><span>{t('gr_kpi_ev')}</span><b>{pct(GAGE_SAMPLE_RESULT.pctOfTV.EV)}</b></div>
                      <div className="tl-kpi"><span>{t('gr_kpi_av')}</span><b>{pct(GAGE_SAMPLE_RESULT.pctOfTV.AV)}</b></div>
                    </div>
                    <div className="gr-cta" style={{ marginTop: 14 }}>
                      <span style={{ fontSize: 13, color: 'var(--qh-muted)', flex: '1 1 240px' }}>{t('gr_pro_locked')}</span>
                      {!isLoggedIn && <button type="button" className="tl-xbtn" onClick={() => goToLogin('gage_rr', 'tool')}>{t('gr_pro_login')}</button>}
                      <button type="button" className="tl-xbtn tl-xbtn-pro" onClick={() => goToPricing('gage_rr', 'tool')}>{t('gr_pro_btn')}</button>
                    </div>
                  </div>
                ) : (
                  <>
                    {errorMsg && <div className="tl-error">{errorMsg}</div>}
                    {!r ? (
                      !errorMsg && <div className="tl-card tl-empty">{loading ? t('icmsf_loading') : complete ? t('icmsf_loading') : fill(t('gr_missing'), { n: totalCells - filled, total: totalCells })}</div>
                    ) : (
                      <>
                        <div aria-live="polite">{verdictCards(r, dominant(r))}</div>

                        <div className="tl-kpis tl-kpis-4">
                          <div className="tl-kpi"><span>{t('gr_kpi_grr_tol')}</span><b>{r.pctOfTolerance ? pct(r.pctOfTolerance.GRR) : '—'}</b></div>
                          <div className="tl-kpi"><span>{t('gr_kpi_grr_tv')}</span><b>{pct(tvOf(r).GRR)}</b></div>
                          <div className="tl-kpi"><span>{t('gr_kpi_ev')}</span><b>{pct(tvOf(r).EV)}</b></div>
                          <div className="tl-kpi"><span>{t('gr_kpi_av')}</span><b>{pct(tvOf(r).AV)}</b></div>
                        </div>

                        {r.method === 'average-range' && r.outOfControlRanges.length > 0 && (
                          <div className="tl-chip-warn">{fill(t('gr_ooc'), { n: r.outOfControlRanges.length, list: ltr(r.outOfControlRanges.map(o => `${o.appraiser} / P${o.part}`).join(', ')) })}</div>
                        )}

                        <div className="tl-results-head">
                          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{t('spc_tab_results')}</h2>
                          <ExportRow
                            isPro={isPro}
                            isLoggedIn={isLoggedIn}
                            hasResult={!!r}
                            onCSV={exportCSV}
                            onPNG={() => withEnglishAxes(exportPNG)}
                            onExcel={() => withEnglishAxes(exportExcel)}
                            onPDF={() => withEnglishAxes(exportPDF)}
                            pngLabel={t('gr_x_png')}
                            save={
                              <SaveAnalysisButton
                                theme={theme}
                                tool="gage_rr"
                                defaultName={`Gage R&R — ${new Date().toLocaleDateString('en-US')}`}
                                compact={compactSave}
                                getPayload={() => ({
                                  input_data: { numAppraisers, numTrials, numParts, appraiserNames, measurements, USL, LSL, method },
                                  results: r,
                                })}
                              />
                            }
                          />
                        </div>

                        <div className="tl-chart">
                          <h3>{t('gr_contrib_title')}</h3>
                          <div className="tl-chart-sub">{t('gr_contrib_sub')}</div>
                          <div className="tl-chart-inner" style={{ height: 230 }}>
                            {contribChartData && <Chart ref={contribChartRef} type="bar" data={contribChartData} options={{ ...chartOpts(t('grr_col_pcttotalvar')), plugins: { legend: { display: false } } } as never} />}
                          </div>
                        </div>

                        {r.method === 'average-range' && (
                          <div className="tl-chart">
                            <h3>{t('gr_range_title')} <span style={{ fontWeight: 400, fontSize: 13, color: 'var(--qh-muted)' }}>{ltr(`UCL = ${fmt(r.uclR, 4)}`)}</span></h3>
                            <div className="tl-chart-sub">{t('gr_range_sub')}</div>
                            <div className="tl-chart-inner" style={{ height: 260 }}>
                              {rangeChartData && <Chart ref={rangeChartRef} type="line" data={rangeChartData as never} options={chartOpts(t('grr_axis_range')) as never} />}
                            </div>
                          </div>
                        )}

                        <div className="tl-chart">
                          <h3>{t('gr_xbar_title')}</h3>
                          <div className="tl-chart-sub">{t('gr_xbar_sub')}</div>
                          <div className="tl-chart-inner" style={{ height: 260 }}>
                            {xbarChartData && <Chart ref={xbarChartRef} type="line" data={xbarChartData as never} options={chartOpts(t('grr_axis_avgmeasurement')) as never} />}
                          </div>
                        </div>

                        <details className="tl-more">
                          <summary>{t('gr_more')}</summary>
                          <div className="tl-more-body">
                            <div style={{ overflowX: 'auto' }}>
                              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{t('grr_variation_contribution')}</div>
                              <table className="tl-table">
                                <thead>
                                  <tr>
                                    <th>{t('grr_col_source')}</th>
                                    <th className="num">σ</th>
                                    {r.method === 'anova' && <th className="num">% Contribution</th>}
                                    <th className="num">{t('grr_col_pcttotalvar')}</th>
                                    {r.pctOfTolerance && <th className="num">{t('grr_col_pcttolerance')}</th>}
                                  </tr>
                                </thead>
                                <tbody>
                                  {([['EV', t('grr_row_ev')], ['AV', t('grr_row_av')], ['GRR', t('grr_row_grr')], ['PV', t('grr_row_pv')]] as const).map(([k, label]) => (
                                    <tr key={k}>
                                      <td style={k === 'GRR' ? { fontWeight: 700 } : undefined}>{label}</td>
                                      <td className="num">{ltr(fmt(r[k], 5))}</td>
                                      {r.method === 'anova' && <td className="num">{ltr(pct(r.pctContribution[k], 2))}</td>}
                                      <td className="num">{ltr(pct(tvOf(r)[k], 2))}</td>
                                      {r.pctOfTolerance && <td className="num">{ltr(pct(r.pctOfTolerance[k], 2))}</td>}
                                    </tr>
                                  ))}
                                  <tr>
                                    <td>{t('grr_row_tv')}</td>
                                    <td className="num">{ltr(fmt(r.TV, 5))}</td>
                                    {r.method === 'anova' && <td className="num">100.00%</td>}
                                    <td className="num">100.00%</td>
                                    {r.pctOfTolerance && <td className="num"></td>}
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                            {r.method === 'anova' && (
                              <div style={{ overflowX: 'auto' }}>
                                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{t('grr_anova_title')}</div>
                                <table className="tl-table">
                                  <thead><tr><th>{t('grr_col_source')}</th><th className="num">DF</th><th className="num">SS</th><th className="num">MS</th><th className="num">F</th><th className="num">P</th></tr></thead>
                                  <tbody>
                                    {r.anovaTable.map((row, i) => (
                                      <tr key={i}>
                                        <td>{row.source}</td>
                                        <td className="num">{row.df}</td>
                                        <td className="num">{ltr(row.SS.toFixed(5))}</td>
                                        <td className="num">{ltr(row.MS.toFixed(5))}</td>
                                        <td className="num">{row.F !== null ? ltr(row.F.toFixed(2)) : ''}</td>
                                        <td className="num" style={row.significant ? { color: 'var(--qh-danger)', fontWeight: 700 } : undefined}>{row.p !== null ? ltr(formatPValue(row.p)) : ''}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                                {r.pooled && r.unpooledInteraction?.p !== null && r.unpooledInteraction?.p !== undefined && (
                                  <div className="tl-hint">{t('grr_anova_pooled_note').replace('{p}', formatPValue(r.unpooledInteraction.p)).replace('{alpha}', String(r.poolingAlpha))}</div>
                                )}
                              </div>
                            )}
                            {r.method === 'average-range' && (
                              <div className="tl-hint">{ltr(`R̄ = ${fmt(r.rBar, 4)} · X̄diff = ${fmt(r.xbarDiff, 4)} · Rp = ${fmt(r.rP, 4)} · K1 ${r.constants.K1} · K2 ${r.constants.K2} · K3 ${r.constants.K3} · D4 ${r.constants.D4}`)}</div>
                            )}
                          </div>
                        </details>

                        <details className="tl-more">
                          <summary>{t('gr_method_title')}</summary>
                          <div className="tl-more-body">
                            {(['gr_method_1', 'gr_method_2', 'gr_method_3'] as TKey[]).map(key => <p key={key} style={{ margin: 0, fontSize: 13, lineHeight: 1.7 }}>{t(key).replace('{alpha}', String(POOLING_ALPHA))}</p>)}
                          </div>
                        </details>
                      </>
                    )}
                  </>
                )}
              </section>
            </div>
          </div>
        </div>
      </div>

      <PhoneBar
        showResultActions={mobileTab === 'results' && !!r}
        onAnalyze={() => { setMobileTab('results'); window.scrollTo({ top: 0 }) }}
        onEdit={() => setMobileTab('data')}
        analyzeLabel={t('icmsf_bar_results')}
      />
    </div>
  )
}
