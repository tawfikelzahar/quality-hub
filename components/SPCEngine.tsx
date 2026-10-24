'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import 'chart.js/auto'
import type { Chart as ChartJSInstance } from 'chart.js'
import { Chart } from 'react-chartjs-2'
import { watermarkOptions, watermarkLayout, withWatermarksDisabled } from '@/lib/watermarkHelpers'

// Registered once at module load. Safe to call multiple times (Chart.js
// no-ops on a duplicate id), but this keeps it to a single call site.
import { COLORS, getSharedStyles, usePersistedTheme, tint } from '@/lib/theme'
import Nav from '@/components/Nav'
import ToolSidebar from '@/components/ToolSidebar'
import ToolStyles from '@/components/tool/ToolStyles'
import { ToolHeader, HelpPanel, PhoneTabs, PhoneBar, VerdictCards, ResultsHead, ExportRow, KpiGrid, ReadingsGrid, SpecLimits, DataCardHead, ViolationsCard, AdequacyCard, useCompactSave } from '@/components/tool/ToolParts'
import { capabilityVerdict } from '@/lib/spc/verdict'
import SaveAnalysisButton from '@/components/SaveAnalysisButton'
import { useSubscription } from '@/lib/useSubscription'
import { goToLogin, goToPricing } from '@/lib/exportGate'
import { useLanguage } from '@/lib/i18n/context'
import { createReport, nowStamp, type TableColumn } from '@/lib/excelReport'
import { useGridImport } from '@/lib/gridImport'
import { DEFAULT_TEST_SET, describeTestSet, type TestSet } from '@/lib/spc/testSets'
import { XBAR_S_MIN_N } from '@/lib/spc/chartChoice'
import type { ChartKind } from '@/lib/spc/useChartAnalysis'
import { SheetPicker } from '@/components/GridImportControls'
import {
  createReport as createPdfReport,
  classifyCapability,
  classificationBanner,
  twoColumnTables,
  dataTable,
  capabilityGauge,
  capabilityComparisonPlot,
  interpretationBox,
  summaryBox,
  calloutBox,
  criteriaReferenceTable,
  addChartImage,
  addChartImagePair,
  finalizeReport,
  REPORT_COLORS,
  type KVRow,
} from '@/lib/pdf/reportDesign'
import type { RuleSignal, Tone, CapabilityInput, ConclusionInput, SummaryInput, CapabilityDiagnosis, StudyConclusion } from '@/lib/spc/reportInterpretation'
import { wireReplacer } from '@/lib/spc/wire'
import { formatPValue } from '@/lib/stats/format'

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
  testSet?: TestSet
  /** chart the server picked from the subgroup size (lib/spc/chartChoice.ts) */
  chart?: ChartKind
  /** reason under the capability verdict, written on the server */
  screenReason?: { en: string | null; ar: string | null }
}

const CHART_NAME: Record<ChartKind, string> = { imr: 'I-MR', 'xbar-r': 'X̄-R', 'xbar-s': 'X̄-S' }

// Names for the second (dispersion) chart: MR for I-MR, R for X̄-R, S for X̄-S.
// Results saved before X̄-S was added carry no `chart` and were always R / MR.
function dispersionNames(r: VariableResult) {
  const kind: ChartKind = r.chart ?? (r.N === 1 ? 'imr' : 'xbar-r')
  if (kind === 'imr') return { kind, short: 'MR', bar: 'MR̄', point: 'Moving Range', title: 'Moving Range (MR) Chart', titleKey: 'spc_rchart_mr' as const }
  if (kind === 'xbar-s') return { kind, short: 'S', bar: 'S̄', point: 'S', title: 'S (Standard Deviation) Chart', titleKey: 'spc_rchart_s' as const }
  return { kind, short: 'R', bar: 'R̄', point: 'Range', title: 'Range (R) Chart', titleKey: 'spc_rchart_r' as const }
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
  testSet?: TestSet
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

// Example data for the "Try an example" button: golden dataset DS01
const EXAMPLE_READINGS = ['24.1', '24.3', '23.9', '24.2', '24.6', '24.0', '23.8', '24.4', '24.5', '24.1', '24.0', '24.3', '23.7', '24.2', '24.4']

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
  // Below 0.1 PPM the yield would print as "100.00000%" — no real process
  // is defect-free, so say what we actually know.
  if (ppmTotal < PPM_FLOOR) return '> 99.99999%'
  const yieldPct = 100 - ppmTotal / 10000
  return yieldPct >= 99.9995 ? `${yieldPct.toFixed(5)}%` : `${yieldPct.toFixed(3)}%`
}

// PPM for report tables. A normal-tail estimate is never exactly zero, so
// tiny values print as "< 0.1" instead of a misleading "0.0"; a side with no
// specification limit has no defect estimate at all ("—").
const PPM_FLOOR = 0.05
function fmtPpm(ppm: number, hasLimit = true): string {
  if (!hasLimit) return '—'
  if (!isFinite(ppm)) return '—'
  return ppm < PPM_FLOOR ? '< 0.1' : ppm.toFixed(1)
}

// Maps an interpretation tone to the report's text color for table cells.
function toneColor(tone: Tone) {
  return tone === 'good' ? REPORT_COLORS.good : tone === 'bad' ? REPORT_COLORS.bad : tone === 'warn' ? REPORT_COLORS.warn : null
}

