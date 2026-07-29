'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import 'chart.js/auto'
import { Chart } from 'react-chartjs-2'
import { COLORS, getSharedStyles, usePersistedTheme } from '@/lib/theme'
import AuthStatus from '@/components/AuthStatus'

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
  sigLvl_st: number | null
  sigLvl_lt: number | null
  ppmD_st: PpmDetail | null
  ppmD_lt: PpmDetail | null
  N: number
  LSL: number | null
  USL: number | null
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
  const c = COLORS[theme]
  const s = getSharedStyles(theme)

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
  const [pasteToast, setPasteToast] = useState(false)

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
    if (!window.confirm('Clear all data? This cannot be undone.')) return
    setResult(null)
    setErrorMsg('')
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
          setErrorMsg('Please provide at least 3 valid rows of data.')
          setLoading(false)
          return
        }
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
          setErrorMsg('At least 5 rows are required for attribute charts.')
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

  // ── Chart builders ──────────────────────────────────────────────────────
  const lineChartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          labels: { color: c.muted, font: { size: 11 }, boxWidth: 14, filter: (item: { text: string }) => item.text !== 'CL' },
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

  function buildControlChart(labels: number[], values: number[], ucl: number, cl: number, lcl: number, violated: Set<number>, label: string) {
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
        { label: 'CL', data: Array(labels.length).fill(cl), borderColor: c.muted, borderWidth: 1, borderDash: [2, 2], pointRadius: 0, fill: false, tension: 0 },
        { label: 'LCL', data: Array(labels.length).fill(lcl), borderColor: c.danger, borderWidth: 1.5, borderDash: [5, 4], pointRadius: 0, fill: false, tension: 0 },
      ],
    }
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
    ...(varResult?.violations_x.map(v => ({ ...v, chart: 'X̄ / Individuals' })) ?? []),
    ...(varResult?.violations_r.map(v => ({ ...v, chart: 'R / MR' })) ?? []),
    ...(attrResult?.violations.map(v => ({ ...v, chart: attrResult.chartLabel })) ?? []),
  ]

  return (
    <div style={s.page}>
      <nav style={s.nav}>
        <div style={s.navLeft}>
          <Link href="/" style={s.logo}>
            <div style={s.logoIcon}>σ</div>
            QualityTools
          </Link>
          <span style={s.separator}>/</span>
          <span style={s.breadcrumb}>SPC Engine</span>
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
        {/* ── LEFT SIDEBAR ─────────────────────────────────────────────── */}
        <div style={s.left}>
          <div>
            <div style={s.sectionTitle}>📊 Data Type</div>
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
                Variable
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
                Attribute
              </button>
            </div>
          </div>

          {dataType === 'variable' ? (
            <>
              <div>
                <div style={s.sectionTitle}>⚙️ Subgroup Size (n)</div>
                <input
                  style={s.input}
                  type="number"
                  min={1}
                  max={10}
                  value={N}
                  onChange={e => handleNChange(parseInt(e.target.value, 10) || 1)}
                />
                <div style={{ fontSize: 10, color: c.muted, marginTop: 6, lineHeight: 1.5 }}>
                  n = 1 uses an Individuals / Moving Range (I-MR) chart. n ≥ 2 uses an X̄-R chart.
                </div>
              </div>

              <div>
                <div style={s.sectionTitle}>🎯 Spec Limits</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div>
                    <div style={s.label}>LSL (optional)</div>
                    <input style={s.input} type="number" value={LSL} onChange={e => setLSL(e.target.value)} />
                  </div>
                  <div>
                    <div style={s.label}>Target (optional)</div>
                    <input style={s.input} type="number" value={target} onChange={e => setTarget(e.target.value)} />
                  </div>
                  <div>
                    <div style={s.label}>USL (optional)</div>
                    <input style={s.input} type="number" value={USL} onChange={e => setUSL(e.target.value)} />
                  </div>
                </div>
              </div>

              <div>
                <div style={s.sectionTitle}>🔍 Advanced</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div>
                    <div style={s.label}>Last N Subgroups (0 = all)</div>
                    <input style={s.input} type="number" min={0} value={lastN} onChange={e => setLastN(e.target.value)} />
                  </div>
                  <div>
                    <div style={s.label}>Sigma Convention</div>
                    <select style={s.select} value={sigmaConvention} onChange={e => setSigmaConvention(e.target.value as SigmaConvention)}>
                      <option value="direct">Direct (Z)</option>
                      <option value="sixsigma">+1.5σ Shift (Six Sigma)</option>
                    </select>
                  </div>
                  <div>
                    <div style={s.label}>Show</div>
                    <select style={s.select} value={displayMode} onChange={e => setDisplayMode(e.target.value as DisplayMode)}>
                      <option value="both">Capability + Benchmark Z</option>
                      <option value="capability">Capability Only (Cp/Cpk)</option>
                      <option value="benchmark">Benchmark Z Only</option>
                    </select>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <div style={s.sectionTitle}>⚙️ Chart Type</div>
                <select
                  style={s.select}
                  value={attrType}
                  onChange={e => { setAttrType(e.target.value as AttrType); setResult(null) }}
                >
                  <option value="p">p-Chart (proportion defective, variable n)</option>
                  <option value="np">np-Chart (count defective, fixed n)</option>
                  <option value="c">c-Chart (defects per unit)</option>
                  <option value="u">u-Chart (defects per unit, variable n)</option>
                </select>
              </div>
              {attrType === 'np' && (
                <div>
                  <div style={s.label}>Fixed Sample Size (n)</div>
                  <input style={s.input} type="number" value={fixedN} onChange={e => setFixedN(e.target.value)} />
                </div>
              )}
              <div>
                <div style={s.label}>Sigma Convention</div>
                <select style={s.select} value={sigmaConvention} onChange={e => setSigmaConvention(e.target.value as SigmaConvention)}>
                  <option value="direct">Direct (Z)</option>
                  <option value="sixsigma">+1.5σ Shift (Six Sigma)</option>
                </select>
              </div>
            </>
          )}

          <div>
            <button style={{ ...s.ctaBtn, width: '100%', textAlign: 'center', border: 'none', cursor: 'pointer', fontSize: 13, padding: '10px 16px' }} onClick={analyze} disabled={loading}>
              {loading ? 'Analyzing…' : '▶ Analyze'}
            </button>
          </div>

          <div>
            <button
              style={{ ...s.addBtn, background: 'rgba(239,68,68,0.1)', border: '1px dashed #ef4444', color: '#ef4444' }}
              onClick={clearAll}
            >
              🗑️ Clear All
            </button>
          </div>

          <div style={{ fontSize: 10, color: c.muted, lineHeight: 1.6 }}>
            📤 Excel / PNG / PDF export is coming in the next update — same as the Pareto and DPMO tools.
          </div>
        </div>

        {/* ── RIGHT MAIN AREA ──────────────────────────────────────────── */}
        <div style={s.right}>
          {/* Data entry table */}
          <div style={s.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Data Entry</div>
              <div style={{ fontSize: 11, color: c.muted }}>Paste from Excel with Ctrl+V</div>
            </div>

            {dataType === 'variable' ? (
              <>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>#</th>
                      {Array.from({ length: N }, (_, i) => (
                        <th key={i} style={s.th}>{N === 1 ? 'Value' : `x${i + 1}`}</th>
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
                <button style={{ ...s.addBtn, marginTop: 10 }} onClick={addVarRow}>+ Add Subgroup</button>
              </>
            ) : (
              <>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>#</th>
                      {(attrType === 'p' || attrType === 'u') && <th style={s.th}>Sample Size (n)</th>}
                      <th style={s.th}>Defects</th>
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
                <button style={{ ...s.addBtn, marginTop: 10 }} onClick={addAttrRow}>+ Add Row</button>
              </>
            )}
          </div>

          {errorMsg && (
            <div style={{ ...s.card, borderColor: '#ef4444', color: '#ef4444', fontSize: 13 }}>{errorMsg}</div>
          )}

          {/* ── VARIABLE RESULTS ───────────────────────────────────────── */}
          {varResult && (
            <>
              <div style={s.statsRow}>
                <div style={s.statCard}>
                  <div style={s.statVal}>{varResult.n}</div>
                  <div style={s.statLabel}>Data Points</div>
                </div>
                <div style={s.statCard}>
                  <div style={s.statVal}>{fmt(varResult.mu)}</div>
                  <div style={s.statLabel}>Overall Mean</div>
                </div>
                <div style={s.statCard}>
                  <div style={s.statVal}>{fmt(varResult.sigma)}</div>
                  <div style={s.statLabel}>Within Std Dev (σ)</div>
                </div>
                <div style={s.statCard}>
                  <div style={{ ...s.statVal, color: varResult.isNormal ? '#4ade80' : '#f59e0b' }}>
                    {varResult.isNormal ? 'Normal' : 'Non-Normal'}
                  </div>
                  <div style={s.statLabel}>
                    Anderson-Darling {varResult.ad ? `(p=${fmt(varResult.ad.p, 3)})` : ''}
                  </div>
                </div>
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
                    <div style={s.statCard}><div style={s.statVal}>{fmt(varResult.sigLvl_st)}σ</div><div style={s.statLabel}>Sigma (Short-term)</div></div>
                    <div style={s.statCard}><div style={s.statVal}>{fmt(varResult.sigLvl_lt)}σ</div><div style={s.statLabel}>Sigma (Long-term)</div></div>
                    {varResult.ppmD_lt && (
                      <div style={s.statCard}><div style={s.statVal}>{Math.round(varResult.ppmD_lt.total).toLocaleString()}</div><div style={s.statLabel}>PPM (Long-term)</div></div>
                    )}
                  </>
                )}
              </div>

              <div style={s.chartWrap}>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
                  {varResult.N === 1 ? 'Individuals (I) Chart' : 'X̄ Chart'}
                </div>
                <div style={{ color: c.muted, fontSize: 12, marginBottom: 16 }}>
                  CL = {fmt(varResult.cl_x)} · UCL = {fmt(varResult.ucl_x)} · LCL = {fmt(varResult.lcl_x)}
                </div>
                <div style={s.chartInner}>
                  <Chart
                    type="line"
                    data={buildControlChart(varResult.labels, varResult.xbarVals, varResult.ucl_x, varResult.cl_x, varResult.lcl_x, violatedX, varResult.N === 1 ? 'Individual Value' : 'X̄')}
                    options={lineChartOptions}
                  />
                </div>
              </div>

              <div style={s.chartWrap}>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
                  {varResult.N === 1 ? 'Moving Range (MR) Chart' : 'Range (R) Chart'}
                </div>
                <div style={{ color: c.muted, fontSize: 12, marginBottom: 16 }}>
                  CL = {fmt(varResult.cl_r)} · UCL = {fmt(varResult.ucl_r)} · LCL = {fmt(Math.max(0, varResult.lcl_r))}
                </div>
                <div style={s.chartInner}>
                  <Chart
                    type="line"
                    data={buildControlChart(rangeLabels, rangeValsTrimmed, varResult.ucl_r, varResult.cl_r, Math.max(0, varResult.lcl_r), violatedR, varResult.N === 1 ? 'Moving Range' : 'Range')}
                    options={lineChartOptions}
                  />
                </div>
              </div>
            </>
          )}

          {/* ── ATTRIBUTE RESULTS ──────────────────────────────────────── */}
          {attrResult && (
            <>
              <div style={s.statsRow}>
                <div style={s.statCard}>
                  <div style={s.statVal}>{attrResult.pts.length}</div>
                  <div style={s.statLabel}>Subgroups</div>
                </div>
                <div style={s.statCard}>
                  <div style={s.statVal}>{fmt(attrResult.metric, 4)}</div>
                  <div style={s.statLabel}>{attrResult.metricLabel}</div>
                </div>
                <div style={s.statCard}>
                  <div style={s.statVal}>{Math.round(attrResult.dpm).toLocaleString()}</div>
                  <div style={s.statLabel}>DPM</div>
                </div>
                <div style={s.statCard}>
                  <div style={s.statVal}>{isFinite(attrResult.sigmaLvl) ? fmt(attrResult.sigmaLvl) : '6.00+'}σ</div>
                  <div style={s.statLabel}>Sigma Level</div>
                </div>
              </div>

              <div style={s.chartWrap}>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{attrResult.chartLabel}</div>
                <div style={{ color: c.muted, fontSize: 12, marginBottom: 16 }}>
                  CL = {fmt(attrResult.clVal, 4)} · UCL = {fmt(attrResult.ucl, 4)} · LCL = {fmt(Math.max(0, attrResult.lcl), 4)}
                </div>
                <div style={s.chartInner}>
                  <Chart
                    type="line"
                    data={buildControlChart(attrResult.labels, attrResult.pts, attrResult.ucl, attrResult.clVal, Math.max(0, attrResult.lcl), violatedAttr, attrResult.metricLabel)}
                    options={lineChartOptions}
                  />
                </div>
              </div>
            </>
          )}

          {/* ── NELSON RULE VIOLATIONS ─────────────────────────────────── */}
          {result && (
            <div style={s.card}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Nelson Rule Violations</div>
              {allViolations.length === 0 ? (
                <div style={{ color: '#4ade80', fontSize: 13 }}>✅ No out-of-control signals detected.</div>
              ) : (
                allViolations.map((v, i) => (
                  <div key={i} style={s.rowCard}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, color: '#ef4444', fontSize: 13 }}>Rule {v.rule}: {v.label}</span>
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
              Enter your data on the left and click Analyze to generate control charts, capability indices, and Nelson Rule diagnostics.
            </div>
          )}
        </div>
      </div>

      {pasteToast && <div style={s.toast}>✅ Data pasted successfully</div>}
    </div>
  )
}
