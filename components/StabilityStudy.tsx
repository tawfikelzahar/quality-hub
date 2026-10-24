'use client'

import { useEffect, useRef, useState } from 'react'
import 'chart.js/auto'
import { Chart } from 'react-chartjs-2'
import type { Chart as ChartJSInstance } from 'chart.js'
import { COLORS, getSharedStyles, usePersistedTheme, tint } from '@/lib/theme'
import Nav from '@/components/Nav'
import ToolSidebar from '@/components/ToolSidebar'
import ToolStyles from '@/components/tool/ToolStyles'
import { ToolHeader, HelpPanel, PhoneTabs, PhoneBar, ExportRow, DataCardHead, useCompactSave, type MobileTab } from '@/components/tool/ToolParts'
import SaveAnalysisButton from '@/components/SaveAnalysisButton'
import { SheetPicker } from '@/components/GridImportControls'
import { useGridImport } from '@/lib/gridImport'
import { useSubscription } from '@/lib/useSubscription'
import { goToLogin, goToPricing } from '@/lib/exportGate'
import { watermarkOptions, watermarkLayout, withWatermarksDisabled } from '@/lib/watermarkHelpers'
import { useLanguage } from '@/lib/i18n/context'
import { translations, type TKey } from '@/lib/i18n/translations'
import { createReport, nowStamp } from '@/lib/excelReport'
import { createReport as createPdfReport, addChartImage, addSignOff, calloutBox, dataTable, finalizeReport, REPORT_COLORS } from '@/lib/pdf/reportDesign'
import { fixed, formatPEquals } from '@/lib/stats/format'
import { STORAGE_CONDITIONS, ACCEL_RESULTS, storageKindOf, type AccelResult } from '@/lib/stability/options'
import type { StabilityResult, ShelfLifeClaim } from '@/lib/stability/calc'

// ─────────────────────────────────────────────────────────────────────────
// Stability Study on the shared tool layout. The ICH Q1E analysis (model
// choice, confidence bound, shelf life) and the claim rule (2.4) run on the
// server, /api/stability. This page sends the inputs and draws the reply.
// ─────────────────────────────────────────────────────────────────────────

