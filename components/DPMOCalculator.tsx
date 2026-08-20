'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import 'chart.js/auto'
import { Chart } from 'react-chartjs-2'
import type { Chart as ChartJSInstance } from 'chart.js'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import { COLORS, usePersistedTheme } from '@/lib/theme'
import Nav from '@/components/Nav'
import SaveAnalysisButton from '@/components/SaveAnalysisButton'
import { useSubscription } from '@/lib/useSubscription'
import { goToLogin, goToPricing } from '@/lib/exportGate'
import { useLanguage } from '@/lib/i18n/context'
import type { TKey } from '@/lib/i18n/translations'
import { createReport, nowStamp, type Tone } from '@/lib/excelReport'

interface ProcessRow {
  id: string
  name: string
  units: number
  opportunities: number
  defects: number
}

// Performance bands (industry-standard Six Sigma benchmarks)
// `label` stays English — used verbatim in CSV/Excel/PDF exports.
// `labelKey` is the translated version shown in the UI (badges, tooltips, stats).
const SIGMA_BANDS = [
  { min: 6, label: 'World Class', labelKey: 'dpmo_band_worldclass' as TKey, color: '#3b82f6' },
  { min: 5, label: 'Excellent', labelKey: 'dpmo_band_excellent' as TKey, color: '#22c55e' },
  { min: 4, label: 'Good', labelKey: 'dpmo_band_good' as TKey, color: '#84cc16' },
  { min: 3, label: 'Industry Average', labelKey: 'dpmo_band_avg' as TKey, color: '#f59e0b' },
  { min: 2, label: 'Needs Improvement', labelKey: 'dpmo_band_needsimprovement' as TKey, color: '#f97316' },
  { min: 0, label: 'Non-Competitive', labelKey: 'dpmo_band_noncompetitive' as TKey, color: '#ef4444' },
]

function sigmaBand(sigma: number) {
  return SIGMA_BANDS.find(b => sigma >= b.min) || SIGMA_BANDS[SIGMA_BANDS.length - 1]
}

function generateId() {
  return Math.random().toString(36).slice(2, 9)
}

// ── Inverse Normal CDF (Acklam's algorithm) — industry-standard for Sigma Level ──
function normSInv(p: number): number {
  if (p <= 0) return -6
  if (p >= 1) return 6

  const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00]
  const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01]
  const cc = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00]
  const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00]

  const pLow = 0.02425
  const pHigh = 1 - pLow

  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p))
    return (((((cc[0] * q + cc[1]) * q + cc[2]) * q + cc[3]) * q + cc[4]) * q + cc[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  } else if (p <= pHigh) {
    const q = p - 0.5
    const r = q * q
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p))
    return -(((((cc[0] * q + cc[1]) * q + cc[2]) * q + cc[3]) * q + cc[4]) * q + cc[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  }
}

function calcMetrics(units: number, opportunities: number, defects: number) {
  const totalOpportunities = units * opportunities
  if (totalOpportunities <= 0) return { dpo: 0, dpmo: 0, yieldPct: 100, sigma: 6 }

  const dpo = Math.min(defects / totalOpportunities, 0.9999999)
  const dpmo = dpo * 1_000_000
  const yieldPct = (1 - dpo) * 100
  // Standard long-term Sigma Level with 1.5σ shift
  const sigma = Math.max(0, Math.min(6, normSInv(1 - dpo) + 1.5))

  return { dpo, dpmo, yieldPct, sigma }
}

function parseDelimited(text: string): ProcessRow[] {
  const lines = text.trim().split('\n').filter(Boolean)
  const rows: ProcessRow[] = []
  for (const line of lines) {
    const delimiter = line.includes('\t') ? '\t' : ','
    const parts = line.split(delimiter).map(p => p.trim().replace(/^"|"$/g, ''))
    if (parts.length >= 4) {
      const [name, units, opportunities, defects] = parts
      const u = parseFloat(units), o = parseFloat(opportunities), d = parseFloat(defects)
      if (name && !isNaN(u) && !isNaN(o) && !isNaN(d)) {
        rows.push({ id: generateId(), name, units: u, opportunities: o, defects: d })
      }
    }
  }
  return rows
}

