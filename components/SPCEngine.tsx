'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import 'chart.js/auto'
import type { Chart as ChartJSInstance } from 'chart.js'
import { Chart } from 'react-chartjs-2'
import { COLORS, getSharedStyles, usePersistedTheme } from '@/lib/theme'
import Nav from '@/components/Nav'
import SaveAnalysisButton from '@/components/SaveAnalysisButton'
import { useSubscription } from '@/lib/useSubscription'
import { goToLogin, goToPricing } from '@/lib/exportGate'
import { useLanguage } from '@/lib/i18n/context'
import { createReport, nowStamp, type TableColumn } from '@/lib/excelReport'
import {
  createReport as createPdfReport,
  classifyCapability,
  classificationBanner,
  twoColumnTables,
  dataTable,
  capabilityGauge,
  capabilityComparisonPlot,
  interpretationBox,
  calloutBox,
  criteriaReferenceTable,
  addChartImage,
  addChartImagePair,
  finalizeReport,
  REPORT_COLORS,
  type KVRow,
} from '@/lib/pdf/reportDesign'

// ─────────────────────────────────────────────────────────────────────────
// Types — mirror the shape returned by app/api/analyze/route.ts exactly
// ─────────────────────────────────────────────────────────────────────────
type DataType = 'variable' | 'attribute'
type AttrType = 'p' | 'np' | 'c' | 'u'
type SigmaConvention = 'direct' | 'sixsigma'
type DisplayMode = 'capability' | 'benchmark' | 'both'

interface Violation {
  rule: number
  label: string
  points: number[]
  desc: string
}

interface PpmDetail {
  above: number
  below: number
  total: number
}

interface DataAdequacy {
  n: number
  tier: 'low' | 'moderate' | 'adequate'
  label: string
}

interface VariableResult {
  n: number
  mu: number
  sdOverall: number
  min: number
  max: number
  labels: number[]
  xbarVals: number[]
  rangeVals: (number | null)[]
  cl_x: number
  ucl_x: number
  lcl_x: number
  cl_r: number
  ucl_r: number
  lcl_r: number
  sigma: number
  violations_x: Violation[]
  violations_r: Violation[]
  ad: { A2: number; A2adj?: number; p: number; normal: boolean } | null
  isNormal: boolean
  Cp: number | null
  Cpk: number | null
  Pp: number | null
  Ppk: number | null
  Cpm: number | null
  Z_bench_st: number | null
  Z_bench_lt: number | null
  Z_USL_st: number | null
  Z_LSL_st: number | null
  Z_USL_lt: number | null
  Z_LSL_lt: number | null
  sigLvl_st: number | null
  sigLvl_lt: number | null
  ppmD_st: PpmDetail | null
  ppmD_lt: PpmDetail | null
  N: number
  LSL: number | null
  USL: number | null
  dataAdequacy: DataAdequacy
}

interface AttributeResult {
  mode: 'attribute'
  pts: number[]
  clVal: number
  ucl: number
  lcl: number
  labels: number[]
  chartLabel: string
  dpm: number
  sigmaLvl: number
  metric: number
  metricLabel: string
  violations: Violation[]
  dataAdequacy: DataAdequacy
}

type ApiResult = VariableResult | AttributeResult

interface VarRow {
  id: string
  vals: string[]
}

interface AttrRow {
  id: string
  n: string
  defects: string
}

function generateId() {
  return Math.random().toString(36).slice(2, 9)
}

function resizeVals(vals: string[], n: number): string[] {
  const copy = vals.slice(0, n)
  while (copy.length < n) copy.push('')
  return copy
}

function fmt(n: number | null | undefined, digits = 3): string {
  if (n === null || n === undefined || !isFinite(n)) return '—'
  return n.toFixed(digits)
}

// Yield precision — avoid a misleading "100.000%" appearing next to a
// nonzero PPM figure. Once yield rounds to 100.000% at the standard
// 3-decimal precision, switch to 5 decimals so the true shortfall shows.
function formatYieldPct(ppmTotal: number | null): string {
  if (ppmTotal === null || !isFinite(ppmTotal)) return '—'
  const yieldPct = 100 - ppmTotal / 10000
  return yieldPct >= 99.9995 ? `${yieldPct.toFixed(5)}%` : `${yieldPct.toFixed(3)}%`
}

// Capability diagnosis — separates "how much spread" (Cp) from "how well
// centered" (gap between the two one-sided Cpk components) so the report
// can point at the actual lever to pull instead of a single label.
interface CapabilityDiagnosis {
  spreadOk: boolean
  centeringOk: boolean
  nearerLimit: 'LSL' | 'USL' | null
  recommendedAction: string
}

function buildCapabilityDiagnosis(v: VariableResult, stable: boolean): CapabilityDiagnosis | null {
  if (v.LSL === null || v.USL === null || v.Cp === null || v.Cpk === null || v.sigma <= 0) return null

  const cpkLower = (v.mu - v.LSL) / (3 * v.sigma)
  const cpkUpper = (v.USL - v.mu) / (3 * v.sigma)
  const nearerLimit: 'LSL' | 'USL' = cpkLower <= cpkUpper ? 'LSL' : 'USL'
  const spreadOk = v.Cp >= 1.33
  const centeringOk = Math.abs(cpkUpper - cpkLower) < 0.1

  let recommendedAction: string
  if (!stable) {
    recommendedAction =
      'Do not rely on capability indices alone — investigate special-cause variation and confirm the process is in statistical control before acting on Cp/Cpk/Pp/Ppk.'
  } else if (!spreadOk && !centeringOk) {
    recommendedAction = `Both variation reduction and improved centering are needed. The process mean sits closer to the ${nearerLimit}; reducing overall variation alone will not be sufficient.`
  } else if (!spreadOk) {
    recommendedAction =
      'Prioritize reducing process variation — the specification width limits achievable capability even under perfect centering.'
  } else if (!centeringOk) {
    recommendedAction = `Prioritize centering the process away from the ${nearerLimit}; variation is already acceptable relative to the specification width.`
  } else {
    recommendedAction = 'Process capability is acceptable. Continue routine monitoring and control.'
  }

  return { spreadOk, centeringOk, nearerLimit, recommendedAction }
}

// Capability verdict — mirrors capabilityClass/capabilityLabel from spc-tool.html
function capabilityColor(val: number | null): string {
  if (val === null || isNaN(val)) return '#8892a4'
  if (val >= 1.33) return '#4ade80'
  if (val >= 1.0) return '#f59e0b'
  return '#ef4444'
}
function capabilityLabel(val: number | null): string {
  if (val === null || isNaN(val)) return '—'
  if (val >= 1.33) return '✓ Capable'
  if (val >= 1.0) return '⚠ Marginal'
  return '✗ Not Capable'
}
function sigmaColor(sVal: number): string {
  if (sVal >= 6) return '#4ade80'
  if (sVal >= 4) return '#1ea7a7'
  if (sVal >= 3) return '#fbbf24'
  return '#f87171'
}

// Analytical normal PDF/CDF — used client-side to draw the distribution and
// ECDF charts (mirrors createDistChart/createECDFChart in spc-tool.html)
function normalPDF(x: number, mu: number, sigma: number): number {
  return Math.exp(-0.5 * ((x - mu) / sigma) ** 2) / (sigma * Math.sqrt(2 * Math.PI))
}
function normalCDF(z: number): number {
  const a = [0.31938153, -0.356563782, 1.781477937, -1.821255978, 1.330274429]
  const x = Math.abs(z)
  const t = 1 / (1 + 0.2316419 * x)
  const poly = t * (a[0] + t * (a[1] + t * (a[2] + t * (a[3] + t * a[4]))))
  const result = 1 - (poly * Math.exp((-x * x) / 2)) / Math.sqrt(2 * Math.PI)
  return z >= 0 ? result : 1 - result
}

// Rule 1 violations list individual subgroup indices; the other Nelson rules
// return a [start, end] pair describing the run. We expand both shapes into
// a flat set of 1-indexed subgroup numbers so chart points can be highlighted.
function expandViolationPoints(v: Violation): number[] {
  if (v.rule === 1) return v.points
  const [start, end] = v.points
  if (start === undefined || end === undefined) return []
  const out: number[] = []
  for (let i = start; i <= end; i++) out.push(i)
  return out
}

function violatedSet(violations: Violation[]): Set<number> {
  const s = new Set<number>()
  violations.forEach(v => expandViolationPoints(v).forEach(p => s.add(p)))
  return s
}

// ─────────────────────────────────────────────────────────────────────────
// Paste parsing — matches the Ctrl+V behavior of ParetoChart/DPMOCalculator
// ─────────────────────────────────────────────────────────────────────────
function splitLine(line: string): string[] {
  const delimiter = line.includes('\t') ? '\t' : ','
  return line.split(delimiter).map(p => p.trim())
}

function parseVariablePaste(text: string, n: number): VarRow[] {
  const lines = text.trim().split('\n').filter(Boolean)
  const rows: VarRow[] = []
  for (const line of lines) {
    const parts = splitLine(line).filter(p => p !== '' && !isNaN(parseFloat(p)))
    if (parts.length > 0) rows.push({ id: generateId(), vals: resizeVals(parts, n) })
  }
  return rows
}

function parseAttributePaste(text: string, attrType: AttrType): AttrRow[] {
  const lines = text.trim().split('\n').filter(Boolean)
  const rows: AttrRow[] = []
  const needsN = attrType === 'p' || attrType === 'u'
  for (const line of lines) {
    const parts = splitLine(line)
    if (needsN && parts.length >= 2 && !isNaN(parseFloat(parts[0])) && !isNaN(parseFloat(parts[1]))) {
      rows.push({ id: generateId(), n: parts[0], defects: parts[1] })
    } else if (!needsN && parts.length >= 1 && !isNaN(parseFloat(parts[0]))) {
      rows.push({ id: generateId(), n: '', defects: parts[0] })
    }
  }
  return rows
}