const EN = translations.en
type Dict = Readonly<Record<string, string>>
const say = (d: Dict, k: TKey) => d[k]
const fill = (str: string, vars: Record<string, string | number>) => Object.entries(vars).reduce((a, [k, v]) => a.split(`{${k}}`).join(String(v)), str)
const ltr = (v: string) => `⁦${v}⁩`
const hexRgb = (h: string): [number, number, number] => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)) as [number, number, number]
const csvCell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`

const MAX_BATCHES = 20
const MAX_MONTHS = 60
/** charts in the PDF: full width, a little shorter than on screen */
const PDF_CHART = { width: 900, height: 240 }
const SOURCE_LINE = 'Source: ICH Q1E (2003) — regression and confidence bound, poolability at α = 0.25, extrapolation limits in 2.4–2.5 · storage conditions and significant change: ICH Q1A(R2).'
// categorical, avoids the verdict colours (green/amber/red)
const BATCH_COLORS = ['#5B8FD9', '#9A7FE0', '#2BA39A', '#D9659A', '#7A8BA6', '#5FB0D9']

interface Inputs {
  attribute: string
  unit: string
  storage: string
  /** accelerated (and intermediate) study result */
  accel: AccelResult
  confidence: 90 | 95 | 99
  lower: string
  upper: string
  months: string[]
  names: string[]
  /** values[row][batch] */
  values: string[][]
}

// Realistic assay decline, 24 months, three batches: a common slope with a
// start per batch, the bound reaches 95.0% at about 30 months.
const EXAMPLE: Inputs = {
  attribute: 'Assay', unit: '%', storage: 'long-term', accel: 'none', confidence: 95, lower: '95.0', upper: '',
  months: ['0', '3', '6', '9', '12', '18', '24'],
  names: ['A2401', 'A2402', 'A2403'],
  values: [
    ['100.5', '100.8', '100.1'],
    ['99.8', '100.5', '99.7'],
    ['99.5', '99.9', '99.0'],
    ['99.0', '99.5', '98.8'],
    ['98.3', '99.0', '98.1'],
    ['97.4', '97.8', '97.2'],
    ['96.6', '96.9', '96.0'],
  ],
}

const num = (s: string): number | null => {
  const v = s.trim()
  if (v === '') return null
  const n = Number(v)
  return Number.isFinite(n) && Math.abs(n) <= 1e9 ? n : null
}
const isNum = (s: string | undefined) => s !== undefined && num(s) !== null

interface Reply { result: StabilityResult | null; claim: ShelfLifeClaim | null }

function useAnalysis(body: object | null) {
  const key = body ? JSON.stringify(body) : null
  const [reply, setReply] = useState<{ key: string; r: Reply | null; failed: boolean } | null>(null)
  useEffect(() => {
    if (!key) return
    const ctrl = new AbortController()
    const timer = setTimeout(() => {
      fetch('/api/stability', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: key, signal: ctrl.signal })
        .then(async res => setReply({ key, r: res.ok ? ((await res.json()) as Reply) : null, failed: !res.ok }))
        .catch(() => { if (!ctrl.signal.aborted) setReply({ key, r: null, failed: true }) })
    }, 200)
    return () => { clearTimeout(timer); ctrl.abort() }
  }, [key])
  if (!key) return { r: null, pending: false, failed: false }
  const current = reply?.key === key ? reply : null
  // keep the last reply on screen while the next one is on its way
  return { r: current ? current.r : reply?.r ?? null, pending: current === null, failed: current?.failed ?? false }
}

export default function StabilityStudy() {
  const { isPro, isLoggedIn } = useSubscription()
  const [theme, setTheme] = usePersistedTheme()
  const { t, lang } = useLanguage()
  const c = COLORS[theme]
  const s = getSharedStyles(theme)
  const compactSave = useCompactSave()
  const chartRef = useRef<ChartJSInstance<'scatter'>>(null)

  const [inp, setInp] = useState<Inputs>(EXAMPLE)
  const [mobileTab, setMobileTab] = useState<MobileTab>('data')
  const [helpOpen, setHelpOpen] = useState(false)
  const [loadedProjectName, setLoadedProjectName] = useState('')
  const [loadError, setLoadError] = useState('')
  const set = (p: Partial<Inputs>) => setInp(prev => ({ ...prev, ...p }))

  // ── Load a saved project (?id=…) — old saves carry direction + both limits ──
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id')
    if (!id) return
    fetch(`/api/saved-analyses/${id}`)
      .then(res => (res.ok ? res.json() : Promise.reject()))
      .then(({ analysis }) => {
        const d = analysis.input_data as Record<string, unknown>
        const str = (v: unknown) => (v === null || v === undefined ? '' : String(v))
        const months = Array.isArray(d.timePoints) ? (d.timePoints as unknown[]).map(str) : []
        const names = Array.isArray(d.batchNames) ? (d.batchNames as unknown[]).map(str) : []
        const values = Array.isArray(d.values) ? (d.values as unknown[][]).map(row => names.map((_, j) => str(Array.isArray(row) ? row[j] : ''))) : []
        let lower = str(d.specLower)
        let upper = str(d.specUpper)
        // the old page used only the limit that matched its trend direction
        if (d.direction === 'decreasing') upper = ''
        if (d.direction === 'increasing') lower = ''
        const conf = [90, 95, 99].includes(Number(d.confidence)) ? (Number(d.confidence) as 90 | 95 | 99) : 95
        setInp({
          attribute: str(d.attribute ?? d.attributeName) || 'Assay',
          unit: d.unit === undefined ? '%' : str(d.unit),
          storage: STORAGE_CONDITIONS.some(x => x.key === d.storageCondition) ? String(d.storageCondition) : 'long-term',
          accel: ACCEL_RESULTS.includes(d.accel as AccelResult) ? (d.accel as AccelResult) : 'unknown',
          confidence: conf, lower, upper,
          months, names, values: months.map((_, i) => values[i] ?? names.map(() => '')),
        })
        setLoadedProjectName(analysis.name as string)
      })
      .catch(() => setLoadError(lang === 'ar' ? 'تعذر تحميل المشروع المحفوظ.' : 'Could not load the saved project.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Paste anywhere / upload: months in column 1, a column per batch, names in row 1 ──
  const gridImport = useGridImport({
    minCellsPerRow: 2,
    keepHeaderRow: true,
    onGrid: grid => {
      const head = grid[0]
      const hasHeader = !isNum(head[0]) || head.slice(1).some(v => v.trim() !== '' && !isNum(v))
      const rows = grid.slice(hasHeader ? 1 : 0).filter(r => isNum(r[0])).slice(0, MAX_MONTHS)
      const width = Math.min(MAX_BATCHES, Math.max(0, ...rows.map(r => r.length - 1), hasHeader ? head.length - 1 : 0))
      if (rows.length === 0 || width === 0) return
      const names = Array.from({ length: width }, (_, j) => (hasHeader && head[j + 1]?.trim()) || `Batch ${j + 1}`)
      setInp(prev => ({
        ...prev,
        months: rows.map(r => r[0].trim()),
        names,
        values: rows.map(r => names.map((_, j) => (isNum(r[j + 1]) ? r[j + 1].trim() : ''))),
      }))
    },
    onError: () => undefined,
  })

  // ── Grid editing ──
  const setCell = (row: number, col: number, v: string) => setInp(prev => ({ ...prev, values: prev.values.map((r, i) => (i === row ? r.map((x, j) => (j === col ? v : x)) : r)) }))
  const setMonth = (row: number, v: string) => setInp(prev => ({ ...prev, months: prev.months.map((m, i) => (i === row ? v : m)) }))
  const setName = (col: number, v: string) => setInp(prev => ({ ...prev, names: prev.names.map((n, j) => (j === col ? v : n)) }))
  const addMonth = () => setInp(prev => {
    if (prev.months.length >= MAX_MONTHS) return prev
    const nums = prev.months.map(num).filter((v): v is number => v !== null)
    const next = nums.length ? Math.max(...nums) + (nums.length > 1 && Math.max(...nums) >= 12 ? 6 : 3) : 0
    return { ...prev, months: [...prev.months, String(next)], values: [...prev.values, prev.names.map(() => '')] }
  })
  const removeMonth = (row: number) => setInp(prev => (prev.months.length <= 1 ? prev : { ...prev, months: prev.months.filter((_, i) => i !== row), values: prev.values.filter((_, i) => i !== row) }))
  const addBatch = () => setInp(prev => (prev.names.length >= MAX_BATCHES ? prev : { ...prev, names: [...prev.names, `Batch ${prev.names.length + 1}`], values: prev.values.map(r => [...r, '']) }))
  const removeBatch = (col: number) => setInp(prev => (prev.names.length <= 1 ? prev : { ...prev, names: prev.names.filter((_, j) => j !== col), values: prev.values.map(r => r.filter((_, j) => j !== col)) }))
  const clearAll = () => set({ months: ['0', '3', '6'], names: ['Batch 1'], values: [[''], [''], ['']] })
  const loadExample = () => { setInp(EXAMPLE); setMobileTab('results') }

  // ── Request ──
  const lower = num(inp.lower)
  const upper = num(inp.upper)
  const limitsBad = lower !== null && upper !== null && lower >= upper
  const used = new Set<string>()
  const allBatches = inp.names.map((raw, j) => {
    let name = raw.trim() || `Batch ${j + 1}`
    for (let k = 2; used.has(name); k++) name = `${raw.trim() || `Batch ${j + 1}`} (${k})`
    used.add(name)
    const points = inp.months
      .map((m, i) => ({ time: num(m), value: num(inp.values[i]?.[j] ?? '') }))
      .filter((p): p is { time: number; value: number } => p.time !== null && p.time >= 0 && p.value !== null)
    return { name, color: BATCH_COLORS[j % BATCH_COLORS.length], points }
  })
  const batches = allBatches.filter(b => b.points.length >= 2)
  const filled = allBatches.reduce((a, b) => a + b.points.length, 0)
  const body = batches.length && !limitsBad
    ? { batches: batches.map(b => ({ name: b.name, points: b.points })), lower, upper, confidence: inp.confidence / 100, storage: inp.storage, accel: inp.accel }
    : null
  const { r: reply, pending, failed } = useAnalysis(body)
  const res = body ? reply?.result ?? null : null
  const claim = body ? reply?.claim ?? null : null
  const hasLimit = lower !== null || upper !== null
  const kind = storageKindOf(inp.storage)
  const colorOf = (name: string) => batches.find(b => b.name === name)?.color ?? c.data

  // ── Words ──
  const months = (x: number, d: Dict, digits = 1) => fill(say(d, 'stb_months'), { x: fixed(x, digits) })
  const side = (d: Dict) => say(d, res?.sided === 'two' ? 'stb_side_two' : 'stb_side_one')
  const modelKey = (m: StabilityResult['model']): TKey => (m === 'pooled' ? 'stb_model_t_pooled' : m === 'common-slope' ? 'stb_model_t_common' : m === 'separate' ? 'stb_model_t_separate' : 'stb_model_t_single')
  /** iso: wrap the p values for Arabic on screen (never in exports: the PDF font has no isolate marks) */
  const modelText = (d: Dict, iso = false) => {
    if (!res) return ''
    if (res.model === 'single' || !res.poolability) return say(d, 'stb_model_single')
    const w = (x: string) => (iso ? ltr(x) : x)
    const v = { ps: w(formatPEquals(res.poolability.slopesP)), pi: w(formatPEquals(res.poolability.interceptsP)) }
    return fill(say(d, res.model === 'pooled' ? 'stb_model_pooled' : res.model === 'common-slope' ? 'stb_model_common' : 'stb_model_separate'), v)
  }
  const shelfHead = (d: Dict) => (!hasLimit ? say(d, 'stb_v_no_limit') : res?.recommended == null ? say(d, 'stb_v_not_reached') : months(res.recommended, d))
  const shelfSub = (d: Dict) => {
    if (!res) return ''
    if (!hasLimit) return say(d, 'stb_v_no_limit_sub')
    if (res.recommended === null) return say(d, 'stb_v_not_reached_sub')
    const base = fill(say(d, 'stb_v_sub'), { conf: inp.confidence, side: side(d), x: fixed(res.recommended, 1) })
    return res.limiting && res.model !== 'single' ? `${base} ${fill(say(d, 'stb_set_by'), { b: res.limiting })}` : base
  }
  /** why this extrapolation rule applies (storage + accelerated result) */
  const whyKey = (): TKey => {
    if (!claim) return 'stb_why_unknown'
    if (kind === 'frozen') return 'stb_why_frozen'
    if (claim.accel === 'unknown') return 'stb_why_unknown'
    if (kind === 'refrigerated') return claim.accel === 'none' ? 'stb_why_fridge_none' : 'stb_why_fridge_acc'
    return claim.accel === 'none' ? 'stb_why_room_none' : claim.accel === 'accelerated' ? 'stb_why_room_acc' : 'stb_why_room_int'
  }
  const claimSub = (d: Dict) => {
    if (!claim || claim.claim === null) return ''
    const v = { c: fixed(claim.covered, 0), max: fixed(claim.maxAllowed ?? 0, 0), rule: say(d, claim.rule === '2x12' ? 'stb_rule_2x12' : 'stb_rule_15x6'), why: say(d, whyKey()) }
    const parts: string[] = []
    if (claim.rule === null) parts.push(say(d, 'stb_claim_custom'))
    else if (claim.rule === 'none') parts.push(fill(say(d, claim.limitedBy === 'rule' ? 'stb_claim_nox' : 'stb_claim_in'), v))
    else if (claim.limitedBy === 'rule') parts.push(fill(say(d, 'stb_claim_rule'), v))
    else if (claim.claim > claim.covered) parts.push(fill(say(d, 'stb_claim_extra'), v))
    else parts.push(fill(say(d, 'stb_claim_in'), v))
    if (claim.step6 !== null && claim.step6 >= 6 && claim.step6 !== claim.wholeMonths) parts.push(fill(say(d, 'stb_claim_steps'), { s: claim.step6 }))
    return parts.join(' ')
  }
  const claimHead = (d: Dict) => (kind === 'support' ? say(d, 'stb_claim_support_t') : claim?.wholeMonths != null ? months(claim.wholeMonths, d, 0) : '—')
  const limitsLine = (d: Dict = EN) => [lower !== null ? `${say(d, 'stb_lower')} ${inp.lower.trim()}` : '', upper !== null ? `${say(d, 'stb_upper')} ${inp.upper.trim()}` : ''].filter(Boolean).join(' · ') + (hasLimit && inp.unit ? ` ${inp.unit}` : '')
  const storageLabel = (d: Dict) => say(d, `stb_sc_${inp.storage.replace(/-/g, '_')}` as TKey) ?? inp.storage

  const claimColor = !claim || claim.claim === null || kind === 'support' ? 'var(--qh-muted)' : claim.limitedBy === 'rule' || claim.claim > claim.covered ? 'var(--qh-amber)' : 'var(--qh-good)'
  const shelfColor = 'var(--qh-data)'

  // ── Chart ──
  const xMax = res ? res.bound[res.bound.length - 1].t : 6
  const yVals = [
    ...batches.flatMap(b => b.points.map(p => p.value)),
    ...(lower !== null ? [lower] : []), ...(upper !== null ? [upper] : []),
    ...(res ? res.bound.flatMap(p => [p.lower, p.upper]).filter((v): v is number => v !== null) : []),
  ]
  const yLo = yVals.length ? Math.min(...yVals) : 0
  const yHi = yVals.length ? Math.max(...yVals) : 1
  const pad = (yHi - yLo) * 0.08 || 1
  const yMin = yLo - pad
  const yMax = yHi + pad
  const lineAt = (a: number, b: number) => [{ x: 0, y: a }, { x: xMax, y: a + b * xMax }]
  const pooledLine = res?.model === 'pooled' && res.batches[0]
  const chartData = res
    ? {
        datasets: [
          ...batches.map(b => ({ type: 'scatter' as const, label: b.name, data: b.points.map(p => ({ x: p.time, y: p.value })), backgroundColor: b.color, borderColor: b.color, pointRadius: 4.5, pointHoverRadius: 6 })),
          ...(pooledLine
            ? [{ type: 'scatter' as const, label: 'model', data: lineAt(pooledLine.modelIntercept, pooledLine.modelSlope), showLine: true, borderColor: c.text, borderWidth: 2, pointRadius: 0 }]
            : res.batches.map(b => ({ type: 'scatter' as const, label: 'model', data: lineAt(b.modelIntercept, b.modelSlope), showLine: true, borderColor: colorOf(b.name), borderWidth: b.name === res.limiting ? 2.5 : 1.5, pointRadius: 0 }))),
          ...(['lower', 'upper'] as const).filter(k => res.bound[0][k] !== null).map(k => ({
            type: 'scatter' as const, label: 'bound', data: res.bound.map(p => ({ x: p.t, y: p[k] as number })), showLine: true, borderColor: c.amber, borderWidth: 2, borderDash: [6, 4], pointRadius: 0,
          })),
          ...[lower, upper].filter((v): v is number => v !== null).map(v => ({ type: 'scatter' as const, label: 'limit', data: [{ x: 0, y: v }, { x: xMax, y: v }], showLine: true, borderColor: c.danger, borderWidth: 2, pointRadius: 0 })),
          ...(res.recommended !== null && hasLimit
            ? [{ type: 'scatter' as const, label: 'shelf', data: [{ x: res.recommended, y: yMin }, { x: res.recommended, y: yMax }], showLine: true, borderColor: c.muted, borderWidth: 1.5, borderDash: [3, 3], pointRadius: 0 }]
            : []),
        ],
      }
    : null
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false as const,
    devicePixelRatio: 2,
    layout: watermarkLayout(),
    plugins: {
      legend: { display: false },
      watermark: watermarkOptions('light'),
      tooltip: {
        filter: (item: { datasetIndex: number }) => item.datasetIndex < batches.length,
        callbacks: { label: (item: { dataset: { label?: string }; parsed: { x: number | null; y: number | null } }) => `${item.dataset.label}: ${item.parsed.y} ${inp.unit} @ ${item.parsed.x} mo` },
      },
    },
    scales: {
      x: { type: 'linear' as const, min: 0, max: xMax, ticks: { color: c.muted, font: { size: 11 } }, grid: { display: false }, border: { color: c.border }, title: { display: true, text: t('stab_axis_time'), color: c.muted, font: { size: 11 } } },
      y: { min: yMin, max: yMax, ticks: { color: c.muted, font: { size: 11 } }, grid: { color: c.grid }, border: { color: c.border }, title: { display: true, text: `\u200E${inp.attribute || t('stab_attribute')}${inp.unit ? ` (${inp.unit})` : ''}\u200E`, color: c.muted, font: { size: 11 } } },
    },
  }

  // ── Exports (English) ──
  const attr = `${inp.attribute || 'Attribute'}${inp.unit ? ` (${inp.unit})` : ''}`
  const modelEn = res ? say(EN, modelKey(res.model)) : ''
  const shelfCell = (v: number | null, ex: boolean) => (v === null ? 'not reached' : `${fixed(v, 1)} mo${ex ? '*' : ''}`)
  const verdictLine = () => res ? `Shelf life from the data: ${shelfHead(EN)}. ${shelfSub(EN)}` : ''
  const claimLine = () => claim && kind !== 'support' ? `Shelf life you can claim: ${claimHead(EN)}. ${claimSub(EN)}` : say(EN, 'stb_claim_support')

  const poolLine = (p: NonNullable<StabilityResult['poolability']>) =>
    `slopes F(${p.slopesDf1}, ${p.slopesDf2}) = ${fixed(p.slopesF, 3)}, ${formatPEquals(p.slopesP)} (${p.slopesPoolable ? 'poolable' : 'not poolable'}) · ` +
    `intercepts F(${p.interceptsDf1}, ${p.interceptsDf2}) = ${fixed(p.interceptsF, 3)}, ${formatPEquals(p.interceptsP)} (${p.interceptsPoolable ? 'poolable' : 'not poolable'}) · α = 0.25`

  /** exports are in English: the chart's axis titles switch for the snapshot */
  const withEnglishAxes = async <T,>(fn: () => T | Promise<T>): Promise<T> => {
    const ch = chartRef.current
    const sc = ch?.options.scales as { x?: { title?: { text?: string } }; y?: { title?: { text?: string } } } | undefined
    if (!ch || !sc?.x?.title || !sc.y?.title) return fn()
    const keep = [sc.x.title.text, sc.y.title.text]
    sc.x.title.text = EN.stab_axis_time
    sc.y.title.text = `\u200E${attr}\u200E`
    ch.update('none')
    try {
      return await fn()
    } finally {
      sc.x.title.text = keep[0]
      sc.y.title.text = keep[1]
      ch.update('none')
    }
  }

  const exportCSV = () => {
    if (!isLoggedIn) { goToLogin('stability', 'csv'); return }
    if (!res) return
    const lines = [
      `Stability Study — ${attr}`,
      `Storage condition,${csvCell(storageLabel(EN))}`,
      `Accelerated study,${csvCell(say(EN, `stb_accel_${inp.accel}` as TKey))}`,
      `Limits,${csvCell(limitsLine() || 'none')}`,
      `Confidence,${inp.confidence}% ${res.sided}-sided`,
      `Model,${csvCell(modelEn)}`,
      `Shelf life (months),${res.recommended !== null ? fixed(res.recommended, 2) : 'not reached'}`,
      `Limiting batch,${csvCell(res.limiting ?? '')}`,
      `Claim (months),${claim?.wholeMonths ?? ''}`,
      '',
      ['Month', ...inp.names.map(csvCell)].join(','),
      ...inp.months.map((m, i) => [m, ...inp.names.map((_, j) => inp.values[i]?.[j] ?? '')].join(',')),
      '',
      'Batch,Results,Slope per month,Intercept,R2,Shelf life (months),Beyond data',
      ...res.batches.map(b => [csvCell(b.name), b.n, fixed(b.slope, 5), fixed(b.intercept, 4), fixed(b.r2, 4), b.shelfLife !== null ? fixed(b.shelfLife, 2) : 'not reached', b.extrapolated ? 'yes' : 'no'].join(',')),
    ]
    const blob = new Blob(['﻿', lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'stability-study.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const runExcel = async () => {
    if (!isPro) { goToPricing('stability', 'excel'); return }
    if (!res) return
    const report = createReport({ toolName: 'Stability Study' })
    const sh = report.addSheet('Overview')
    sh.titleBand('Stability Study — ICH Q1E', `${attr} · ${storageLabel(EN)}`)
    sh.metaStrip([
      ['Generated on', nowStamp()],
      ['Limits', limitsLine() || 'none'],
      ['Accelerated study', say(EN, `stb_accel_${inp.accel}` as TKey)],
      ['Confidence', `${inp.confidence}% ${res.sided}-sided`],
      ['Model', modelEn],
    ])
    sh.sectionHeading('Shelf Life')
    sh.kpiRow([
      { label: 'Shelf life from the data', value: hasLimit && res.recommended !== null ? `${fixed(res.recommended, 1)} mo` : shelfHead(EN), sub: res.limiting && res.model !== 'single' ? `Set by ${res.limiting}` : undefined, tone: 'accent' },
      ...(kind !== 'support' && claim?.wholeMonths != null ? [{ label: 'Shelf life you can claim', value: `${claim.wholeMonths} mo`, tone: claimColor === 'var(--qh-good)' ? 'good' as const : 'warning' as const }] : []),
      { label: 'Batches', value: batches.length, tone: 'neutral' },
    ])
    sh.note(verdictLine(), 'neutral')
    sh.note(claimLine(), claimColor === 'var(--qh-good)' ? 'good' : 'warning')
    sh.note(`${modelEn}: ${modelText(EN)}`, 'neutral')
    if (batches.length < 3) sh.note(say(EN, 'stb_few_batches'), 'warning')
    if (chartRef.current) {
      sh.sectionHeading('Stability Trend')
      await sh.image(chartRef.current.toBase64Image('image/png', 1), { widthCm: 17, heightCm: 9 })
    }
    sh.sectionHeading('Batches')
    sh.table({
      headers: [
        { header: 'Batch', key: 'b', align: 'left', width: 16 },
        { header: 'Results', key: 'n', align: 'center' },
        { header: 'Slope / month', key: 'slope', align: 'right', numFmt: '0.00000', width: 14 },
        { header: 'R²', key: 'r2', align: 'right', numFmt: '0.0000' },
        { header: 'Shelf life (months)', key: 'sl', align: 'right', numFmt: '0.0', width: 18 },
        { header: 'Beyond data', key: 'ex', align: 'center', width: 12 },
      ],
      rows: res.batches.map(b => ({ b: b.name, n: b.n, slope: b.slope, r2: b.r2, sl: b.shelfLife ?? 'not reached', ex: b.extrapolated ? 'Yes' : 'No' })),
      rowTones: res.batches.map(b => (b.name === res.limiting ? 'warning' : undefined)),
    })
    if (res.poolability) {
      sh.sectionHeading('Poolability (ANCOVA, α = 0.25)')
      const p = res.poolability
      sh.table({
        headers: [
          { header: 'Test', key: 't', align: 'left', width: 18 },
          { header: 'F', key: 'f', align: 'right', numFmt: '0.000' },
          { header: 'df', key: 'df', align: 'center' },
          { header: 'p', key: 'p', align: 'right', numFmt: '0.0000' },
          { header: 'Result', key: 'r', align: 'left', width: 16 },
        ],
        rows: [
          { t: 'Equal slopes', f: p.slopesF, df: `${p.slopesDf1}, ${p.slopesDf2}`, p: p.slopesP, r: p.slopesPoolable ? 'Poolable' : 'Not poolable' },
          { t: 'Equal intercepts', f: p.interceptsF, df: `${p.interceptsDf1}, ${p.interceptsDf2}`, p: p.interceptsP, r: p.interceptsPoolable ? 'Poolable' : 'Not poolable' },
        ],
      })
    }
    sh.note(SOURCE_LINE, 'neutral')
    sh.freezeHeader(2)
    const raw = report.addSheet('Raw Data')
    raw.titleBand('Raw Data', attr)
    raw.table({
      headers: [{ header: 'Month', key: 'm', align: 'center', width: 10 }, ...inp.names.map((n, j) => ({ header: n || `Batch ${j + 1}`, key: `b${j}`, align: 'right' as const, width: 12 }))],
      rows: inp.months.map((m, i) => {
        const row: Record<string, string | number> = { m: num(m) ?? m }
        inp.names.forEach((_, j) => { const v = num(inp.values[i]?.[j] ?? ''); row[`b${j}`] = v ?? '' })
        return row
      }),
    })
    raw.freezeHeader(2)
    await report.download('stability-study.xlsx')
  }

  const runPDF = () => {
    if (!isPro) { goToPricing('stability', 'pdf'); return }
    if (!res) return
    const ctx = createPdfReport('Stability Study — ICH Q1E', 'stability')
    calloutBox(ctx, verdictLine(), 'info')
    calloutBox(ctx, claimLine(), claimColor === 'var(--qh-good)' ? 'good' : 'warn')
    const w = ctx.pageWidth - ctx.margin * 2
    dataTable(ctx, 'Study', [{ header: 'ITEM', width: 130 }, { header: 'VALUE', width: w - 130 }], [
      ['Attribute', attr],
      ['Storage condition', storageLabel(EN)],
      ...(kind === 'room' || kind === 'refrigerated' ? [['Accelerated study', say(EN, `stb_accel_${inp.accel}` as TKey)]] : []),
      ['Limits', limitsLine() || 'none'],
      ['Confidence bound', `${inp.confidence}%, ${res.sided}-sided`],
      ['Data', `${batches.length} batches · ${filled} results · up to ${fixed(res.maxObserved, 0)} months`],
      ['Model', `${modelEn}. ${modelText(EN)}`],
      ...(res.poolability ? [['Poolability (ANCOVA)', poolLine(res.poolability)]] : []),
      ['Source', SOURCE_LINE.replace('Source: ', '')],
    ])
    if (batches.length < 3) calloutBox(ctx, say(EN, 'stb_few_batches'), 'warn')
    dataTable(
      ctx,
      'Batches (* beyond the last time point)',
      [
        { header: 'BATCH', width: 110 },
        { header: 'RESULTS', width: 64, align: 'center' },
        { header: 'SLOPE / MONTH', width: 100, align: 'right' },
        { header: 'R²', width: 70, align: 'right' },
        { header: 'SHELF LIFE', width: w - 344, align: 'right' },
      ],
      res.batches.map(b => [b.name, String(b.n), fixed(b.slope, 4), fixed(b.r2, 3), shelfCell(b.shelfLife, b.extrapolated)]),
      { cellColors: res.batches.map(b => [hexRgb(colorOf(b.name)), null, null, null, b.name === res.limiting ? REPORT_COLORS.warn : null]) },
    )
    if (chartRef.current) addChartImage(ctx, chartRef.current, `Stability Trend  ·  solid: model · dashed: ${inp.confidence}% bound · red: limit · dotted: shelf life`, PDF_CHART)
    addSignOff(ctx)
    finalizeReport(ctx)
    ctx.pdf.save('stability-report.pdf')
  }

  const runPNG = () => {
    if (!isLoggedIn) { goToLogin('stability', 'png'); return }
    if (!chartRef.current) return
    const a = document.createElement('a')
    a.href = chartRef.current.toBase64Image('image/png', 1)
    a.download = 'stability-trend.png'
    a.click()
  }
  const exportExcel = () => (isPro ? withWatermarksDisabled([chartRef.current], () => withEnglishAxes(runExcel)) : runExcel())
  const exportPDF = () => (isPro ? withWatermarksDisabled([chartRef.current], () => withEnglishAxes(runPDF)) : runPDF())
  const exportPNG = () => (isLoggedIn ? withWatermarksDisabled([chartRef.current], () => withEnglishAxes(runPNG)) : runPNG())

  const helpSteps = [1, 2, 3, 4].map(k => ({ t: t(`stb_help_s${k}_t` as TKey), d: t(`stb_help_s${k}_d` as TKey) }))
  const D = translations[lang]

  return (
    <div style={s.page}>
      <ToolStyles />
      <style>{`
        .st-two { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: 10px; }
        .st-pair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
        .st-field > span { display: block; font-size: 11px; color: var(--qh-muted); margin-bottom: 3px; }
        .st-txt { width: 100%; box-sizing: border-box; background: color-mix(in srgb, var(--qh-bg) 70%, var(--qh-surface)); border: 1px solid var(--qh-border); border-radius: 7px; color: var(--qh-text); padding: 8px 10px; font: inherit; font-size: 14px; outline: none; }
        .st-txt:focus { border-color: var(--qh-accent); }
        .st-seg { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border: 1px solid var(--qh-border); border-radius: 8px; overflow: hidden; }
        .st-seg button { border: 0; background: transparent; color: var(--qh-text); font: inherit; font-size: 13px; font-weight: 600; padding: 8px 6px; cursor: pointer; }
        .st-seg button + button { border-inline-start: 1px solid var(--qh-border); }
        .st-seg button[aria-pressed="true"] { background: var(--qh-accent); color: var(--qh-onAccent); }
        .st-grid th { vertical-align: bottom; }
        .st-grid th input { font: 600 13px ui-monospace, 'SF Mono', Menlo, monospace; text-align: center; min-width: 70px; color: var(--qh-text); }
        .st-grid td input { text-align: center; min-width: 70px; }
        .st-bh { display: flex; align-items: center; justify-content: center; gap: 2px; }
        .st-bh i { width: 8px; height: 8px; border-radius: 50%; flex: none; }
        .st-grid td.st-m input { color: var(--qh-muted); text-align: center; min-width: 52px; }
        .st-legend { display: flex; flex-wrap: wrap; gap: 6px 16px; margin-top: 12px; font-size: 12px; color: var(--qh-muted); }
        .st-legend span { display: inline-flex; align-items: center; gap: 6px; }
        .st-legend i { display: inline-block; width: 16px; height: 0; border-top: 2px solid; }
        .st-legend i.dot { width: 9px; height: 9px; border: 0; border-radius: 50%; }
        .st-model b { display: block; font-size: 15px; margin: 2px 0 4px; }
        .st-big { font: 700 24px ui-monospace, 'SF Mono', Menlo, monospace; letter-spacing: -0.3px; margin-bottom: 4px; }
        @media (max-width: 768px) { .st-two { grid-template-columns: minmax(0, 1fr) 90px; } }
      `}</style>
      <Nav theme={theme} setTheme={setTheme} breadcrumbKey="bc_stability" />

      {(loadedProjectName || loadError) && (
        <div className="qh-main" style={{ ...s.main, paddingBottom: 0 }}>
          {loadedProjectName && (
            <div style={{ fontSize: 13, color: c.accent, background: c.surface2, border: `1px solid ${c.border}`, borderRadius: 8, padding: '8px 14px' }}>
              {lang === 'ar' ? `تم تحميل المشروع المحفوظ: ${loadedProjectName}` : `Loaded saved project: ${loadedProjectName}`}
            </div>
          )}
          {loadError && <div className="tl-error">{loadError}</div>}
        </div>
      )}

      <div className="tl-shell">
        <ToolSidebar current="/stability" />

        <div className="tl-main">
          <ToolHeader title={t('stability_title')} intro={t('stb_intro')} onHelp={() => setHelpOpen(true)} onExample={loadExample} />
          <HelpPanel open={helpOpen} onClose={() => setHelpOpen(false)} title={t('stb_help_title')} steps={helpSteps} onExample={loadExample} showCapability={false} tip={t('stb_help_tip')} />
          <PhoneTabs tab={mobileTab} onTab={setMobileTab} dataCount={filled} />

          <div className="tl-top">
            {/* ── SETUP ───────────────────────────────────────────────── */}
            <section className="tl-panel tl-setup tl-card" data-active={mobileTab === 'setup'} aria-label={t('spc_tab_setup')}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{t('stb_setup_title')}</div>
              <div className="st-two">
                <label className="st-field"><span>{t('stab_attribute')}</span><input className="st-txt" value={inp.attribute} onChange={e => set({ attribute: e.target.value })} /></label>
                <label className="st-field"><span>{t('stab_unit')}</span><input className="st-txt" value={inp.unit} onChange={e => set({ unit: e.target.value })} /></label>
              </div>
              <div>
                <div className="tl-label">{t('stb_limits')}</div>
                <div className="st-pair">
                  <label className="tl-field"><span>{t('stb_lower')}</span><input inputMode="decimal" value={inp.lower} placeholder="—" onChange={e => set({ lower: e.target.value })} /></label>
                  <label className="tl-field"><span>{t('stb_upper')}</span><input inputMode="decimal" value={inp.upper} placeholder="—" onChange={e => set({ upper: e.target.value })} /></label>
                </div>
                <div className="tl-hint">{t('stb_limits_hint')}</div>
                {limitsBad && <div className="tl-error" style={{ marginTop: 8 }}>{t('stb_err_limits')}</div>}
              </div>
              <div>
                <div className="tl-label">{t('stab_confidence')}</div>
                <div className="st-seg" role="group" aria-label={t('stab_confidence')}>
                  {([90, 95, 99] as const).map(v => <button key={v} type="button" aria-pressed={inp.confidence === v} onClick={() => set({ confidence: v })}>{v}%</button>)}
                </div>
                <div className="tl-hint">{t('stb_conf_hint')}</div>
              </div>
              <label className="st-field">
                <div className="tl-label">{t('stab_storage_condition')}</div>
                <select className="st-txt" value={inp.storage} onChange={e => set({ storage: e.target.value })}>
                  {STORAGE_CONDITIONS.map(sc => <option key={sc.key} value={sc.key}>{t(`stb_sc_${sc.key.replace(/-/g, '_')}` as TKey)}</option>)}
                </select>
                <div className="tl-hint">{t('stb_storage_hint')}</div>
              </label>
              {(kind === 'room' || kind === 'refrigerated') && (
                <label className="st-field">
                  <div className="tl-label">{t('stb_accel')}</div>
                  <select className="st-txt" value={inp.accel} onChange={e => set({ accel: e.target.value as AccelResult })}>
                    {ACCEL_RESULTS.map(a => <option key={a} value={a}>{t(`stb_accel_${a}` as TKey)}</option>)}
                  </select>
                  <div className="tl-hint">{t('stb_accel_hint')}</div>
                </label>
              )}
            </section>

            <div className="tl-col">
              {/* ── DATA ──────────────────────────────────────────────── */}
              <section className="tl-panel tl-card" data-active={mobileTab === 'data'} aria-label={t('spc_tab_data')}>
                <DataCardHead
                  countLabel={fill(t('stb_data_count'), { b: inp.names.length, n: filled })}
                  onUpload={gridImport.openFilePicker}
                  onClear={clearAll}
                  extra={<gridImport.FileInput />}
                />
                {gridImport.fileError && <div className="tl-error" style={{ marginBottom: 10 }}>{gridImport.fileError}</div>}
                <SheetPicker sheetNames={gridImport.sheetNames} activeSheet={gridImport.activeSheet} onSelect={gridImport.selectSheet} accentColor={c.accent} textColor={c.text} mutedColor={c.muted} borderColor={c.border} />
                <div className="tl-sg-wrap">
                  <table className="tl-sg st-grid">
                    <thead>
                      <tr>
                        <th>{t('stab_month')}</th>
                        {inp.names.map((n, j) => (
                          <th key={j}>
                            <div className="st-bh">
                              <i style={{ background: BATCH_COLORS[j % BATCH_COLORS.length] }} aria-hidden="true" />
                              <input value={n} placeholder={t('stb_batch_ph')} aria-label={`${t('stb_batch_ph')} ${j + 1}`} onChange={e => setName(j, e.target.value)} />
                              {inp.names.length > 1 && <button type="button" className="tl-sg-x" aria-label={`${t('stb_remove_batch')} ${n}`} onClick={() => removeBatch(j)}>✕</button>}
                            </div>
                          </th>
                        ))}
                        <th aria-label={t('stb_remove_month')} style={{ width: 28 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {inp.months.map((m, i) => (
                        <tr key={i}>
                          <td className="st-m"><input inputMode="decimal" value={m} aria-label={`${t('stab_month')} ${i + 1}`} onChange={e => setMonth(i, e.target.value)} /></td>
                          {inp.names.map((n, j) => (
                            <td key={j}><input inputMode="decimal" value={inp.values[i]?.[j] ?? ''} aria-label={`${n} · ${t('stab_month')} ${m}`} onChange={e => setCell(i, j, e.target.value)} /></td>
                          ))}
                          <td><button type="button" className="tl-sg-x" aria-label={`${t('stb_remove_month')} ${m}`} onClick={() => removeMonth(i)}>✕</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginTop: 10 }}>
                  <button type="button" className="tl-xbtn tl-add" onClick={addMonth} disabled={inp.months.length >= MAX_MONTHS}>{t('stab_add_timepoint')}</button>
                  <button type="button" className="tl-xbtn tl-add" onClick={addBatch} disabled={inp.names.length >= MAX_BATCHES}>{t('stab_add_batch')}</button>
                </div>
                <div className="tl-paste">{t('stb_paste')}</div>
              </section>

              {/* ── RESULTS ───────────────────────────────────────────── */}
              <section className="tl-panel tl-results" data-active={mobileTab === 'results'} aria-label={t('spc_tab_results')}>
                {failed && <div className="tl-error">{t('stb_failed')}</div>}
                {!res ? (
                  <div className="tl-card tl-empty">{pending ? t('icmsf_loading') : t('stb_empty')}</div>
                ) : (
                  <>
                    <div className="tl-verdicts" aria-live="polite">
                      <div className="tl-verdict" style={{ background: tint(shelfColor, 8), border: `1px solid ${tint(shelfColor, 35)}` }}>
                        <span className="tl-verdict-icon" aria-hidden="true" style={{ background: tint(shelfColor, 16), color: shelfColor }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                        </span>
                        <div>
                          <div style={{ fontSize: 12, color: 'var(--qh-muted)', marginBottom: 2 }}>{t('stb_v_shelf')}</div>
                          <div className={hasLimit && res.recommended !== null ? 'st-big' : undefined} style={hasLimit && res.recommended !== null ? undefined : { fontSize: 17, fontWeight: 600, marginBottom: 4 }}>{shelfHead(D)}</div>
                          <div style={{ fontSize: 13, color: 'var(--qh-muted)', lineHeight: 1.6 }}>{shelfSub(D)}</div>
                        </div>
                      </div>
                      {hasLimit && (
                        <div className="tl-verdict" style={{ background: tint(claimColor, 8), border: `1px solid ${tint(claimColor, 35)}` }}>
                          <span className="tl-verdict-icon" aria-hidden="true" style={{ background: tint(claimColor, 16), color: claimColor }}>{claimColor === 'var(--qh-good)' ? '✓' : '!'}</span>
                          <div>
                            <div style={{ fontSize: 12, color: 'var(--qh-muted)', marginBottom: 2 }}>{t('stb_v_claim')}</div>
                            <div className={kind !== 'support' && claim?.wholeMonths != null ? 'st-big' : undefined} style={kind !== 'support' && claim?.wholeMonths != null ? { color: claimColor } : { fontSize: 17, fontWeight: 600, marginBottom: 4 }}>{claimHead(D)}</div>
                            <div style={{ fontSize: 13, color: 'var(--qh-muted)', lineHeight: 1.6 }}>{kind === 'support' ? t('stb_claim_support') : claimSub(D)}</div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="tl-card st-model" style={{ padding: '14px 18px' }}>
                      <div style={{ fontSize: 12, color: 'var(--qh-muted)' }}>{t('stb_model_label')} · {ltr(`${inp.confidence}%`)} {side(D)} · {ltr(`t = ${fixed(res.tCrit, 3)} · df ${res.df}`)}</div>
                      <b>{t(modelKey(res.model))}</b>
                      <div style={{ fontSize: 13, lineHeight: 1.7 }}>{modelText(D, lang === 'ar')}</div>
                      {batches.length < 3 && <div className="tl-chip-warn" style={{ marginTop: 10, display: 'inline-block' }}>{t('stb_few_batches')}</div>}
                    </div>

                    <div className="tl-results-head">
                      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{t('spc_tab_results')}</h2>
                      <ExportRow
                        isPro={isPro}
                        isLoggedIn={isLoggedIn}
                        hasResult={!!res}
                        onCSV={exportCSV}
                        onPNG={exportPNG}
                        onExcel={exportExcel}
                        onPDF={exportPDF}
                        pngLabel={t('stb_x_png')}
                        save={
                          <SaveAnalysisButton
                            theme={theme}
                            tool="stability"
                            defaultName={`Stability — ${inp.attribute || 'Study'} — ${new Date().toLocaleDateString('en-US')}`}
                            compact={compactSave}
                            getPayload={() => ({
                              input_data: {
                                attribute: inp.attribute, unit: inp.unit, storageCondition: inp.storage, accel: inp.accel, confidence: inp.confidence,
                                timePoints: inp.months.map(m => num(m)), batchNames: inp.names,
                                values: inp.months.map((_, i) => inp.names.map((__, j) => num(inp.values[i]?.[j] ?? ''))),
                                specLower: inp.lower, specUpper: inp.upper,
                              },
                              results: { model: res.model, recommended: res.recommended, limiting: res.limiting, sided: res.sided, poolability: res.poolability, batches: res.batches, claim },
                            })}
                          />
                        }
                      />
                    </div>

                    {chartData && (
                      <div className="tl-chart">
                        <h3>{t('stb_chart_title')}</h3>
                        <div className="tl-chart-sub">{fill(t('stb_chart_sub'), { conf: inp.confidence })}</div>
                        <div className="tl-chart-inner" style={{ height: 340 }}>
                          <Chart ref={chartRef} type="scatter" data={chartData} options={chartOptions} />
                        </div>
                        <div className="st-legend">
                          {batches.map(b => <span key={b.name}><i className="dot" style={{ background: b.color }} />{b.name}{b.name === res.limiting && res.model !== 'single' ? ' ★' : ''}</span>)}
                          {hasLimit && <span><i style={{ borderColor: c.amber, borderTopStyle: 'dashed' }} />{t('stb_lg_bound')}</span>}
                          {hasLimit && <span><i style={{ borderColor: c.danger }} />{t('stb_lg_limit')}</span>}
                          {hasLimit && res.recommended !== null && <span><i style={{ borderColor: c.muted, borderTopStyle: 'dotted' }} />{t('stb_lg_shelf')} {ltr(fixed(res.recommended, 1))}</span>}
                        </div>
                      </div>
                    )}

                    <details className="tl-more">
                      <summary>{t('stb_more')}</summary>
                      <div className="tl-more-body">
                        <div style={{ overflowX: 'auto' }}>
                          <table className="tl-table">
                            <thead>
                              <tr>
                                <th>{t('stab_col_batch')}</th>
                                <th className="num">{t('stb_col_n')}</th>
                                <th className="num">{t('stb_col_slope')}</th>
                                <th className="num">{t('stab_col_r2')}</th>
                                <th className="num">{t('stab_col_shelflife')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {res.batches.map(b => (
                                <tr key={b.name}>
                                  <td><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: colorOf(b.name), marginInlineEnd: 8 }} />{b.name}</td>
                                  <td className="num">{b.n}</td>
                                  <td className="num">{ltr(fixed(b.slope, 4))}</td>
                                  <td className="num">{fixed(b.r2, 3)}</td>
                                  <td className="num" style={b.name === res.limiting && res.model !== 'pooled' ? { color: 'var(--qh-amber)', fontWeight: 700 } : undefined}>
                                    {b.shelfLife === null ? t('stab_not_reached') : ltr(`${fixed(b.shelfLife, 1)}${b.extrapolated ? '*' : ''}`)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <div className="tl-hint">{t('stb_table_note')}</div>
                        </div>
                        {res.poolability && (
                          <div style={{ overflowX: 'auto' }}>
                            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{t('stab_poolability_title')}</div>
                            <table className="tl-table">
                              <thead>
                                <tr><th>{t('stb_pool_test')}</th><th className="num">F</th><th className="num">p</th><th>{t('stb_pool_result')}</th></tr>
                              </thead>
                              <tbody>
                                {([
                                  [t('stab_equal_slopes'), res.poolability.slopesF, res.poolability.slopesDf1, res.poolability.slopesDf2, res.poolability.slopesP, res.poolability.slopesPoolable],
                                  [t('stab_equal_intercepts'), res.poolability.interceptsF, res.poolability.interceptsDf1, res.poolability.interceptsDf2, res.poolability.interceptsP, res.poolability.interceptsPoolable],
                                ] as const).map(([label, f, d1, d2, p, ok]) => (
                                  <tr key={label}>
                                    <td>{label}</td>
                                    <td className="num">{ltr(`F(${d1}, ${d2}) = ${fixed(f, 3)}`)}</td>
                                    <td className="num">{ltr(formatPEquals(p).replace('p = ', ''))}</td>
                                    <td style={{ color: ok ? 'var(--qh-good)' : 'var(--qh-amber)', fontWeight: 600 }}>{t(ok ? 'stab_poolable' : 'stab_not_poolable')}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </details>

                    <details className="tl-more">
                      <summary>{t('stb_method_title')}</summary>
                      <div className="tl-more-body">
                        {(['stb_method_1', 'stb_method_2', 'stb_method_3'] as TKey[]).map(k => <p key={k} style={{ margin: 0, fontSize: 13, lineHeight: 1.7 }}>{t(k)}</p>)}
                      </div>
                    </details>
                  </>
                )}
              </section>
            </div>
          </div>
        </div>
      </div>

      <PhoneBar
        showResultActions={mobileTab === 'results' && !!res}
        onAnalyze={() => { setMobileTab('results'); window.scrollTo({ top: 0 }) }}
        onEdit={() => setMobileTab('data')}
        analyzeLabel={t('icmsf_bar_results')}
      />
    </div>
  )
}