function parseExcelFile(file: File): Promise<ProcessRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const data = e.target?.result
        const workbook = XLSX.read(data, { type: 'binary' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const json: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 })
        const rows: ProcessRow[] = []
        for (const row of json) {
          if (Array.isArray(row) && row.length >= 4) {
            const name = String(row[0] ?? '').trim()
            const u = parseFloat(String(row[1] ?? ''))
            const o = parseFloat(String(row[2] ?? ''))
            const d = parseFloat(String(row[3] ?? ''))
            if (name && !isNaN(u) && !isNaN(o) && !isNaN(d)) {
              rows.push({ id: generateId(), name, units: u, opportunities: o, defects: d })
            }
          }
        }
        resolve(rows)
      } catch {
        reject(new Error('Could not read Excel file'))
      }
    }
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.readAsBinaryString(file)
  })
}

export default function DPMOCalculator() {
  const { isPro, isLoggedIn } = useSubscription()
 const [theme, setTheme] = usePersistedTheme()
  const { t, lang } = useLanguage()
  const [rows, setRows] = useState<ProcessRow[]>([
    { id: generateId(), name: 'Assembly Line A', units: 500, opportunities: 12, defects: 18 },
  ])
  const [dragOver, setDragOver] = useState(false)
  const [fileError, setFileError] = useState('')
  const [pasteToast, setPasteToast] = useState(false)
  const [loadedProjectName, setLoadedProjectName] = useState('')
  const [showReference, setShowReference] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const chartRef = useRef<ChartJSInstance<'bar'>>(null)
  const c = COLORS[theme]

  const results = rows
    .filter(r => r.name.trim() && r.units > 0 && r.opportunities > 0)
    .map(r => ({ ...r, ...calcMetrics(r.units, r.opportunities, r.defects) }))

  const addRow = () => {
    setRows(prev => [...prev, { id: generateId(), name: '', units: 0, opportunities: 0, defects: 0 }])
  }

  const updateRow = (id: string, field: keyof ProcessRow, val: string) => {
    setRows(prev =>
      prev.map(r =>
        r.id === id
          ? { ...r, [field]: field === 'name' ? val : parseFloat(val) || 0 }
          : r
      )
    )
  }

  const removeRow = (id: string) => setRows(prev => prev.filter(r => r.id !== id))

  const clearAll = () => {
    if (rows.length === 0) return
    if (window.confirm(t('dpmo_confirm_clear'))) setRows([])
  }

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      const text = e.clipboardData?.getData('text')
      if (!text) return
      const parsed = parseDelimited(text)
      if (parsed.length > 0) {
        e.preventDefault()
        setRows(parsed)
        setFileError('')
        setPasteToast(true)
        setTimeout(() => setPasteToast(false), 2000)
      }
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [])

  // ── Load a saved project from the dashboard (?id=...) ──────────────────
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id')
    if (!id) return
    fetch(`/api/saved-analyses/${id}`)
      .then(res => (res.ok ? res.json() : Promise.reject()))
      .then(({ analysis }) => {
        setRows(analysis.input_data as ProcessRow[])
        setLoadedProjectName(analysis.name as string)
      })
      .catch(() =>
        setFileError(lang === 'ar' ? 'تعذر تحميل المشروع المحفوظ.' : 'Could not load the saved project.')
      )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleFile = useCallback((file: File) => {
    setFileError('')
    const isCSV = file.name.endsWith('.csv')
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
    if (!isCSV && !isExcel) {
      setFileError(t('dpmo_err_filetype'))
      return
    }
    if (isCSV) {
      const reader = new FileReader()
      reader.onload = e => {
        const parsed = parseDelimited(e.target?.result as string)
        if (parsed.length === 0) {
          setFileError(t('dpmo_err_novaliddata'))
          return
        }
        setRows(parsed)
      }
      reader.readAsText(file)
    } else {
      parseExcelFile(file)
        .then(parsed => {
          if (parsed.length === 0) {
            setFileError(t('dpmo_err_novaliddata_excel'))
            return
          }
          setRows(parsed)
        })
        .catch(() => setFileError(t('dpmo_err_readexcel')))
    }
  }, [t])

  const exportCSV = () => {
    if (!isLoggedIn) { goToLogin('dpmo', 'csv'); return }
    const header = 'Process,Units,Opportunities per Unit,Defects,DPO,DPMO,Yield %,Sigma Level,Rating\n'
    const body = results
      .map(r => {
        const band = sigmaBand(r.sigma)
        return `"${r.name}",${r.units},${r.opportunities},${r.defects},${r.dpo.toFixed(6)},${Math.round(r.dpmo)},${r.yieldPct.toFixed(2)}%,${r.sigma.toFixed(2)},${band.label}`
      })
      .join('\n')
    const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'dpmo-analysis.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportExcel = async () => {
    if (!isPro) { goToPricing('dpmo', 'excel'); return }
    const report = createReport({ toolName: 'DPMO Calculator' })
    const bandTone = (sigma: number): Tone => sigma >= 5 ? 'good' : sigma >= 3 ? 'warning' : 'danger'

    const overview = report.addSheet('Overview')
    overview.titleBand('DPMO & Sigma Level Report', `${results.length} process(es) analyzed`)
    overview.metaStrip([
      ['Generated on', nowStamp()],
      ['Standard', 'Six Sigma DPMO / Sigma Level (industry benchmarks)'],
    ])

    if (results.length > 0) {
      const avgSigma = results.reduce((s, r) => s + r.sigma, 0) / results.length
      const worst = results.reduce((a, b) => (a.sigma < b.sigma ? a : b))
      overview.sectionHeading('At a Glance')
      overview.kpiRow([
        { label: 'Processes', value: results.length, tone: 'neutral' },
        { label: 'Avg Sigma Level', value: avgSigma.toFixed(2), tone: bandTone(avgSigma) },
        { label: 'Lowest Sigma', value: `${worst.sigma.toFixed(2)} (${worst.name})`, tone: bandTone(worst.sigma) },
      ])
    }

    overview.sectionHeading('Process Detail')
    overview.table({
      headers: [
        { header: 'Process', key: 'process', align: 'left', width: 22 },
        { header: 'Units', key: 'units', align: 'right' },
        { header: 'Opportunities/Unit', key: 'opp', align: 'right' },
        { header: 'Defects', key: 'defects', align: 'right' },
        { header: 'DPO', key: 'dpo', align: 'right' },
        { header: 'DPMO', key: 'dpmo', align: 'right' },
        { header: 'Yield %', key: 'yield', align: 'right' },
        { header: 'Sigma Level', key: 'sigma', align: 'right' },
        { header: 'Rating', key: 'rating', align: 'left', width: 20 },
      ],
      rows: results.map(r => [
        r.name, r.units, r.opportunities, r.defects,
        r.dpo.toFixed(6), Math.round(r.dpmo), `${r.yieldPct.toFixed(2)}%`, r.sigma.toFixed(2),
        sigmaBand(r.sigma).label,
      ]),
      rowTones: results.map(r => bandTone(r.sigma)),
    })
    overview.freezeHeader(2)

    await report.download('dpmo-analysis.xlsx')
  }

  const exportPNG = () => {
    if (!isLoggedIn) { goToLogin('dpmo', 'png'); return }
    const chart = chartRef.current
    if (!chart) return
    const url = chart.toBase64Image('image/png', 1)
    const a = document.createElement('a')
    a.href = url
    a.download = 'sigma-level-chart.png'
    a.click()
  }

  const exportPDF = () => {
    if (!isPro) { goToPricing('dpmo', 'pdf'); return }
    const chart = chartRef.current
    if (!chart) return
    const imgData = chart.toBase64Image('image/png', 1)
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 40
    let y = margin

    pdf.setFontSize(18)
    pdf.setFont('helvetica', 'bold')
    pdf.text('DPMO & Sigma Level Analysis', margin, y)
    y += 10
    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(100)
    pdf.text(`Generated: ${new Date().toLocaleDateString()}`, margin, y + 12)
    y += 34

    const imgWidth = pageWidth - margin * 2
    const imgHeight = (chart.height / chart.width) * imgWidth
    pdf.addImage(imgData, 'PNG', margin, y, imgWidth, imgHeight)
    y += imgHeight + 30

    const colX = [margin, margin + 130, margin + 190, margin + 250, margin + 310, margin + 370, margin + 430]
    const rowHeight = 20

    const drawHeader = () => {
      pdf.setFillColor(230, 230, 230)
      pdf.rect(margin, y, pageWidth - margin * 2, rowHeight, 'F')
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(9)
      pdf.setTextColor(0)
      const headers = ['Process', 'Units', 'Opp/Unit', 'Defects', 'DPMO', 'Yield %', 'Sigma']
      headers.forEach((h, i) => pdf.text(h, colX[i] + 4, y + 14))
      y += rowHeight
    }

    drawHeader()
    pdf.setFont('helvetica', 'normal')
    results.forEach(r => {
      if (y + rowHeight > pageHeight - margin) {
        pdf.addPage()
        y = margin
        drawHeader()
      }
      pdf.setTextColor(0)
      pdf.text(r.name.slice(0, 20), colX[0] + 4, y + 14)
      pdf.text(String(r.units), colX[1] + 4, y + 14)
      pdf.text(String(r.opportunities), colX[2] + 4, y + 14)
      pdf.text(String(r.defects), colX[3] + 4, y + 14)
      pdf.text(String(Math.round(r.dpmo)), colX[4] + 4, y + 14)
      pdf.text(`${r.yieldPct.toFixed(1)}%`, colX[5] + 4, y + 14)
      pdf.text(r.sigma.toFixed(2), colX[6] + 4, y + 14)
      y += rowHeight
    })

    pdf.save('dpmo-report.pdf')
  }

  const chartData = {
    labels: results.map(r => r.name),
    datasets: [
      {
        label: t('dpmo_axis_sigma'),
        data: results.map(r => Number(r.sigma.toFixed(2))),
        backgroundColor: results.map(r => sigmaBand(r.sigma).color),
        borderRadius: 4,
      },
    ],
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartOptions: any = {
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
          label: (ctx: any) => {
            const r = results[ctx.dataIndex]
            return [
              ` ${t('dpmo_tooltip_sigma')}: ${r.sigma.toFixed(2)}`,
              ` ${t('dpmo_tooltip_dpmo')}: ${Math.round(r.dpmo).toLocaleString()}`,
              ` ${t('dpmo_tooltip_yield')}: ${r.yieldPct.toFixed(2)}%`,
              ` ${t('dpmo_tooltip_rating')}: ${t(sigmaBand(r.sigma).labelKey)}`,
            ]
          },
        },
      },
    },
    scales: {
      x: {
        ticks: { color: c.muted, font: { size: 11 }, maxRotation: 30 },
        grid: { display: false },
        border: { color: c.border },
      },
      y: {
        min: 0,
        max: 6,
        ticks: { color: c.muted, font: { size: 11 }, stepSize: 1 },
        grid: { color: c.grid },
        border: { color: c.border },
        title: { display: true, text: t('dpmo_axis_sigma'), color: c.muted, font: { size: 11 } },
      },
    },
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
    rowCard: {
      background: c.surface2, border: `1px solid ${c.border}`,
      borderRadius: 10, padding: 12, marginBottom: 10,
      display: 'flex', flexDirection: 'column', gap: 6,
    },
    input: {
      background: theme === 'dark' ? '#0d1520' : '#f8fafc',
      border: `1px solid ${c.border}`, borderRadius: 7,
      color: c.text, padding: '7px 10px', fontSize: 13, outline: 'none', width: '100%',
    },
    inputGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 },
    label: { fontSize: 10, color: c.muted, marginBottom: 2 },
    removeBtn: {
      background: 'transparent', border: 'none', color: '#ef4444',
      cursor: 'pointer', fontSize: 13, fontWeight: 700, padding: '2px 4px',
      alignSelf: 'flex-end',
    },
    addBtn: {
      background: `${c.accent}15`, border: `1px dashed ${c.accent}`,
      borderRadius: 8, color: c.accent, padding: '8px 0',
      width: '100%', cursor: 'pointer', fontSize: 13, fontWeight: 600,
    },
    dropzone: {
      border: `2px dashed ${dragOver ? c.accent : c.border}`,
      borderRadius: 10, padding: '18px 14px',
      textAlign: 'center' as const,
      background: dragOver ? `${c.accent}08` : 'transparent',
      transition: 'all 0.2s', cursor: 'pointer',
    },
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
    chartInner: { height: 340, position: 'relative' as const },
    table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 },
    th: {
      textAlign: 'left' as const, padding: '10px 12px',
      color: c.muted, fontWeight: 600, fontSize: 11,
      borderBottom: `1px solid ${c.border}`,
      textTransform: 'uppercase' as const, letterSpacing: 0.5,
    },
    td: { padding: '10px 12px', borderBottom: `1px solid ${c.border}40` },
    badge: {
      fontSize: 11, fontWeight: 700, padding: '3px 10px',
      borderRadius: 20, display: 'inline-block',
    },
    toast: {
      position: 'fixed' as const, bottom: 24, left: '50%',
      transform: 'translateX(-50%)',
      background: c.accent, color: '#060d1a',
      padding: '10px 20px', borderRadius: 8,
      fontSize: 13, fontWeight: 700, zIndex: 100,
      boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
    },
  }

  const avgSigma = results.length > 0
    ? results.reduce((s, r) => s + r.sigma, 0) / results.length
    : 0
  const worstProcess = results.length > 0
    ? [...results].sort((a, b) => a.sigma - b.sigma)[0]
    : null

  return (
    <div style={s.page}>
      <Nav theme={theme} setTheme={setTheme} breadcrumbKey="bc_dpmo" />

      {loadedProjectName && (
        <div style={{ margin: '0 32px', fontSize: 13, color: c.accent, background: c.surface2, border: `1px solid ${c.border}`, borderRadius: 8, padding: '8px 14px' }}>
          {lang === 'ar' ? `تم تحميل المشروع المحفوظ: ${loadedProjectName}` : `Loaded saved project: ${loadedProjectName}`}
        </div>
      )}

      <div className="qh-body" style={s.body}>
        <div className="qh-left" style={s.left}>
          <div>
            <div style={s.sectionTitle}>{t('dpmo_process_data')}</div>
            {rows.map(row => (
              <div key={row.id} style={s.rowCard}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    style={{ ...s.input, flex: 1 }}
                    placeholder={t('dpmo_placeholder_process')}
                    value={row.name}
                    onChange={e => updateRow(row.id, 'name', e.target.value)}
                  />
                  <button style={s.removeBtn} onClick={() => removeRow(row.id)}>✕</button>
                </div>
                <div className="qh-input-grid" style={s.inputGrid}>
                  <div>
                    <div style={s.label}>{t('dpmo_field_units')}</div>
                    <input
                      style={s.input} type="number" placeholder="0"
                      value={row.units || ''}
                      onChange={e => updateRow(row.id, 'units', e.target.value)}
                    />
                  </div>
                  <div>
                    <div style={s.label}>{t('dpmo_field_oppunit')}</div>
                    <input
                      style={s.input} type="number" placeholder="0"
                      value={row.opportunities || ''}
                      onChange={e => updateRow(row.id, 'opportunities', e.target.value)}
                    />
                  </div>
                  <div>
                    <div style={s.label}>{t('dpmo_field_defects')}</div>
                    <input
                      style={s.input} type="number" placeholder="0"
                      value={row.defects || ''}
                      onChange={e => updateRow(row.id, 'defects', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ))}
            <button style={s.addBtn} onClick={addRow}>{t('dpmo_add_process')}</button>
            {rows.length > 0 && (
              <button
                style={{
                  ...s.addBtn, marginTop: 8,
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px dashed #ef4444', color: '#ef4444',
                }}
                onClick={clearAll}
              >
                {t('dpmo_clear_all')}
              </button>
            )}
          </div>

          <div>
            <div style={s.sectionTitle}>{t('dpmo_upload_paste')}</div>
            <div
              style={s.dropzone}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => {
                e.preventDefault(); setDragOver(false)
                const f = e.dataTransfer.files[0]
                if (f) handleFile(f)
              }}
              onClick={() => fileRef.current?.click()}
            >
              <div style={{ fontSize: 24, marginBottom: 6 }}>📂</div>
              <div style={{ color: c.text, fontWeight: 600, fontSize: 12 }}>
                {t('dpmo_dropzone_text')}
              </div>
              {fileError && <div style={{ color: '#ef4444', fontSize: 11, marginTop: 6 }}>{fileError}</div>}
            </div>
            <input
              ref={fileRef} type="file" accept=".csv,.xlsx,.xls"
              style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />
            <div style={{ fontSize: 10, color: c.muted, marginTop: 8, lineHeight: 1.6 }}>
              {t('dpmo_format_hint')}
            </div>
          </div>

          <div>
            <div style={s.sectionTitle}>{t('common_export_section')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button style={s.exportBtn} onClick={exportCSV}>{isLoggedIn ? t('common_export_csv') : t('common_export_csv_locked')}</button>
              <button style={s.exportBtn} onClick={exportExcel}>{isPro ? t('common_export_excel') : t('common_export_excel_locked')}</button>
              <button style={s.exportBtn} onClick={exportPNG}>{isLoggedIn ? t('common_export_png') : t('common_export_png_locked')}</button>
              <button style={s.exportBtn} onClick={exportPDF}>{isPro ? t('common_export_pdf') : t('common_export_pdf_locked')}</button>
            </div>
            <div style={{ marginTop: 8 }}>
              <SaveAnalysisButton
                theme={theme}
                tool="dpmo"
                defaultName={`DPMO — ${new Date().toLocaleDateString('en-US')}`}
                getPayload={() => (results.length === 0 ? null : { input_data: rows, results })}
              />
            </div>
          </div>

          <div>
            <button
              style={{ ...s.exportBtn, width: '100%' }}
              onClick={() => setShowReference(v => !v)}
            >
              📖 {showReference ? t('dpmo_ref_hide') : t('dpmo_ref_show')} {t('dpmo_ref_table')}
            </button>
            {showReference && (
              <div style={{ ...s.card, marginTop: 10, padding: 12 }}>
                {SIGMA_BANDS.slice().reverse().map(b => (
                  <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 11 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: b.color, flexShrink: 0 }} />
                    <span style={{ color: c.text, fontWeight: 600 }}>{b.min}σ+</span>
                    <span style={{ color: c.muted }}>{t(b.labelKey)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="qh-right" style={s.right}>
          {results.length > 0 ? (
            <>
              <div className="qh-stats-row" style={s.statsRow}>
                <div style={s.statCard}>
                  <div style={s.statVal}>{results.length}</div>
                  <div style={s.statLabel}>{t('dpmo_stat_processes')}</div>
                </div>
                <div style={s.statCard}>
                  <div style={s.statVal}>{avgSigma.toFixed(2)}σ</div>
                  <div style={s.statLabel}>{t('dpmo_stat_avgsigma')}</div>
                </div>
                {worstProcess && (
                  <div style={s.statCard}>
                    <div style={{ ...s.statVal, color: sigmaBand(worstProcess.sigma).color, fontSize: 16 }}>
                      {worstProcess.name}
                    </div>
                    <div style={s.statLabel}>{t('dpmo_stat_lowest')} ({worstProcess.sigma.toFixed(2)}σ)</div>
                  </div>
                )}
              </div>

              <div className="qh-chart-wrap" style={s.chartWrap}>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{t('dpmo_chart_title')}</div>
                <div style={{ color: c.muted, fontSize: 12, marginBottom: 16 }}>
                  {t('dpmo_chart_sub')}
                </div>
                <div className="qh-chart-inner" style={s.chartInner}>
                  <Chart ref={chartRef} type="bar" data={chartData} options={chartOptions} />
                </div>
              </div>

              <div style={s.card}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>{t('dpmo_detailed_results')}</div>
                <div className="qh-table-wrap" style={{ overflowX: 'auto' }}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>{t('dpmo_col_process')}</th>
                      <th style={s.th}>{t('dpmo_col_units')}</th>
                      <th style={s.th}>{t('dpmo_col_oppunit')}</th>
                      <th style={s.th}>{t('dpmo_col_defects')}</th>
                      <th style={s.th}>{t('dpmo_col_dpo')}</th>
                      <th style={s.th}>{t('dpmo_col_dpmo')}</th>
                      <th style={s.th}>{t('dpmo_col_yield')}</th>
                      <th style={s.th}>{t('dpmo_col_sigma')}</th>
                      <th style={s.th}>{t('dpmo_col_rating')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map(r => {
                      const band = sigmaBand(r.sigma)
                      return (
                        <tr key={r.id}>
                          <td style={{ ...s.td, fontWeight: 600 }}>{r.name}</td>
                          <td style={s.td}>{r.units}</td>
                          <td style={s.td}>{r.opportunities}</td>
                          <td style={s.td}>{r.defects}</td>
                          <td style={s.td}>{r.dpo.toFixed(4)}</td>
                          <td style={s.td}>{Math.round(r.dpmo).toLocaleString()}</td>
                          <td style={s.td}>{r.yieldPct.toFixed(2)}%</td>
                          <td style={{ ...s.td, fontWeight: 700, color: band.color }}>{r.sigma.toFixed(2)}</td>
                          <td style={s.td}>
                            <span style={{ ...s.badge, background: `${band.color}22`, color: band.color }}>
                              {t(band.labelKey)}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                </div>
              </div>
            </>
          ) : (
            <div style={{ ...s.card, textAlign: 'center', padding: 60, color: c.muted }}>
              {t('dpmo_empty_state')}
            </div>
          )}
        </div>
      </div>

      {pasteToast && <div style={s.toast}>{t('dpmo_toast')}</div>}
    </div>
  )
}