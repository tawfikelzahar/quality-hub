'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Link from 'next/link'
import 'chart.js/auto'
import { Chart } from 'react-chartjs-2'
import type { Chart as ChartJSInstance } from 'chart.js'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import { COLORS } from '@/lib/theme'
import AuthStatus from '@/components/AuthStatus'

interface DataRow {
  id: string
  label: string
  value: number
}

function generateId() {
  return Math.random().toString(36).slice(2, 9)
}

// Parses CSV or pasted TSV (tab-separated, from Excel/Sheets copy)
function parseDelimited(text: string): DataRow[] {
  const lines = text.trim().split('\n').filter(Boolean)
  const rows: DataRow[] = []
  for (const line of lines) {
    // Try tab first (Excel paste), then comma (CSV)
    const delimiter = line.includes('\t') ? '\t' : ','
    const parts = line.split(delimiter)
    if (parts.length >= 2) {
      const label = parts[0].trim().replace(/^"|"$/g, '')
      const value = parseFloat(parts[1].trim())
      if (label && !isNaN(value) && value > 0 && !isNaN(Number(label)) === false) {
        rows.push({ id: generateId(), label, value })
      }
    }
  }
  return rows
}

function parseExcelFile(file: File): Promise<DataRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const data = e.target?.result
        const workbook = XLSX.read(data, { type: 'binary' })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        const json: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 })
        const rows: DataRow[] = []
        for (const row of json) {
          if (Array.isArray(row) && row.length >= 2) {
            const label = String(row[0] ?? '').trim()
            const value = parseFloat(String(row[1] ?? ''))
            if (label && !isNaN(value) && value > 0) {
              rows.push({ id: generateId(), label, value })
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

export default function ParetoChart() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [rows, setRows] = useState<DataRow[]>([
    { id: generateId(), label: 'Dimensional Error', value: 42 },
    { id: generateId(), label: 'Surface Defect', value: 28 },
    { id: generateId(), label: 'Wrong Material', value: 15 },
    { id: generateId(), label: 'Assembly Fault', value: 9 },
    { id: generateId(), label: 'Packaging Damage', value: 6 },
  ])
  const [dragOver, setDragOver] = useState(false)
  const [fileError, setFileError] = useState('')
  const [pasteToast, setPasteToast] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const chartRef = useRef<ChartJSInstance<'bar' | 'line'>>(null)
  const c = COLORS[theme]

  const sorted = [...rows]
    .filter(r => r.label.trim() && r.value > 0)
    .sort((a, b) => b.value - a.value)

  const total = sorted.reduce((s, r) => s + r.value, 0)

  const cumulative: number[] = []
  let running = 0
  for (const r of sorted) {
    running += r.value
    cumulative.push(total > 0 ? Math.round((running / total) * 100) : 0)
  }

  const vitalFewCount = cumulative.findIndex(v => v >= 80) + 1
  const vitalFew = vitalFewCount > 0 ? vitalFewCount : sorted.length

 const addRow = () => {
    setRows(prev => [...prev, { id: generateId(), label: '', value: 0 }])
  }

  const clearAll = () => {
    if (rows.length === 0) return
    const confirmed = window.confirm('Clear all data? This cannot be undone.')
    if (confirmed) {
      setRows([])
    }
  }
  const updateRow = (id: string, field: 'label' | 'value', val: string) => {
    setRows(prev =>
      prev.map(r =>
        r.id === id
          ? { ...r, [field]: field === 'value' ? parseFloat(val) || 0 : val }
          : r
      )
    )
  }

  const removeRow = (id: string) => {
    setRows(prev => prev.filter(r => r.id !== id))
  }

  // ── Global Ctrl+V paste handler ──
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement
      // Don't hijack paste while typing inside a text input/textarea
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

  // ── File upload (CSV or Excel) ──
  const handleFile = useCallback((file: File) => {
    setFileError('')
    const isCSV = file.name.endsWith('.csv')
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls')

    if (!isCSV && !isExcel) {
      setFileError('Please upload a .csv or .xlsx file')
      return
    }

    if (isCSV) {
      const reader = new FileReader()
      reader.onload = e => {
        const text = e.target?.result as string
        const parsed = parseDelimited(text)
        if (parsed.length === 0) {
          setFileError('No valid data found. Format: Label, Value')
          return
        }
        setRows(parsed)
      }
      reader.readAsText(file)
    } else {
      parseExcelFile(file)
        .then(parsed => {
          if (parsed.length === 0) {
            setFileError('No valid data found in Excel file')
            return
          }
          setRows(parsed)
        })
        .catch(() => setFileError('Could not read Excel file'))
    }
  }, [])

  // ── Export: Data as CSV ──
  const exportCSV = () => {
    const header = 'Category,Count,Percent of Total,Cumulative Percent,Status\n'
    const body = sorted
      .map((r, i) => {
        const pct = total > 0 ? Math.round((r.value / total) * 100) : 0
        const status = i < vitalFew ? 'Vital Few' : 'Useful Many'
        return `"${r.label}",${r.value},${pct}%,${cumulative[i]}%,${status}`
      })
      .join('\n')
    const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'pareto-data.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Export: Data as Excel ──
  const exportExcel = () => {
    const data = sorted.map((r, i) => ({
      Category: r.label,
      Count: r.value,
      'Percent of Total': `${total > 0 ? Math.round((r.value / total) * 100) : 0}%`,
      'Cumulative Percent': `${cumulative[i]}%`,
      Status: i < vitalFew ? 'Vital Few' : 'Useful Many',
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Pareto Data')
    XLSX.writeFile(wb, 'pareto-data.xlsx')
  }

  // ── Export: Chart as PNG ──
  const exportPNG = () => {
    const chart = chartRef.current
    if (!chart) return
    const url = chart.toBase64Image('image/png', 1)
    const a = document.createElement('a')
    a.href = url
    a.download = 'pareto-chart.png'
    a.click()
  }

 // ── Export: Chart + Table as PDF ──
  const exportPDF = () => {
    const chart = chartRef.current
    if (!chart) return
    const imgData = chart.toBase64Image('image/png', 1)
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 40
    let y = margin

    // Title
    pdf.setFontSize(18)
    pdf.setFont('helvetica', 'bold')
    pdf.text('Pareto Analysis', margin, y)
    y += 10

    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(100)
    pdf.text(`Generated: ${new Date().toLocaleDateString()}`, margin, y + 12)
    y += 30

    // Summary line
    pdf.setFontSize(11)
    pdf.setTextColor(0)
    pdf.text(
      `Total: ${total}  |  Categories: ${sorted.length}  |  Vital Few: ${vitalFew} categories = 80% of problems`,
      margin,
      y
    )
    y += 20

    // Chart image
    const imgWidth = pageWidth - margin * 2
    const imgHeight = (chart.height / chart.width) * imgWidth
    pdf.addImage(imgData, 'PNG', margin, y, imgWidth, imgHeight)
    y += imgHeight + 30

    // Table header
    const colX = [margin, margin + 180, margin + 260, margin + 340, margin + 430]
    const rowHeight = 20

    const drawTableHeader = () => {
      pdf.setFillColor(230, 230, 230)
      pdf.rect(margin, y, pageWidth - margin * 2, rowHeight, 'F')
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(10)
      pdf.setTextColor(0)
      pdf.text('Category', colX[0] + 4, y + 14)
      pdf.text('Count', colX[1] + 4, y + 14)
      pdf.text('% Total', colX[2] + 4, y + 14)
      pdf.text('Cumulative', colX[3] + 4, y + 14)
      pdf.text('Status', colX[4] + 4, y + 14)
      y += rowHeight
    }

    drawTableHeader()

    pdf.setFont('helvetica', 'normal')
    sorted.forEach((r, i) => {
      // New page if needed
      if (y + rowHeight > pageHeight - margin) {
        pdf.addPage()
        y = margin
        drawTableHeader()
      }

      if (i < vitalFew) {
        pdf.setFillColor(255, 245, 225)
        pdf.rect(margin, y, pageWidth - margin * 2, rowHeight, 'F')
      }

      pdf.setTextColor(0)
      pdf.text(r.label.slice(0, 28), colX[0] + 4, y + 14)
      pdf.text(String(r.value), colX[1] + 4, y + 14)
      pdf.text(`${total > 0 ? Math.round((r.value / total) * 100) : 0}%`, colX[2] + 4, y + 14)
      pdf.text(`${cumulative[i]}%`, colX[3] + 4, y + 14)
      pdf.setTextColor(i < vitalFew ? 200 : 120, i < vitalFew ? 120 : 120, 0)
      pdf.text(i < vitalFew ? 'Vital Few' : 'Useful Many', colX[4] + 4, y + 14)

      y += rowHeight
    })

    pdf.save('pareto-report.pdf')
  }

  const chartData = {
    labels: sorted.map(r => r.label),
    datasets: [
      {
        type: 'bar' as const,
        label: 'Frequency',
        data: sorted.map(r => r.value),
        backgroundColor: sorted.map((_, i) =>
          i < vitalFew ? c.bar : `${c.bar}55`
        ),
        borderRadius: 4,
        yAxisID: 'y',
        order: 2,
      },
      {
        type: 'line' as const,
        label: 'Cumulative %',
        data: cumulative,
        borderColor: c.line,
        backgroundColor: `${c.line}22`,
        borderWidth: 2.5,
        pointBackgroundColor: c.line,
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.3,
        yAxisID: 'y2',
        order: 1,
        fill: false,
      },
    ],
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        labels: {
          color: c.text,
          font: { size: 12 },
          boxWidth: 14,
        },
      },
      tooltip: {
        backgroundColor: c.surface,
        borderColor: c.border,
        borderWidth: 1,
        titleColor: c.text,
        bodyColor: c.muted,
        padding: 10,
        callbacks: {
          label: (ctx: any) => {
            if (ctx.dataset.label === 'Cumulative %')
              return ` Cumulative: ${ctx.parsed.y}%`
            return ` Count: ${ctx.parsed.y} (${total > 0 ? Math.round((ctx.parsed.y / total) * 100) : 0}%)`
          },
          afterBody: (items: any[]) => {
            const i = items[0]?.dataIndex
            if (i !== undefined && i < vitalFew)
              return ['', '⭐ Vital Few — Top 80%']
            return []
          },
        },
      },
    },
    scales: {
      x: {
        ticks: { color: c.muted, font: { size: 11 }, maxRotation: 30 },
        grid: { color: c.grid },
        border: { color: c.border },
      },
      y: {
        position: 'left',
        ticks: { color: c.muted, font: { size: 11 } },
        grid: { color: c.grid },
        border: { color: c.border },
        title: { display: true, text: 'Frequency', color: c.muted, font: { size: 11 } },
      },
      y2: {
        position: 'right',
        min: 0,
        max: 100,
        ticks: {
          color: c.amber,
          font: { size: 11 },
          callback: (v: any) => `${v}%`,
        },
        grid: { drawOnChartArea: false },
        border: { color: c.amber },
        title: { display: true, text: 'Cumulative %', color: c.amber, font: { size: 11 } },
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
      width: 300, flexShrink: 0,
      background: c.surface,
      borderRight: `1px solid ${c.border}`,
      overflowY: 'auto', padding: 20,
      display: 'flex', flexDirection: 'column', gap: 20,
    },
    right: { flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 },
    sectionTitle: { fontSize: 11, fontWeight: 700, color: c.muted, textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 12 },
    card: {
      background: c.surface, border: `1px solid ${c.border}`,
      borderRadius: 12, padding: 20,
    },
    inputRow: { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 },
    input: {
      background: theme === 'dark' ? '#0d1520' : '#f8fafc',
      border: `1px solid ${c.border}`, borderRadius: 7,
      color: c.text, padding: '7px 10px', fontSize: 13, outline: 'none',
    },
    removeBtn: {
      background: 'transparent', border: 'none', color: '#ef4444',
      cursor: 'pointer', fontSize: 16, padding: '0 4px', lineHeight: 1,
    },
    addBtn: {
      background: `${c.accent}15`, border: `1px dashed ${c.accent}`,
      borderRadius: 8, color: c.accent, padding: '8px 0',
      width: '100%', cursor: 'pointer', fontSize: 13, fontWeight: 600,
      marginTop: 4,
    },
    dropzone: {
      border: `2px dashed ${dragOver ? c.accent : c.border}`,
      borderRadius: 10, padding: '20px 16px',
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
    statsRow: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 },
    statCard: {
      background: c.surface2, border: `1px solid ${c.border}`,
      borderRadius: 10, padding: '14px 16px', textAlign: 'center' as const,
    },
    statVal: { fontSize: 24, fontWeight: 800, color: c.accent },
    statLabel: { fontSize: 11, color: c.muted, marginTop: 4 },
    chartWrap: {
      background: c.surface, border: `1px solid ${c.border}`,
      borderRadius: 12, padding: 20,
    },
    chartInner: { height: 380, position: 'relative' as const },
    vitalBadge: {
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: `${c.amber}18`, border: `1px solid ${c.amber}40`,
      borderRadius: 20, padding: '4px 12px',
      fontSize: 12, color: c.amber, fontWeight: 600,
    },
    table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 },
    th: {
      textAlign: 'left' as const, padding: '10px 12px',
      color: c.muted, fontWeight: 600, fontSize: 11,
      borderBottom: `1px solid ${c.border}`,
      textTransform: 'uppercase' as const, letterSpacing: 0.5,
    },
    td: { padding: '10px 12px', borderBottom: `1px solid ${c.border}40` },
    toast: {
      position: 'fixed' as const, bottom: 24, left: '50%',
      transform: 'translateX(-50%)',
      background: c.accent, color: '#060d1a',
      padding: '10px 20px', borderRadius: 8,
      fontSize: 13, fontWeight: 700, zIndex: 100,
      boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
    },
  }

  return (
    <div style={s.page}>
      {/* Nav */}
      <nav style={s.nav}>
        <div style={s.navLeft}>
          <Link href="/" style={s.logo}>
            <div style={s.logoIcon}>σ</div>
            QualityTools
          </Link>
          <span style={s.separator}>/</span>
          <span style={s.breadcrumb}>Pareto Chart</span>
        </div>
        <div style={s.navRight}>
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

      <div style={s.body}>
        {/* Left Panel */}
        <div style={s.left}>

          {/* Manual Input */}
          <div>
            <div style={s.sectionTitle}>📋 Manual Input</div>
            {rows.map(row => (
              <div key={row.id} style={s.inputRow}>
                <input
                  style={{ ...s.input, flex: 2 }}
                  placeholder="Category name"
                  value={row.label}
                  onChange={e => updateRow(row.id, 'label', e.target.value)}
                />
                <input
                  style={{ ...s.input, flex: 1, width: 70 }}
                  type="number"
                  placeholder="0"
                  value={row.value || ''}
                  onChange={e => updateRow(row.id, 'value', e.target.value)}
                />
                <button style={s.removeBtn} onClick={() => removeRow(row.id)}>×</button>
              </div>
            ))}
           <button style={s.addBtn} onClick={addRow}>+ Add Row</button>
            {rows.length > 0 && (
              <button
                style={{
                  ...s.addBtn,
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px dashed #ef4444',
                  color: '#ef4444',
                  marginTop: 8,
                }}
                onClick={clearAll}
              >
                🗑️ Clear All Data
              </button>
            )}
          </div>

          {/* File Upload + Paste */}
          <div>
            <div style={s.sectionTitle}>📁 Upload or Paste</div>
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
              <div style={{ fontSize: 28, marginBottom: 8 }}>📂</div>
              <div style={{ color: c.text, fontWeight: 600, fontSize: 13 }}>
                Drop CSV / Excel here or click to browse
              </div>
              <div style={{ color: c.muted, fontSize: 11, marginTop: 6 }}>
                or press Ctrl+V to paste from Excel/Sheets
              </div>
              {fileError && (
                <div style={{ color: '#ef4444', fontSize: 11, marginTop: 8 }}>{fileError}</div>
              )}
            </div>
            <input
              ref={fileRef} type="file" accept=".csv,.xlsx,.xls"
              style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />
            <div style={{ fontSize: 11, color: c.muted, marginTop: 10, lineHeight: 1.6 }}>
              Format: Category, Count<br />
              <code style={{ color: c.accent }}>
                Dimensional Error, 42<br />
                Surface Defect, 28
              </code>
            </div>
          </div>

          {/* Export */}
          <div>
            <div style={s.sectionTitle}>📤 Export</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button style={s.exportBtn} onClick={exportCSV}>📄 CSV</button>
              <button style={s.exportBtn} onClick={exportExcel}>📊 Excel</button>
              <button style={s.exportBtn} onClick={exportPNG}>🖼️ PNG</button>
              <button style={s.exportBtn} onClick={exportPDF}>📑 PDF</button>
            </div>
          </div>

        </div>

        {/* Right Panel */}
        <div style={s.right}>

          {/* Stats */}
          <div style={s.statsRow}>
            <div style={s.statCard}>
              <div style={s.statVal}>{total}</div>
              <div style={s.statLabel}>Total Defects</div>
            </div>
            <div style={{ ...s.statCard }}>
              <div style={{ ...s.statVal, color: c.amber }}>{vitalFew}</div>
              <div style={s.statLabel}>Vital Few Categories</div>
            </div>
            <div style={s.statCard}>
              <div style={s.statVal}>{sorted.length}</div>
              <div style={s.statLabel}>Total Categories</div>
            </div>
          </div>

          {/* Chart */}
          <div style={s.chartWrap}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: c.text }}>Pareto Analysis</div>
                <div style={{ color: c.muted, fontSize: 12, marginTop: 3 }}>
                  Bars = frequency · Line = cumulative % · Bright bars = Vital Few
                </div>
              </div>
              <span style={s.vitalBadge}>
                ⭐ {vitalFew} of {sorted.length} categories = 80% of problems
              </span>
            </div>

            {sorted.length > 0 ? (
              <div style={s.chartInner}>
                <Chart ref={chartRef} type="bar" data={chartData} options={chartOptions} />
              </div>
            ) : (
              <div style={{ height: 380, display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.muted }}>
                Add data on the left to generate the chart
              </div>
            )}
          </div>

          {/* Table */}
          {sorted.length > 0 && (
            <div style={s.card}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, color: c.text }}>
                Breakdown Table
              </div>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>Rank</th>
                    <th style={s.th}>Category</th>
                    <th style={s.th}>Count</th>
                    <th style={s.th}>% of Total</th>
                    <th style={s.th}>Cumulative %</th>
                    <th style={s.th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((r, i) => (
                    <tr key={r.id} style={{ background: i < vitalFew ? `${c.amber}08` : 'transparent' }}>
                      <td style={{ ...s.td, color: c.muted }}>#{i + 1}</td>
                      <td style={{ ...s.td, fontWeight: 600 }}>{r.label}</td>
                      <td style={s.td}>{r.value}</td>
                      <td style={s.td}>{total > 0 ? Math.round((r.value / total) * 100) : 0}%</td>
                      <td style={{ ...s.td, color: c.amber, fontWeight: 600 }}>{cumulative[i]}%</td>
                      <td style={s.td}>
                        {i < vitalFew ? (
                          <span style={{ ...s.vitalBadge, fontSize: 11, padding: '3px 8px' }}>
                            ⭐ Vital Few
                          </span>
                        ) : (
                          <span style={{ color: c.muted, fontSize: 11 }}>Useful Many</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>
      </div>

      {pasteToast && (
        <div style={s.toast}>✅ Data pasted successfully</div>
      )}
    </div>
  )
}