export default function SPCEngine() {
  const [theme, setTheme] = usePersistedTheme()
  const { t, lang } = useLanguage()
  const c = COLORS[theme]
  const s = getSharedStyles(theme)
  const { isPro, isLoggedIn } = useSubscription()

  const [dataType, setDataType] = useState<DataType>('variable')
  const [N, setN] = useState(1)
  const [varRows, setVarRows] = useState<VarRow[]>(() =>
    [24.1, 24.3, 23.9, 24.2, 24.6, 24.0, 23.8, 24.4, 24.5, 24.1, 24.0, 24.3, 23.7, 24.2, 24.4].map(v => ({
      id: generateId(),
      vals: [String(v)],
    }))
  )

  const [attrType, setAttrType] = useState<AttrType>('p')
  const [attrRows, setAttrRows] = useState<AttrRow[]>(() =>
    Array.from({ length: 10 }, (_, i) => ({ id: generateId(), n: '100', defects: String(3 + (i % 4)) }))
  )
  const [fixedN, setFixedN] = useState('100')

  const [LSL, setLSL] = useState('')
  const [USL, setUSL] = useState('')
  const [target, setTarget] = useState('')
  const [lastN, setLastN] = useState('')
  const [sigmaConvention, setSigmaConvention] = useState<SigmaConvention>('direct')
  const [displayMode, setDisplayMode] = useState<DisplayMode>('both')

  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [result, setResult] = useState<ApiResult | null>(null)
  const [submittedVals, setSubmittedVals] = useState<number[]>([])
  const [pasteToast, setPasteToast] = useState(false)
  const [loadedProjectName, setLoadedProjectName] = useState('')

  // UX: Advanced options are collapsed by default; Data Entry auto-collapses
  // into a summary bar once a result exists so the charts aren't pushed down.
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [dataEntryOpen, setDataEntryOpen] = useState(true)

  // Chart refs — needed to export each chart as an image
  const iChartRef = useRef<ChartJSInstance<'line'>>(null)
  const rChartRef = useRef<ChartJSInstance<'line'>>(null)
  const distChartRef = useRef<ChartJSInstance<'scatter'>>(null)
  const ecdfChartRef = useRef<ChartJSInstance<'scatter'>>(null)
  const attrChartRef = useRef<ChartJSInstance<'line'>>(null)

  // ── Variable-mode row handlers ──────────────────────────────────────────
  const handleNChange = (newN: number) => {
    const safe = Math.max(1, Math.min(10, newN))
    setN(safe)
    setVarRows(prev => prev.map(r => ({ ...r, vals: resizeVals(r.vals, safe) })))
  }
  const addVarRow = () => setVarRows(prev => [...prev, { id: generateId(), vals: Array(N).fill('') }])
  const removeVarRow = (id: string) => setVarRows(prev => prev.filter(r => r.id !== id))
  const updateVarCell = (id: string, idx: number, val: string) => {
    setVarRows(prev =>
      prev.map(r => (r.id === id ? { ...r, vals: r.vals.map((v, i) => (i === idx ? val : v)) } : r))
    )
  }

  // ── Attribute-mode row handlers ─────────────────────────────────────────
  const addAttrRow = () => setAttrRows(prev => [...prev, { id: generateId(), n: '', defects: '' }])
  const removeAttrRow = (id: string) => setAttrRows(prev => prev.filter(r => r.id !== id))
  const updateAttrCell = (id: string, field: 'n' | 'defects', val: string) => {
    setAttrRows(prev => prev.map(r => (r.id === id ? { ...r, [field]: val } : r)))
  }

  const clearAll = () => {
    if (!window.confirm(t('spc_confirm_clear'))) return
    setResult(null)
    setErrorMsg('')
    setDataEntryOpen(true)
    if (dataType === 'variable') setVarRows([])
    else setAttrRows([])
  }

  // ── Ctrl+V paste support ─────────────────────────────────────────────────
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      const text = e.clipboardData?.getData('text')
      if (!text) return
      if (dataType === 'variable') {
        const parsed = parseVariablePaste(text, N)
        if (parsed.length > 0) {
          e.preventDefault()
          setVarRows(parsed)
          setPasteToast(true)
          setTimeout(() => setPasteToast(false), 2000)
        }
      } else {
        const parsed = parseAttributePaste(text, attrType)
        if (parsed.length > 0) {
          e.preventDefault()
          setAttrRows(parsed)
          setPasteToast(true)
          setTimeout(() => setPasteToast(false), 2000)
        }
      }
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [dataType, N, attrType])

  // ── Load a saved project from the dashboard (?id=...) ──────────────────
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id')
    if (!id) return
    fetch(`/api/saved-analyses/${id}`)
      .then(res => (res.ok ? res.json() : Promise.reject()))
      .then(({ analysis }) => {
        const input = analysis.input_data as {
          dataType: DataType
          varRows: VarRow[]
          attrRows: AttrRow[]
          attrType: AttrType
          fixedN: string
          LSL: string
          USL: string
          target: string
          sigmaConvention: SigmaConvention
        }
        setDataType(input.dataType)
        setVarRows(input.varRows)
        setAttrRows(input.attrRows)
        setAttrType(input.attrType)
        setFixedN(input.fixedN)
        setLSL(input.LSL)
        setUSL(input.USL)
        setTarget(input.target)
        setSigmaConvention(input.sigmaConvention)
        if (input.dataType === 'variable' && input.varRows.length > 0) {
          setN(input.varRows[0].vals.length)
          setSubmittedVals(
            input.varRows
              .map(r => r.vals.map(v => parseFloat(v)))
              .filter(row => row.every(v => !isNaN(v)))
              .flat()
          )
        }
        setResult(analysis.results as ApiResult)
        setDataEntryOpen(false)
        setLoadedProjectName(analysis.name as string)
      })
      .catch(() =>
        setErrorMsg(lang === 'ar' ? 'تعذر تحميل المشروع المحفوظ.' : 'Could not load the saved project.')
      )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Analyze ──────────────────────────────────────────────────────────────
  const analyze = async () => {
    setErrorMsg('')
    setLoading(true)
    setResult(null)
    try {
      let body: Record<string, unknown>
      if (dataType === 'variable') {
        const data = varRows
          .map(r => r.vals.map(v => parseFloat(v)))
          .filter(row => row.every(v => !isNaN(v)) && row.length === N)
        if (data.length < 3) {
          setErrorMsg(t('spc_err_min3rows'))
          setLoading(false)
          return
        }
        setSubmittedVals(data.flat())
        body = {
          data,
          N,
          LSL: LSL !== '' ? parseFloat(LSL) : null,
          USL: USL !== '' ? parseFloat(USL) : null,
          target: target !== '' ? parseFloat(target) : null,
          sigmaConvention,
          lastN: lastN !== '' ? parseInt(lastN, 10) : 0,
        }
      } else {
        const needsN = attrType === 'p' || attrType === 'u'
        const data = attrRows
          .map(r =>
            needsN ? [parseFloat(r.n), parseFloat(r.defects)] : [parseFloat(r.defects)]
          )
          .filter(row => row.every(v => !isNaN(v)))
        if (data.length < 5) {
          setErrorMsg(t('spc_err_min5rows'))
          setLoading(false)
          return
        }
        body = {
          mode: 'attribute',
          data,
          attrType,
          fixedN: fixedN !== '' ? parseInt(fixedN, 10) : 100,
          sigmaConvention,
        }
      }
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) {
        setErrorMsg(json.error || t('spc_err_calc_failed'))
      } else {
        setResult(json)
        setDataEntryOpen(false)
      }
    } catch {
      setErrorMsg(t('spc_err_network'))
    } finally {
      setLoading(false)
    }
  }

  // ── Export: raw data + key stats as CSV ── (free, requires login — same as other tools)
  const exportCSV = () => {
    if (!isLoggedIn) { goToLogin('spc', 'csv'); return }

    let csv = ''

    if (dataType === 'variable' && varResult) {
      const header = ['Subgroup', ...Array.from({ length: N }, (_, i) => `x${i + 1}`), 'Mean', 'Range'].join(',')
      const rows = varRows.map((row, i) => {
        const nums = row.vals.map(v => parseFloat(v)).filter(v => !isNaN(v))
        const mean = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : ''
        const range = nums.length ? Math.max(...nums) - Math.min(...nums) : ''
        return [i + 1, ...row.vals, mean, range].join(',')
      })
      csv = [header, ...rows].join('\n')

      csv += '\n\nSummary,\n'
      csv += `Mean (μ),${fmt(varResult.mu, 4)}\n`
      csv += `Within Sigma,${fmt(varResult.sigma, 4)}\n`
      csv += `${varResult.N === 1 ? 'Individuals (X)' : 'X̄'} CL,${fmt(varResult.cl_x, 4)}\n`
      csv += `${varResult.N === 1 ? 'Individuals (X)' : 'X̄'} UCL,${fmt(varResult.ucl_x, 4)}\n`
      csv += `${varResult.N === 1 ? 'Individuals (X)' : 'X̄'} LCL,${fmt(varResult.lcl_x, 4)}\n`
      csv += `${varResult.N === 1 ? 'MR̄' : 'R̄'} CL,${fmt(varResult.cl_r, 4)}\n`
      csv += `${varResult.N === 1 ? 'MR̄' : 'R̄'} UCL,${fmt(varResult.ucl_r, 4)}\n`
      csv += `${varResult.N === 1 ? 'MR̄' : 'R̄'} LCL,${fmt(Math.max(0, varResult.lcl_r), 4)}\n`
      if (hasSpecLimits) {
        csv += `Cp,${fmt(varResult.Cp, 2)}\n`
        csv += `Cpk,${fmt(varResult.Cpk, 2)}\n`
        csv += `Pp,${fmt(varResult.Pp, 2)}\n`
        csv += `Ppk,${fmt(varResult.Ppk, 2)}\n`
        csv += `Sigma Level (ST),${fmt(varResult.sigLvl_st, 2)}\n`
        csv += `Sigma Level (LT),${fmt(varResult.sigLvl_lt, 2)}\n`
      }
    } else if (dataType === 'attribute' && attrResult) {
      const header = ['Subgroup', 'n', 'Defects', attrResult.metricLabel].join(',')
      const rows = attrRows.map((row, i) => [i + 1, row.n, row.defects, fmt(attrResult.pts[i], 4)].join(','))
      csv = [header, ...rows].join('\n')

      csv += '\n\nSummary,\n'
      csv += `Chart Type,${attrResult.chartLabel}\n`
      csv += `CL,${fmt(attrResult.clVal, 4)}\n`
      csv += `UCL,${fmt(attrResult.ucl, 4)}\n`
      csv += `LCL,${fmt(Math.max(0, attrResult.lcl), 4)}\n`
      csv += `DPM,${fmt(attrResult.dpm, 1)}\n`
      csv += `Sigma Level,${fmt(attrResult.sigmaLvl, 2)}\n`
    } else {
      return
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'spc-data.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Export: Data + Stats as a professional Excel workbook ── (Pro only)
  const exportExcel = async () => {
    if (!isPro) { goToPricing('spc', 'excel'); return }
    const report = createReport({ toolName: 'SPC Engine' })

    // ── Sheet 1: Overview — KPI cards + chart limits + capability summary ──
    const overview = report.addSheet('Overview')
    overview.titleBand(
      'Statistical Process Control Report',
      dataType === 'variable' ? 'Variable (Continuous) Data — Control Chart Analysis' : 'Attribute Data — Control Chart Analysis'
    )
    overview.metaStrip([
      ['Generated on', nowStamp()],
      ['Data type', dataType === 'variable' ? `Variable — subgroup size n = ${N}` : `Attribute — ${attrType.toUpperCase()} chart`],
      ['Standard', 'Nelson Rules (Western Electric derivative), AIAG SPC'],
    ])

    if (varResult) {
      const chartWord = varResult.N === 1 ? 'Individuals (X)' : 'X̄'
      const clWord = varResult.N === 1 ? 'MR̄' : 'R̄'

      overview.sectionHeading('Process Summary')
      overview.kpiRow([
        { label: 'Data Points', value: varResult.n, tone: 'neutral' },
        { label: 'Mean (μ)', value: fmt(varResult.mu, 4), tone: 'accent' },
        { label: 'Within σ', value: fmt(varResult.sigma, 4), tone: 'accent' },
        { label: 'Normality', value: varResult.isNormal ? 'Normal' : 'Non-Normal', tone: varResult.isNormal ? 'good' : 'warning' },
      ])

      if (hasSpecLimits) {
        overview.sectionHeading('Process Capability')
        overview.kpiRow([
          { label: 'Cp', value: fmt(varResult.Cp, 2), sub: 'Potential', tone: varResult.Cp !== null ? (varResult.Cp >= 1.33 ? 'good' : varResult.Cp >= 1 ? 'warning' : 'danger') : 'neutral' },
          { label: 'Cpk', value: fmt(varResult.Cpk, 2), sub: 'Actual', tone: varResult.Cpk !== null ? (varResult.Cpk >= 1.33 ? 'good' : varResult.Cpk >= 1 ? 'warning' : 'danger') : 'neutral' },
          { label: 'Pp', value: fmt(varResult.Pp, 2), sub: 'Overall potential', tone: 'neutral' },
          { label: 'Ppk', value: fmt(varResult.Ppk, 2), sub: 'Overall actual', tone: 'neutral' },
        ])
        overview.spacer(1)
        overview.kpiRow([
          { label: 'Sigma Level (ST)', value: fmt(varResult.sigLvl_st, 2), tone: 'accent' },
          { label: 'Sigma Level (LT)', value: fmt(varResult.sigLvl_lt, 2), sub: 'incl. 1.5σ shift', tone: 'accent' },
          { label: 'Total PPM (ST)', value: varResult.ppmD_st ? Math.round(varResult.ppmD_st.total) : '—', tone: 'neutral' },
          { label: 'Total PPM (LT)', value: varResult.ppmD_lt ? Math.round(varResult.ppmD_lt.total) : '—', tone: 'neutral' },
        ])
      }

      overview.sectionHeading('Control Limits')
      overview.table({
        title: undefined,
        headers: [
          { header: 'Chart', key: 'chart', align: 'left', width: 22 },
          { header: 'CL', key: 'cl', align: 'right' },
          { header: 'UCL', key: 'ucl', align: 'right' },
          { header: 'LCL', key: 'lcl', align: 'right' },
        ],
        rows: [
          [chartWord, fmt(varResult.cl_x, 4), fmt(varResult.ucl_x, 4), fmt(varResult.lcl_x, 4)],
          [clWord, fmt(varResult.cl_r, 4), fmt(varResult.ucl_r, 4), fmt(Math.max(0, varResult.lcl_r), 4)],
        ],
      })

      if (hasSpecLimits) {
        overview.sectionHeading('Specification Limits & PPM')
        overview.table({
          headers: [
            { header: 'Metric', key: 'metric', align: 'left', width: 26 },
            { header: 'Value', key: 'value', align: 'right' },
          ],
          rows: [
            ['LSL', varResult.LSL ?? '—'],
            ['USL', varResult.USL ?? '—'],
            ['Cpm', fmt(varResult.Cpm, 3)],
            ['Z-bench (Short-term)', fmt(varResult.Z_bench_st, 3)],
            ['Z-bench (Long-term)', fmt(varResult.Z_bench_lt, 3)],
            ['PPM Above USL (Short-term)', varResult.ppmD_st ? Math.round(varResult.ppmD_st.above) : '—'],
            ['PPM Below LSL (Short-term)', varResult.ppmD_st ? Math.round(varResult.ppmD_st.below) : '—'],
            ['PPM Above USL (Long-term)', varResult.ppmD_lt ? Math.round(varResult.ppmD_lt.above) : '—'],
            ['PPM Below LSL (Long-term)', varResult.ppmD_lt ? Math.round(varResult.ppmD_lt.below) : '—'],
          ],
        })
      }

      overview.sectionHeading('Normality Test (Anderson-Darling)')
      overview.table({
        headers: [
          { header: 'Statistic', key: 'k', align: 'left', width: 26 },
          { header: 'Value', key: 'v', align: 'right' },
        ],
        rows: [
          ['A² (adjusted)', fmt(varResult.ad?.A2adj ?? varResult.ad?.A2, 4)],
          ['p-value', fmt(varResult.ad?.p, 4)],
          ['Conclusion', varResult.isNormal ? 'Fail to reject normality (p ≥ 0.05)' : 'Reject normality (p < 0.05)'],
        ],
        rowTones: [undefined, undefined, varResult.isNormal ? 'good' : 'warning'],
      })

      overview.note(
        `Data adequacy: ${varResult.dataAdequacy.label} (n = ${varResult.dataAdequacy.n}). ` +
        (varResult.dataAdequacy.tier === 'low'
          ? 'Consider collecting more subgroups before drawing firm capability conclusions.'
          : 'Sample size is sufficient for the reported statistics.'),
        varResult.dataAdequacy.tier === 'low' ? 'warning' : 'good'
      )
    } else if (attrResult) {
      overview.sectionHeading('Process Summary')
      overview.kpiRow([
        { label: 'Chart Type', value: attrResult.chartLabel, tone: 'accent' },
        { label: 'Subgroups', value: attrResult.pts.length, tone: 'neutral' },
        { label: attrResult.metricLabel, value: fmt(attrResult.metric, 4), tone: 'accent' },
        { label: 'Sigma Level', value: fmt(attrResult.sigmaLvl, 2), tone: attrResult.sigmaLvl >= 4 ? 'good' : attrResult.sigmaLvl >= 3 ? 'warning' : 'danger' },
      ])
      overview.sectionHeading('Control Limits')
      overview.table({
        headers: [
          { header: 'Metric', key: 'k', align: 'left', width: 24 },
          { header: 'Value', key: 'v', align: 'right' },
        ],
        rows: [
          ['CL', fmt(attrResult.clVal, 4)],
          ['UCL', fmt(attrResult.ucl, 4)],
          ['LCL', fmt(Math.max(0, attrResult.lcl), 4)],
          ['DPM (Defects per Million)', fmt(attrResult.dpm, 1)],
        ],
      })
      overview.note(
        `Data adequacy: ${attrResult.dataAdequacy.label} (n = ${attrResult.dataAdequacy.n}).`,
        attrResult.dataAdequacy.tier === 'low' ? 'warning' : 'good'
      )
    }
    overview.freezeHeader(2)

    // ── Sheet 2: Raw Data ──
    const dataSheet = report.addSheet('Raw Data')
    dataSheet.titleBand('Raw Data', 'As entered / pasted into the tool')
    if (dataType === 'variable') {
      const cols: TableColumn[] = [
        { header: 'Subgroup', key: 'subgroup', align: 'center', width: 12 },
        ...Array.from({ length: N }, (_, j) => ({
          header: N === 1 ? 'Value' : `x${j + 1}`,
          key: `x${j}`,
          align: 'right' as const,
          numFmt: '0.0000',
        })),
      ]
      const rows = varRows.map((r, i) => {
        const row: Record<string, string | number> = { subgroup: i + 1 }
        r.vals.forEach((v, j) => { row[`x${j}`] = v === '' ? '' : parseFloat(v) })
        return row
      })
      dataSheet.table({ headers: cols, rows })
    } else {
      const needsN = attrType === 'p' || attrType === 'u'
      const cols: TableColumn[] = [
        { header: 'Row', key: 'row', align: 'center', width: 10 },
        ...(needsN ? [{ header: 'Sample Size (n)', key: 'n', align: 'right' as const }] : []),
        { header: 'Defects', key: 'defects', align: 'right' },
      ]
      const rows = attrRows.map((r, i) => {
        const row: Record<string, string | number> = { row: i + 1 }
        if (needsN) row['n'] = r.n === '' ? '' : parseFloat(r.n)
        row['defects'] = r.defects === '' ? '' : parseFloat(r.defects)
        return row
      })
      dataSheet.table({ headers: cols, rows })
    }
    dataSheet.freezeHeader(2)

    // ── Sheet 3: Nelson Rule Violations (only if any) ──
    if (allViolations.length > 0) {
      const violSheet = report.addSheet('Nelson Violations')
      violSheet.titleBand('Nelson Rule Violations', `${allViolations.length} violation(s) detected across all charts`)
      violSheet.table({
        headers: [
          { header: 'Chart', key: 'chart', align: 'left', width: 16 },
          { header: 'Rule #', key: 'rule', align: 'center', width: 10 },
          { header: 'Test', key: 'test', align: 'left', width: 26 },
          { header: 'Description', key: 'desc', align: 'left', width: 44 },
          { header: 'Points', key: 'points', align: 'left', width: 22 },
        ],
        rows: allViolations.map(v => [v.chart, v.rule, v.label, v.desc, expandViolationPoints(v).join(', ')]),
        rowTones: allViolations.map(() => 'danger'),
      })
      violSheet.freezeHeader(2)
    }

    await report.download('spc-report.xlsx')
  }

  // ── Export: charts as PNG ────────────────────────────────────────────────
  const downloadChartImage = (chart: ChartJSInstance<'line'> | ChartJSInstance<'scatter'> | null, filename: string): boolean => {
    if (!chart) return false
    const url = chart.toBase64Image('image/png', 1)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    return true
  }

  const exportPNG = () => {
    if (!isLoggedIn) { goToLogin('spc', 'png'); return }
    const exportedAny = [
      downloadChartImage(iChartRef.current, 'spc-control-chart.png'),
      downloadChartImage(rChartRef.current, 'spc-range-chart.png'),
      downloadChartImage(distChartRef.current, 'spc-distribution-chart.png'),
      downloadChartImage(ecdfChartRef.current, 'spc-ecdf-chart.png'),
      downloadChartImage(attrChartRef.current, 'spc-attribute-chart.png'),
    ].some(Boolean)
    if (!exportedAny) setErrorMsg(t('spc_err_no_charts'))
  }

  // ── Export: full report as PDF ── (Pro only)
  const exportPDF = () => {
    if (!isPro) { goToPricing('spc', 'pdf'); return }
    if (!result) {
      setErrorMsg(t('spc_err_no_report'))
      return
    }

    const ctx = createPdfReport('SPC Analysis Report', 'spc')
    const cls = varResult && hasSpecLimits ? classifyCapability(pkVal) : null

    if (cls) {
      classificationBanner(ctx, cls)
    } else if (varResult) {
      calloutBox(
        ctx,
        'No specification limits were provided — capability indices (Cp/Cpk/Pp/Ppk) are not applicable. Statistical control and stability are assessed below instead.',
        'info'
      )
    }

    if (varResult) {
      const dataTypeLabel = varResult.N === 1 ? 'Individual measurements' : `Subgrouped measurements (n=${varResult.N})`
      const withinMethod = varResult.N === 1 ? 'Average moving range / d2' : 'Average range / d2 (X̄-R)'

      const studyRows: KVRow[] = [
        ['Data Type', dataTypeLabel],
        ['Observations', String(varResult.labels.length)],
        ['Subgroup Size', String(varResult.N)],
        ['Within Sigma Method', withinMethod],
        ['LSL', varResult.LSL !== null ? fmt(varResult.LSL, 3) : '—'],
        ['Target', target !== '' ? fmt(parseFloat(target), 3) : '—'],
        ['USL', varResult.USL !== null ? fmt(varResult.USL, 3) : '—'],
      ]

      const metricRows: KVRow[] = [
        ['Mean', fmt(varResult.mu)],
        ['StDev Within', fmt(varResult.sigma)],
        ['StDev Overall', fmt(varResult.sdOverall)],
        ['Cp', fmt(varResult.Cp)],
        ['Cpk', fmt(varResult.Cpk)],
        ['Pp', fmt(varResult.Pp)],
        ['Ppk', fmt(varResult.Ppk)],
        ['Sigma Level (Overall)', varResult.sigLvl_lt !== null ? `${fmt(varResult.sigLvl_lt)} σ` : '—'],
      ]

      twoColumnTables(ctx, 'Study Information', studyRows, 'Key Metrics', metricRows)

      calloutBox(
        ctx,
        `Data adequacy: ${varResult.dataAdequacy.label} (n = ${varResult.dataAdequacy.n}). ` +
          (varResult.dataAdequacy.tier === 'low'
            ? 'Treat capability and stability conclusions with proportionally lower confidence until more data is collected.'
            : varResult.dataAdequacy.tier === 'moderate'
            ? 'Sample size gives moderate confidence — consider collecting more data before high-stakes decisions.'
            : 'Sample size is sufficient for the reported statistics.'),
        varResult.dataAdequacy.tier === 'low' ? 'bad' : varResult.dataAdequacy.tier === 'moderate' ? 'warn' : 'good'
      )

      if (cls && pkVal !== null) {
        const cpkCls = classifyCapability(varResult.Cpk)
        const ppkCls = classifyCapability(varResult.Ppk)
        const stable = allViolations.length === 0
        const usingCpk = varResult.Cpk !== null
        const primaryLabel = usingCpk ? 'Primary Capability Index' : 'Primary Performance Indicator'
        dataTable(
          ctx,
          'Capability Classification Summary',
          [
            { header: 'CRITERION', width: 150 },
            { header: 'RESULT', width: 190 },
            { header: 'ASSESSMENT', width: ctx.pageWidth - ctx.margin * 2 - 340 },
          ],
          [
            [primaryLabel, fmt(pkVal), cls.label],
            ['Within Capability', `Cp ${fmt(varResult.Cp)} / Cpk ${fmt(varResult.Cpk)}`, cpkCls.label],
            ['Overall Performance', `Pp ${fmt(varResult.Pp)} / Ppk ${fmt(varResult.Ppk)}`, ppkCls.label],
            [
              'Stability Screen',
              stable ? 'No violations detected' : `${allViolations.length} rule violation(s)`,
              stable ? 'No Stability Signals Detected' : 'Review Required',
            ],
          ],
          {
            cellColors: [
              [null, null, cls.color],
              [null, null, cpkCls.color],
              [null, null, ppkCls.color],
              [null, null, stable ? REPORT_COLORS.good : REPORT_COLORS.warn],
            ],
          }
        )

        calloutBox(
          ctx,
          usingCpk
            ? 'Cpk is used as the primary capability index because the normality assumption was not rejected.'
            : 'Cpk is not reported because the normality assumption was rejected. Ppk is shown to provide a performance-based assessment using the overall variation observed in the study data.',
          'info'
        )

        capabilityGauge(ctx, {
          title: usingCpk ? 'Capability Classification Gauge' : 'Performance Classification Gauge',
          value: pkVal,
          caption: `${primaryLabel} = ${fmt(pkVal)}`,
        })
      }

      // Process Stability Assessment
      addChartImagePair(
        ctx,
        'Process Stability Assessment',
        { chart: iChartRef.current, title: varResult.N === 1 ? 'Individuals (I) Chart' : 'X̄ Chart' },
        { chart: rChartRef.current, title: varResult.N === 1 ? 'Moving Range (MR) Chart' : 'Range (R) Chart' }
      )
      calloutBox(
        ctx,
        allViolations.length === 0
          ? 'No basic Nelson Rule signal was detected in the displayed charts. Continue to review patterns, subgrouping, and practical process knowledge.'
          : `${allViolations.length} Nelson Rule violation(s) were detected in the displayed charts — see the detailed table below.`,
        allViolations.length === 0 ? 'good' : 'warn'
      )

      dataTable(
        ctx,
        'Normality Test (Anderson-Darling)',
        [
          { header: 'STATISTIC', width: 200 },
          { header: 'VALUE', width: ctx.pageWidth - ctx.margin * 2 - 200 },
        ],
        [
          ['N', String(varResult.n)],
          ['Mean', fmt(varResult.mu)],
          ['StDev', fmt(varResult.sdOverall)],
          ['AD (A²)', fmt(varResult.ad?.A2adj ?? varResult.ad?.A2, 3)],
          ['P-Value', fmt(varResult.ad?.p, 3)],
          ['Conclusion', varResult.isNormal ? 'Fail to reject normality (p ≥ 0.05)' : 'Reject normality (p < 0.05)'],
        ],
        {
          cellColors: [
            [null, null],
            [null, null],
            [null, null],
            [null, null],
            [null, null],
            [null, varResult.isNormal ? REPORT_COLORS.good : REPORT_COLORS.warn],
          ],
        }
      )
      calloutBox(
        ctx,
        varResult.isNormal
          ? 'The normal distribution assumption is not rejected at the 0.05 level. Capability indices and PPM estimates in this report assume normality.'
          : 'The normal distribution assumption is rejected at the 0.05 level (p < 0.05). Cpk is therefore not reported in this analysis; Ppk is shown instead as a performance indicator based on overall variation. The PPM estimates below still assume a normal distribution and should be interpreted with caution — consider a distribution fit or transformation for a non-normal process.',
        varResult.isNormal ? 'good' : 'warn'
      )

      if (cls) {
        addChartImagePair(
          ctx,
          'Distribution and Capability Evidence',
          { chart: distChartRef.current, title: 'Capability Histogram' },
          { chart: ecdfChartRef.current, title: 'Empirical CDF vs. Normal' }
        )

        capabilityComparisonPlot(ctx, 'Capability Plot', {
          lsl: varResult.LSL,
          usl: varResult.USL,
          mean: varResult.mu,
          sigmaWithin: varResult.sigma,
          sigmaOverall: varResult.sdOverall,
          withinStats: [
            ['StDev', fmt(varResult.sigma)],
            ['Cp', fmt(varResult.Cp)],
            ['Cpk', fmt(varResult.Cpk)],
            ['PPM', varResult.ppmD_st ? varResult.ppmD_st.total.toFixed(1) : '—'],
          ],
          overallStats: [
            ['StDev', fmt(varResult.sdOverall)],
            ['Pp', fmt(varResult.Pp)],
            ['Ppk', fmt(varResult.Ppk)],
            ['PPM', varResult.ppmD_lt ? varResult.ppmD_lt.total.toFixed(1) : '—'],
          ],
        })

        dataTable(
          ctx,
          'Performance and Defect Risk',
          [
            { header: 'PPM ESTIMATE', width: 260 },
            { header: 'VALUE', width: ctx.pageWidth - ctx.margin * 2 - 260 },
          ],
          [
            ['Within - Below LSL', varResult.ppmD_st ? varResult.ppmD_st.below.toFixed(1) : '—'],
            ['Within - Above USL', varResult.ppmD_st ? varResult.ppmD_st.above.toFixed(1) : '—'],
            ['Within - Total PPM', varResult.ppmD_st ? varResult.ppmD_st.total.toFixed(1) : '—'],
            ['Overall - Below LSL', varResult.ppmD_lt ? varResult.ppmD_lt.below.toFixed(1) : '—'],
            ['Overall - Above USL', varResult.ppmD_lt ? varResult.ppmD_lt.above.toFixed(1) : '—'],
            ['Overall - Total PPM', varResult.ppmD_lt ? varResult.ppmD_lt.total.toFixed(1) : '—'],
            ['Estimated Yield (Overall)', formatYieldPct(varResult.ppmD_lt ? varResult.ppmD_lt.total : null)],
          ]
        )

        calloutBox(
          ctx,
          'Within PPM is based on within-process variation estimated from moving ranges, while Overall PPM is based on the total variation observed in the study data. The two estimates use different sigma values and may differ — this is expected and is not a check on each other.',
          'info'
        )

        const diagnosis = buildCapabilityDiagnosis(varResult, allViolations.length === 0)
        if (diagnosis) {
          dataTable(
            ctx,
            'Capability Diagnosis',
            [
              { header: 'DIMENSION', width: 150 },
              { header: 'RESULT', width: 150 },
              { header: 'ASSESSMENT', width: ctx.pageWidth - ctx.margin * 2 - 300 },
            ],
            [
              [
                'Process Spread',
                `Cp = ${fmt(varResult.Cp)}`,
                diagnosis.spreadOk
                  ? 'Spread is acceptable relative to specification width.'
                  : 'Spread is limited relative to specification width — variation reduction is needed.',
              ],
              [
                'Process Centering',
                diagnosis.nearerLimit ? `Closer to ${diagnosis.nearerLimit}` : '—',
                diagnosis.centeringOk
                  ? 'Process is reasonably centered between specification limits.'
                  : `Process mean is closer to the ${diagnosis.nearerLimit} than to the opposite limit — this is the main driver of the lower index.`,
              ],
            ],
            {
              cellColors: [
                [null, null, diagnosis.spreadOk ? REPORT_COLORS.good : REPORT_COLORS.warn],
                [null, null, diagnosis.centeringOk ? REPORT_COLORS.good : REPORT_COLORS.warn],
              ],
            }
          )
          interpretationBox(
            ctx,
            'Recommended Action',
            diagnosis.recommendedAction,
            allViolations.length > 0 ? 'bad' : diagnosis.spreadOk && diagnosis.centeringOk ? 'good' : 'warn'
          )
        }
      }
    } else if (attrResult) {
      calloutBox(
        ctx,
        `${attrResult.chartLabel} · Subgroups=${attrResult.pts.length} · ${attrResult.metricLabel}=${fmt(attrResult.metric, 4)} · DPM=${Math.round(attrResult.dpm)} · Sigma=${isFinite(attrResult.sigmaLvl) ? fmt(attrResult.sigmaLvl) : '6.00+'}`,
        'info'
      )
      addChartImage(ctx, attrChartRef.current, attrResult.chartLabel)
      calloutBox(
        ctx,
        allViolations.length === 0
          ? 'No basic Nelson Rule signal was detected in the displayed chart.'
          : `${allViolations.length} Nelson Rule violation(s) were detected — see the detailed table below.`,
        allViolations.length === 0 ? 'good' : 'warn'
      )
    }

    if (allViolations.length > 0) {
      dataTable(
        ctx,
        'Nelson Rule Violations',
        [
          { header: 'RULE', width: 40 },
          { header: 'TEST', width: 180 },
          { header: 'CHART', width: 120 },
          { header: 'POINTS', width: ctx.pageWidth - ctx.margin * 2 - 340 },
        ],
        allViolations.map(v => [String(v.rule), v.label, v.chart, expandViolationPoints(v).join(', ')])
      )
    }

    if (cls && varResult) {
      const yieldStr = varResult.ppmD_lt ? formatYieldPct(varResult.ppmD_lt.total) : null
      const tone = pkVal === null ? 'info' : pkVal >= 1.33 ? 'good' : pkVal >= 1.0 ? 'warn' : 'bad'
      const usingCpkInConclusion = varResult.Cpk !== null
      const basisSentence = usingCpkInConclusion
        ? `The process is classified as ${cls.label} based on Cpk, the primary capability index for this analysis, since the normality assumption was not rejected. Cpk is ${fmt(varResult.Cpk)} and Ppk is ${fmt(varResult.Ppk)}.`
        : `The process is classified as ${cls.label} based on Ppk, the primary performance indicator for this analysis. Because the normality assumption was rejected, Cpk is not reported. Ppk is ${fmt(varResult.Ppk)}.`
      const conclusion = `${basisSentence}${
        yieldStr ? ` The estimated overall nonconformance rate is ${varResult.ppmD_lt!.total.toFixed(1)} PPM, corresponding to an estimated yield of ${yieldStr}.` : ''
      } Final capability decisions should consider process stability, distribution fit, subgrouping strategy, specification validity, customer requirements, and risk associated with the product or process characteristic.`
      interpretationBox(ctx, 'Study Conclusion', conclusion, tone)
      criteriaReferenceTable(ctx)
    }

    finalizeReport(ctx)
    ctx.pdf.save('spc-report.pdf')
  }

  // ── Chart builders ──────────────────────────────────────────────────────
  const lineChartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          labels: { color: c.muted, font: { size: 11 }, boxWidth: 14, filter: (item: { text: string }) => !['CL', 'MR̄', 'R̄'].includes(item.text) },
        },
        tooltip: {
          backgroundColor: c.surface,
          borderColor: c.border,
          borderWidth: 1,
          titleColor: c.text,
          bodyColor: c.muted,
          padding: 10,
        },
      },
      scales: {
        x: {
          ticks: { color: c.muted, font: { size: 11 } },
          grid: { display: false },
          border: { color: c.border },
          title: { display: true, text: 'Subgroup #', color: c.muted, font: { size: 11 } },
        },
        y: {
          ticks: { color: c.muted, font: { size: 11 } },
          grid: { color: c.grid },
          border: { color: c.border },
        },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any),
    [c]
  )

  function buildControlChart(labels: number[], values: number[], ucl: number, cl: number, lcl: number, violated: Set<number>, label: string, clLabel = 'CL') {
    return {
      labels,
      datasets: [
        {
          label,
          data: values,
          borderColor: c.accent,
          backgroundColor: c.accent,
          pointBackgroundColor: labels.map(n => (violated.has(n) ? c.danger : c.accent)),
          pointRadius: 4,
          pointHoverRadius: 5,
          borderWidth: 2,
          tension: 0.15,
        },
        { label: 'UCL', data: Array(labels.length).fill(ucl), borderColor: c.danger, borderWidth: 1.5, borderDash: [5, 4], pointRadius: 0, fill: false, tension: 0 },
        { label: clLabel, data: Array(labels.length).fill(cl), borderColor: c.muted, borderWidth: 1, borderDash: [2, 2], pointRadius: 0, fill: false, tension: 0 },
        { label: 'LCL', data: Array(labels.length).fill(lcl), borderColor: c.danger, borderWidth: 1.5, borderDash: [5, 4], pointRadius: 0, fill: false, tension: 0 },
      ],
    }
  }

  // Linear-x-axis options, shared by the distribution and ECDF charts
  const linearChartOptions = useMemo(
    () => (yPercent: boolean) => ({
      responsive: true,
      maintainAspectRatio: false,
      parsing: false,
      plugins: {
        legend: { display: true, labels: { color: c.muted, font: { size: 10 }, boxWidth: 12 } },
        tooltip: {
          backgroundColor: c.surface,
          borderColor: c.border,
          borderWidth: 1,
          titleColor: c.text,
          bodyColor: c.muted,
          padding: 10,
        },
      },
      scales: {
        x: {
          type: 'linear',
          ticks: { color: c.muted, font: { size: 10 } },
          grid: { color: c.grid },
          border: { color: c.border },
        },
        y: yPercent
          ? {
              min: 0,
              max: 1,
              ticks: { color: c.muted, font: { size: 10 }, callback: (v: number) => `${Math.round(Number(v) * 100)}%` },
              grid: { color: c.grid },
              border: { color: c.border },
            }
          : {
              ticks: { color: c.muted, font: { size: 10 } },
              grid: { color: c.grid },
              border: { color: c.border },
            },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any),
    [c]
  )

  // Distribution vs. Specification Limits — mirrors createDistChart()
  function buildDistChart(vals: number[], mu: number, sigma: number, lsl: number | null, usl: number | null) {
    const dataMin = Math.min(...vals, lsl ?? Infinity, usl ?? Infinity) - 3 * sigma
    const dataMax = Math.max(...vals, lsl ?? -Infinity, usl ?? -Infinity) + 3 * sigma
    const steps = 120
    const dx = (dataMax - dataMin) / steps
    const xs = Array.from({ length: steps + 1 }, (_, i) => dataMin + i * dx)
    const ys = xs.map(x => normalPDF(x, mu, sigma))
    const yMax = Math.max(...ys)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const datasets: any[] = [
      {
        label: 'Distribution',
        data: xs.map((x, i) => ({ x, y: ys[i] })),
        borderColor: c.accent,
        backgroundColor: `${c.accent}33`,
        borderWidth: 2,
        pointRadius: 0,
        fill: 'origin',
        tension: 0.4,
        showLine: true,
      },
      {
        label: 'μ',
        data: [{ x: mu, y: 0 }, { x: mu, y: yMax * 1.05 }],
        borderColor: c.muted,
        borderWidth: 1.5,
        borderDash: [3, 2],
        pointRadius: 0,
        fill: false,
        showLine: true,
      },
    ]
    if (lsl !== null)
      datasets.push({ label: 'LSL', data: [{ x: lsl, y: 0 }, { x: lsl, y: yMax * 1.1 }], borderColor: c.danger, borderWidth: 2, borderDash: [4, 3], pointRadius: 0, fill: false, showLine: true })
    if (usl !== null)
      datasets.push({ label: 'USL', data: [{ x: usl, y: 0 }, { x: usl, y: yMax * 1.1 }], borderColor: c.danger, borderWidth: 2, borderDash: [4, 3], pointRadius: 0, fill: false, showLine: true })
    return { datasets }
  }

  // Empirical CDF vs. Normal CDF — mirrors createECDFChart()
  function buildEcdfChart(vals: number[], mu: number, sigma: number, lsl: number | null, usl: number | null) {
    const sorted = [...vals].sort((a, b) => a - b)
    const n = sorted.length
    const ecdf = sorted.map((x, i) => ({ x, y: (i + 1) / n }))
    const xMin = sorted[0] - 2 * sigma
    const xMax = sorted[n - 1] + 2 * sigma
    const steps = 200
    const dx = (xMax - xMin) / steps
    const normPts = Array.from({ length: steps + 1 }, (_, i) => {
      const x = xMin + i * dx
      return { x, y: normalCDF((x - mu) / sigma) }
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const datasets: any[] = [
      { label: 'Normal CDF', data: normPts, borderColor: c.muted, borderWidth: 1.5, borderDash: [4, 3], pointRadius: 0, fill: false, showLine: true },
      { label: 'Empirical CDF', data: ecdf, backgroundColor: c.accent, borderColor: c.accent, pointRadius: 4, pointHoverRadius: 6, showLine: true, stepped: true, borderWidth: 1.5, fill: false },
    ]
    if (lsl !== null) datasets.push({ label: 'LSL', data: [{ x: lsl, y: 0 }, { x: lsl, y: 1 }], borderColor: c.danger, borderWidth: 1.5, borderDash: [4, 3], pointRadius: 0, fill: false, showLine: true })
    if (usl !== null) datasets.push({ label: 'USL', data: [{ x: usl, y: 0 }, { x: usl, y: 1 }], borderColor: c.danger, borderWidth: 1.5, borderDash: [4, 3], pointRadius: 0, fill: false, showLine: true })
    return { datasets }
  }

  // ── Derived data for rendering ──────────────────────────────────────────
  const isVariable = result !== null && !('mode' in result)
  const varResult = isVariable ? (result as VariableResult) : null
  const attrResult = result && 'mode' in result ? (result as AttributeResult) : null

  const violatedX = varResult ? violatedSet(varResult.violations_x) : new Set<number>()
  const violatedR = varResult ? violatedSet(varResult.violations_r) : new Set<number>()
  const violatedAttr = attrResult ? violatedSet(attrResult.violations) : new Set<number>()

  const rangeVals = varResult ? varResult.rangeVals.map(v => v ?? 0) : []
  const rangeLabels = varResult ? varResult.labels.slice(1) : []
  const rangeValsTrimmed = rangeVals.slice(1)

  const allViolations = [
    ...(varResult?.violations_x.map(v => ({ ...v, chart: t('spc_chart_xbar_indiv') })) ?? []),
    ...(varResult?.violations_r.map(v => ({ ...v, chart: t('spc_chart_r_mr') })) ?? []),
    ...(attrResult?.violations.map(v => ({ ...v, chart: attrResult.chartLabel })) ?? []),
  ]

  const adequacy = varResult?.dataAdequacy ?? attrResult?.dataAdequacy ?? null
  const adequacyColor = adequacy?.tier === 'adequate' ? '#4ade80' : adequacy?.tier === 'moderate' ? '#facc15' : '#ef4444'
  const adequacyIcon = adequacy?.tier === 'adequate' ? '🟢' : adequacy?.tier === 'moderate' ? '🟡' : '⚠️'

  // Capability verdict prefers Cpk (short-term/within) and falls back to Ppk,
  // matching the legacy tool's `const pkVal = Cpk !== null ? Cpk : Ppk`
  const hasSpecLimits = !!(varResult && (varResult.LSL !== null || varResult.USL !== null))
  const pkVal = varResult ? (varResult.Cpk !== null ? varResult.Cpk : varResult.Ppk) : null
  const verdict = !hasSpecLimits || pkVal === null
    ? null
    : pkVal >= 1.33
    ? { icon: '✅', color: '#4ade80', bg: 'rgba(74,222,128,0.1)', text: t('spc_capable'), sub: t('spc_capable_sub') }
    : pkVal < 1.0
    ? { icon: '❌', color: '#ef4444', bg: 'rgba(239,68,68,0.1)', text: t('spc_notcapable').replace('{n}', fmt(varResult!.Ppk, 3)), sub: t('spc_notcapable_sub') }
    : { icon: '⚠️', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', text: t('spc_marginal'), sub: t('spc_marginal_sub') }

  const displaySigLvl = varResult ? varResult.sigLvl_st ?? varResult.sigLvl_lt : null

  return (
    <div style={s.page}>
      <Nav theme={theme} setTheme={setTheme} breadcrumbKey="bc_spc" />

      {loadedProjectName && (
        <div className="qh-main" style={{ ...s.main, paddingBottom: 0 }}>
          <div style={{ fontSize: 13, color: c.accent, background: c.surface2, border: `1px solid ${c.border}`, borderRadius: 8, padding: '8px 14px' }}>
            {lang === 'ar' ? `تم تحميل المشروع المحفوظ: ${loadedProjectName}` : `Loaded saved project: ${loadedProjectName}`}
          </div>
        </div>
      )}

      <div className="qh-body" style={s.body}>
        {/* ── LEFT SIDEBAR ─────────────────────────────────────────────── */}
        <div className="qh-left" style={s.left}>
          <div>
            <div style={s.sectionTitle}>{t('spc_data_type')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button
                style={{
                  ...s.exportBtn,
                  background: dataType === 'variable' ? c.accent : s.exportBtn.background,
                  color: dataType === 'variable' ? '#060d1a' : c.text,
                  border: dataType === 'variable' ? `1px solid ${c.accent}` : s.exportBtn.border,
                }}
                onClick={() => { setDataType('variable'); setResult(null); setErrorMsg('') }}
              >
                {t('spc_variable')}
              </button>
              <button
                style={{
                  ...s.exportBtn,
                  background: dataType === 'attribute' ? c.accent : s.exportBtn.background,
                  color: dataType === 'attribute' ? '#060d1a' : c.text,
                  border: dataType === 'attribute' ? `1px solid ${c.accent}` : s.exportBtn.border,
                }}
                onClick={() => { setDataType('attribute'); setResult(null); setErrorMsg('') }}
              >
                {t('spc_attribute')} {!isPro && '🔒'}
              </button>
            </div>
          </div>

          {dataType === 'variable' ? (
            <>
              <div>
                <div style={s.sectionTitle}>{t('spc_subgroup_size')}</div>
                <input
                  style={s.input}
                  type="number"
                  min={1}
                  max={10}
                  value={N}
                  onChange={e => handleNChange(parseInt(e.target.value, 10) || 1)}
                />
                <div style={{ fontSize: 10, color: c.muted, marginTop: 6, lineHeight: 1.5 }}>
                  {t('spc_subgroup_hint')}
                </div>
              </div>

              <div>
                <div style={s.sectionTitle}>{t('spc_spec_limits')}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div>
                    <div style={s.label}>{t('spc_lsl')}</div>
                    <input style={s.input} type="number" value={LSL} onChange={e => setLSL(e.target.value)} />
                  </div>
                  <div>
                    <div style={s.label}>{t('spc_target')}</div>
                    <input style={s.input} type="number" value={target} onChange={e => setTarget(e.target.value)} />
                  </div>
                  <div>
                    <div style={s.label}>{t('spc_usl')}</div>
                    <input style={s.input} type="number" value={USL} onChange={e => setUSL(e.target.value)} />
                  </div>
                </div>
              </div>

              <div>
                <button
                  onClick={() => setAdvancedOpen(o => !o)}
                  style={{
                    ...s.sectionTitle,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    font: 'inherit',
                  }}
                >
                  <span>{t('spc_advanced')}</span>
                  <span style={{ fontSize: 11, color: c.muted }}>{advancedOpen ? t('spc_hide') : t('spc_show')}</span>
                </button>
                {advancedOpen && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                    <div>
                      <div style={s.label}>{t('spc_last_n')}</div>
                      <input style={s.input} type="number" min={0} value={lastN} onChange={e => setLastN(e.target.value)} />
                    </div>
                    <div>
                      <div style={s.label}>{t('spc_sigma_convention')}</div>
                      <select style={s.select} value={sigmaConvention} onChange={e => setSigmaConvention(e.target.value as SigmaConvention)}>
                        <option value="direct">{t('spc_conv_direct')}</option>
                        <option value="sixsigma">{t('spc_conv_sixsigma')}</option>
                      </select>
                    </div>
                    <div>
                      <div style={s.label}>{t('spc_display_show')}</div>
                      <select style={s.select} value={displayMode} onChange={e => setDisplayMode(e.target.value as DisplayMode)}>
                        <option value="both">{t('spc_show_both')}</option>
                        <option value="capability">{t('spc_show_capability')}</option>
                        <option value="benchmark">{t('spc_show_benchmark')}</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div>
                <div style={s.sectionTitle}>{t('spc_chart_type')}</div>
                <select
                  style={s.select}
                  value={attrType}
                  onChange={e => { setAttrType(e.target.value as AttrType); setResult(null) }}
                >
                  <option value="p">{t('spc_p_chart_opt')}</option>
                  <option value="np">{t('spc_np_chart_opt')}</option>
                  <option value="c">{t('spc_c_chart_opt')}</option>
                  <option value="u">{t('spc_u_chart_opt')}</option>
                </select>
              </div>
              {attrType === 'np' && (
                <div>
                  <div style={s.label}>{t('spc_fixed_n')}</div>
                  <input style={s.input} type="number" value={fixedN} onChange={e => setFixedN(e.target.value)} />
                </div>
              )}
              <div>
                <div style={s.label}>{t('spc_sigma_convention')}</div>
                <select style={s.select} value={sigmaConvention} onChange={e => setSigmaConvention(e.target.value as SigmaConvention)}>
                  <option value="direct">{t('spc_conv_direct')}</option>
                  <option value="sixsigma">{t('spc_conv_sixsigma')}</option>
                </select>
              </div>
            </>
          )}

          <div>
            <button style={{ ...s.ctaBtn, width: '100%', textAlign: 'center', border: 'none', cursor: 'pointer', fontSize: 13, padding: '10px 16px' }} onClick={analyze} disabled={loading}>
              {loading ? t('spc_analyzing') : t('spc_analyze_btn')}
            </button>
          </div>

          <div>
            <button
              style={{ ...s.addBtn, background: 'rgba(239,68,68,0.1)', border: '1px dashed #ef4444', color: '#ef4444' }}
              onClick={clearAll}
            >
              {t('spc_clear_all')}
            </button>
          </div>

          <div>
            <div style={s.sectionTitle}>{t('spc_export')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button style={s.exportBtn} onClick={exportCSV} disabled={!result}>{isLoggedIn ? t('spc_export_csv') : t('spc_export_csv_locked')}</button>
              <button style={s.exportBtn} onClick={exportExcel}>{isPro ? t('spc_export_excel') : t('spc_export_excel_locked')}</button>
              <button style={s.exportBtn} onClick={exportPNG} disabled={!result}>{isLoggedIn ? t('spc_export_png') : t('spc_export_png_locked')}</button>
              <button style={s.exportBtn} onClick={exportPDF} disabled={!result}>{isPro ? t('spc_export_pdf') : t('spc_export_pdf_locked')}</button>
            </div>
            <div style={{ marginTop: 8 }}>
              <SaveAnalysisButton
                theme={theme}
                tool="spc"
                defaultName={`SPC — ${new Date().toLocaleDateString('en-US')}`}
                getPayload={() =>
                  !result
                    ? null
                    : {
                        input_data: {
                          dataType,
                          varRows,
                          attrRows,
                          attrType,
                          fixedN,
                          LSL,
                          USL,
                          target,
                          sigmaConvention,
                        },
                        results: result,
                      }
                }
              />
            </div>
          </div>
        </div>

        {/* ── RIGHT MAIN AREA ──────────────────────────────────────────── */}
        <div className="qh-right" style={s.right}>
          {/* Data entry table — auto-collapses into a summary bar once you have a result */}
          <div style={s.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: dataEntryOpen ? 12 : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{t('spc_data_entry')}</div>
                {!dataEntryOpen && (
                  <div style={{ fontSize: 12, color: c.muted }}>
                    {dataType === 'variable' ? t('spc_subgroups_entered').replace('{n}', String(varRows.length)) : t('spc_rows_entered').replace('{n}', String(attrRows.length))}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {dataEntryOpen && <div style={{ fontSize: 11, color: c.muted }}>{t('spc_paste_hint')}</div>}
                <button
                  onClick={() => setDataEntryOpen(o => !o)}
                  style={{ ...s.exportBtn, padding: '4px 10px', fontSize: 11 }}
                >
                  {dataEntryOpen ? t('spc_collapse') : t('spc_edit_data')}
                </button>
              </div>
            </div>

            {dataEntryOpen && (dataType === 'variable' ? (
              <>
                <div className="qh-table-wrap" style={{ overflowX: 'auto' }}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>#</th>
                      {Array.from({ length: N }, (_, i) => (
                        <th key={i} style={s.th}>{N === 1 ? t('spc_col_value') : `x${i + 1}`}</th>
                      ))}
                      <th style={s.th}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {varRows.map((row, ridx) => (
                      <tr key={row.id}>
                        <td style={s.td}>{ridx + 1}</td>
                        {row.vals.map((v, i) => (
                          <td key={i} style={s.td}>
                            <input
                              style={s.input}
                              type="number"
                              value={v}
                              onChange={e => updateVarCell(row.id, i, e.target.value)}
                            />
                          </td>
                        ))}
                        <td style={s.td}>
                          <button style={s.removeBtn} onClick={() => removeVarRow(row.id)}>✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
                <button style={{ ...s.addBtn, marginTop: 10 }} onClick={addVarRow}>{t('spc_add_subgroup')}</button>
              </>
            ) : (
              <>
                <div className="qh-table-wrap" style={{ overflowX: 'auto' }}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>#</th>
                      {(attrType === 'p' || attrType === 'u') && <th style={s.th}>{t('spc_col_samplesize')}</th>}
                      <th style={s.th}>{t('spc_col_defects')}</th>
                      <th style={s.th}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {attrRows.map((row, ridx) => (
                      <tr key={row.id}>
                        <td style={s.td}>{ridx + 1}</td>
                        {(attrType === 'p' || attrType === 'u') && (
                          <td style={s.td}>
                            <input style={s.input} type="number" value={row.n} onChange={e => updateAttrCell(row.id, 'n', e.target.value)} />
                          </td>
                        )}
                        <td style={s.td}>
                          <input style={s.input} type="number" value={row.defects} onChange={e => updateAttrCell(row.id, 'defects', e.target.value)} />
                        </td>
                        <td style={s.td}>
                          <button style={s.removeBtn} onClick={() => removeAttrRow(row.id)}>✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
                <button style={{ ...s.addBtn, marginTop: 10 }} onClick={addAttrRow}>{t('spc_add_row')}</button>
              </>
            ))}
          </div>

          {errorMsg && (
            <div style={{ ...s.card, borderColor: '#ef4444', color: '#ef4444', fontSize: 13 }}>{errorMsg}</div>
          )}

          {/* ── VARIABLE RESULTS ───────────────────────────────────────── */}
          {varResult && (
            <>
              <div className="qh-stats-row" style={s.statsRow}>
                <div style={s.statCard}>
                  <div style={s.statVal}>{varResult.n}</div>
                  <div style={s.statLabel}>{t('spc_stat_datapoints')}</div>
                </div>
                <div style={s.statCard}>
                  <div style={s.statVal}>{fmt(varResult.mu)}</div>
                  <div style={s.statLabel}>{t('spc_stat_mean')}</div>
                </div>
                <div style={s.statCard}>
                  <div style={s.statVal}>{fmt(varResult.sigma)}</div>
                  <div style={s.statLabel}>{t('spc_stat_withinstddev')}</div>
                </div>
                {varResult.ad ? (
                  <div style={s.statCard}>
                    <div style={{ ...s.statVal, color: varResult.isNormal ? '#4ade80' : '#f59e0b' }}>
                      {varResult.isNormal ? t('spc_normal') : t('spc_nonnormal')}
                    </div>
                    <div style={s.statLabel}>
                      {t('spc_ad_label').replace('{p}', fmt(varResult.ad.p, 3))}
                    </div>
                  </div>
                ) : (
                  <div style={s.statCard}>
                    <div style={{ ...s.statVal, fontSize: 13, color: c.muted }}>
                      {t('spc_ad_need8')}
                    </div>
                  </div>
                )}
                {(displayMode === 'capability' || displayMode === 'both') && (
                  <>
                    <div style={s.statCard}><div style={s.statVal}>{fmt(varResult.Cp)}</div><div style={s.statLabel}>Cp</div></div>
                    <div style={s.statCard}><div style={s.statVal}>{fmt(varResult.Cpk)}</div><div style={s.statLabel}>Cpk</div></div>
                    <div style={s.statCard}><div style={s.statVal}>{fmt(varResult.Pp)}</div><div style={s.statLabel}>Pp</div></div>
                    <div style={s.statCard}><div style={s.statVal}>{fmt(varResult.Ppk)}</div><div style={s.statLabel}>Ppk</div></div>
                    {varResult.Cpm !== null && (
                      <div style={s.statCard}><div style={s.statVal}>{fmt(varResult.Cpm)}</div><div style={s.statLabel}>Cpm</div></div>
                    )}
                  </>
                )}
                {(displayMode === 'benchmark' || displayMode === 'both') && (
                  <>
                    <div style={s.statCard}><div style={s.statVal}>{fmt(varResult.sigLvl_st)}σ</div><div style={s.statLabel}>{t('spc_stat_sigma_st')}</div></div>
                    <div style={s.statCard}><div style={s.statVal}>{fmt(varResult.sigLvl_lt)}σ</div><div style={s.statLabel}>{t('spc_stat_sigma_lt')}</div></div>
                  </>
                )}
              </div>

              <div className="qh-chart-wrap" style={s.chartWrap}>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
                  {varResult.N === 1 ? t('spc_ichart_individuals') : t('spc_ichart_xbar')}
                </div>
                <div style={{ color: c.muted, fontSize: 12, marginBottom: 16 }}>
                  CL = {fmt(varResult.cl_x)} · UCL = {fmt(varResult.ucl_x)} · LCL = {fmt(varResult.lcl_x)}
                </div>
                <div className="qh-chart-inner" style={s.chartInner}>
                  <Chart
                    ref={iChartRef}
                    type="line"
                    data={buildControlChart(varResult.labels, varResult.xbarVals, varResult.ucl_x, varResult.cl_x, varResult.lcl_x, violatedX, varResult.N === 1 ? 'Individual Value' : 'X̄')}
                    options={lineChartOptions}
                  />
                </div>
              </div>

              <div className="qh-chart-wrap" style={s.chartWrap}>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
                  {varResult.N === 1 ? t('spc_rchart_mr') : t('spc_rchart_r')}
                </div>
                <div style={{ color: c.muted, fontSize: 12, marginBottom: 16 }}>
                  {varResult.N === 1 ? 'MR̄' : 'R̄'} = {fmt(varResult.cl_r)} · UCL = {fmt(varResult.ucl_r)} · LCL = {fmt(Math.max(0, varResult.lcl_r))}
                </div>
                <div className="qh-chart-inner" style={s.chartInner}>
                  <Chart
                    ref={rChartRef}
                    type="line"
                    data={buildControlChart(rangeLabels, rangeValsTrimmed, varResult.ucl_r, varResult.cl_r, Math.max(0, varResult.lcl_r), violatedR, varResult.N === 1 ? 'Moving Range' : 'Range', varResult.N === 1 ? 'MR̄' : 'R̄')}
                    options={lineChartOptions}
                  />
                </div>
              </div>

              {/* ── CAPABILITY ANALYSIS (only when LSL/USL is set) ─────── */}
              {hasSpecLimits ? (
                <>
                  {allViolations.length > 0 && (
                    <div style={{ ...s.card, display: 'flex', gap: 12, alignItems: 'flex-start', background: 'rgba(239,68,68,0.08)', border: '1px solid #ef444455' }}>
                      <div style={{ fontSize: 20 }}>⚠️</div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: '#ef4444' }}>{t('spc_capability_needs_stability_title')}</div>
                        <div style={{ fontSize: 12, color: c.muted, marginTop: 2 }}>{t('spc_capability_needs_stability_note')}</div>
                      </div>
                    </div>
                  )}
                  {displaySigLvl !== null && (
                    <div style={s.card}>
                      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
                        <div style={{ textAlign: 'center', minWidth: 110 }}>
                          <div style={{ fontSize: 44, fontWeight: 900, lineHeight: 1, color: sigmaColor(displaySigLvl) }}>
                            {isFinite(displaySigLvl) ? displaySigLvl.toFixed(2) : '∞'}
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: sigmaColor(displaySigLvl) }}>σ</div>
                          <div style={{ fontSize: 11, color: c.muted, marginTop: 2 }}>{t('spc_sigma_level')}</div>
                        </div>
                        <div style={{ flex: 1, minWidth: 240, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {varResult.sigLvl_st !== null && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, borderBottom: `1px solid ${c.border}`, padding: '4px 0' }}>
                              <span style={{ color: c.muted }}>{t('spc_zbench_st')}</span><span>{fmt(varResult.Z_bench_st)}</span>
                            </div>
                          )}
                          {varResult.sigLvl_lt !== null && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, borderBottom: `1px solid ${c.border}`, padding: '4px 0' }}>
                              <span style={{ color: c.muted }}>{t('spc_zbench_lt')}</span><span>{fmt(varResult.Z_bench_lt)}</span>
                            </div>
                          )}
                          {varResult.Z_USL_st !== null && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, borderBottom: `1px solid ${c.border}`, padding: '4px 0' }}>
                              <span style={{ color: c.muted }}>{t('spc_zusl_within')}</span><span>{fmt(varResult.Z_USL_st)}</span>
                            </div>
                          )}
                          {varResult.Z_LSL_st !== null && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, borderBottom: `1px solid ${c.border}`, padding: '4px 0' }}>
                              <span style={{ color: c.muted }}>{t('spc_zlsl_within')}</span><span>{fmt(varResult.Z_LSL_st)}</span>
                            </div>
                          )}
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0' }}>
                            <span style={{ color: c.muted }}>{t('spc_convention_label')}</span><span>{sigmaConvention === 'sixsigma' ? t('spc_conv_shift') : t('spc_conv_direct_val')}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {(displayMode === 'capability' || displayMode === 'both') && (
                    <div className="qh-stats-row" style={s.statsRow}>
                      {[
                        { label: 'Cp', val: varResult.Cp, sub: t('spc_cp_sub') },
                        { label: 'Cpk', val: varResult.Cpk, sub: t('spc_cpk_sub') },
                        { label: 'Pp', val: varResult.Pp, sub: t('spc_pp_sub') },
                        { label: 'Ppk', val: varResult.Ppk, sub: t('spc_ppk_sub') },
                      ].map(item => (
                        <div key={item.label} style={{ ...s.statCard, border: `1px solid ${capabilityColor(item.val)}44` }}>
                          <div style={{ ...s.statVal, color: capabilityColor(item.val) }}>{fmt(item.val)}</div>
                          <div style={s.statLabel}>{item.label}</div>
                          <div style={{ fontSize: 10, color: capabilityColor(item.val), marginTop: 4 }}>{capabilityLabel(item.val)}</div>
                        </div>
                      ))}
                      {varResult.Cpm !== null && (
                        <div style={{ ...s.statCard, border: `1px solid ${capabilityColor(varResult.Cpm)}44` }}>
                          <div style={{ ...s.statVal, color: capabilityColor(varResult.Cpm) }}>{fmt(varResult.Cpm, 4)}</div>
                          <div style={s.statLabel}>{t('spc_cpm_taguchi')}</div>
                          <div style={{ fontSize: 10, color: capabilityColor(varResult.Cpm), marginTop: 4 }}>{capabilityLabel(varResult.Cpm)}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {(varResult.ppmD_st || varResult.ppmD_lt) && (
                    <div style={s.card}>
                      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>{t('spc_ppm_breakdown_title')}</div>
                      <div className="qh-table-wrap" style={{ overflowX: 'auto' }}>
                      <table style={s.table}>
                        <thead>
                          <tr><th style={s.th}>{t('spc_col_region')}</th><th style={s.th}>{t('spc_col_shortterm')}</th><th style={s.th}>{t('spc_col_longterm')}</th></tr>
                        </thead>
                        <tbody>
                          {varResult.USL !== null && (
                            <tr><td style={s.td}>{t('spc_row_aboveusl')}</td><td style={{ ...s.td, color: c.danger }}>{varResult.ppmD_st ? varResult.ppmD_st.above.toFixed(2) : '—'}</td><td style={{ ...s.td, color: c.danger }}>{varResult.ppmD_lt ? varResult.ppmD_lt.above.toFixed(2) : '—'}</td></tr>
                          )}
                          {varResult.LSL !== null && (
                            <tr><td style={s.td}>{t('spc_row_belowlsl')}</td><td style={{ ...s.td, color: c.danger }}>{varResult.ppmD_st ? varResult.ppmD_st.below.toFixed(2) : '—'}</td><td style={{ ...s.td, color: c.danger }}>{varResult.ppmD_lt ? varResult.ppmD_lt.below.toFixed(2) : '—'}</td></tr>
                          )}
                          <tr style={{ fontWeight: 700 }}>
                            <td style={s.td}>{t('spc_row_totalppm')}</td>
                            <td style={{ ...s.td, color: c.danger }}>{varResult.ppmD_st ? varResult.ppmD_st.total.toFixed(2) : '—'}</td>
                            <td style={{ ...s.td, color: c.danger }}>{varResult.ppmD_lt ? varResult.ppmD_lt.total.toFixed(2) : '—'}</td>
                          </tr>
                        </tbody>
                      </table>
                      </div>
                      {varResult.USL !== null && varResult.LSL !== null && (
                        <div style={{ fontSize: 11, color: c.muted, marginTop: 10 }}>
                          K × Σ Tolerance (K=6): (USL−LSL)/6Σ = {fmt(varResult.Cp)} · Overall = {fmt(varResult.Pp)}
                        </div>
                      )}
                    </div>
                  )}

                  {verdict && (
                    <div style={{ ...s.card, display: 'flex', gap: 14, alignItems: 'flex-start', background: verdict.bg, border: `1px solid ${verdict.color}55` }}>
                      <div style={{ fontSize: 22 }}>{verdict.icon}</div>
                      <div>
                        <div style={{ fontWeight: 700, color: verdict.color, fontSize: 14 }}>{verdict.text}</div>
                        <div style={{ fontSize: 12, color: c.muted, marginTop: 2 }}>{verdict.sub}</div>
                      </div>
                    </div>
                  )}

                  {submittedVals.length > 0 && (
                    <div className="qh-chart-wrap" style={s.chartWrap}>
                      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>{t('spc_dist_vs_spec')}</div>
                      <div className="qh-chart-inner" style={s.chartInner}>
                        <Chart
                          ref={distChartRef}
                          type="scatter"
                          data={buildDistChart(submittedVals, varResult.mu, varResult.sdOverall, varResult.LSL, varResult.USL)}
                          options={linearChartOptions(false)}
                        />
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ ...s.card, fontSize: 11, color: c.muted }}>
                  {t('spc_enter_spec_hint')}
                </div>
              )}

              {submittedVals.length > 0 && (
                <div className="qh-chart-wrap" style={s.chartWrap}>
                  <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>{t('spc_ecdf_vs_normal')}</div>
                  <div className="qh-chart-inner" style={s.chartInner}>
                    <Chart
                      ref={ecdfChartRef}
                      type="scatter"
                      data={buildEcdfChart(submittedVals, varResult.mu, varResult.sdOverall, varResult.LSL, varResult.USL)}
                      options={linearChartOptions(true)}
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── ATTRIBUTE RESULTS ──────────────────────────────────────── */}
          {attrResult && (
            <>
              <div className="qh-stats-row" style={s.statsRow}>
                <div style={s.statCard}>
                  <div style={s.statVal}>{attrResult.pts.length}</div>
                  <div style={s.statLabel}>{t('spc_subgroups')}</div>
                </div>
                <div style={s.statCard}>
                  <div style={s.statVal}>{fmt(attrResult.metric, 4)}</div>
                  <div style={s.statLabel}>{attrResult.metricLabel}</div>
                </div>
                <div style={s.statCard}>
                  <div style={s.statVal}>{Math.round(attrResult.dpm).toLocaleString()}</div>
                  <div style={s.statLabel}>{t('spc_dpm')}</div>
                </div>
                <div style={s.statCard}>
                  <div style={s.statVal}>{isFinite(attrResult.sigmaLvl) ? fmt(attrResult.sigmaLvl) : '6.00+'}σ</div>
                  <div style={s.statLabel}>{t('spc_sigma_level')}</div>
                </div>
              </div>

              <div className="qh-chart-wrap" style={s.chartWrap}>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{attrResult.chartLabel}</div>
                <div style={{ color: c.muted, fontSize: 12, marginBottom: 16 }}>
                  CL = {fmt(attrResult.clVal, 4)} · UCL = {fmt(attrResult.ucl, 4)} · LCL = {fmt(Math.max(0, attrResult.lcl), 4)}
                </div>
                <div className="qh-chart-inner" style={s.chartInner}>
                  <Chart
                    ref={attrChartRef}
                    type="line"
                    data={buildControlChart(attrResult.labels, attrResult.pts, attrResult.ucl, attrResult.clVal, Math.max(0, attrResult.lcl), violatedAttr, attrResult.metricLabel)}
                    options={lineChartOptions}
                  />
                </div>
              </div>
            </>
          )}

          {/* ── DATA ADEQUACY ──────────────────────────────────────────── */}
          {result && adequacy && (
            <div style={{ ...s.card, display: 'flex', gap: 12, alignItems: 'center', border: `1px solid ${adequacyColor}55` }}>
              <div style={{ fontSize: 20 }}>{adequacyIcon}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: adequacyColor }}>{adequacy.label}</div>
                <div style={{ fontSize: 11, color: c.muted, marginTop: 2 }}>
                  {t('spc_adequacy_note').replace('{n}', String(adequacy.n))}
                </div>
              </div>
            </div>
          )}

          {/* ── NELSON RULE VIOLATIONS ─────────────────────────────────── */}
          {result && (
            <div style={s.card}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>{t('spc_nelson_title')}</div>
              {allViolations.length === 0 ? (
                <div style={{ color: '#4ade80', fontSize: 13 }}>{t('spc_no_violations')}</div>
              ) : (
                allViolations.map((v, i) => (
                  <div key={i} style={s.rowCard}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, color: '#ef4444', fontSize: 13 }}>{t('spc_rule_label').replace('{n}', String(v.rule))} {v.label}</span>
                      <span style={{ fontSize: 11, color: c.muted }}>{v.chart}</span>
                    </div>
                    <div style={{ fontSize: 12, color: c.muted }}>{v.desc}</div>
                  </div>
                ))
              )}
            </div>
          )}

          {!result && !errorMsg && (
            <div style={{ ...s.card, textAlign: 'center', padding: 60, color: c.muted }}>
              {t('spc_empty_state')}
            </div>
          )}
        </div>
      </div>

      {pasteToast && <div style={s.toast}>{t('spc_toast')}</div>}
    </div>
  )
}
