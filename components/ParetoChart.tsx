'use client'

import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import 'chart.js/auto'
import { Chart } from 'react-chartjs-2' from 'chart.js'
import { Chart } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend
)

interface DataRow {
  id: string
  label: string
  value: number
}

const COLORS = {
  dark: {
    bg: '#0a0f1e',
    surface: '#111827',
    surface2: '#1e2d40',
    border: '#1e3a5f',
    accent: '#0fd4c8',
    amber: '#f59e0b',
    text: '#e2e8f0',
    muted: '#6b89b4',
    bar: '#0fd4c8',
    barHover: '#14b8b0',
    line: '#f59e0b',
    grid: 'rgba(255,255,255,0.06)',
    vital: 'rgba(245,158,11,0.15)',
  },
  light: {
    bg: '#f8fafc',
    surface: '#ffffff',
    surface2: '#f1f5f9',
    border: '#e2e8f0',
    accent: '#0e7474',
    amber: '#d97706',
    text: '#1e293b',
    muted: '#64748b',
    bar: '#0e7474',
    barHover: '#0f8585',
    line: '#d97706',
    grid: 'rgba(0,0,0,0.06)',
    vital: 'rgba(217,119,6,0.08)',
  },
}

function generateId() {
  return Math.random().toString(36).slice(2, 9)
}

function parseCSV(text: string): DataRow[] {
  const lines = text.trim().split('\n').filter(Boolean)
  const rows: DataRow[] = []
  for (const line of lines) {
    const parts = line.split(',')
    if (parts.length >= 2) {
      const label = parts[0].trim().replace(/^"|"$/g, '')
      const value = parseFloat(parts[1].trim())
      if (label && !isNaN(value) && value > 0) {
        rows.push({ id: generateId(), label, value })
      }
    }
  }
  return rows
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
  const [csvError, setCsvError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
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

  const handleFile = useCallback((file: File) => {
    setCsvError('')
    if (!file.name.endsWith('.csv')) {
      setCsvError('Please upload a .csv file')
      return
    }
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      const parsed = parseCSV(text)
      if (parsed.length === 0) {
        setCsvError('No valid data found. Format: Label, Value')
        return
      }
      setRows(parsed)
    }
    reader.readAsText(file)
  }, [])

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
    cardDark: {
      background: theme === 'dark' ? c.surface2 : c.surface2,
      border: `1px solid ${c.border}`,
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
          <Link href="/login" style={{ fontSize: 13, color: c.muted, textDecoration: 'none', fontWeight: 500 }}>
            Sign In
          </Link>
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
          </div>

          {/* CSV Upload */}
          <div>
            <div style={s.sectionTitle}>📁 CSV Upload</div>
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
                Drop CSV here or click to browse
              </div>
              <div style={{ color: c.muted, fontSize: 11, marginTop: 6 }}>
                Format: Category, Count
              </div>
              {csvError && (
                <div style={{ color: '#ef4444', fontSize: 11, marginTop: 8 }}>{csvError}</div>
              )}
            </div>
            <input
              ref={fileRef} type="file" accept=".csv"
              style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />
            <div style={{ fontSize: 11, color: c.muted, marginTop: 10, lineHeight: 1.6 }}>
              Example CSV:<br />
              <code style={{ color: c.accent }}>
                Dimensional Error, 42<br />
                Surface Defect, 28
              </code>
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
                <Chart type="bar" data={chartData} options={chartOptions} />
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
    </div>
  )
}