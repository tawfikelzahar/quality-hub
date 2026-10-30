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
import { createReport as createPdfReport, addChartImage, addChartImagePair, addSignOff, calloutBox, dataTable, finalizeReport, REPORT_COLORS } from '@/lib/pdf/reportDesign'
import { fixed, formatPValue, formatPEquals } from '@/lib/stats/format'
import type { RegressionFit, RegressionError } from '@/lib/regression/model'

// ─────────────────────────────────────────────────────────────────────────
// Simple and multiple linear regression on the shared tool layout. The fit,
// tests, diagnostics and intervals come from /api/regression; this page
// holds the data grid, sends the chosen columns and draws the reply.
// ─────────────────────────────────────────────────────────────────────────

export type RegressionMode = 'simple' | 'multiple'

const EN = translations.en
type Dict = Readonly<Record<string, string>>
const say = (d: Dict, k: TKey) => d[k]
const fill = (str: string, vars: Record<string, string | number>) => Object.entries(vars).reduce((a, [k, v]) => a.split(`{${k}}`).join(String(v)), str)
const ltr = (v: string) => `⁦${v}⁩`
const csvCell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
const MAX_X = 10
const MAX_COLS = 12
const SOURCE_LINE = 'Source: Montgomery, Peck & Vining, Introduction to Linear Regression Analysis — OLS by QR, exact t and F tests, adjusted SS per predictor; unusual observations |std resid| > 2 or leverage > min(3p/n, 0.99); residual normality: Anderson-Darling. Verified on the NIST StRD certified datasets.'
// categorical, away from the verdict colours
const BAND = '#5B8FD9'

interface Grid { names: string[]; rows: string[][] }
interface Inputs extends Grid { y: string; xs: string[]; predict: Record<string, string> }

const EXAMPLES: Record<RegressionMode, Inputs> = {
  simple: {
    names: ['Temperature', 'Strength'],
    rows: [['120', '48.2'], ['125', '49.5'], ['130', '50.1'], ['135', '52.0'], ['140', '53.4'], ['145', '54.1'], ['150', '55.8'], ['155', '57.0'], ['160', '58.2'], ['165', '59.6'], ['170', '60.9']],
    y: 'Strength', xs: ['Temperature'], predict: { Temperature: '158' },
  },
  multiple: {
    names: ['Speed', 'Hardness', 'SurfaceFinish'],
    rows: [['800', '20', '3.1'], ['900', '45', '2.4'], ['1000', '25', '2.6'], ['1100', '50', '1.9'], ['1200', '30', '2.1'], ['1300', '55', '1.5'], ['1400', '35', '1.7'], ['1500', '60', '1.1'], ['1600', '40', '1.3'], ['1700', '65', '0.8'], ['1800', '45', '1.0']],
    y: 'SurfaceFinish', xs: ['Speed', 'Hardness'], predict: { Speed: '1250', Hardness: '40' },
  },
}

const num = (s: string | undefined): number | null => {
  const v = (s ?? '').trim()
  if (v === '') return null
  const n = Number(v)
  return Number.isFinite(n) && Math.abs(n) <= 1e12 ? n : null
}
/** 4 significant figures for coefficients and values, like the statistical packages print */
const g4 = (v: number) => {
  if (!Number.isFinite(v)) return '—'
  const a = Math.abs(v)
  if (a !== 0 && (a >= 1e7 || a < 1e-6)) return v.toExponential(3)
  if (a !== 0 && a < 1) return Number(v.toPrecision(4)).toString()
  return fixed(v, a >= 1000 ? 1 : a >= 100 ? 2 : a >= 10 ? 3 : 4)
}

type Reply = { result: RegressionFit | null; error: RegressionError | 'failed' | null }

function useAnalysis(body: object | null) {
  const key = body ? JSON.stringify(body) : null
  const [reply, setReply] = useState<{ key: string; r: Reply } | null>(null)
  useEffect(() => {
    if (!key) return
    const ctrl = new AbortController()
    const timer = setTimeout(() => {
      fetch('/api/regression', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: key, signal: ctrl.signal })
        .then(async res => {
          const j = (await res.json().catch(() => ({}))) as { result?: RegressionFit; error?: RegressionError }
          setReply({ key, r: res.ok && j.result ? { result: j.result, error: null } : { result: null, error: res.status === 422 && j.error ? j.error : 'failed' } })
        })
        .catch(() => { if (!ctrl.signal.aborted) setReply({ key, r: { result: null, error: 'failed' } }) })
    }, 250)
    return () => { clearTimeout(timer); ctrl.abort() }
  }, [key])
  if (!key) return { r: null, pending: false }
  const current = reply?.key === key ? reply : null
  return { r: current ? current.r : reply?.r ?? null, pending: current === null }
}