// Capability verdict — mirrors capabilityClass/capabilityLabel from spc-tool.html
function capabilityColor(val: number | null): string {
  if (val === null || isNaN(val)) return 'var(--qh-muted)'
  if (val >= 1.33) return 'var(--qh-good)'
  if (val >= 1.0) return 'var(--qh-amber)'
  return 'var(--qh-danger)'
}
function capabilityLabel(val: number | null): string {
  if (val === null || isNaN(val)) return '—'
  if (val >= 1.33) return '✓ Capable'
  if (val >= 1.0) return '⚠ Marginal'
  return '✗ Not Capable'
}
function sigmaColor(sVal: number): string {
  if (sVal >= 6) return 'var(--qh-good)'
  if (sVal >= 4) return 'var(--qh-good)'
  if (sVal >= 3) return 'var(--qh-amber)'
  return 'var(--qh-danger)'
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

// "51–60" for a run, "6, 12" for test-1 points — compact, as in Minitab.
function violationPointsText(v: Violation): string {
  if (v.rule === 1) return v.points.join(', ')
  const [a, b] = v.points
  return a === b ? String(a) : `${a}–${b}`
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

// Same row-building rules as the paste parsers above, applied to a grid
// that came from an uploaded .csv/.xlsx/.xls file instead of the clipboard —
// keeps file-upload and Ctrl+V behaving identically.
function variableRowsFromGrid(grid: string[][], n: number): VarRow[] {
  const rows: VarRow[] = []
  for (const cells of grid) {
    const parts = cells.filter(p => p !== '' && !isNaN(parseFloat(p)))
    if (parts.length > 0) rows.push({ id: generateId(), vals: resizeVals(parts, n) })
  }
  return rows
}

function attributeRowsFromGrid(grid: string[][], attrType: AttrType): AttrRow[] {
  const rows: AttrRow[] = []
  const needsN = attrType === 'p' || attrType === 'u'
  for (const parts of grid) {
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
  // Tests for special causes: Minitab Assistant defaults unless the user
  // opts into all eight Nelson tests (lib/spc/nelson.ts).
  const [testSet, setTestSet] = useState<TestSet>(DEFAULT_TEST_SET)
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
  const distChartRef = useRef<ChartJSInstance<'bar' | 'line', { x: number; y: number }[]>>(null)
  const ecdfChartRef = useRef<ChartJSInstance<'scatter'>>(null)
  const attrChartRef = useRef<ChartJSInstance<'line'>>(null)

  // ── Variable-mode row handlers ──────────────────────────────────────────
  const handleNChange = (newN: number) => {
    const safe = Math.max(1, Math.min(25, newN))
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

  // ── File upload (.csv / .xlsx / .xls) — paste above already handles Ctrl+V,
  // so this hook is used for the upload button only.
  const gridImport = useGridImport({
    enablePasteListener: false,
    onGrid: grid => {
      if (dataType === 'variable') {
        const parsed = variableRowsFromGrid(grid, N)
        if (parsed.length > 0) setVarRows(parsed)
      } else {
        const parsed = attributeRowsFromGrid(grid, attrType)
        if (parsed.length > 0) setAttrRows(parsed)
      }
    },
  })

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
          testSet?: TestSet
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
        setTestSet(input.testSet ?? DEFAULT_TEST_SET)
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
          testSet,
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
          testSet,
        }
      }
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) {
        setErrorMsg(res.status === 429 ? t('tool_rate_limited') : json.error || t('spc_err_calc_failed'))
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
      const disp = dispersionNames(varResult)
      const useS = disp.kind === 'xbar-s'
      const header = ['Subgroup', ...Array.from({ length: N }, (_, i) => `x${i + 1}`), 'Mean', useS ? 'StDev' : 'Range'].join(',')
      const rows = varRows.map((row, i) => {
        const nums = row.vals.map(v => parseFloat(v)).filter(v => !isNaN(v))
        const mean = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : ''
        const spread = useS
          ? (nums.length > 1 && typeof mean === 'number' ? Math.sqrt(nums.reduce((a, x) => a + (x - mean) ** 2, 0) / (nums.length - 1)) : '')
          : (nums.length ? Math.max(...nums) - Math.min(...nums) : '')
        return [i + 1, ...row.vals, mean, spread].join(',')
      })
      csv = [header, ...rows].join('\n')

      csv += '\n\nSummary,\n'
      csv += `Mean (μ),${fmt(varResult.mu, 4)}\n`
      csv += `Within Sigma,${fmt(varResult.sigma, 4)}\n`
      csv += `${varResult.N === 1 ? 'Individuals (X)' : 'X̄'} CL,${fmt(varResult.cl_x, 4)}\n`
      csv += `${varResult.N === 1 ? 'Individuals (X)' : 'X̄'} UCL,${fmt(varResult.ucl_x, 4)}\n`
      csv += `${varResult.N === 1 ? 'Individuals (X)' : 'X̄'} LCL,${fmt(varResult.lcl_x, 4)}\n`
      csv += `${disp.bar} CL,${fmt(varResult.cl_r, 4)}\n`
      csv += `${disp.bar} UCL,${fmt(varResult.ucl_r, 4)}\n`
      csv += `${disp.bar} LCL,${fmt(Math.max(0, varResult.lcl_r), 4)}\n`
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

    const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'spc-data.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Export: Data + Stats as a professional Excel workbook ── (Pro only)
  const runExportExcel = async () => {
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
      ['Data type', dataType === 'variable' ? `Variable — subgroup size n = ${N} (${varResult ? CHART_NAME[dispersionNames(varResult).kind] : ''} chart)` : `Attribute — ${attrType.toUpperCase()} chart`],
      ['Standard', 'Nelson Rules (Western Electric derivative), AIAG SPC'],
    ])

    if (varResult) {
      const chartWord = varResult.N === 1 ? 'Individuals (X)' : 'X̄'
      const clWord = dispersionNames(varResult).bar

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
          { label: 'Cp', value: fmt(varResult.Cp, 2), sub: varResult.isNormal ? 'Potential' : 'Approx. (non-normal)', tone: varResult.Cp !== null ? (varResult.Cp >= 1.33 ? 'good' : varResult.Cp >= 1 ? 'warning' : 'danger') : 'neutral' },
          { label: 'Cpk', value: fmt(varResult.Cpk, 2), sub: varResult.isNormal ? 'Actual' : 'Approx. (non-normal)', tone: varResult.Cpk !== null ? (varResult.Cpk >= 1.33 ? 'good' : varResult.Cpk >= 1 ? 'warning' : 'danger') : 'neutral' },
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
          { header: 'CL', key: 'cl', align: 'right', numFmt: '0.0000' },
          { header: 'UCL', key: 'ucl', align: 'right', numFmt: '0.0000' },
          { header: 'LCL', key: 'lcl', align: 'right', numFmt: '0.0000' },
        ],
        rows: [
          { chart: chartWord, cl: varResult.cl_x, ucl: varResult.ucl_x, lcl: varResult.lcl_x },
          { chart: clWord, cl: varResult.cl_r, ucl: varResult.ucl_r, lcl: Math.max(0, varResult.lcl_r) },
        ],
      })

      // ── Control charts as images, via the shared charts() helper — same
      // Chart.js canvases used on screen and in the PDF export. ──
      await overview.charts(
        [
          { ref: iChartRef, title: chartWord === 'X̄' ? 'X̄ Chart' : 'Individuals (I) Chart' },
          { ref: rChartRef, title: `${clWord} Chart` },
        ],
        { widthCm: 17, heightCm: 8 }
      )

      if (hasSpecLimits) {
        overview.sectionHeading('Specification Limits & Capability')
        overview.table({
          headers: [
            { header: 'Metric', key: 'metric', align: 'left', width: 26 },
            { header: 'Value', key: 'value', align: 'right', numFmt: '0.0000' },
          ],
          rows: [
            { metric: 'LSL', value: varResult.LSL ?? '—' },
            { metric: 'USL', value: varResult.USL ?? '—' },
            { metric: 'Cpm', value: varResult.Cpm ?? '—' },
            { metric: 'Z-bench (Short-term)', value: varResult.Z_bench_st ?? '—' },
            { metric: 'Z-bench (Long-term)', value: varResult.Z_bench_lt ?? '—' },
          ],
        })

        overview.sectionHeading('Defect Rate (PPM)')
        overview.table({
          headers: [
            { header: 'Metric', key: 'metric', align: 'left', width: 30 },
            { header: 'PPM', key: 'ppm', align: 'right', numFmt: '#,##0' },
          ],
          rows: [
            { metric: 'Above USL (Short-term)', ppm: varResult.ppmD_st ? Math.round(varResult.ppmD_st.above) : '—' },
            { metric: 'Below LSL (Short-term)', ppm: varResult.ppmD_st ? Math.round(varResult.ppmD_st.below) : '—' },
            { metric: 'Above USL (Long-term)', ppm: varResult.ppmD_lt ? Math.round(varResult.ppmD_lt.above) : '—' },
            { metric: 'Below LSL (Long-term)', ppm: varResult.ppmD_lt ? Math.round(varResult.ppmD_lt.below) : '—' },
          ],
        })

        // Capability Histogram was already in the PDF export (addChartImage)
        // but missing from Excel — this closes that gap.
        await overview.charts([{ ref: distChartRef, title: 'Capability Histogram' }], { widthCm: 17, heightCm: 8 })
      }

      overview.sectionHeading('Normality Test (Anderson-Darling)')
      overview.table({
        headers: [
          { header: 'Statistic', key: 'k', align: 'left', width: 26 },
          { header: 'Value', key: 'v', align: 'right' },
        ],
        rows: [
          ['AD (A²)', fmt(varResult.ad?.A2, 3)],
          ['p-value', formatPValue(varResult.ad?.p)],
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

      // Empirical CDF vs. Normal was already in the PDF export but missing
      // from Excel — this closes that gap alongside the histogram above.
      await overview.charts([{ ref: ecdfChartRef, title: 'Empirical CDF vs. Normal' }], { widthCm: 17, heightCm: 8 })
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

      // Attribute chart was already in the PDF export (addChartImage) but
      // missing from Excel entirely — this closes that gap.
      await overview.charts([{ ref: attrChartRef, title: attrResult.chartLabel }], { widthCm: 17, heightCm: 8 })
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
      // Flag any subgroup containing a value outside LSL/USL — makes
      // out-of-spec readings visible at a glance in the raw data sheet,
      // matching the "danger" styling already used for Nelson violations.
      const rowTones = hasSpecLimits
        ? varRows.map(r =>
            r.vals.some(v => {
              if (v === '') return false
              const n = parseFloat(v)
              return (varResult?.LSL != null && n < varResult.LSL) || (varResult?.USL != null && n > varResult.USL)
            })
              ? ('danger' as const)
              : undefined
          )
        : undefined
      dataSheet.table({ headers: cols, rows, rowTones })
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
        rows: allViolations.map(v => [v.chart, v.rule, v.label, v.desc, violationPointsText(v)]),
        rowTones: allViolations.map(() => 'danger'),
      })
      violSheet.freezeHeader(2)
    }

    await report.download('spc-report.xlsx')
  }

  const exportExcel = () => withAllWatermarksDisabled(runExportExcel)

  // ── Export: charts as PNG ────────────────────────────────────────────────
  const downloadChartImage = (chart: { toBase64Image: (type?: string, quality?: number) => string } | null, filename: string): boolean => {
    if (!chart) return false
    const url = chart.toBase64Image('image/png', 1)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    return true
  }

  // Every chart this page can render — passed to withWatermarksDisabled()
  // so Pro exports (PDF / Excel / PNG) read clean canvases. Null refs are skipped.
  const withAllWatermarksDisabled = <T,>(fn: () => T | Promise<T>) =>
    withWatermarksDisabled(
      [iChartRef.current, rChartRef.current, distChartRef.current, ecdfChartRef.current, attrChartRef.current],
      fn
    )

  const exportPNG = () => {
    if (!isLoggedIn) { goToLogin('spc', 'png'); return }
    const run = () => [
      downloadChartImage(iChartRef.current, 'spc-control-chart.png'),
      downloadChartImage(rChartRef.current, disp?.kind === 'xbar-s' ? 'spc-s-chart.png' : 'spc-range-chart.png'),
      downloadChartImage(distChartRef.current, 'spc-distribution-chart.png'),
      downloadChartImage(ecdfChartRef.current, 'spc-ecdf-chart.png'),
      downloadChartImage(attrChartRef.current, 'spc-attribute-chart.png'),
    ].some(Boolean)
    // Free accounts get the watermarked canvas; Pro accounts get clean images.
    Promise.resolve(isPro ? withAllWatermarksDisabled(run) : run()).then(exportedAny => {
      if (!exportedAny) setErrorMsg(t('spc_err_no_charts'))
    })
  }

  // ── Export: full report as PDF ── (Pro only)
  const runExportPDF = async () => {
    if (!isPro) { goToPricing('spc', 'pdf'); return }
    if (!result) {
      setErrorMsg(t('spc_err_no_report'))
      return
    }

    const targetNum = target !== '' && isFinite(parseFloat(target)) ? parseFloat(target) : null
    const ruleSignals: RuleSignal[] = [
      ...(varResult?.violations_x.map(v => ({ rule: v.rule, dispersionChart: false })) ?? []),
      ...(varResult?.violations_r.map(v => ({ rule: v.rule, dispersionChart: true })) ?? []),
      ...(attrResult?.violations.map(v => ({ rule: v.rule, dispersionChart: false })) ?? []),
    ]
    const cls = varResult && hasSpecLimits ? classifyCapability(pkVal) : null

    // Interpretation is computed once up front, on the server (Pro only):
    // the page-1 summary and the detailed sections later in the report must
    // say the same thing. The inputs are exactly the ones the page used to
    // pass to the interpretation functions itself.
    const capabilityIn: CapabilityInput | null = varResult && cls
      ? {
          LSL: varResult.LSL,
          USL: varResult.USL,
          target: targetNum,
          center: varResult.cl_x,
          mu: varResult.mu,
          sigmaWithin: varResult.sigma,
          sdOverall: varResult.sdOverall,
          normal: varResult.isNormal,
          signals: ruleSignals,
          n: varResult.n,
          adequacyTier: varResult.dataAdequacy.tier,
        }
      : null
    const usingCpkInConclusion = !!varResult && varResult.isNormal && varResult.Cpk !== null
    const conclusionIn: ConclusionInput | null = varResult || attrResult
      ? {
          classLabel: cls ? cls.label : null,
          indexName: cls && varResult ? (usingCpkInConclusion ? 'Cpk' : 'Ppk') : null,
          indexValue: cls ? pkVal : null,
          ppk: varResult ? varResult.Ppk : null,
          ppmOverall: varResult?.ppmD_lt ? varResult.ppmD_lt.total : null,
          yieldText: varResult?.ppmD_lt ? formatYieldPct(varResult.ppmD_lt.total) : null,
          normal: varResult ? varResult.isNormal : true,
          signals: ruleSignals,
          n: varResult ? varResult.n : attrResult!.dataAdequacy.n,
          adequacyTier: (varResult ?? attrResult)!.dataAdequacy.tier,
          attribute: attrResult
            ? { chartLabel: attrResult.chartLabel, metricText: `${attrResult.metricLabel} = ${fmt(attrResult.metric, 4)}` }
            : null,
        }
      : null
    const adequacyInfo = (varResult ?? attrResult)?.dataAdequacy
    const summaryIn: Omit<SummaryInput, 'headline'> | null = adequacyInfo && conclusionIn
      ? {
          signals: ruleSignals,
          capabilityText: cls && pkVal !== null
            ? `${cls.label} (${usingCpkInConclusion ? 'Cpk' : 'Ppk'} ${fmt(pkVal)})`
            : attrResult
            ? `${attrResult.chartLabel}: ${attrResult.metricLabel} = ${fmt(attrResult.metric, 4)}`
            : null,
          noSpecs: !!varResult && !hasSpecLimits,
          n: adequacyInfo.n,
          adequacyTier: adequacyInfo.tier,
          unit: attrResult ? 'subgroups' : 'readings',
        }
      : null

    let text: {
      diagnosis: Omit<CapabilityDiagnosis, 'facts'> | null
      conclusion: StudyConclusion | null
      summary: { rows: Array<[string, string]>; tone: Tone } | null
    }
    try {
      const res = await fetch('/api/spc/report-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ capability: capabilityIn, conclusion: conclusionIn, summary: summaryIn }, wireReplacer),
      })
      if (res.status === 403) { goToPricing('spc', 'pdf'); return }
      if (!res.ok) {
        setErrorMsg(res.status === 429 ? t('tool_rate_limited') : t('spc_err_report_failed'))
        return
      }
      text = await res.json()
    } catch {
      setErrorMsg(t('spc_err_network'))
      return
    }
    const diagnosis = text.diagnosis
    const conclusion = text.conclusion

    const ctx = createPdfReport('SPC Analysis Report', 'spc')

    if (cls) {
      classificationBanner(ctx, cls)
    } else if (varResult) {
      calloutBox(
        ctx,
        'No specification limits were provided — capability indices (Cp/Cpk/Pp/Ppk) are not applicable. Statistical control and stability are assessed below instead.',
        'info'
      )
    }

    if (adequacyInfo && conclusion && text.summary) {
      summaryBox(ctx, 'Summary', text.summary.rows, conclusion.tone)
    }

    if (varResult) {
      const dataTypeLabel = varResult.N === 1 ? 'Individual measurements' : `Subgrouped measurements (n=${varResult.N})`
      // Capability uses the pooled within-subgroup SD (unbiased with c4) for
      // subgroups — the old label "Average range / d2" did not match the code.
      const withinMethod = varResult.N === 1 ? 'Average moving range / d2' : 'Pooled standard deviation / c4'

      const studyRows: KVRow[] = [
        ['Data Type', dataTypeLabel],
        ['Observations', String(varResult.labels.length)],
        ['Subgroup Size', String(varResult.N)],
        ['Within Sigma Method', withinMethod],
        ['Chart', `${CHART_NAME[dispersionNames(varResult).kind]} chart`],
        ['Special-cause Tests', describeTestSet(varResult.testSet ?? DEFAULT_TEST_SET, varResult.N === 1 ? 'individuals' : 'xbar', dispersionNames(varResult).short)],
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
        varResult.dataAdequacy.tier === 'adequate' ? 'good' : 'warn'
      )

      if (cls && pkVal !== null) {
        const cpkCls = classifyCapability(varResult.Cpk)
        const ppkCls = classifyCapability(varResult.Ppk)
        const stable = allViolations.length === 0
        const usingCpk = varResult.isNormal && varResult.Cpk !== null
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
            : 'Cpk is shown for reference, as standard statistical software reports it, but the normality assumption was rejected, so the verdict uses Ppk, the performance index based on the overall variation observed in the study data.',
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
        { chart: rChartRef.current, title: dispersionNames(varResult).title }
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
          ['AD (A²)', fmt(varResult.ad?.A2, 3)],
          ['P-Value', formatPValue(varResult.ad?.p)],
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
          : 'The normal distribution assumption is rejected at the 0.05 level (p < 0.05). Cp, Cpk, Pp and Ppk are reported as standard statistical software does, but all of them, and the PPM estimates, assume a normal distribution, so treat them as approximate. The capability verdict uses Ppk. Consider a distribution fit or transformation for a non-normal process.',
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
            ['PPM', varResult.ppmD_st ? fmtPpm(varResult.ppmD_st.total) : '—'],
          ],
          overallStats: [
            ['StDev', fmt(varResult.sdOverall)],
            ['Pp', fmt(varResult.Pp)],
            ['Ppk', fmt(varResult.Ppk)],
            ['PPM', varResult.ppmD_lt ? fmtPpm(varResult.ppmD_lt.total) : '—'],
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
            ['Within - Below LSL', varResult.ppmD_st ? fmtPpm(varResult.ppmD_st.below, varResult.LSL !== null) : '—'],
            ['Within - Above USL', varResult.ppmD_st ? fmtPpm(varResult.ppmD_st.above, varResult.USL !== null) : '—'],
            ['Within - Total PPM', varResult.ppmD_st ? fmtPpm(varResult.ppmD_st.total) : '—'],
            ['Overall - Below LSL', varResult.ppmD_lt ? fmtPpm(varResult.ppmD_lt.below, varResult.LSL !== null) : '—'],
            ['Overall - Above USL', varResult.ppmD_lt ? fmtPpm(varResult.ppmD_lt.above, varResult.USL !== null) : '—'],
            ['Overall - Total PPM', varResult.ppmD_lt ? fmtPpm(varResult.ppmD_lt.total) : '—'],
            ['Estimated Yield (Overall)', formatYieldPct(varResult.ppmD_lt ? varResult.ppmD_lt.total : null)],
          ]
        )

        calloutBox(
          ctx,
          `Within PPM is based on within-process variation estimated from ${varResult.N === 1 ? 'the average moving range' : 'the pooled within-subgroup standard deviation'}, while Overall PPM is based on the total variation observed in the study data. The two estimates use different sigma values and may differ — this is expected and is not a check on each other.`,
          'info'
        )

        if (diagnosis) {
          dataTable(
            ctx,
            'Capability Diagnosis',
            [
              { header: 'DIMENSION', width: 150 },
              { header: 'RESULT', width: 150 },
              { header: 'ASSESSMENT', width: ctx.pageWidth - ctx.margin * 2 - 300 },
            ],
            diagnosis.rows.map(r => [r.dimension, r.result, r.assessment]),
            { cellColors: diagnosis.rows.map(r => [null, null, toneColor(r.tone)]) }
          )
          interpretationBox(ctx, 'Recommended Action', diagnosis.recommendedAction, diagnosis.tone)
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
        allViolations.map(v => [String(v.rule), v.label, v.chart, violationPointsText(v)])
      )
    }

    if (conclusion) {
      interpretationBox(ctx, 'Study Conclusion', conclusion.text, conclusion.tone)
      if (cls) criteriaReferenceTable(ctx)
    }

    finalizeReport(ctx)
    ctx.pdf.save('spc-report.pdf')
  }

  const exportPDF = () => withAllWatermarksDisabled(runExportPDF)

  // ── Chart builders ──────────────────────────────────────────────────────
  const lineChartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          labels: { color: c.muted, font: { size: 11 }, boxWidth: 14, filter: (item: { text: string }) => !['CL', 'MR̄', 'R̄', 'S̄'].includes(item.text) },
        },
        tooltip: {
          backgroundColor: c.surface,
          borderColor: c.border,
          borderWidth: 1,
          titleColor: c.text,
          bodyColor: c.muted,
          padding: 10,
        },
        // Diagonal tiled "qualityhub.tools" + bottom strip, baked directly
        // into the canvas pixels. Covers the live on-screen view and the
        // free PNG export (same canvas, same toBase64Image() call).
        // Disabled on the chart instance (not removed) just before a Pro
        // PDF/Excel export reads the canvas — see exportPDF / exportExcel.
        watermark: watermarkOptions('normal'),
      },
      layout: watermarkLayout(),
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
          borderColor: c.data,
          backgroundColor: c.data,
          pointBackgroundColor: labels.map(n => (violated.has(n) ? c.danger : c.data)),
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
        // Lighter density than the control charts: this options object is
        // shared by the Distribution/Capability Histogram and ECDF charts,
        // both visually denser (bars / step curve), so a lighter tile keeps
        // the watermark from competing with the data.
        watermark: watermarkOptions('light'),
      },
      layout: watermarkLayout(),
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
  // Capability Histogram: raw-data histogram + Overall/Within normal curves + spec limits.
  // Replaces the previous single-curve "Distribution vs. Spec" chart with the more
  // rigorous Overall-vs-Within comparison (mirrors the Xbar-R/S/I-MR capability histogram).
  function buildDistChart(vals: number[], mu: number, sigmaOverall: number, sigmaWithin: number, lsl: number | null, usl: number | null) {
    const n = vals.length
    const min = Math.min(...vals)
    const max = Math.max(...vals)
    const range = max - min || 1
    const binCount = Math.max(5, Math.min(20, Math.round(1 + Math.log2(n))))
    const binWidth = range / binCount
    const binEdges = Array.from({ length: binCount + 1 }, (_, i) => min + i * binWidth)
    const binCounts = new Array(binCount).fill(0)
    vals.forEach((v) => {
      let idx = Math.floor((v - min) / binWidth)
      if (idx >= binCount) idx = binCount - 1
      if (idx < 0) idx = 0
      binCounts[idx]++
    })
    const binCenters = binEdges.slice(0, -1).map((edge) => edge + binWidth / 2)

    const specVals = [lsl, usl].filter((v): v is number => v !== null)
    const rangeMin = Math.min(min, ...specVals)
    const rangeMax = Math.max(max, ...specVals)
    const fullRange = rangeMax - rangeMin || 1
    const curvePad = fullRange * 0.15
    const axisMin = rangeMin - curvePad
    const axisMax = rangeMax + curvePad

    const curveN = 80
    const curveX = Array.from({ length: curveN }, (_, i) => axisMin + ((axisMax - axisMin) * i) / (curveN - 1))
    const overallCurve = curveX.map((x) => normalPDF(x, mu, sigmaOverall) * n * binWidth)
    const withinCurve = curveX.map((x) => normalPDF(x, mu, sigmaWithin) * n * binWidth)
    const chartMaxY = Math.max(...binCounts, ...overallCurve, ...withinCurve) * 1.08

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const datasets: any[] = [
      {
        type: 'bar',
        label: 'Frequency',
        data: binCenters.map((x, i) => ({ x, y: binCounts[i] })),
        backgroundColor: `${c.data}80`,
        borderColor: c.data,
        borderWidth: 1,
        order: 2,
      },
      {
        type: 'line',
        label: 'Overall sigma',
        data: curveX.map((x, i) => ({ x, y: overallCurve[i] })),
        borderColor: c.text,
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.3,
        order: 1,
      },
      {
        type: 'line',
        label: 'Within sigma',
        data: curveX.map((x, i) => ({ x, y: withinCurve[i] })),
        borderColor: c.line,
        borderDash: [6, 4],
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.3,
        order: 1,
      },
    ]
    if (lsl !== null)
      datasets.push({ type: 'line', label: 'LSL', data: [{ x: lsl, y: 0 }, { x: lsl, y: chartMaxY }], borderColor: c.danger, borderWidth: 1.5, borderDash: [4, 3], pointRadius: 0, tension: 0, order: 0 })
    if (usl !== null)
      datasets.push({ type: 'line', label: 'USL', data: [{ x: usl, y: 0 }, { x: usl, y: chartMaxY }], borderColor: c.danger, borderWidth: 1.5, borderDash: [4, 3], pointRadius: 0, tension: 0, order: 0 })

    return { datasets, axisMin, axisMax }
  }

  // Empirical CDF vs. Normal CDF — mirrors createECDFChart()
  function buildEcdfChart(vals: number[], mu: number, sigma: number, lsl: number | null, usl: number | null) {
    const sorted = [...vals].sort((a, b) => a - b)
    const n = sorted.length
    const ecdf = sorted.map((x, i) => ({ x, y: (i + 1) / n }))
    // Plot range only: reach the spec limits so the normal curve spans the whole axis
    const xMin = Math.min(sorted[0] - 2 * sigma, lsl ?? Infinity)
    const xMax = Math.max(sorted[n - 1] + 2 * sigma, usl ?? -Infinity)
    const steps = 200
    const dx = (xMax - xMin) / steps
    const normPts = Array.from({ length: steps + 1 }, (_, i) => {
      const x = xMin + i * dx
      return { x, y: normalCDF((x - mu) / sigma) }
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const datasets: any[] = [
      { label: 'Normal CDF', data: normPts, borderColor: c.muted, borderWidth: 1.5, borderDash: [4, 3], pointRadius: 0, fill: false, showLine: true },
      { label: 'Empirical CDF', data: ecdf, backgroundColor: c.data, borderColor: c.data, pointRadius: 4, pointHoverRadius: 6, showLine: true, stepped: true, borderWidth: 1.5, fill: false },
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

  const distChartBuild = useMemo(() => {
    if (!varResult || submittedVals.length === 0) return null
    return buildDistChart(submittedVals, varResult.mu, varResult.sdOverall, varResult.sigma, varResult.LSL, varResult.USL)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [varResult, submittedVals, c])

  const distChartData = useMemo(
    () => (distChartBuild ? { datasets: distChartBuild.datasets } : { datasets: [] }),
    [distChartBuild]
  )

  const distChartOptions = useMemo(() => {
    const base = linearChartOptions(false)
    if (!distChartBuild) return base
    return {
      ...base,
      scales: {
        ...base.scales,
        x: { ...base.scales.x, min: distChartBuild.axisMin, max: distChartBuild.axisMax },
      },
    }
  }, [distChartBuild, linearChartOptions])

  const rangeVals = varResult ? varResult.rangeVals.map(v => v ?? 0) : []
  // Only the moving-range chart starts at observation 2; an R chart has a
  // range for every subgroup, including the first.
  const isMovingRange = varResult?.N === 1
  const disp = varResult ? dispersionNames(varResult) : null
  const rangeLabels = varResult ? (isMovingRange ? varResult.labels.slice(1) : varResult.labels) : []
  const rangeValsTrimmed = isMovingRange ? rangeVals.slice(1) : rangeVals

  const allViolations = [
    ...(varResult?.violations_x.map(v => ({ ...v, chart: t('spc_chart_xbar_indiv') })) ?? []),
    ...(varResult?.violations_r.map(v => ({ ...v, chart: disp?.short ?? t('spc_chart_r_mr') })) ?? []),
    ...(attrResult?.violations.map(v => ({ ...v, chart: attrResult.chartLabel })) ?? []),
  ]

  const adequacy = varResult?.dataAdequacy ?? attrResult?.dataAdequacy ?? null

  // Capability verdict prefers Cpk (short-term/within) and falls back to Ppk,
  // matching the legacy tool's `const pkVal = Cpk !== null ? Cpk : Ppk`
  const hasSpecLimits = !!(varResult && (varResult.LSL !== null || varResult.USL !== null))
  const pkVal = varResult ? (varResult.isNormal && varResult.Cpk !== null ? varResult.Cpk : varResult.Ppk) : null

  const displaySigLvl = varResult ? varResult.sigLvl_st ?? varResult.sigLvl_lt : null


  // ── Layout state (no effect on any calculation) ─────────────────────────
  // Phones show one panel at a time: setup, data or results.
  const [mobileTab, setMobileTab] = useState<'setup' | 'data' | 'results'>('setup')
  const [helpOpen, setHelpOpen] = useState(false)
  useEffect(() => {
    if (!helpOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setHelpOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [helpOpen])
  // "Try an example": golden dataset DS01 (15 readings, LSL 23, USL 25), analysed right away
  const exampleQueued = useRef(false)
  const loadExample = () => {
    setDataType('variable')
    setN(1)
    setVarRows(EXAMPLE_READINGS.map(v => ({ id: generateId(), vals: [v] })))
    setLSL('23')
    setUSL('25')
    setTarget('')
    setResult(null)
    setErrorMsg('')
    exampleQueued.current = true
  }
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const update = () => setNarrow(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  const runAnalyze = async () => {
    await analyze()
    setMobileTab('results')
    if (narrow) window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  // Runs once after "Try an example" has put the example data in place
  useEffect(() => {
    if (!exampleQueued.current) return
    exampleQueued.current = false
    void runAnalyze()
  })
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      for (const r of [iChartRef, rChartRef, distChartRef, ecdfChartRef, attrChartRef]) r.current?.resize()
    })
    return () => cancelAnimationFrame(id)
  }, [mobileTab, result])
  // On-screen verdicts (shared with I-MR, X̄-R, X̄-S): same thresholds as the report,
  // and the reason sentence from the report's own diagnosis
  const screenVerdict = varResult ? capabilityVerdict(varResult, t) : null
  const verdictReason = varResult?.screenReason ? (lang === 'ar' ? varResult.screenReason.ar : varResult.screenReason.en) : null
  const compactSave = useCompactSave()

  const gridMode = dataType === 'variable' && N === 1
  // Single readings (n = 1) show as an always-open numbered grid; subgroups keep the table
  const showData = gridMode || dataEntryOpen
  const fieldLabel = { fontSize: 13, fontWeight: 600, color: c.text, marginBottom: 8 } as const
  const nPoints = varResult ? varResult.n : attrResult ? attrResult.pts.length : 0
  const stable = allViolations.length === 0

  return (
    <div style={s.page}>
      <ToolStyles />
      <Nav theme={theme} setTheme={setTheme} breadcrumbKey="bc_spc" />

      {loadedProjectName && (
        <div className="qh-main" style={{ ...s.main, paddingBottom: 0 }}>
          <div style={{ fontSize: 13, color: c.accent, background: c.surface2, border: `1px solid ${c.border}`, borderRadius: 8, padding: '8px 14px' }}>
            {lang === 'ar' ? `تم تحميل المشروع المحفوظ: ${loadedProjectName}` : `Loaded saved project: ${loadedProjectName}`}
          </div>
        </div>
      )}

      <div className="tl-shell">
        <ToolSidebar current="/spc" />

        <div className="tl-main">
          <ToolHeader title="SPC Engine" intro={t('spc_intro')} onHelp={() => setHelpOpen(true)} onExample={loadExample} exampleDisabled={loading} />
          <HelpPanel
            open={helpOpen}
            onClose={() => setHelpOpen(false)}
            title={t('spc_help_title')}
            steps={([1, 2, 3, 4, 5, 6] as const).map(i => ({ t: t(`spc_help_s${i}_t`), d: t(`spc_help_s${i}_d`) }))}
            onExample={loadExample}
          />
          <PhoneTabs tab={mobileTab} onTab={setMobileTab} dataCount={dataType === 'variable' ? varRows.length : attrRows.length} />

          <div className="tl-top">
            {/* ── SETUP ──────────────────────────────────────────────────── */}
            <section className="tl-panel tl-setup" data-active={mobileTab === 'setup'} aria-label={t('spc_tab_setup')} style={s.card}>
          <div>
            <div style={fieldLabel}>{t('spc_data_type')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button
                style={{
                  ...s.exportBtn,
                  background: dataType === 'variable' ? c.accent : s.exportBtn.background,
                  color: dataType === 'variable' ? 'var(--qh-onAccent)' : c.text,
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
                  color: dataType === 'attribute' ? 'var(--qh-onAccent)' : c.text,
                  border: dataType === 'attribute' ? `1px solid ${c.accent}` : s.exportBtn.border,
                }}
                onClick={() => { setDataType('attribute'); setResult(null); setErrorMsg('') }}
              >
                {t('spc_attribute')}
              </button>
            </div>
          </div>

          {dataType === 'variable' ? (
            <>
              <div>
                <div style={fieldLabel}>{t('spc_subgroup_size')}</div>
                <input
                  className="tl-input"
                  type="number"
                  min={1}
                  max={25}
                  value={N}
                  onChange={e => handleNChange(parseInt(e.target.value, 10) || 1)}
                />
                <div className="tl-hint">{t(N === 1 ? 'spc_subgroup_hint_imr' : N >= XBAR_S_MIN_N ? 'spc_subgroup_hint_xs' : 'spc_subgroup_hint_xr')}</div>
              </div>

              <SpecLimits lsl={LSL} target={target} usl={USL} onLsl={setLSL} onTarget={setTarget} onUsl={setUSL} />

              <div>
                <button
                  onClick={() => setAdvancedOpen(o => !o)}
                  style={{
                    ...fieldLabel,
                    marginBottom: 0,
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
                      <div style={s.label}>{t('spc_tests_label')}</div>
                      <select style={s.select} value={testSet} onChange={e => setTestSet(e.target.value as TestSet)}>
                        <option value="assistant">{t('spc_tests_assistant')}</option>
                        <option value="all">{t('spc_tests_all')}</option>
                      </select>
                      <div style={{ fontSize: 11, color: c.muted, marginTop: 4, lineHeight: 1.5 }}>{t('spc_tests_help')}</div>
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
                <div style={fieldLabel}>{t('spc_chart_type')}</div>
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
              <div>
                <div style={s.label}>{t('spc_tests_label')}</div>
                <select style={s.select} value={testSet} onChange={e => setTestSet(e.target.value as TestSet)}>
                  <option value="assistant">{t('spc_tests_assistant')}</option>
                  <option value="all">{t('spc_tests_all')}</option>
                </select>
              </div>
            </>
          )}
          <div className="tl-setup-analyze">
            <button className="tl-analyze" onClick={runAnalyze} disabled={loading}>
              {loading ? t('spc_analyzing') : t('spc_analyze_btn')}
            </button>
          </div>
            </section>

            <div className="tl-col">
            {/* ── DATA ───────────────────────────────────────────────────── */}
            <section className="tl-panel tl-data" data-active={mobileTab === 'data'} aria-label={t('spc_tab_data')}>
          <div className="tl-card">
            <DataCardHead
              countLabel={dataType === 'variable'
                ? (N === 1 ? t('spc_readings_count') : t('spc_subgroups_count')).replace('{n}', String(varRows.length))
                : t('spc_rows_entered').replace('{n}', String(attrRows.length))}
              onUpload={gridImport.openFilePicker}
              onClear={clearAll}
              extra={
                <>
                  <gridImport.FileInput />
                  {!gridMode && (
                    <button type="button" className="tl-xbtn tl-xbtn-sm" onClick={() => setDataEntryOpen(o => !o)}>
                      {dataEntryOpen ? t('spc_collapse') : t('spc_edit_data')}
                    </button>
                  )}
                </>
              }
            />

            {showData && gridImport.fileError && (
              <div style={{ color: 'var(--qh-danger)', fontSize: 11, marginBottom: 8 }}>{gridImport.fileError}</div>
            )}
            {showData && (
              <SheetPicker
                sheetNames={gridImport.sheetNames}
                activeSheet={gridImport.activeSheet}
                onSelect={gridImport.selectSheet}
                accentColor={c.accent}
                textColor={c.text}
                mutedColor={c.muted}
                borderColor={c.border}
              />
            )}

            {gridMode && (
              <ReadingsGrid
                values={varRows.map(r => r.vals[0] ?? '')}
                onChange={(i, v) => updateVarCell(varRows[i].id, 0, v)}
                onRemove={i => removeVarRow(varRows[i].id)}
                onAdd={addVarRow}
              />
            )}
            {!gridMode && dataEntryOpen && (dataType === 'variable' ? (
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
            </section>

          {/* ── RESULTS ──────────────────────────────────────────────────── */}
          <section className="tl-panel tl-results" data-active={mobileTab === 'results'} aria-label={t('spc_tab_results')}>
          {result && (
            <ResultsHead nPoints={nPoints} ad={varResult ? (varResult.ad ?? null) : undefined} isNormal={varResult?.isNormal ?? true} hasSpec={hasSpecLimits}>
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
                    tool="spc"
                    defaultName={`SPC — ${new Date().toLocaleDateString('en-US')}`}
                    compact={compactSave}
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
                              testSet,
                            },
                            results: result,
                          }
                    }
                  />
                }
              />
            </ResultsHead>
          )}
          {errorMsg && <div className="tl-error">{errorMsg}</div>}
          {/* ── VERDICTS: stability + capability, first thing on the results ── */}
          {result && <VerdictCards stable={stable} nPoints={nPoints} nSubgroups={varResult && varResult.N > 1 ? varResult.xbarVals.length : undefined} signals={allViolations.length} verdict={screenVerdict} reason={verdictReason} />}
          {/* ── VARIABLE RESULTS ───────────────────────────────────────── */}
          {varResult && (
            <>
              <KpiGrid r={varResult} hasSpec={hasSpecLimits} pkName={screenVerdict?.pkName ?? null} displayMode={displayMode} capColor={capabilityColor} />

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
                  {disp && t(disp.titleKey)}
                </div>
                <div style={{ color: c.muted, fontSize: 12, marginBottom: 16 }}>
                  {disp?.bar} = {fmt(varResult.cl_r)} · UCL = {fmt(varResult.ucl_r)} · LCL = {fmt(Math.max(0, varResult.lcl_r))}
                </div>
                <div className="qh-chart-inner" style={s.chartInner}>
                  <Chart
                    ref={rChartRef}
                    type="line"
                    data={buildControlChart(rangeLabels, rangeValsTrimmed, varResult.ucl_r, varResult.cl_r, Math.max(0, varResult.lcl_r), violatedR, disp?.point ?? 'Range', disp?.bar ?? 'R̄')}
                    options={lineChartOptions}
                  />
                </div>
              </div>

              {/* ── CAPABILITY ANALYSIS (only when LSL/USL is set) ─────── */}
              {hasSpecLimits ? (
                <>
                  {allViolations.length > 0 && (
                    <div style={{ ...s.card, display: 'flex', gap: 12, alignItems: 'flex-start', background: 'color-mix(in srgb, var(--qh-amber) 8%, transparent)', border: '1px solid #f59e0b55' }}>
                      <div style={{ fontSize: 20 }}>⚠️</div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--qh-amber)' }}>{t('spc_capability_needs_stability_title')}</div>
                        <div style={{ fontSize: 12, color: c.muted, marginTop: 2 }}>{t('spc_capability_needs_stability_note')}</div>
                      </div>
                    </div>
                  )}
                  {/* All indices: open on desktop, tap to open on phones */}
                  <details key={narrow ? 'n' : 'w'} className="tl-more" open={!narrow}>
                    <summary>{t('spc_show_all_indices')}</summary>
                    <div className="tl-more-body">
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
                              {(displayMode === 'benchmark' || displayMode === 'both') && (
                                <>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, borderBottom: `1px solid ${c.border}`, padding: '4px 0' }}>
                                    <span style={{ color: c.muted }}>{t('spc_stat_sigma_st')}</span><span>{fmt(varResult.sigLvl_st)}σ</span>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, borderBottom: `1px solid ${c.border}`, padding: '4px 0' }}>
                                    <span style={{ color: c.muted }}>{t('spc_stat_sigma_lt')}</span><span>{fmt(varResult.sigLvl_lt)}σ</span>
                                  </div>
                                </>
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
                            <div key={item.label} style={{ ...s.statCard, border: `1px solid ${tint(capabilityColor(item.val), 27)}` }}>
                              <div style={{ ...s.statVal, color: capabilityColor(item.val) }}>{fmt(item.val)}</div>
                              <div style={s.statLabel}>{item.label}</div>
                              <div style={{ fontSize: 10, color: capabilityColor(item.val), marginTop: 4 }}>{capabilityLabel(item.val)}</div>
                            </div>
                          ))}
                          {varResult.Cpm !== null && (
                            <div style={{ ...s.statCard, border: `1px solid ${tint(capabilityColor(varResult.Cpm), 27)}` }}>
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
                          <div className="qh-table-wrap qh-table-fit" style={{ overflowX: 'auto' }}>
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
                    </div>
                  </details>

                  {submittedVals.length > 0 && (
                    <div className="qh-chart-wrap" style={s.chartWrap}>
                      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>{t('spc_dist_vs_spec')}</div>
                      <div className="qh-chart-inner" style={s.chartInner}>
                        <Chart
                          ref={distChartRef}
                          type="bar"
                          data={distChartData}
                          options={distChartOptions}
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
          {result && adequacy && <AdequacyCard adequacy={adequacy} />}
          {/* ── TESTS FOR SPECIAL CAUSES ───────────────────────────────── */}
          {result && <ViolationsCard items={allViolations} allTests={(result.testSet ?? DEFAULT_TEST_SET) === 'all'} />}

          {!result && !errorMsg && (
            <div style={{ ...s.card, textAlign: 'center', padding: 60, color: c.muted }}>
              {t('spc_empty_state')}
            </div>
          )}
          </section>
            </div>
          </div>
        </div>
      </div>

      {/* Phone action bar */}
      <PhoneBar showResultActions={mobileTab === 'results' && !!result} loading={loading} onAnalyze={runAnalyze} onEdit={() => setMobileTab('data')} />

      {pasteToast && <div style={s.toast}>{t('spc_toast')}</div>}
    </div>
  )
}
