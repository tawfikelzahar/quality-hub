'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import 'chart.js/auto'
import type { Chart as ChartJSInstance } from 'chart.js'
import { Chart } from 'react-chartjs-2'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import { COLORS, getSharedStyles, usePersistedTheme } from '@/lib/theme'
import Nav from '@/components/Nav'
import SaveAnalysisButton from '@/components/SaveAnalysisButton'
import { LockedSection } from '@/components/Locked'
import { useSubscription } from '@/lib/useSubscription'
import { goToLogin, goToPricing } from '@/lib/exportGate'
import { useLanguage } from '@/lib/i18n/context'

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
  const { t } = useLanguage()
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

  // ── Export: Data + Stats as Excel workbook ── (Pro only)
  const exportExcel = () => {
    if (!isPro) { goToPricing(); return }
    const wb = XLSX.utils.book_new()

    if (dataType === 'variable') {
      const rows = varRows.map((r, i) => {
        const row: Record<string, string | number> = { Subgroup: i + 1 }
        r.vals.forEach((v, j) => { row[N === 1 ? 'Value' : `x${j + 1}`] = v === '' ? '' : parseFloat(v) })
        return row
      })
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Raw Data')
    } else {
      const needsN = attrType === 'p' || attrType === 'u'
      const rows = attrRows.map((r, i) => {
        const row: Record<string, string | number> = { Row: i + 1 }
        if (needsN) row['Sample Size (n)'] = r.n === '' ? '' : parseFloat(r.n)
        row['Defects'] = r.defects === '' ? '' : parseFloat(r.defects)
        return row
      })
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Raw Data')
    }

    if (varResult) {
      const chartWord = varResult.N === 1 ? 'Individuals' : 'X̄'
      const clWord = varResult.N === 1 ? 'MR̄' : 'R̄'
      const summary = [
        { Metric: 'Data Points', Value: varResult.n },
        { Metric: 'Overall Mean', Value: varResult.mu },
        { Metric: 'Within Std Dev (σ)', Value: varResult.sigma },
        { Metric: 'Overall Std Dev', Value: varResult.sdOverall },
        { Metric: 'Anderson-Darling A²', Value: varResult.ad?.A2 ?? '' },
        { Metric: 'Anderson-Darling p-value', Value: varResult.ad?.p ?? '' },
        { Metric: 'Normality', Value: varResult.isNormal ? 'Normal' : 'Non-Normal' },
        { Metric: `${chartWord} CL`, Value: varResult.cl_x },
        { Metric: `${chartWord} UCL`, Value: varResult.ucl_x },
        { Metric: `${chartWord} LCL`, Value: varResult.lcl_x },
        { Metric: clWord, Value: varResult.cl_r },
        { Metric: 'Range/MR UCL', Value: varResult.ucl_r },
        { Metric: 'Range/MR LCL', Value: Math.max(0, varResult.lcl_r) },
      ]
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), 'Summary')

      if (hasSpecLimits) {
        const cap = [
          { Metric: 'LSL', Value: varResult.LSL ?? '' },
          { Metric: 'USL', Value: varResult.USL ?? '' },
          { Metric: 'Cp', Value: varResult.Cp ?? '' },
          { Metric: 'Cpk', Value: varResult.Cpk ?? '' },
          { Metric: 'Pp', Value: varResult.Pp ?? '' },
          { Metric: 'Ppk', Value: varResult.Ppk ?? '' },
          { Metric: 'Cpm', Value: varResult.Cpm ?? '' },
          { Metric: 'Sigma Level (Short-term)', Value: varResult.sigLvl_st ?? '' },
          { Metric: 'Sigma Level (Long-term)', Value: varResult.sigLvl_lt ?? '' },
          { Metric: 'Z-bench (Short-term)', Value: varResult.Z_bench_st ?? '' },
          { Metric: 'Z-bench (Long-term)', Value: varResult.Z_bench_lt ?? '' },
          { Metric: 'PPM Above USL (Short-term)', Value: varResult.ppmD_st?.above ?? '' },
          { Metric: 'PPM Below LSL (Short-term)', Value: varResult.ppmD_st?.below ?? '' },
          { Metric: 'Total PPM (Short-term)', Value: varResult.ppmD_st?.total ?? '' },
          { Metric: 'PPM Above USL (Long-term)', Value: varResult.ppmD_lt?.above ?? '' },
          { Metric: 'PPM Below LSL (Long-term)', Value: varResult.ppmD_lt?.below ?? '' },
          { Metric: 'Total PPM (Long-term)', Value: varResult.ppmD_lt?.total ?? '' },
        ]
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cap), 'Capability')
      }
    } else if (attrResult) {
      const summary = [
        { Metric: 'Chart Type', Value: attrResult.chartLabel },
        { Metric: 'Subgroups', Value: attrResult.pts.length },
        { Metric: attrResult.metricLabel, Value: attrResult.metric },
        { Metric: 'CL', Value: attrResult.clVal },
        { Metric: 'UCL', Value: attrResult.ucl },
        { Metric: 'LCL', Value: Math.max(0, attrResult.lcl) },
        { Metric: 'DPM', Value: attrResult.dpm },
        { Metric: 'Sigma Level', Value: attrResult.sigmaLvl },
      ]
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), 'Summary')
    }

    if (allViolations.length > 0) {
      const viol = allViolations.map(v => ({
        Chart: v.chart,
        Rule: v.rule,
        Test: v.label,
        Description: v.desc,
        Points: expandViolationPoints(v).join(', '),
      }))
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(viol), 'Nelson Violations')
    }

    XLSX.writeFile(wb, 'spc-report.xlsx')
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
    if (!isLoggedIn) { goToLogin(); return }
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
    if (!isPro) { goToPricing(); return }
    if (!result) {
      setErrorMsg(t('spc_err_no_report'))
      return
    }
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 40
    let y = margin

    const ensureSpace = (needed: number) => {
      if (y + needed > pageHeight - margin) {
        pdf.addPage()
        y = margin
      }
    }

    pdf.setFontSize(18)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(0)
    pdf.text('SPC Analysis Report', margin, y)
    y += 10
    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(100)
    pdf.text(`Generated: ${new Date().toLocaleDateString()}`, margin, y + 12)
    y += 30

    const addChartImage = (chart: ChartJSInstance<'line'> | ChartJSInstance<'scatter'> | null, title: string) => {
      if (!chart) return
      ensureSpace(60)
      pdf.setFontSize(12)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(0)
      pdf.text(title, margin, y)
      y += 12
      const imgData = chart.toBase64Image('image/png', 1)
      const imgWidth = pageWidth - margin * 2
      const imgHeight = (chart.height / chart.width) * imgWidth
      ensureSpace(imgHeight)
      pdf.addImage(imgData, 'PNG', margin, y, imgWidth, imgHeight)
      y += imgHeight + 24
    }

    if (varResult) {
      pdf.setFontSize(11)
      pdf.setTextColor(0)
      pdf.text(
        `N=${varResult.n}  ·  Mean=${fmt(varResult.mu)}  ·  σ(within)=${fmt(varResult.sigma)}  ·  ${varResult.isNormal ? 'Normal' : 'Non-Normal'} (p=${fmt(varResult.ad?.p ?? null, 3)})`,
        margin,
        y
      )
      y += 24
      addChartImage(iChartRef.current, varResult.N === 1 ? 'Individuals (I) Chart' : 'X̄ Chart')
      addChartImage(rChartRef.current, varResult.N === 1 ? 'Moving Range (MR) Chart' : 'Range (R) Chart')

      if (hasSpecLimits) {
        ensureSpace(70)
        pdf.setFontSize(12)
        pdf.setFont('helvetica', 'bold')
        pdf.setTextColor(0)
        pdf.text('Process Capability', margin, y)
        y += 16
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(10)
        const capLines = [
          `Cp = ${fmt(varResult.Cp)}   Cpk = ${fmt(varResult.Cpk)}   Pp = ${fmt(varResult.Pp)}   Ppk = ${fmt(varResult.Ppk)}${varResult.Cpm !== null ? `   Cpm = ${fmt(varResult.Cpm, 4)}` : ''}`,
          `Sigma Level: ${fmt(varResult.sigLvl_st)}σ (short-term) / ${fmt(varResult.sigLvl_lt)}σ (long-term)`,
          `Total PPM: ${varResult.ppmD_st ? varResult.ppmD_st.total.toFixed(2) : '—'} (short-term) / ${varResult.ppmD_lt ? varResult.ppmD_lt.total.toFixed(2) : '—'} (long-term)`,
        ]
        capLines.forEach(line => {
          pdf.text(line, margin, y)
          y += 14
        })
        if (verdict) {
          y += 4
          pdf.setFont('helvetica', 'bold')
          pdf.text(verdict.text, margin, y)
          y += 18
        }
        pdf.setFont('helvetica', 'normal')
        addChartImage(distChartRef.current, 'Distribution vs. Specification Limits')
      }
      addChartImage(ecdfChartRef.current, 'Empirical CDF vs. Normal Distribution')
    } else if (attrResult) {
      pdf.setFontSize(11)
      pdf.setTextColor(0)
      pdf.text(
        `${attrResult.chartLabel}  ·  Subgroups=${attrResult.pts.length}  ·  ${attrResult.metricLabel}=${fmt(attrResult.metric, 4)}  ·  DPM=${Math.round(attrResult.dpm)}  ·  Sigma=${isFinite(attrResult.sigmaLvl) ? fmt(attrResult.sigmaLvl) : '6.00+'}`,
        margin,
        y
      )
      y += 24
      addChartImage(attrChartRef.current, attrResult.chartLabel)
    }

    if (allViolations.length > 0) {
      ensureSpace(50)
      pdf.setFontSize(12)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(0)
      pdf.text('Nelson Rule Violations', margin, y)
      y += 16
      const rowHeight = 18
      const colX = [margin, margin + 60, margin + 180, margin + 320]
      const drawHeader = () => {
        pdf.setFillColor(230, 230, 230)
        pdf.rect(margin, y, pageWidth - margin * 2, rowHeight, 'F')
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(9)
        pdf.setTextColor(0)
        pdf.text('Rule', colX[0] + 4, y + 13)
        pdf.text('Test', colX[1] + 4, y + 13)
        pdf.text('Chart', colX[2] + 4, y + 13)
        pdf.text('Points', colX[3] + 4, y + 13)
        y += rowHeight
      }
      drawHeader()
      pdf.setFont('helvetica', 'normal')
      allViolations.forEach(v => {
        if (y + rowHeight > pageHeight - margin) {
          pdf.addPage()
          y = margin
          drawHeader()
        }
        pdf.setTextColor(0)
        pdf.text(String(v.rule), colX[0] + 4, y + 13)
        pdf.text(v.label.slice(0, 26), colX[1] + 4, y + 13)
        pdf.text(v.chart.slice(0, 22), colX[2] + 4, y + 13)
        pdf.text(expandViolationPoints(v).join(',').slice(0, 26), colX[3] + 4, y + 13)
        y += rowHeight
      })
    } else {
      ensureSpace(20)
      pdf.setFontSize(10)
      pdf.setTextColor(0, 150, 0)
      pdf.text('No Nelson Rule violations — process in statistical control.', margin, y)
    }

    pdf.save('spc-report.pdf')
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
                <LockedSection theme={theme} feature={t('spc_normality_test')} minHeight={72}>
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
                </LockedSection>
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
                    <LockedSection theme={theme} feature={t('spc_distribution_chart_feature')} minHeight={340}>
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
                    </LockedSection>
                  )}
                </>
              ) : (
                <div style={{ ...s.card, fontSize: 11, color: c.muted }}>
                  {t('spc_enter_spec_hint')}
                </div>
              )}

              {submittedVals.length > 0 && (
                <LockedSection theme={theme} feature={t('spc_ecdf_feature')} minHeight={340}>
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
                </LockedSection>
              )}
            </>
          )}

          {/* ── ATTRIBUTE RESULTS ──────────────────────────────────────── */}
          {attrResult && (
            <LockedSection theme={theme} feature={t('spc_attr_feature')} minHeight={420}>
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
            </LockedSection>
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
            <LockedSection theme={theme} feature={t('spc_nelson_feature')} minHeight={140}>
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
            </LockedSection>
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