/** guide: the server-rendered “About” section (components/tool/ToolGuide.tsx) */
export default function RegressionStudy({ mode, guide }: { mode: RegressionMode; guide?: React.ReactNode }) {
  const multi = mode === 'multiple'
  const tool = multi ? 'multiregression' : 'regression'
  const { isPro, isLoggedIn } = useSubscription()
  const [theme, setTheme] = usePersistedTheme()
  const { t, lang } = useLanguage()
  const c = COLORS[theme]
  const s = getSharedStyles(theme)
  const compactSave = useCompactSave()
  const mainRef = useRef<ChartJSInstance<'scatter'>>(null)
  const normRef = useRef<ChartJSInstance<'scatter'>>(null)
  const fitsRef = useRef<ChartJSInstance<'scatter'>>(null)
  const histRef = useRef<ChartJSInstance<'bar'>>(null)
  const orderRef = useRef<ChartJSInstance<'scatter'>>(null)

  const [inp, setInp] = useState<Inputs>(EXAMPLES[mode])
  const [mobileTab, setMobileTab] = useState<MobileTab>('data')
  const [helpOpen, setHelpOpen] = useState(false)
  const [loadedProjectName, setLoadedProjectName] = useState('')
  const [loadError, setLoadError] = useState('')
  const set = (p: Partial<Inputs>) => setInp(prev => ({ ...prev, ...p }))

  // ── Load a saved project (?id=…) — old saves: points/xCol/yCol (simple), rows/predictorNames/yCol (multiple) ──
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id')
    if (!id) return
    fetch(`/api/saved-analyses/${id}`)
      .then(res => (res.ok ? res.json() : Promise.reject()))
      .then(({ analysis }) => {
        const d = analysis.input_data as Record<string, unknown>
        const str = (v: unknown) => (v === null || v === undefined ? '' : String(v))
        let next: Inputs | null = null
        if (Array.isArray(d.names) && Array.isArray(d.rows) && typeof d.y === 'string') {
          next = { names: (d.names as unknown[]).map(str), rows: (d.rows as unknown[][]).map(r => r.map(str)), y: d.y, xs: Array.isArray(d.xs) ? (d.xs as unknown[]).map(str) : [], predict: (d.predict as Record<string, string>) ?? {} }
        } else if (Array.isArray(d.points)) {
          const xCol = str(d.xCol) || 'X', yCol = str(d.yCol) || 'Y'
          next = { names: [xCol, yCol], rows: (d.points as { x: number; y: number }[]).map(p => [str(p.x), str(p.y)]), y: yCol, xs: [xCol], predict: {} }
        } else if (Array.isArray(d.rows) && Array.isArray(d.predictorNames)) {
          const xs = (d.predictorNames as unknown[]).map(str), yCol = str(d.yCol) || 'Y'
          next = { names: [...xs, yCol], rows: (d.rows as { y: number; x: number[] }[]).map(r => [...r.x.map(str), str(r.y)]), y: yCol, xs, predict: {} }
        }
        if (!next) throw new Error()
        setInp(next)
        setLoadedProjectName(analysis.name as string)
      })
      .catch(() => setLoadError(lang === 'ar' ? 'تعذر تحميل المشروع المحفوظ.' : 'Could not load the saved project.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Paste anywhere / upload: names in row 1 (or generated) ──
  const gridImport = useGridImport({
    minCellsPerRow: 2,
    keepHeaderRow: true,
    onGrid: grid => {
      const head = grid[0]
      const hasHeader = head.some(v => v.trim() !== '' && num(v) === null)
      const body = grid.slice(hasHeader ? 1 : 0).filter(r => r.some(v => num(v) !== null)).slice(0, 5000)
      const width = Math.min(MAX_COLS, Math.max(hasHeader ? head.length : 0, ...body.map(r => r.length)))
      if (!body.length || width < 2) return
      const used = new Set<string>()
      const names = Array.from({ length: width }, (_, j) => {
        let n = (hasHeader && head[j]?.trim()) || `C${j + 1}`
        for (let k = 2; used.has(n); k++) n = `${(hasHeader && head[j]?.trim()) || `C${j + 1}`} (${k})`
        used.add(n)
        return n
      })
      const yName = names[width - 1]
      setInp({ names, rows: body.map(r => names.map((_, j) => (r[j] ?? '').trim())), y: yName, xs: multi ? names.slice(0, width - 1).slice(0, MAX_X) : [names[0]], predict: {} })
    },
    onError: () => undefined,
  })

  // ── Grid editing ──
  const setCell = (r: number, j: number, v: string) => setInp(prev => ({ ...prev, rows: prev.rows.map((row, i) => (i === r ? row.map((x, k) => (k === j ? v : x)) : row)) }))
  const rename = (j: number, v: string) => setInp(prev => {
    const old = prev.names[j]
    const names = prev.names.map((n, k) => (k === j ? v : n))
    const predict = { ...prev.predict }
    if (old in predict) { predict[v] = predict[old]; delete predict[old] }
    return { ...prev, names, y: prev.y === old ? v : prev.y, xs: prev.xs.map(x => (x === old ? v : x)), predict }
  })
  const addRow = () => setInp(prev => ({ ...prev, rows: [...prev.rows, prev.names.map(() => '')] }))
  const removeRow = (r: number) => setInp(prev => (prev.rows.length <= 1 ? prev : { ...prev, rows: prev.rows.filter((_, i) => i !== r) }))
  const addCol = () => setInp(prev => {
    if (prev.names.length >= MAX_COLS) return prev
    let name = `C${prev.names.length + 1}`
    for (let k = prev.names.length + 2; prev.names.includes(name); k++) name = `C${k}`
    return { ...prev, names: [...prev.names, name], rows: prev.rows.map(r => [...r, '']) }
  })
  const removeCol = (j: number) => setInp(prev => {
    if (prev.names.length <= 2) return prev
    const gone = prev.names[j]
    return { ...prev, names: prev.names.filter((_, k) => k !== j), rows: prev.rows.map(r => r.filter((_, k) => k !== j)), xs: prev.xs.filter(x => x !== gone), y: prev.y === gone ? '' : prev.y }
  })
  const clearAll = () => setInp({ names: ['X', 'Y'], rows: Array.from({ length: 5 }, () => ['', '']), y: 'Y', xs: ['X'], predict: {} })
  const loadExample = () => { setInp(EXAMPLES[mode]); setMobileTab('results') }
  const chooseY = (y: string) => setInp(prev => ({ ...prev, y, xs: prev.xs.filter(x => x !== y).length ? prev.xs.filter(x => x !== y) : prev.names.filter(n => n !== y).slice(0, multi ? MAX_X : 1) }))
  const toggleX = (x: string) => setInp(prev => {
    if (!multi) return { ...prev, xs: [x] }
    if (prev.xs.includes(x)) return { ...prev, xs: prev.xs.filter(v => v !== x) }
    if (prev.xs.length >= MAX_X) return prev
    return { ...prev, xs: prev.names.filter(n => n === x || prev.xs.includes(n)) }
  })

  // ── Request ──
  const yIdx = inp.names.indexOf(inp.y)
  const xs = inp.xs.filter(x => inp.names.includes(x) && x !== inp.y)
  const xIdx = xs.map(x => inp.names.indexOf(x))
  const complete = yIdx < 0 ? [] : inp.rows.filter(r => num(r[yIdx]) !== null && xIdx.every(j => num(r[j]) !== null))
  const touched = inp.rows.filter(r => r.some(v => v.trim() !== ''))
  const skipped = touched.length - complete.length
  const need = xs.length + 2
  const namesOk = inp.names.every(n => n.trim() !== '') && new Set(inp.names.map(n => n.trim())).size === inp.names.length
  const predVals = xs.map(x => num(inp.predict[x]))
  const body = yIdx >= 0 && xs.length >= 1 && complete.length >= need && namesOk
    ? {
        yName: inp.y.trim().slice(0, 60), xNames: xs.map(x => x.trim().slice(0, 60)),
        y: complete.map(r => num(r[yIdx]) as number),
        X: complete.map(r => xIdx.map(j => num(r[j]) as number)),
        predict: predVals.every(v => v !== null) ? (predVals as number[]) : null,
      }
    : null
  const { r: reply, pending } = useAnalysis(body)
  const res = body ? reply?.result ?? null : null
  const err = body ? reply?.error ?? null : null

  // ── Words ──
  const pct = (v: number) => fixed(v * 100, 2)
  const eqText = (r: RegressionFit) => `${r.yName} = ${g4(r.coefficients[0].coef)} ` + r.coefficients.slice(1).map(cf => `${cf.coef >= 0 ? '+' : '−'} ${g4(Math.abs(cf.coef))} ${cf.term}`).join(' ')
  const sigPreds = (r: RegressionFit) => r.coefficients.slice(1).filter(cf => cf.p < 0.05)
  const modelSig = (r: RegressionFit) => r.pRegression < 0.05
  const modelHead = (d: Dict, r: RegressionFit) => say(d, modelSig(r) ? 'rg_v_sig' : 'rg_v_not_sig')
  const modelSub = (d: Dict, r: RegressionFit, iso = false) => {
    const w = (v: string) => (iso ? ltr(v) : v)
    const v = { p: w(formatPEquals(r.pRegression)), r2: w(pct(r.r2)), x: w(r.xNames[0]), y: w(r.yName), list: sigPreds(r).map(cf => w(cf.term)).join(iso ? '، ' : ', ') }
    if (!multi) return fill(say(d, modelSig(r) ? 'rg_v_sub_sig_simple' : 'rg_v_sub_not_simple'), v)
    if (!modelSig(r)) return fill(say(d, 'rg_v_sub_not_multi'), v)
    return fill(say(d, sigPreds(r).length ? 'rg_v_sub_sig_multi' : 'rg_v_sub_sig_multi_none'), v)
  }
  const vifHigh = (r: RegressionFit) => r.coefficients.filter(cf => cf.vif !== null && cf.vif > 10)
  const vifMid = (r: RegressionFit) => r.coefficients.filter(cf => cf.vif !== null && cf.vif > 5 && cf.vif <= 10)
  const nonNormal = (r: RegressionFit) => !!r.normality && r.normality.p < 0.05
  const checkCount = (r: RegressionFit) => r.unusual.length + (nonNormal(r) ? 1 : 0) + vifHigh(r).length
  const checkHead = (d: Dict, r: RegressionFit) => { const n = checkCount(r); return n === 0 ? say(d, 'rg_v_check_ok') : n === 1 ? say(d, 'rg_v_check_warn_one') : fill(say(d, 'rg_v_check_warn'), { n }) }
  const checkLines = (d: Dict, r: RegressionFit, iso = false) => {
    const w = (v: string) => (iso ? ltr(v) : v)
    const out: { text: string; warn: boolean; info?: boolean }[] = []
    out.push(r.normality ? { text: fill(say(d, nonNormal(r) ? 'rg_chk_nonnormal' : 'rg_chk_normal'), { p: w(`AD ${formatPEquals(r.normality.p)}`) }), warn: nonNormal(r) } : { text: say(d, 'rg_chk_normal_na'), warn: false, info: true })
    out.push(r.unusual.length ? { text: fill(say(d, 'rg_chk_unusual'), { n: r.unusual.length, rows: w(r.unusual.slice(0, 8).join(', ') + (r.unusual.length > 8 ? ' …' : '')) }), warn: true } : { text: say(d, 'rg_chk_no_unusual'), warn: false })
    if (vifHigh(r).length) out.push({ text: fill(say(d, 'rg_chk_vif'), { list: vifHigh(r).map(cf => w(`${cf.term} ${fixed(cf.vif as number, 1)}`)).join(', ') }), warn: true })
    else if (vifMid(r).length) out.push({ text: fill(say(d, 'rg_chk_vif_mid'), { list: vifMid(r).map(cf => w(`${cf.term} ${fixed(cf.vif as number, 1)}`)).join(', ') }), warn: false })
    if (multi && r.n < 10 * r.k) out.push({ text: say(d, 'rg_chk_fewrows'), warn: false, info: true })
    return out
  }
  const errText = (() => {
    if (!err) return ''
    if (err === 'failed') return t('rg_failed')
    if (err.code === 'y-constant') return t('rg_err_y_constant')
    if (err.code === 'x-constant') return fill(t('rg_err_x_constant'), { x: err.name })
    if (err.code === 'collinear') return fill(t('rg_err_collinear'), { x: err.name })
    return t('rg_failed')
  })()
  const mColor = !res ? 'var(--qh-muted)' : modelSig(res) ? 'var(--qh-good)' : 'var(--qh-amber)'
  const kColor = !res ? 'var(--qh-muted)' : checkCount(res) ? 'var(--qh-amber)' : 'var(--qh-good)'

  // ── Charts ──
  const axisTitle = (text: string) => ({ display: true, text: `‎${text}‎`, color: c.muted, font: { size: 11 } })
  const baseScales = (xTitle: string, yTitle: string) => ({
    x: { type: 'linear' as const, grid: { color: c.grid }, border: { color: c.border }, ticks: { color: c.muted, font: { size: 10 } }, title: axisTitle(xTitle) },
    y: { grid: { color: c.grid }, border: { color: c.border }, ticks: { color: c.muted, font: { size: 10 } }, title: axisTitle(yTitle) },
  })
  const baseOptions = (xTitle: string, yTitle: string, wm: 'light' | 'normal' = 'light') => ({
    responsive: true, maintainAspectRatio: false, animation: false as const, devicePixelRatio: 2, parsing: false as const,
    layout: watermarkLayout(),
    plugins: { legend: { display: false }, watermark: watermarkOptions(wm), tooltip: { callbacks: { label: (item: { parsed: { x: number | null; y: number | null } }) => `${g4(item.parsed.x ?? 0)}, ${g4(item.parsed.y ?? 0)}` } } },
    scales: baseScales(xTitle, yTitle),
  })
  const zeroLine = (x0: number, x1: number) => ({ type: 'scatter' as const, data: [{ x: x0, y: 0 }, { x: x1, y: 0 }], showLine: true, borderColor: c.muted, borderWidth: 1, borderDash: [4, 4], pointRadius: 0 })
  const dot = { backgroundColor: c.data, borderColor: c.data, pointRadius: 3.5, pointHoverRadius: 5 }

  const mainData = res ? (res.band ? {
    datasets: [
      { type: 'scatter' as const, label: 'ciLo', data: res.band.map(b => ({ x: b.x, y: b.ciLo })), showLine: true, borderWidth: 0, pointRadius: 0, fill: false },
      { type: 'scatter' as const, label: 'ciHi', data: res.band.map(b => ({ x: b.x, y: b.ciHi })), showLine: true, borderWidth: 0, pointRadius: 0, backgroundColor: tint(BAND, 18), fill: '-1' },
      { type: 'scatter' as const, label: 'piLo', data: res.band.map(b => ({ x: b.x, y: b.piLo })), showLine: true, borderColor: BAND, borderWidth: 1.2, borderDash: [5, 4], pointRadius: 0 },
      { type: 'scatter' as const, label: 'piHi', data: res.band.map(b => ({ x: b.x, y: b.piHi })), showLine: true, borderColor: BAND, borderWidth: 1.2, borderDash: [5, 4], pointRadius: 0 },
      { type: 'scatter' as const, label: 'fit', data: res.band.map(b => ({ x: b.x, y: b.fit })), showLine: true, borderColor: c.text, borderWidth: 2, pointRadius: 0 },
      { type: 'scatter' as const, label: 'data', data: res.residuals.map(r => ({ x: r.x[0], y: r.y })), ...dot },
    ],
  } : {
    datasets: (() => {
      const all = res.residuals.flatMap(r => [r.y, r.fit])
      const lo = Math.min(...all), hi = Math.max(...all)
      return [
        { type: 'scatter' as const, label: 'diag', data: [{ x: lo, y: lo }, { x: hi, y: hi }], showLine: true, borderColor: c.muted, borderWidth: 1, borderDash: [4, 4], pointRadius: 0 },
        { type: 'scatter' as const, label: 'data', data: res.residuals.map(r => ({ x: r.fit, y: r.y })), ...dot },
      ]
    })(),
  }) : null
  const mainOptions = res ? {
    ...baseOptions(res.band ? res.xNames[0] : t('rg_ax_fit'), res.band ? res.yName : t('rg_ax_actual'), 'normal'),
    plugins: { ...baseOptions('', '').plugins, watermark: watermarkOptions('normal'), tooltip: { filter: (item: { dataset: { label?: string } }) => item.dataset.label === 'data', callbacks: { label: (item: { parsed: { x: number | null; y: number | null } }) => `${g4(item.parsed.x ?? 0)}, ${g4(item.parsed.y ?? 0)}` } } },
  } : null

  const normData = res ? (() => {
    const z = res.normalPlot
    const n = z.length
    const m = z.reduce((a, p) => a + p.resid, 0) / n
    const sd = Math.sqrt(z.reduce((a, p) => a + (p.resid - m) ** 2, 0) / Math.max(1, n - 1))
    const zMin = Math.min(...z.map(p => p.z)), zMax = Math.max(...z.map(p => p.z))
    return { datasets: [
      { type: 'scatter' as const, label: 'ref', data: [{ x: m + sd * zMin, y: zMin }, { x: m + sd * zMax, y: zMax }], showLine: true, borderColor: c.danger, borderWidth: 1.2, pointRadius: 0 },
      { type: 'scatter' as const, label: 'data', data: z.map(p => ({ x: p.resid, y: p.z })), ...dot },
    ] }
  })() : null
  const fitsData = res ? { datasets: [zeroLine(Math.min(...res.residuals.map(r => r.fit)), Math.max(...res.residuals.map(r => r.fit))), { type: 'scatter' as const, label: 'data', data: res.residuals.map(r => ({ x: r.fit, y: r.resid })), ...dot }] } : null
  const orderData = res ? { datasets: [zeroLine(1, res.n), { type: 'scatter' as const, label: 'data', data: res.residuals.map(r => ({ x: r.row, y: r.resid })), ...dot, showLine: true, borderColor: tint(c.data, 60), borderWidth: 1 }] } : null
  const hist = res ? (() => {
    const e = res.residuals.map(r => r.resid)
    const lo = Math.min(...e), hi = Math.max(...e)
    const bins = Math.max(4, Math.min(12, Math.round(Math.sqrt(e.length)) + 1))
    const w = (hi - lo || 1) / bins
    const counts = new Array(bins).fill(0)
    e.forEach(v => { counts[Math.min(bins - 1, Math.floor((v - lo) / w))]++ })
    return { labels: counts.map((_, i) => Number((lo + w * (i + 0.5)).toPrecision(3)).toString()), datasets: [{ data: counts, backgroundColor: tint(c.data, 75), borderColor: c.data, borderWidth: 1, barPercentage: 1, categoryPercentage: 0.96 }] }
  })() : null
  const histOptions = {
    responsive: true, maintainAspectRatio: false, animation: false as const, devicePixelRatio: 2, layout: watermarkLayout(),
    plugins: { legend: { display: false }, watermark: watermarkOptions('light') },
    scales: {
      x: { grid: { display: false }, border: { color: c.border }, ticks: { color: c.muted, font: { size: 9 }, maxRotation: 0 }, title: axisTitle(t('rg_ax_resid')) },
      y: { beginAtZero: true, grid: { color: c.grid }, border: { color: c.border }, ticks: { color: c.muted, font: { size: 10 }, precision: 0 }, title: axisTitle(t('rg_ax_freq')) },
    },
  }

  // ── Exports (English) ──
  type Sc = { x?: { title?: { text?: string } }; y?: { title?: { text?: string } } }
  const withEnglishAxes = async <T,>(fn: () => T | Promise<T>): Promise<T> => {
    if (!res) return fn()
    const jobs: { ch: ChartJSInstance; title: { text?: string }; keep?: string; text: string }[] = []
    const add = (ch: unknown, axis: 'x' | 'y', text: string) => {
      const chart = ch as ChartJSInstance | null
      const title = (chart?.options.scales as Sc | undefined)?.[axis]?.title
      if (chart && title) jobs.push({ ch: chart, title, keep: title.text, text: `‎${text}‎` })
    }
    if (!res.band) { add(mainRef.current, 'x', EN.rg_ax_fit); add(mainRef.current, 'y', EN.rg_ax_actual) }
    add(normRef.current, 'x', EN.rg_ax_resid); add(normRef.current, 'y', EN.rg_ax_normal)
    add(fitsRef.current, 'x', EN.rg_ax_fit); add(fitsRef.current, 'y', EN.rg_ax_resid)
    add(histRef.current, 'x', EN.rg_ax_resid); add(histRef.current, 'y', EN.rg_ax_freq)
    add(orderRef.current, 'x', EN.rg_ax_order); add(orderRef.current, 'y', EN.rg_ax_resid)
    jobs.forEach(j => { j.title.text = j.text; j.ch.update('none') })
    try {
      return await fn()
    } finally {
      jobs.forEach(j => { j.title.text = j.keep; j.ch.update('none') })
    }
  }
  const charts = () => [mainRef.current, normRef.current, fitsRef.current, histRef.current, orderRef.current]
  const summaryLine = (r: RegressionFit) => `S ${g4(r.s)} · R² ${pct(r.r2)}% · R²(adj) ${pct(r.r2Adj)}%${r.r2Pred !== null ? ` · R²(pred) ${pct(r.r2Pred)}%` : ''}`
  const predLine = (r: RegressionFit) => r.prediction
    ? `At ${r.xNames.map((x, j) => `${x} = ${g4(r.prediction!.x[j])}`).join(', ')}: fit ${g4(r.prediction.fit)} · 95% CI ${g4(r.prediction.ciLo)} to ${g4(r.prediction.ciHi)} · 95% PI ${g4(r.prediction.piLo)} to ${g4(r.prediction.piHi)}${r.prediction.beyondData ? ' · outside the range of the data (extrapolation)' : ''}`
    : ''
  const anovaCells = (r: RegressionFit) => r.anova.map(a => [a.source, String(a.df), g4(a.ss), a.ms !== null ? g4(a.ms) : '', a.f !== null ? fixed(a.f, 2) : '', a.p !== null ? formatPValue(a.p) : ''])

  const exportCSV = () => {
    if (!isLoggedIn) { goToLogin(tool, 'csv'); return }
    if (!res) return
    const lines = [
      `${multi ? 'Multiple' : 'Simple'} Linear Regression — ${res.yName}`,
      `Regression equation,${csvCell(eqText(res))}`,
      `Model summary,${csvCell(summaryLine(res))}`,
      `F,${res.fRegression},p,${res.pRegression}`,
      '',
      'Term,Coef,SE Coef,T,P,VIF',
      ...res.coefficients.map(cf => [csvCell(cf.term), cf.coef, cf.se, cf.t, cf.p, cf.vif ?? ''].join(',')),
      '',
      'Source,DF,Adj SS,Adj MS,F,P',
      ...res.anova.map(a => [csvCell(a.source), a.df, a.ss, a.ms ?? '', a.f ?? '', a.p ?? ''].join(',')),
      '',
      ['Row', ...res.xNames.map(csvCell), csvCell(res.yName), 'Fit', 'Resid', 'Std Resid', 'Leverage', 'Cook D', 'Flag'].join(','),
      ...res.residuals.map(r => [r.row, ...r.x, r.y, r.fit, r.resid, r.stdResid, r.leverage, r.cook, r.flags.join(' ')].join(',')),
      ...(res.prediction ? ['', `Prediction,${csvCell(predLine(res))}`] : []),
    ]
    const blob = new Blob(['﻿', lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${tool}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const runExcel = async () => {
    if (!isPro) { goToPricing(tool, 'excel'); return }
    if (!res) return
    const report = createReport({ toolName: multi ? 'Multiple Linear Regression' : 'Simple Linear Regression' })
    const sh = report.addSheet('Overview')
    sh.titleBand(multi ? 'Multiple Linear Regression' : 'Simple Linear Regression', `${res.yName} vs ${res.xNames.join(', ')} · ${res.n} rows`)
    sh.metaStrip([['Generated on', nowStamp()], ['Equation', eqText(res)]])
    sh.kpiRow([
      { label: 'Model', value: `p ${formatPValue(res.pRegression)}`, tone: modelSig(res) ? 'good' : 'warning' },
      { label: 'R²', value: `${pct(res.r2)}%`, tone: 'neutral' },
      { label: 'R² (adj)', value: `${pct(res.r2Adj)}%`, tone: 'neutral' },
      { label: 'S', value: g4(res.s), tone: 'neutral' },
    ])
    sh.note(`${modelHead(EN, res)}. ${modelSub(EN, res)}`, modelSig(res) ? 'good' : 'warning')
    checkLines(EN, res).forEach(l => sh.note(l.text, l.warn ? 'warning' : 'neutral'))
    if (res.prediction) sh.note(predLine(res), res.prediction.beyondData ? 'warning' : 'neutral')
    await sh.charts([{ ref: mainRef, title: res.band ? 'Fitted Line Plot' : 'Actual vs Fitted' }, { ref: normRef, title: 'Normal Probability Plot of Residuals' }, { ref: fitsRef, title: 'Residuals vs Fits' }, { ref: histRef, title: 'Histogram of Residuals' }, { ref: orderRef, title: 'Residuals vs Order' }], { widthCm: 16, heightCm: 8 })
    sh.sectionHeading('Coefficients')
    sh.table({
      headers: [
        { header: 'Term', key: 'term', align: 'left', width: 18 },
        { header: 'Coef', key: 'coef', align: 'right', numFmt: '0.000000', width: 14 },
        { header: 'SE Coef', key: 'se', align: 'right', numFmt: '0.000000', width: 14 },
        { header: 'T', key: 't', align: 'right', numFmt: '0.000' },
        { header: 'P', key: 'p', align: 'right', numFmt: '0.0000' },
        ...(multi ? [{ header: 'VIF', key: 'vif', align: 'right' as const, numFmt: '0.00' }] : []),
      ],
      rows: res.coefficients.map(cf => ({ term: cf.term, coef: cf.coef, se: cf.se, t: cf.t, p: cf.p, vif: cf.vif ?? '' })),
      rowTones: res.coefficients.map((cf, i) => (i > 0 && cf.p < 0.05 ? 'good' as const : undefined)),
    })
    sh.sectionHeading('Analysis of Variance')
    sh.table({
      headers: [
        { header: 'Source', key: 's', align: 'left', width: 18 },
        { header: 'DF', key: 'df', align: 'right', numFmt: '0' },
        { header: 'Adj SS', key: 'ss', align: 'right', numFmt: '0.0000', width: 16 },
        { header: 'Adj MS', key: 'ms', align: 'right', numFmt: '0.0000', width: 16 },
        { header: 'F', key: 'f', align: 'right', numFmt: '0.00' },
        { header: 'P', key: 'p', align: 'right', numFmt: '0.0000' },
      ],
      rows: res.anova.map(a => ({ s: a.source, df: a.df, ss: a.ss, ms: a.ms ?? '', f: a.f ?? '', p: a.p ?? '' })),
    })
    sh.note(`${summaryLine(res)} · Durbin-Watson ${fixed(res.durbinWatson, 3)}`, 'neutral')
    sh.note(SOURCE_LINE, 'neutral')
    sh.freezeHeader(2)
    const rs = report.addSheet('Residuals')
    rs.titleBand('Fits and Diagnostics', res.yName)
    rs.table({
      headers: [
        { header: 'Row', key: 'row', align: 'center' },
        ...res.xNames.map((x, j) => ({ header: x, key: `x${j}`, align: 'right' as const, width: 12 })),
        { header: res.yName, key: 'y', align: 'right' as const, width: 12 },
        { header: 'Fit', key: 'fit', align: 'right', numFmt: '0.0000', width: 12 },
        { header: 'Resid', key: 'e', align: 'right', numFmt: '0.0000', width: 12 },
        { header: 'Std Resid', key: 'sr', align: 'right', numFmt: '0.00' },
        { header: 'Leverage', key: 'h', align: 'right', numFmt: '0.0000' },
        { header: 'Cook D', key: 'cd', align: 'right', numFmt: '0.0000' },
        { header: 'Flag', key: 'fl', align: 'center' },
      ],
      rows: res.residuals.map(r => {
        const o: Record<string, string | number> = { row: r.row, y: r.y, fit: r.fit, e: r.resid, sr: r.stdResid, h: r.leverage, cd: r.cook, fl: r.flags.join(' ') }
        r.x.forEach((v, j) => { o[`x${j}`] = v })
        return o
      }),
      rowTones: res.residuals.map(r => (r.flags.length ? 'warning' as const : undefined)),
      zebra: true,
    })
    rs.freezeHeader(2)
    await report.download(`${tool}.xlsx`)
  }

  const runPDF = () => {
    if (!isPro) { goToPricing(tool, 'pdf'); return }
    if (!res) return
    const ctx = createPdfReport(multi ? 'Multiple Linear Regression' : 'Simple Linear Regression', tool)
    calloutBox(ctx, `${modelHead(EN, res)}. ${modelSub(EN, res)}`, modelSig(res) ? 'good' : 'warn')
    calloutBox(ctx, `Regression equation: ${eqText(res)}`, 'info')
    if (mainRef.current) addChartImage(ctx, mainRef.current, res.band ? 'Fitted Line Plot' : 'Actual vs Fitted', { width: 900, height: 300 }, res.band ? `Line: fit · shaded: 95% confidence interval · dashed: 95% prediction interval · ${summaryLine(res)}` : summaryLine(res))
    const w = ctx.pageWidth - ctx.margin * 2
    const cw = (w - 120) / (multi ? 5 : 4)
    dataTable(ctx, 'Coefficients', [
      { header: 'TERM', width: 120 }, { header: 'COEF', width: cw, align: 'right' }, { header: 'SE COEF', width: cw, align: 'right' },
      { header: 'T', width: cw, align: 'right' }, { header: 'P', width: cw, align: 'right' }, ...(multi ? [{ header: 'VIF', width: cw, align: 'right' as const }] : []),
    ], res.coefficients.map(cf => [cf.term, g4(cf.coef), g4(cf.se), fixed(cf.t, 2), formatPValue(cf.p), ...(multi ? [cf.vif !== null ? fixed(cf.vif, 2) : ''] : [])]),
    { cellColors: res.coefficients.map((cf, i) => (i > 0 && cf.p < 0.05 ? [REPORT_COLORS.good] : [])) })
    const aw = (w - 120) / 5
    dataTable(ctx, 'Analysis of Variance', [
      { header: 'SOURCE', width: 120 }, { header: 'DF', width: aw, align: 'right' }, { header: 'ADJ SS', width: aw, align: 'right' },
      { header: 'ADJ MS', width: aw, align: 'right' }, { header: 'F', width: aw, align: 'right' }, { header: 'P', width: aw, align: 'right' },
    ], anovaCells(res))
    checkLines(EN, res).forEach(l => calloutBox(ctx, l.text, l.warn ? 'warn' : 'info'))
    if (res.prediction) calloutBox(ctx, predLine(res), res.prediction.beyondData ? 'warn' : 'info')
    if (normRef.current && fitsRef.current) addChartImagePair(ctx, 'Residual Plots', { chart: normRef.current, title: 'Normal Probability Plot' }, { chart: fitsRef.current, title: 'Versus Fits' })
    if (histRef.current && orderRef.current) addChartImagePair(ctx, '', { chart: histRef.current, title: 'Histogram' }, { chart: orderRef.current, title: 'Versus Order' })
    const flagged = res.residuals.filter(r => r.flags.length)
    if (flagged.length) {
      const fw = (w - 60) / 5
      dataTable(ctx, `Unusual Observations (R: |Std Resid| > 2 · X: leverage > ${fixed(res.leverageLimit, 3)})`, [
        { header: 'ROW', width: 60 }, { header: res.yName.toUpperCase().slice(0, 18), width: fw, align: 'right' }, { header: 'FIT', width: fw, align: 'right' },
        { header: 'RESID', width: fw, align: 'right' }, { header: 'STD RESID', width: fw, align: 'right' }, { header: 'FLAG', width: fw, align: 'center' },
      ], flagged.map(r => [String(r.row), g4(r.y), g4(r.fit), g4(r.resid), fixed(r.stdResid, 2), r.flags.join(' ')]))
    }
    dataTable(ctx, 'Study', [{ header: 'ITEM', width: 130 }, { header: 'VALUE', width: w - 130 }], [
      ['Response', res.yName],
      [res.k > 1 ? 'Predictors' : 'Predictor', res.xNames.join(', ')],
      ['Rows', `${res.n}${skipped > 0 ? ` (${skipped} incomplete rows left out)` : ''}`],
      ['Model summary', summaryLine(res)],
      ['Durbin-Watson', `${fixed(res.durbinWatson, 3)} (meaningful only when rows are in time order)`],
      ['Source', SOURCE_LINE.replace('Source: ', '')],
    ])
    addSignOff(ctx)
    finalizeReport(ctx)
    ctx.pdf.save(`${tool}-report.pdf`)
  }

  const runPNG = () => {
    if (!isLoggedIn) { goToLogin(tool, 'png'); return }
    if (!mainRef.current) return
    const a = document.createElement('a')
    a.href = mainRef.current.toBase64Image('image/png', 1)
    a.download = res?.band ? 'fitted-line-plot.png' : 'actual-vs-fitted.png'
    a.click()
  }
  const exportExcel = () => (isPro ? withWatermarksDisabled(charts(), () => withEnglishAxes(runExcel)) : runExcel())
  const exportPDF = () => (isPro ? withWatermarksDisabled(charts(), () => withEnglishAxes(runPDF)) : runPDF())
  const exportPNG = () => (isLoggedIn ? withWatermarksDisabled([mainRef.current], () => withEnglishAxes(runPNG)) : runPNG())

  const helpSteps = [1, 2, 3, 4].map(n => ({ t: t(`rg_help_s${n}_t` as TKey), d: t(`rg_help_s${n}_d` as TKey) }))
  const D = translations[lang]
  const iso = lang === 'ar'
  const small = (title: string, el: React.ReactNode) => (
    <div className="rg-mini"><div className="rg-mini-t">{title}</div><div className="tl-chart-inner" style={{ height: 200 }}>{el}</div></div>
  )

  return (
    <div style={s.page}>
      <ToolStyles />
      <style>{`
        .rg-label { font-size: 12px; color: var(--qh-muted); margin-bottom: 6px; }
        .rg-sel { width: 100%; box-sizing: border-box; background: color-mix(in srgb, var(--qh-bg) 70%, var(--qh-surface)); border: 1px solid var(--qh-border); border-radius: 7px; color: var(--qh-text); padding: 8px 10px; font: inherit; font-size: 14px; outline: none; }
        .rg-sel:focus { border-color: var(--qh-accent); }
        .rg-chips { display: flex; flex-wrap: wrap; gap: 6px; }
        .rg-chip { border: 1px solid var(--qh-border); background: transparent; color: var(--qh-text); border-radius: 999px; padding: 6px 12px; font: inherit; font-size: 13px; cursor: pointer; }
        .rg-chip[aria-pressed="true"] { background: var(--qh-accent); color: var(--qh-onAccent); border-color: var(--qh-accent); }
        .rg-chip:disabled { opacity: .45; cursor: default; }
        .rg-pred { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 8px; }
        .rg-grid th input { font-weight: 600; text-align: center; min-width: 80px; color: var(--qh-text); }
        .rg-grid td input { text-align: center; min-width: 80px; }
        .rg-grid th.rg-y input { color: var(--qh-gold); }
        .rg-grid th.rg-x input { color: var(--qh-data); }
        .rg-colh { display: flex; align-items: center; justify-content: center; gap: 2px; }
        .rg-eq { font: 14px ui-monospace, Menlo, monospace; line-height: 1.8; direction: ltr; text-align: left; overflow-wrap: anywhere; }
        .rg-checks { margin: 6px 0 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 4px; font-size: 13px; line-height: 1.55; }
        .rg-checks li { display: flex; gap: 6px; color: var(--qh-muted); }
        .rg-checks li.warn { color: var(--qh-text); }
        .rg-checks li::before { content: '✓'; color: var(--qh-good); font-weight: 700; flex: none; }
        .rg-checks li.warn::before { content: '!'; color: var(--qh-amber); }
        .rg-checks li.info::before { content: '•'; color: var(--qh-muted); }
        .rg-four { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 14px; }
        .rg-mini-t { font-size: 12px; font-weight: 600; margin-bottom: 4px; }
        .rg-legend { display: flex; flex-wrap: wrap; gap: 6px 16px; margin-top: 10px; font-size: 12px; color: var(--qh-muted); }
        .rg-legend span { display: inline-flex; align-items: center; gap: 6px; }
        .rg-legend i { display: inline-block; width: 16px; height: 0; border-top: 2px solid; }
        .rg-legend i.dot { width: 8px; height: 8px; border: 0; border-radius: 50%; }
        .rg-legend i.box { height: 10px; border: 0; }
        .rg-pred-card b { font: 700 22px ui-monospace, 'SF Mono', Menlo, monospace; }
        .rg-flag { font: 700 12px ui-monospace, Menlo, monospace; color: var(--qh-amber); }
        @media (max-width: 700px) { .rg-four { grid-template-columns: minmax(0, 1fr); } }
      `}</style>
      <Nav theme={theme} setTheme={setTheme} breadcrumbKey={multi ? 'bc_multiregression' : 'bc_regression'} />

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
        <ToolSidebar current={multi ? '/multiregression' : '/regression'} />

        <div className="tl-main">
          <ToolHeader
            title={t(multi ? 'multiregression_title' : 'regression_title')}
            intro={t(multi ? 'rg_intro_multi' : 'rg_intro_simple')}
            route={multi ? { text: t('rg_route_simple'), href: '/regression', label: t('rg_route_simple_link') } : { text: t('rg_route_multi'), href: '/multiregression', label: t('rg_route_multi_link') }}
            onHelp={() => setHelpOpen(true)}
            onExample={loadExample}
          />
          <HelpPanel open={helpOpen} onClose={() => setHelpOpen(false)} title={t('rg_help_title')} steps={helpSteps} onExample={loadExample} showCapability={false} tip={t('rg_help_tip')} />
          <PhoneTabs tab={mobileTab} onTab={setMobileTab} dataCount={complete.length} />

          <div className="tl-top">
            {/* ── SETUP ───────────────────────────────────────────────── */}
            <section className="tl-panel tl-setup tl-card" data-active={mobileTab === 'setup'} aria-label={t('spc_tab_setup')}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{t('rg_setup_title')}</div>
              <label>
                <div className="rg-label">{t('rg_response')}</div>
                <select className="rg-sel" value={inp.names.includes(inp.y) ? inp.y : ''} onChange={e => chooseY(e.target.value)}>
                  {!inp.names.includes(inp.y) && <option value="">—</option>}
                  {inp.names.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              {multi ? (
                <div>
                  <div className="rg-label">{t('rg_predictors')}</div>
                  <div className="rg-chips">
                    {inp.names.filter(n => n !== inp.y).map(n => (
                      <button key={n} type="button" className="rg-chip" aria-pressed={xs.includes(n)} disabled={!xs.includes(n) && xs.length >= MAX_X} onClick={() => toggleX(n)}>{n}</button>
                    ))}
                  </div>
                  <div className="tl-hint">{t('rg_predictors_hint')}</div>
                </div>
              ) : (
                <label>
                  <div className="rg-label">{t('rg_predictor')}</div>
                  <select className="rg-sel" value={xs[0] ?? ''} onChange={e => toggleX(e.target.value)}>
                    {!xs.length && <option value="">—</option>}
                    {inp.names.filter(n => n !== inp.y).map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
              )}
              {xs.length > 0 && (
                <div>
                  <div className="tl-label">{t('rg_predict_title')}</div>
                  <div className="rg-pred">
                    {xs.map(x => (
                      <label key={x} className="tl-field"><span>{x}</span><input inputMode="decimal" value={inp.predict[x] ?? ''} placeholder="—" onChange={e => set({ predict: { ...inp.predict, [x]: e.target.value } })} /></label>
                    ))}
                  </div>
                  <div className="tl-hint">{t('rg_predict_hint')}</div>
                </div>
              )}
            </section>

            <div className="tl-col">
              {/* ── DATA ──────────────────────────────────────────────── */}
              <section className="tl-panel tl-card" data-active={mobileTab === 'data'} aria-label={t('spc_tab_data')}>
                <DataCardHead
                  countLabel={fill(t('rg_data_count'), { c: inp.names.length, n: inp.rows.length })}
                  onUpload={gridImport.openFilePicker}
                  onClear={clearAll}
                  extra={<gridImport.FileInput />}
                />
                {gridImport.fileError && <div className="tl-error" style={{ marginBottom: 10 }}>{gridImport.fileError}</div>}
                <SheetPicker sheetNames={gridImport.sheetNames} activeSheet={gridImport.activeSheet} onSelect={gridImport.selectSheet} accentColor={c.accent} textColor={c.text} mutedColor={c.muted} borderColor={c.border} />
                <div className="tl-sg-wrap">
                  <table className="tl-sg rg-grid">
                    <thead>
                      <tr>
                        <th>#</th>
                        {inp.names.map((n, j) => (
                          <th key={j} className={n === inp.y ? 'rg-y' : xs.includes(n) ? 'rg-x' : undefined}>
                            <div className="rg-colh">
                              <input value={n} placeholder={t('rg_col_ph')} maxLength={60} aria-label={`${t('rg_col_ph')} ${j + 1}`} onChange={e => rename(j, e.target.value)} />
                              {inp.names.length > 2 && <button type="button" className="tl-sg-x" aria-label={`${t('rg_remove_col')} ${n}`} onClick={() => removeCol(j)}>✕</button>}
                            </div>
                          </th>
                        ))}
                        <th aria-label={t('rg_remove_row')} style={{ width: 28 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {inp.rows.map((row, i) => (
                        <tr key={i}>
                          <td className="tl-sg-n">{i + 1}</td>
                          {inp.names.map((n, j) => <td key={j}><input inputMode="decimal" value={row[j] ?? ''} aria-label={`${n} ${i + 1}`} onChange={e => setCell(i, j, e.target.value)} /></td>)}
                          <td><button type="button" className="tl-sg-x" aria-label={`${t('rg_remove_row')} ${i + 1}`} onClick={() => removeRow(i)}>✕</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginTop: 10 }}>
                  <button type="button" className="tl-xbtn tl-add" onClick={addRow}>{t('rg_add_row')}</button>
                  <button type="button" className="tl-xbtn tl-add" onClick={addCol} disabled={inp.names.length >= MAX_COLS}>{t('rg_add_col')}</button>
                </div>
                <div className="tl-paste">{t('rg_paste')}</div>
              </section>

              {/* ── RESULTS ───────────────────────────────────────────── */}
              <section className="tl-panel tl-results" data-active={mobileTab === 'results'} aria-label={t('spc_tab_results')}>
                {errText && <div className="tl-error">{errText}</div>}
                {skipped > 0 && body && <div className="tl-chip-warn" style={{ alignSelf: 'flex-start' }}>{fill(t('rg_skipped'), { n: skipped })}</div>}
                {!res ? (
                  !errText && <div className="tl-card tl-empty">{pending ? t('icmsf_loading') : fill(t('rg_empty'), { n: need })}</div>
                ) : (
                  <>
                    <div className="tl-verdicts" aria-live="polite">
                      <div className="tl-verdict" style={{ background: tint(mColor, 8), border: `1px solid ${tint(mColor, 35)}` }}>
                        <span className="tl-verdict-icon" aria-hidden="true" style={{ background: tint(mColor, 16), color: mColor }}>{modelSig(res) ? '✓' : '!'}</span>
                        <div>
                          <div style={{ fontSize: 12, color: 'var(--qh-muted)', marginBottom: 2 }}>{t('rg_v_model')}</div>
                          <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 4, color: mColor }}>{modelHead(D, res)}</div>
                          <div style={{ fontSize: 13, color: 'var(--qh-muted)', lineHeight: 1.6 }}>{modelSub(D, res, iso)}</div>
                        </div>
                      </div>
                      <div className="tl-verdict" style={{ background: tint(kColor, 8), border: `1px solid ${tint(kColor, 35)}` }}>
                        <span className="tl-verdict-icon" aria-hidden="true" style={{ background: tint(kColor, 16), color: kColor }}>{checkCount(res) ? '!' : '✓'}</span>
                        <div>
                          <div style={{ fontSize: 12, color: 'var(--qh-muted)', marginBottom: 2 }}>{t('rg_v_check')}</div>
                          <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 2, color: kColor }}>{checkHead(D, res)}</div>
                          <ul className="rg-checks">{checkLines(D, res, iso).map((l, i) => <li key={i} className={l.warn ? 'warn' : l.info ? 'info' : undefined}>{l.text}</li>)}</ul>
                        </div>
                      </div>
                    </div>

                    <div className="tl-kpis tl-kpis-4">
                      <div className="tl-kpi"><span>S</span><b>{g4(res.s)}</b></div>
                      <div className="tl-kpi"><span>R²</span><b>{pct(res.r2)}%</b></div>
                      <div className="tl-kpi"><span>R² (adj)</span><b>{pct(res.r2Adj)}%</b></div>
                      <div className="tl-kpi"><span>R² (pred)</span><b>{res.r2Pred !== null ? `${pct(res.r2Pred)}%` : '—'}</b></div>
                    </div>

                    <div className="tl-card" style={{ padding: '14px 18px' }}>
                      <div style={{ fontSize: 12, color: 'var(--qh-muted)', marginBottom: 4 }}>{t('rg_eq_title')}</div>
                      <div className="rg-eq">{eqText(res)}</div>
                    </div>

                    {res.prediction && (
                      <div className="tl-card rg-pred-card" style={{ padding: '14px 18px', borderColor: res.prediction.beyondData ? tint('var(--qh-amber)', 45) : undefined }}>
                        <div style={{ fontSize: 12, color: 'var(--qh-muted)', marginBottom: 4 }}>{t('rg_pred_title')} · {ltr(res.xNames.map((x, j) => `${x} = ${g4(res.prediction!.x[j])}`).join(', '))}</div>
                        <b>{ltr(g4(res.prediction.fit))}</b>
                        <div style={{ fontSize: 13, lineHeight: 1.8, marginTop: 4 }}>
                          {t('rg_pred_ci')}: {ltr(`${g4(res.prediction.ciLo)} – ${g4(res.prediction.ciHi)}`)}<br />
                          {t('rg_pred_pi')}: {ltr(`${g4(res.prediction.piLo)} – ${g4(res.prediction.piHi)}`)}
                        </div>
                        {res.prediction.beyondData && <div className="tl-chip-warn" style={{ marginTop: 8, display: 'inline-block' }}>{t('rg_pred_beyond')}</div>}
                      </div>
                    )}

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
                        pngLabel={t('rg_x_png_fit')}
                        save={
                          <SaveAnalysisButton
                            theme={theme}
                            tool={tool}
                            defaultName={`${multi ? 'Multiple Regression' : 'Regression'} — ${res.yName} — ${new Date().toLocaleDateString('en-US')}`}
                            compact={compactSave}
                            getPayload={() => ({
                              input_data: { names: inp.names, rows: inp.rows, y: inp.y, xs, predict: inp.predict },
                              results: { equation: eqText(res), r2: res.r2, r2Adj: res.r2Adj, s: res.s, pRegression: res.pRegression, coefficients: res.coefficients },
                            })}
                          />
                        }
                      />
                    </div>

                    <div className="tl-chart">
                      <h3>{t(res.band ? 'rg_fit_title' : 'rg_avf_title')}</h3>
                      <div className="tl-chart-sub">{t(res.band ? 'rg_fit_sub' : 'rg_avf_sub')}</div>
                      <div className="tl-chart-inner" style={{ height: 330 }}>
                        {mainData && mainOptions && <Chart ref={mainRef} type="scatter" data={mainData} options={mainOptions} />}
                      </div>
                      {res.band && (
                        <div className="rg-legend">
                          <span><i className="dot" style={{ background: c.data }} />{t('rg_lg_data')}</span>
                          <span><i style={{ borderColor: c.text }} />{t('rg_lg_fit')}</span>
                          <span><i className="box" style={{ background: tint(BAND, 30) }} />{t('rg_lg_ci')}</span>
                          <span><i style={{ borderColor: BAND, borderTopStyle: 'dashed' }} />{t('rg_lg_pi')}</span>
                        </div>
                      )}
                    </div>

                    <div className="tl-chart">
                      <h3>{t('rg_resid_title')}</h3>
                      <div className="tl-chart-sub">{t('rg_resid_sub')}</div>
                      <div className="rg-four">
                        {small(t('rg_p_normal'), normData && <Chart ref={normRef} type="scatter" data={normData} options={baseOptions(t('rg_ax_resid'), t('rg_ax_normal'))} />)}
                        {small(t('rg_p_fits'), fitsData && <Chart ref={fitsRef} type="scatter" data={fitsData} options={baseOptions(t('rg_ax_fit'), t('rg_ax_resid'))} />)}
                        {small(t('rg_p_hist'), hist && <Chart ref={histRef} type="bar" data={hist} options={histOptions} />)}
                        {small(t('rg_p_order'), orderData && <Chart ref={orderRef} type="scatter" data={orderData} options={baseOptions(t('rg_ax_order'), t('rg_ax_resid'))} />)}
                      </div>
                    </div>

                    <details className="tl-more">
                      <summary>{t('rg_more')}</summary>
                      <div className="tl-more-body">
                        <div style={{ overflowX: 'auto' }}>
                          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{t('rg_coef_title')}</div>
                          <table className="tl-table">
                            <thead><tr><th>{t('rg_col_term')}</th><th className="num">Coef</th><th className="num">SE Coef</th><th className="num">T</th><th className="num">P</th>{multi && <th className="num">VIF</th>}</tr></thead>
                            <tbody>
                              {res.coefficients.map((cf, i) => (
                                <tr key={cf.term}>
                                  <td style={i > 0 && cf.p < 0.05 ? { color: 'var(--qh-good)', fontWeight: 700 } : undefined}>{i === 0 ? t('rg_constant') : cf.term}</td>
                                  <td className="num">{ltr(g4(cf.coef))}</td>
                                  <td className="num">{ltr(g4(cf.se))}</td>
                                  <td className="num">{ltr(fixed(cf.t, 2))}</td>
                                  <td className="num">{ltr(formatPValue(cf.p))}</td>
                                  {multi && <td className="num" style={cf.vif !== null && cf.vif > 10 ? { color: 'var(--qh-amber)', fontWeight: 700 } : undefined}>{cf.vif !== null ? ltr(fixed(cf.vif, 2)) : ''}</td>}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{t('rg_anova_title')}</div>
                          <table className="tl-table">
                            <thead><tr><th>{t('dx_col_source')}</th><th className="num">DF</th><th className="num">Adj SS</th><th className="num">Adj MS</th><th className="num">F</th><th className="num">P</th></tr></thead>
                            <tbody>
                              {res.anova.map(a => (
                                <tr key={a.source}>
                                  <td style={{ paddingInlineStart: a.source !== 'Regression' && a.source !== 'Error' && a.source !== 'Total' ? 22 : undefined }}>{a.source === 'Regression' ? t('rg_src_regression') : a.source === 'Error' ? t('rg_src_error') : a.source === 'Total' ? t('rg_src_total') : a.source}</td>
                                  <td className="num">{a.df}</td>
                                  <td className="num">{ltr(g4(a.ss))}</td>
                                  <td className="num">{a.ms !== null ? ltr(g4(a.ms)) : ''}</td>
                                  <td className="num">{a.f !== null ? ltr(fixed(a.f, 2)) : ''}</td>
                                  <td className="num">{a.p !== null ? ltr(formatPValue(a.p)) : ''}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <div className="tl-hint">{fill(t('rg_dw'), { dw: ltr(fixed(res.durbinWatson, 3)) })}</div>
                        </div>
                        {res.unusual.length > 0 && (
                          <div style={{ overflowX: 'auto' }}>
                            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{t('rg_unusual_title')}</div>
                            <table className="tl-table">
                              <thead><tr><th>{t('rg_col_row')}</th><th className="num">{res.yName}</th><th className="num">{t('rg_col_fit')}</th><th className="num">{t('rg_col_resid')}</th><th className="num">{t('rg_col_std')}</th><th></th></tr></thead>
                              <tbody>
                                {res.unusual.map(row => {
                                  const r = res.residuals[row - 1]
                                  return (
                                    <tr key={row}>
                                      <td>{row}</td>
                                      <td className="num">{ltr(g4(r.y))}</td>
                                      <td className="num">{ltr(g4(r.fit))}</td>
                                      <td className="num">{ltr(g4(r.resid))}</td>
                                      <td className="num">{ltr(fixed(r.stdResid, 2))}</td>
                                      <td className="rg-flag">{r.flags.join(' ')}</td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                            <div className="tl-hint">{t('rg_flag_r')} · {fill(t('rg_flag_x'), { lim: ltr(fixed(res.leverageLimit, 3)) })}</div>
                          </div>
                        )}
                      </div>
                    </details>

                    <details className="tl-more">
                      <summary>{t('rg_method_title')}</summary>
                      <div className="tl-more-body">
                        {(['rg_method_1', 'rg_method_2', 'rg_method_3', 'rg_method_4'] as TKey[]).map(key => <p key={key} style={{ margin: 0, fontSize: 13, lineHeight: 1.7 }}>{t(key)}</p>)}
                      </div>
                    </details>
                  </>
                )}
              </section>
            </div>
          </div>
          {guide}
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
