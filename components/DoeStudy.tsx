'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import 'chart.js/auto'
import { Chart } from 'react-chartjs-2'
import type { Chart as ChartJSInstance, Plugin } from 'chart.js'
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
import { fixed, formatPValue } from '@/lib/stats/format'
import { LETTERS, MAX_FACTORS, MAX_REPLICATES, MIN_FACTORS, buildDesignMatrix, randomizeRunOrder, type DesignRow } from '@/lib/doe/design'
import type { DoeResult, DoeError } from '@/lib/doe/calculator'

// ─────────────────────────────────────────────────────────────────────────
// DOE (2^k full factorial) on the shared tool layout. The design matrix is
// built here (published construction, lib/doe/design.ts); the analysis —
// effects, tests, Lenth's method, plot means, equation — comes from
// /api/doe. The page sends the inputs and draws the reply.
// ─────────────────────────────────────────────────────────────────────────

const EN = translations.en
type Dict = Readonly<Record<string, string>>
const say = (d: Dict, k: TKey) => d[k]
const fill = (str: string, vars: Record<string, string | number>) => Object.entries(vars).reduce((a, [k, v]) => a.split(`{${k}}`).join(String(v)), str)
const ltr = (v: string) => `⁦${v}⁩`
const csvCell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`

/** chart sizes in the PDF */
const PDF_WIDE = { width: 900, height: 250 }
const SOURCE_LINE = 'Source: Montgomery, Design and Analysis of Experiments, Ch. 6 — full model, pure error from replicates (exact t and F, α = 0.05); one replicate: Lenth (1989) PSE and ME = t(0.975, m/3) × PSE.'
// categorical, away from the verdict colours
const LINE_A = '#5B8FD9'
const LINE_B = '#D9659A'

interface Factor { name: string; low: string; high: string }
interface Inputs {
  response: string
  unit: string
  factors: Factor[]
  replicates: number
  randomized: boolean
  /** run order → `${std}-${rep}`; empty = standard order */
  order: string[]
  /** `${std}-${rep}` → typed value */
  values: Record<string, string>
}

// Montgomery, Example 6.1 (plasma etch): A gap, B C2F6 flow, C power, 2 replicates.
const EX_Y = [[550, 604], [669, 650], [633, 601], [642, 635], [1037, 1052], [749, 868], [1075, 1063], [729, 860]]
const EXAMPLE: Inputs = {
  response: 'Etch rate', unit: 'Å/min',
  factors: [{ name: 'Gap (cm)', low: '0.80', high: '1.20' }, { name: 'C2F6 flow (SCCM)', low: '125', high: '200' }, { name: 'Power (W)', low: '275', high: '325' }],
  replicates: 2, randomized: false, order: [],
  values: Object.fromEntries(EX_Y.flatMap((ys, p) => ys.map((v, r) => [`${p + 1}-${r + 1}`, String(v)]))),
}
const BLANK = (k: number): Factor[] => Array.from({ length: k }, (_, i) => ({ name: `Factor ${LETTERS[i]}`, low: '-1', high: '1' }))

const num = (s: string | undefined): number | null => {
  const v = (s ?? '').trim()
  if (v === '') return null
  const n = Number(v)
  return Number.isFinite(n) && Math.abs(n) <= 1e9 ? n : null
}
const g4 = (v: number) => (Math.abs(v) >= 1000 ? fixed(v, 1) : Math.abs(v) >= 10 ? fixed(v, 3) : fixed(v, 4))

type Reply = { result: DoeResult | null; error: DoeError | 'failed' | null }

function useAnalysis(body: object | null) {
  const key = body ? JSON.stringify(body) : null
  const [reply, setReply] = useState<{ key: string; r: Reply } | null>(null)
  useEffect(() => {
    if (!key) return
    const ctrl = new AbortController()
    const timer = setTimeout(() => {
      fetch('/api/doe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: key, signal: ctrl.signal })
        .then(async res => {
          const j = (await res.json().catch(() => ({}))) as { result?: DoeResult; error?: DoeError }
          setReply({ key, r: res.ok && j.result ? { result: j.result, error: null } : { result: null, error: res.status === 422 && j.error ? j.error : 'failed' } })
        })
        .catch(() => { if (!ctrl.signal.aborted) setReply({ key, r: { result: null, error: 'failed' } }) })
    }, 200)
    return () => { clearTimeout(timer); ctrl.abort() }
  }, [key])
  if (!key) return { r: null, pending: false }
  const current = reply?.key === key ? reply : null
  return { r: current ? current.r : reply?.r ?? null, pending: current === null }
}

/** guide: the server-rendered “About” section (components/tool/ToolGuide.tsx) */
export default function DoeStudy({ guide }: { guide?: React.ReactNode } = {}) {
  const { isPro, isLoggedIn } = useSubscription()
  const [theme, setTheme] = usePersistedTheme()
  const { t, lang } = useLanguage()
  const c = COLORS[theme]
  const s = getSharedStyles(theme)
  const compactSave = useCompactSave()
  const paretoRef = useRef<ChartJSInstance<'bar'>>(null)
  const mainRef = useRef<ChartJSInstance<'scatter'>>(null)
  const interRef = useRef<ChartJSInstance<'scatter'>>(null)

  const [inp, setInp] = useState<Inputs>(EXAMPLE)
  const [pair, setPair] = useState<string | null>(null)
  const [mobileTab, setMobileTab] = useState<MobileTab>('data')
  const [helpOpen, setHelpOpen] = useState(false)
  const [loadedProjectName, setLoadedProjectName] = useState('')
  const [loadError, setLoadError] = useState('')
  const set = (p: Partial<Inputs>) => setInp(prev => ({ ...prev, ...p }))
  const k = inp.factors.length

  // ── Load a saved project (?id=…): old saves have factors, replicates, responseMap ──
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id')
    if (!id) return
    fetch(`/api/saved-analyses/${id}`)
      .then(res => (res.ok ? res.json() : Promise.reject()))
      .then(({ analysis }) => {
        const d = analysis.input_data as Record<string, unknown>
        const fs = Array.isArray(d.factors) ? (d.factors as { name?: unknown; low?: unknown; high?: unknown }[]) : []
        if (fs.length < MIN_FACTORS || fs.length > MAX_FACTORS) throw new Error()
        const reps = Math.min(MAX_REPLICATES, Math.max(1, Math.round(Number(d.replicates) || 1)))
        const map = (d.responseMap ?? d.values ?? {}) as Record<string, unknown>
        setInp({
          response: typeof d.response === 'string' ? d.response : 'Response',
          unit: typeof d.unit === 'string' ? d.unit : '',
          factors: fs.map((f, i) => ({ name: String(f.name ?? LETTERS[i]), low: String(f.low ?? ''), high: String(f.high ?? '') })),
          replicates: reps, randomized: Array.isArray(d.order) && d.order.length > 0,
          order: Array.isArray(d.order) ? (d.order as unknown[]).map(String) : [],
          values: Object.fromEntries(Object.entries(map).map(([key, v]) => [key, v === null || v === undefined ? '' : String(v)])),
        })
        setLoadedProjectName(analysis.name as string)
      })
      .catch(() => setLoadError(lang === 'ar' ? 'تعذر تحميل المشروع المحفوظ.' : 'Could not load the saved project.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Run sheet ──
  const rows: DesignRow[] = useMemo(() => {
    const std = buildDesignMatrix(k, inp.replicates)
    if (!inp.order.length) return std
    const byKey = new Map(std.map(r => [`${r.standardOrder}-${r.replicate}`, r]))
    const ordered = inp.order.map(key => byKey.get(key)).filter((r): r is DesignRow => !!r)
    return ordered.length === std.length ? ordered.map((r, i) => ({ ...r, runOrder: i + 1 })) : std
  }, [k, inp.replicates, inp.order])
  const keyOf = (r: DesignRow) => `${r.standardOrder}-${r.replicate}`

  const setFactor = (i: number, p: Partial<Factor>) => setInp(prev => ({ ...prev, factors: prev.factors.map((f, j) => (j === i ? { ...f, ...p } : f)) }))
  const setCount = (n: number) => setInp(prev => (n === prev.factors.length ? prev : {
    ...prev, factors: [...prev.factors, ...BLANK(MAX_FACTORS)].slice(0, n).map((f, i) => (i < prev.factors.length ? f : BLANK(n)[i])), order: [], randomized: false, values: {},
  }))
  const setReps = (n: number) => setInp(prev => ({ ...prev, replicates: n, order: [], randomized: false }))
  const shuffle = () => setInp(prev => ({ ...prev, randomized: true, order: randomizeRunOrder(buildDesignMatrix(prev.factors.length, prev.replicates)).map(keyOf) }))
  const unshuffle = () => set({ randomized: false, order: [] })
  const setValue = (key: string, v: string) => setInp(prev => ({ ...prev, values: { ...prev.values, [key]: v } }))
  const clearAll = () => set({ values: {} })
  const loadExample = () => { setInp(EXAMPLE); setPair(null); setMobileTab('results') }

  // ── Paste a column of results (run order) ──
  const gridImport = useGridImport({
    minCellsPerRow: 1,
    onGrid: grid => {
      const col = grid.map(r => r[r.length - 1]).filter(v => num(v) !== null)
      if (!col.length) return
      setInp(prev => {
        const vals = { ...prev.values }
        rows.forEach((r, i) => { if (col[i] !== undefined) vals[keyOf(r)] = col[i].trim() })
        return { ...prev, values: vals }
      })
    },
    onError: () => undefined,
  })

  // ── Request ──
  const factorsNum = inp.factors.map((f, i) => ({ name: f.name.trim() || `Factor ${LETTERS[i]}`, low: num(f.low), high: num(f.high) }))
  const levelsBad = factorsNum.some(f => f.low === null || f.high === null || f.low === f.high)
  const filled = rows.filter(r => num(inp.values[keyOf(r)]) !== null).length
  const complete = filled === rows.length
  const body = !levelsBad && complete
    ? {
        factors: factorsNum.map(f => ({ name: f.name.slice(0, 40), low: f.low as number, high: f.high as number })),
        responses: Array.from({ length: 2 ** k }, (_, p) => Array.from({ length: inp.replicates }, (_, r) => num(inp.values[`${p + 1}-${r + 1}`]) as number)),
      }
    : null
  const { r: reply, pending } = useAnalysis(body)
  const res = body ? reply?.result ?? null : null
  const err = body ? reply?.error ?? null : null

  // ── Words ──
  const yName = inp.response.trim() || 'Response'
  const yLabel = `${yName}${inp.unit.trim() ? ` (${inp.unit.trim()})` : ''}`
  const fName = (i: number) => factorsNum[i]?.name ?? LETTERS[i]
  const termName = (term: string) => term.length === 1 ? `${term} · ${fName(LETTERS.indexOf(term as typeof LETTERS[number]))}` : term.split('').join('×')
  const listText = (r: DoeResult, iso = false) => r.significant.map(x => { const v = x.length === 1 ? `${x} = ${fName(LETTERS.indexOf(x as typeof LETTERS[number]))}` : x.split('').join('×'); return iso ? ltr(v) : v }).join(iso ? '، ' : ', ')
  const sigHead = (d: Dict, r: DoeResult) => (r.significant.length === 0 ? say(d, 'dx_v_none') : r.significant.length === 1 ? say(d, 'dx_v_count_one') : fill(say(d, 'dx_v_count'), { n: r.significant.length }))
  /** iso: isolate the inserted names and numbers for Arabic on screen (never in exports) */
  const sigSub = (d: Dict, r: DoeResult, iso = false) => {
    if (r.method === 'anova') return r.significant.length ? fill(say(d, 'dx_v_sub_anova'), { r: r.replicates, df: r.error!.df, list: listText(r, iso) }) : fill(say(d, 'dx_v_sub_anova_none'), { df: r.error!.df })
    const me = iso ? ltr(g4(r.lenth!.me)) : g4(r.lenth!.me)
    return r.significant.length ? fill(say(d, 'dx_v_sub_lenth'), { me, list: listText(r, iso) }) : fill(say(d, 'dx_v_sub_lenth_none'), { me })
  }
  const biggest = res ? [...res.terms].sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect))[0] : null
  const bigHead = (r: DoeResult) => {
    const b = [...r.terms].sort((a, b2) => Math.abs(b2.effect) - Math.abs(a.effect))[0]
    return `${b.term.length === 1 ? fName(b.idx[0]) : b.term.split('').join('×')}  ${b.effect >= 0 ? '+' : '−'}${g4(Math.abs(b.effect))}`
  }
  const bigSub = (d: Dict, r: DoeResult, iso = false) => {
    const w = (v: string) => (iso ? ltr(v) : v)
    const b = [...r.terms].sort((a, b2) => Math.abs(b2.effect) - Math.abs(a.effect))[0]
    if (b.order >= 2) return fill(say(d, 'dx_v_big_inter'), { f1: w(fName(b.idx[0])), f2: w(fName(b.idx[1])) })
    const i = b.idx[0]
    const main = fill(say(d, 'dx_v_big_main'), { f: w(fName(i)), lo: w(inp.factors[i].low.trim()), hi: w(inp.factors[i].high.trim()), y: w(yName), e: w(`${b.effect >= 0 ? '+' : '−'}${g4(Math.abs(b.effect))}`) })
    const inter = r.terms.find(x => x.order >= 2 && x.significant && x.idx.includes(i))
    return inter ? `${main} ${fill(say(d, 'dx_v_big_inter_note'), { t: w(inter.term.split('').join('×')) })}` : main
  }
  const sigColor = !res ? 'var(--qh-muted)' : res.significant.length ? 'var(--qh-good)' : 'var(--qh-amber)'
  const bigColor = 'var(--qh-data)'

  // ── Charts ──
  const pareto = res ? [...res.terms].sort((a, b) => b.paretoValue - a.paretoValue) : []
  const paretoAxis = (d: Dict) => say(d, res?.method === 'anova' ? 'dx_axis_std_effect' : 'dx_axis_effect')
  const refLine: Plugin<'bar'> = {
    id: 'dxRefLine',
    afterDatasetsDraw(chart) {
      if (!res) return
      const x = chart.scales.x.getPixelForValue(res.paretoLine)
      const { top, bottom } = chart.chartArea
      const ctx = chart.ctx
      ctx.save()
      ctx.strokeStyle = c.danger
      ctx.lineWidth = 1.5
      ctx.setLineDash([5, 4])
      ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = c.danger
      ctx.font = '600 11px system-ui, sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(g4(res.paretoLine), x + 4, top + 10)
      ctx.restore()
    },
  }
  const paretoData = res ? {
    labels: pareto.map(x => x.term),
    datasets: [{
      data: pareto.map(x => x.paretoValue),
      backgroundColor: pareto.map(x => (x.significant ? c.data : tint(c.muted, 45))),
      borderRadius: 3, barThickness: 16,
    }],
  } : null
  const paretoOptions = {
    indexAxis: 'y' as const, responsive: true, maintainAspectRatio: false, animation: false as const, devicePixelRatio: 2,
    layout: watermarkLayout(),
    plugins: {
      legend: { display: false }, watermark: watermarkOptions('light'),
      tooltip: { callbacks: { title: (items: { label: string }[]) => termName(items[0]?.label ?? ''), label: (item: { parsed: { x: number | null } }) => ` ${g4(item.parsed.x ?? 0)}` } },
    },
    scales: {
      x: { beginAtZero: true, suggestedMax: res ? res.paretoLine * 1.1 : undefined, grid: { color: c.grid }, border: { color: c.border }, ticks: { color: c.muted, font: { size: 10 } }, title: { display: true, text: paretoAxis(translations[lang]), color: c.muted, font: { size: 11 } } },
      y: { grid: { display: false }, border: { color: c.border }, ticks: { color: c.text, font: { size: 12, family: 'ui-monospace, Menlo, monospace' } } },
    },
  }
  const paretoH = Math.max(200, pareto.length * 24 + 60)

  // main effects: one panel per factor on a shared axis (x = 3i low, 3i + 1 high)
  const yRange = (vals: number[]) => {
    const lo = Math.min(...vals), hi = Math.max(...vals)
    const pad = (hi - lo) * 0.12 || Math.abs(hi) * 0.05 || 1
    return { min: lo - pad, max: hi + pad }
  }
  const mainY = res ? yRange([...res.mainEffects.flatMap(m => [m.low, m.high]), ...res.interactions.flatMap(i => i.means.flat())]) : { min: 0, max: 1 }
  const panelNames: Plugin<'scatter'> = {
    id: 'dxPanels',
    afterDraw(chart) {
      if (!res) return
      const ctx = chart.ctx
      ctx.save()
      ctx.fillStyle = c.text
      ctx.font = '600 11px system-ui, sans-serif'
      ctx.textAlign = 'center'
      res.mainEffects.forEach(m => {
        const x = chart.scales.x.getPixelForValue(m.idx * 3 + 0.5)
        ctx.fillText(LETTERS[m.idx], x, chart.chartArea.top - 6)
      })
      ctx.strokeStyle = c.border
      for (let i = 1; i < res.k; i++) {
        const x = chart.scales.x.getPixelForValue(i * 3 - 1)
        ctx.beginPath(); ctx.moveTo(x, chart.chartArea.top); ctx.lineTo(x, chart.chartArea.bottom); ctx.stroke()
      }
      ctx.restore()
    },
  }
  const mainData = res ? {
    datasets: [
      ...res.mainEffects.map(m => ({
        type: 'scatter' as const, label: fName(m.idx), data: [{ x: m.idx * 3, y: m.low }, { x: m.idx * 3 + 1, y: m.high }], showLine: true,
        borderColor: c.data, backgroundColor: c.data, borderWidth: 2, pointRadius: 4,
      })),
      { type: 'scatter' as const, label: 'mean', data: [{ x: -0.5, y: res.grandMean }, { x: res.k * 3 - 1.5, y: res.grandMean }], showLine: true, borderColor: c.muted, borderWidth: 1, borderDash: [4, 4], pointRadius: 0 },
    ],
  } : null
  const levelText = (v: number) => {
    const i = Math.floor((v + 0.5) / 3)
    const f = inp.factors[i]
    if (!f) return ''
    return Math.abs(v - i * 3) < 1e-9 ? f.low.trim() : Math.abs(v - (i * 3 + 1)) < 1e-9 ? f.high.trim() : ''
  }
  const mainOptions = {
    responsive: true, maintainAspectRatio: false, animation: false as const, devicePixelRatio: 2,
    layout: { padding: { top: 18, ...watermarkLayout().padding } },
    plugins: {
      legend: { display: false }, watermark: watermarkOptions('light'),
      tooltip: { filter: (item: { datasetIndex: number }) => !!res && item.datasetIndex < res.k, callbacks: { label: (item: { dataset: { label?: string }; parsed: { x: number | null; y: number | null } }) => `${item.dataset.label} = ${levelText(item.parsed.x ?? 0)}: ${g4(item.parsed.y ?? 0)}` } },
    },
    scales: {
      x: {
        type: 'linear' as const, min: -0.5, max: (res?.k ?? 2) * 3 - 1.5, grid: { display: false }, border: { color: c.border },
        afterBuildTicks: (axis: { ticks: { value: number }[] }) => { axis.ticks = Array.from({ length: (res?.k ?? 0) * 2 }, (_, j) => ({ value: Math.floor(j / 2) * 3 + (j % 2) })) },
        ticks: { color: c.muted, font: { size: 10 }, autoSkip: false, maxRotation: 0, callback: (v: string | number) => levelText(Number(v)) },
      },
      y: { ...mainY, grid: { color: c.grid }, border: { color: c.border }, ticks: { color: c.muted, font: { size: 10 }, includeBounds: false }, title: { display: true, text: fill(t('dx_axis_mean'), { y: yName }), color: c.muted, font: { size: 11 } } },
    },
  }

  // interaction plot for the chosen pair (default: largest interaction effect)
  const pairs = res?.interactions ?? []
  const defaultPair = res ? (() => {
    const two = res.terms.filter(x => x.order === 2).sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect))[0]
    return two ? `${two.idx[0]}-${two.idx[1]}` : '0-1'
  })() : '0-1'
  const pairKey = pair && pairs.some(p => `${p.a}-${p.b}` === pair) ? pair : defaultPair
  const inter = pairs.find(p => `${p.a}-${p.b}` === pairKey) ?? null
  const interData = inter ? {
    datasets: [0, 1].map(j => ({
      type: 'scatter' as const, label: `${fName(inter.b)} = ${j ? inp.factors[inter.b].high.trim() : inp.factors[inter.b].low.trim()}`,
      data: [{ x: 0, y: inter.means[0][j] }, { x: 1, y: inter.means[1][j] }], showLine: true,
      borderColor: j ? LINE_B : LINE_A, backgroundColor: j ? LINE_B : LINE_A, borderWidth: 2, pointRadius: 4, borderDash: j ? [6, 4] : [],
    })),
  } : null
  const interOptions = inter ? {
    responsive: true, maintainAspectRatio: false, animation: false as const, devicePixelRatio: 2,
    layout: watermarkLayout(),
    plugins: {
      legend: { display: true, position: 'top' as const, labels: { color: c.text, usePointStyle: true, boxWidth: 8, font: { size: 11 } } },
      watermark: watermarkOptions('light'),
      tooltip: { callbacks: { label: (item: { dataset: { label?: string }; parsed: { y: number | null } }) => `${item.dataset.label}: ${g4(item.parsed.y ?? 0)}` } },
    },
    scales: {
      x: {
        type: 'linear' as const, min: -0.25, max: 1.25, grid: { display: false }, border: { color: c.border },
        afterBuildTicks: (axis: { ticks: { value: number }[] }) => { axis.ticks = [{ value: 0 }, { value: 1 }] },
        ticks: { color: c.muted, font: { size: 11 }, callback: (v: string | number) => (Number(v) === 0 ? inp.factors[inter.a].low.trim() : Number(v) === 1 ? inp.factors[inter.a].high.trim() : '') },
        title: { display: true, text: `‎${fName(inter.a)}‎`, color: c.muted, font: { size: 11 } },
      },
      y: { ...mainY, grid: { color: c.grid }, border: { color: c.border }, ticks: { color: c.muted, font: { size: 10 }, includeBounds: false }, title: { display: true, text: fill(t('dx_axis_mean'), { y: yName }), color: c.muted, font: { size: 11 } } },
    },
  } : null

  // ── Exports (English) ──
  /** the charts' axis titles switch to English for the snapshot */
  const withEnglishAxes = async <T,>(fn: () => T | Promise<T>): Promise<T> => {
    type Sc = { x?: { title?: { text?: string } }; y?: { title?: { text?: string } } }
    const jobs: { ch: ChartJSInstance; title: { text?: string }; text: string; keep?: string }[] = []
    const add = (ch: ChartJSInstance | null, axis: 'x' | 'y', text: string) => {
      const title = (ch?.options.scales as Sc | undefined)?.[axis]?.title
      if (ch && title) jobs.push({ ch, title, text, keep: title.text })
    }
    add(paretoRef.current as unknown as ChartJSInstance, 'x', paretoAxis(EN))
    add(mainRef.current as unknown as ChartJSInstance, 'y', fill(EN.dx_axis_mean, { y: yName }))
    add(interRef.current as unknown as ChartJSInstance, 'y', fill(EN.dx_axis_mean, { y: yName }))
    jobs.forEach(j => { j.title.text = j.text; j.ch.update('none') })
    try {
      return await fn()
    } finally {
      jobs.forEach(j => { j.title.text = j.keep; j.ch.update('none') })
    }
  }
  const charts = () => [paretoRef.current, mainRef.current, interRef.current]
  const factorRows = (r: DoeResult) => r.factors.map((f, i) => [LETTERS[i], f.name, String(inp.factors[i].low.trim()), String(inp.factors[i].high.trim())])
  const studyLine = (r: DoeResult) => `Full factorial 2^${r.k} · ${r.replicates} replicate${r.replicates > 1 ? 's' : ''} · ${r.totalRuns} runs${inp.randomized ? ' · randomized run order' : ''}`
  const eqText = (r: DoeResult) => {
    const name = (idx: number[]) => idx.map(i => r.factors[i].name).join(' × ')
    const [c0, ...rest] = r.uncoded
    return `${yName} = ${g4(c0.coef)} ` + rest.map(u => `${u.coef >= 0 ? '+' : '−'} ${g4(Math.abs(u.coef))} ${name(u.idx)}`).join(' ')
  }
  const pCell = (p: number | null) => (p === null ? '—' : formatPValue(p))
  const anovaRows = (r: DoeResult): (string | number)[][] => [
    ['Model', r.model.df, r.model.ss, r.model.ms, r.model.fValue ?? '—', r.model.pValue ?? '—'],
    ...r.terms.map(x => [x.term, 1, x.ss, x.ss, x.fValue ?? '—', x.pValue ?? '—']),
    ...(r.error ? [['Error', r.error.df, r.error.ss, r.error.ms, '—', '—']] : []),
    ['Total', r.total.df, r.total.ss, '—', '—', '—'],
  ]

  const exportCSV = () => {
    if (!isLoggedIn) { goToLogin('doe', 'csv'); return }
    if (!res) return
    const lines = [
      `DOE — ${yLabel}`,
      `Design,${csvCell(studyLine(res))}`,
      `Method,${res.method === 'anova' ? 'ANOVA with pure error, alpha 0.05' : `Lenth PSE ${g4(res.lenth!.pse)}, ME ${g4(res.lenth!.me)}`}`,
      '',
      ['Run order', 'Std order', 'Replicate', ...res.factors.map(f => csvCell(f.name)), csvCell(yLabel)].join(','),
      ...rows.map(r => [r.runOrder, r.standardOrder, r.replicate, ...r.coded.map((v, i) => (v < 0 ? inp.factors[i].low.trim() : inp.factors[i].high.trim())), inp.values[keyOf(r)] ?? ''].join(',')),
      '',
      'Term,Effect,Coef,SE Coef,T,P,Contribution %,Significant',
      `Constant,,${res.grandMean},${res.terms[0].seCoef ?? ''},,,,`,
      ...res.terms.map(x => [x.term, x.effect, x.coef, x.seCoef ?? '', x.tValue ?? '', x.pValue ?? '', fixed(x.contribution, 2), x.significant ? 'yes' : 'no'].join(',')),
      '',
      `R2,${res.r2}`, `R2 adj,${res.r2Adj ?? ''}`, `R2 pred,${res.r2Pred ?? ''}`, `S,${res.s ?? ''}`,
      `Uncoded equation,${csvCell(eqText(res))}`,
    ]
    const blob = new Blob(['﻿', lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'doe-full-factorial.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const runExcel = async () => {
    if (!isPro) { goToPricing('doe', 'excel'); return }
    if (!res) return
    const report = createReport({ toolName: 'Design of Experiments' })
    const sh = report.addSheet('Overview')
    sh.titleBand('Design of Experiments — Full Factorial', `${yLabel} · ${studyLine(res)}`)
    sh.metaStrip([
      ['Generated on', nowStamp()],
      ['Method', res.method === 'anova' ? `Pure error (${res.error!.df} DF), α = 0.05` : `Lenth: PSE ${g4(res.lenth!.pse)}, ME ${g4(res.lenth!.me)}`],
    ])
    sh.kpiRow([
      { label: res.method === 'anova' ? 'Significant terms' : 'Active effects', value: res.significant.length ? res.significant.join(', ') : 'None', tone: res.significant.length ? 'good' : 'warning' },
      { label: 'R²', value: `${fixed(res.r2 * 100, 2)}%`, tone: 'neutral' },
      ...(res.r2Adj !== null ? [{ label: 'R² (adj)', value: `${fixed(res.r2Adj * 100, 2)}%`, tone: 'neutral' as const }] : []),
      ...(res.s !== null ? [{ label: 'S', value: g4(res.s), tone: 'neutral' as const }] : []),
    ])
    sh.note(sigSub(EN, res), res.significant.length ? 'good' : 'warning')
    sh.note(`Largest effect: ${bigHead(res)}. ${bigSub(EN, res)}`, 'neutral')
    await sh.charts([{ ref: paretoRef, title: 'Pareto of Effects' }, { ref: mainRef, title: 'Main Effects' }, { ref: interRef, title: 'Interaction Plot' }], { widthCm: 17, heightCm: 8 })
    sh.sectionHeading('Factors')
    sh.table({
      headers: [{ header: 'Letter', key: 'l', align: 'center' }, { header: 'Factor', key: 'f', align: 'left', width: 24 }, { header: 'Low (−1)', key: 'lo', align: 'right' }, { header: 'High (+1)', key: 'hi', align: 'right' }],
      rows: factorRows(res).map(([l, f, lo, hi]) => ({ l, f, lo: num(lo) ?? lo, hi: num(hi) ?? hi })),
    })
    sh.sectionHeading('Coded Coefficients')
    sh.table({
      headers: [
        { header: 'Term', key: 'term', align: 'left', width: 12 },
        { header: 'Effect', key: 'e', align: 'right', numFmt: '0.0000' },
        { header: 'Coef', key: 'c', align: 'right', numFmt: '0.0000' },
        { header: 'SE Coef', key: 'se', align: 'right', numFmt: '0.0000' },
        { header: 'T', key: 't', align: 'right', numFmt: '0.000' },
        { header: 'P', key: 'p', align: 'right', numFmt: '0.0000' },
        { header: 'Contribution %', key: 'pc', align: 'right', numFmt: '0.00', width: 14 },
      ],
      rows: [
        { term: 'Constant', e: '', c: res.grandMean, se: res.terms[0].seCoef ?? '', t: '', p: '', pc: '' },
        ...res.terms.map(x => ({ term: x.term, e: x.effect, c: x.coef, se: x.seCoef ?? '—', t: x.tValue ?? '—', p: x.pValue ?? '—', pc: x.contribution })),
      ],
      rowTones: [undefined, ...res.terms.map(x => (x.significant ? 'good' as const : undefined))],
    })
    sh.sectionHeading('Analysis of Variance')
    sh.table({
      headers: [
        { header: 'Source', key: 'src', align: 'left', width: 12 },
        { header: 'DF', key: 'df', align: 'right', numFmt: '0' },
        { header: 'SS', key: 'ss', align: 'right', numFmt: '0.0000', width: 14 },
        { header: 'MS', key: 'ms', align: 'right', numFmt: '0.0000', width: 14 },
        { header: 'F', key: 'f', align: 'right', numFmt: '0.000' },
        { header: 'P', key: 'p', align: 'right', numFmt: '0.0000' },
      ],
      rows: anovaRows(res).map(([src, df, ss, ms, f, p]) => ({ src, df, ss, ms, f, p })),
    })
    sh.note(`Regression equation in uncoded units: ${eqText(res)}`, 'neutral')
    sh.note(SOURCE_LINE, 'neutral')
    sh.freezeHeader(2)
    const raw = report.addSheet('Run Sheet')
    raw.titleBand('Run Sheet', yLabel)
    raw.table({
      headers: [
        { header: 'Run', key: 'run', align: 'center' }, { header: 'Std', key: 'std', align: 'center' }, { header: 'Rep', key: 'rep', align: 'center' },
        ...res.factors.map((f, i) => ({ header: `${LETTERS[i]} · ${f.name}`, key: `f${i}`, align: 'right' as const, width: 16 })),
        { header: yLabel, key: 'y', align: 'right' as const, width: 16 },
      ],
      rows: rows.map(r => {
        const o: Record<string, string | number> = { run: r.runOrder, std: r.standardOrder, rep: r.replicate, y: num(inp.values[keyOf(r)]) ?? '' }
        r.coded.forEach((v, i) => { const raw2 = v < 0 ? inp.factors[i].low : inp.factors[i].high; o[`f${i}`] = num(raw2) ?? raw2 })
        return o
      }),
      zebra: true,
    })
    raw.freezeHeader(2)
    await report.download('doe-full-factorial.xlsx')
  }

  const runPDF = () => {
    if (!isPro) { goToPricing('doe', 'pdf'); return }
    if (!res) return
    const ctx = createPdfReport('Design of Experiments — Full Factorial', 'doe')
    calloutBox(ctx, `${res.method === 'anova' ? 'Significant terms' : 'Active effects'}: ${sigHead(EN, res)}. ${sigSub(EN, res)}`, res.significant.length ? 'good' : 'warn')
    calloutBox(ctx, `Largest effect: ${bigHead(res)}. ${bigSub(EN, res)}`, 'info')
    if (paretoRef.current) addChartImage(ctx, paretoRef.current, 'Pareto of Effects', { width: 900, height: Math.min(300, 60 + pareto.length * 16) }, res.method === 'anova' ? `Standardized effects |t| · dashed line t = ${g4(res.paretoLine)} (α = 0.05, ${res.error!.df} DF)` : `Absolute effects · dashed line Lenth ME = ${g4(res.paretoLine)} (PSE = ${g4(res.lenth!.pse)})`)
    if (mainRef.current && interRef.current && inter) addChartImagePair(ctx, 'Factorial Plots', { chart: mainRef.current, title: 'Main Effects' }, { chart: interRef.current, title: `Interaction ${LETTERS[inter.a]}×${LETTERS[inter.b]}` })
    else if (mainRef.current) addChartImage(ctx, mainRef.current, 'Main Effects', PDF_WIDE)
    const w = ctx.pageWidth - ctx.margin * 2
    dataTable(ctx, 'Study', [{ header: 'ITEM', width: 130 }, { header: 'VALUE', width: w - 130 }], [
      ['Response', yLabel],
      ['Design', studyLine(res)],
      ...factorRows(res).map(([l, f, lo, hi]) => [`Factor ${l}`, `${f}: ${lo} / ${hi}`]),
      ['Model summary', `R² ${fixed(res.r2 * 100, 2)}%${res.r2Adj !== null ? ` · R²(adj) ${fixed(res.r2Adj * 100, 2)}%` : ''}${res.r2Pred !== null ? ` · R²(pred) ${fixed(res.r2Pred * 100, 2)}%` : ''}${res.s !== null ? ` · S ${g4(res.s)}` : ''}`],
      ['Source', SOURCE_LINE.replace('Source: ', '')],
    ])
    const cw = (w - 70) / 6
    dataTable(ctx, 'Coded Coefficients', [
      { header: 'TERM', width: 70 }, { header: 'EFFECT', width: cw, align: 'right' }, { header: 'COEF', width: cw, align: 'right' }, { header: 'SE COEF', width: cw, align: 'right' },
      { header: 'T', width: cw, align: 'right' }, { header: 'P', width: cw, align: 'right' }, { header: 'CONTRIB.', width: cw, align: 'right' },
    ], [
      ['Constant', '', g4(res.grandMean), res.terms[0].seCoef !== null ? g4(res.terms[0].seCoef) : '—', '', '', ''],
      ...res.terms.map(x => [x.term, g4(x.effect), g4(x.coef), x.seCoef !== null ? g4(x.seCoef) : '—', x.tValue !== null ? fixed(x.tValue, 2) : '—', pCell(x.pValue), `${fixed(x.contribution, 2)}%`]),
    ], { cellColors: [[], ...res.terms.map(x => (x.significant ? [REPORT_COLORS.good] : []))] })
    if (res.method === 'anova') {
      const aw = (w - 70) / 5
      dataTable(ctx, 'Analysis of Variance', [
        { header: 'SOURCE', width: 70 }, { header: 'DF', width: aw, align: 'right' }, { header: 'SS', width: aw, align: 'right' }, { header: 'MS', width: aw, align: 'right' }, { header: 'F', width: aw, align: 'right' }, { header: 'P', width: aw, align: 'right' },
      ], anovaRows(res).map(row => row.map((v, j) => (typeof v === 'number' ? (j === 1 ? String(v) : j === 5 ? formatPValue(v) : j === 4 ? fixed(v, 2) : g4(v)) : String(v)))))
    } else {
      calloutBox(ctx, fill(EN.dx_lenth_note, { s0: g4(res.lenth!.s0), pse: g4(res.lenth!.pse), df: fixed(res.lenth!.df, 2), me: g4(res.lenth!.me) }), 'info')
    }
    calloutBox(ctx, `Regression equation in uncoded units: ${eqText(res)}`, 'info')
    addSignOff(ctx)
    finalizeReport(ctx)
    ctx.pdf.save('doe-report.pdf')
  }

  const runPNG = () => {
    if (!isLoggedIn) { goToLogin('doe', 'png'); return }
    if (!paretoRef.current) return
    const a = document.createElement('a')
    a.href = paretoRef.current.toBase64Image('image/png', 1)
    a.download = 'doe-pareto-of-effects.png'
    a.click()
  }
  const exportExcel = () => (isPro ? withWatermarksDisabled(charts(), () => withEnglishAxes(runExcel)) : runExcel())
  const exportPDF = () => (isPro ? withWatermarksDisabled(charts(), () => withEnglishAxes(runPDF)) : runPDF())
  const exportPNG = () => (isLoggedIn ? withWatermarksDisabled([paretoRef.current], () => withEnglishAxes(runPNG)) : runPNG())

  const helpSteps = [1, 2, 3, 4].map(n => ({ t: t(`dx_help_s${n}_t` as TKey), d: t(`dx_help_s${n}_d` as TKey) }))
  const D = translations[lang]
  const errText = err === 'no-variation' ? t('dx_err_no_variation') : err === 'zero-error' ? t('dx_err_zero_error') : err ? t('dx_failed') : ''

  return (
    <div style={s.page}>
      <ToolStyles />
      <style>{`
        .dx-two { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: 10px; }
        .dx-field > span { display: block; font-size: 11px; color: var(--qh-muted); margin-bottom: 3px; }
        .dx-txt { width: 100%; box-sizing: border-box; background: color-mix(in srgb, var(--qh-bg) 70%, var(--qh-surface)); border: 1px solid var(--qh-border); border-radius: 7px; color: var(--qh-text); padding: 8px 10px; font: inherit; font-size: 14px; outline: none; }
        .dx-txt:focus { border-color: var(--qh-accent); }
        .dx-seg { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); border: 1px solid var(--qh-border); border-radius: 8px; overflow: hidden; }
        .dx-seg button { border: 0; background: transparent; color: var(--qh-text); font: inherit; font-size: 13px; font-weight: 600; padding: 8px 4px; cursor: pointer; }
        .dx-seg button + button { border-inline-start: 1px solid var(--qh-border); }
        .dx-seg button[aria-pressed="true"] { background: var(--qh-accent); color: var(--qh-onAccent); }
        .dx-factors { display: flex; flex-direction: column; gap: 8px; }
        .dx-frow { display: grid; grid-template-columns: 26px minmax(0, 1.6fr) minmax(0, 1fr) minmax(0, 1fr); gap: 6px; align-items: center; }
        .dx-frow input { min-width: 0; }
        .dx-frow .dx-txt { padding: 7px 8px; font-size: 13px; }
        .dx-letter { width: 26px; height: 26px; border-radius: 6px; display: grid; place-items: center; font: 700 12px ui-monospace, Menlo, monospace; background: color-mix(in srgb, var(--qh-data) 14%, transparent); color: var(--qh-data); }
        .dx-fhead { font-size: 11px; color: var(--qh-muted); }
        .dx-grid td.dx-lv { font: 12px ui-monospace, Menlo, monospace; text-align: center; white-space: nowrap; padding: 0 8px; }
        .dx-grid td.dx-lv.hi { color: var(--qh-text); font-weight: 600; }
        .dx-grid td.dx-lv.lo { color: var(--qh-muted); }
        .dx-grid td.dx-n { color: var(--qh-muted); font-size: 12px; text-align: center; }
        .dx-grid td input { text-align: center; min-width: 84px; }
        .dx-grid th { white-space: nowrap; }
        .dx-row-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 10px; }
        .dx-big { font-size: 22px; font-weight: 700; letter-spacing: -0.3px; margin-bottom: 4px; white-space: pre-wrap; }
        .dx-charts2 { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); gap: 12px; }
        .dx-eq { font: 13px ui-monospace, Menlo, monospace; line-height: 1.8; direction: ltr; text-align: left; background: var(--qh-surface2); border-radius: 8px; padding: 10px 12px; overflow-wrap: anywhere; }
        .dx-sig { color: var(--qh-good); font-weight: 700; }
        @media (max-width: 900px) { .dx-charts2 { grid-template-columns: minmax(0, 1fr); } }
        @media (max-width: 768px) { .dx-two { grid-template-columns: minmax(0, 1fr) 90px; } }
      `}</style>
      <Nav theme={theme} setTheme={setTheme} breadcrumbKey="bc_doe" />

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
        <ToolSidebar current="/doe" />

        <div className="tl-main">
          <ToolHeader title={t('doe_title')} intro={t('dx_intro')} onHelp={() => setHelpOpen(true)} onExample={loadExample} />
          <HelpPanel open={helpOpen} onClose={() => setHelpOpen(false)} title={t('dx_help_title')} steps={helpSteps} onExample={loadExample} showCapability={false} tip={t('dx_help_tip')} />
          <PhoneTabs tab={mobileTab} onTab={setMobileTab} dataCount={filled} />

          <div className="tl-top">
            {/* ── SETUP ───────────────────────────────────────────────── */}
            <section className="tl-panel tl-setup tl-card" data-active={mobileTab === 'setup'} aria-label={t('spc_tab_setup')}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{t('dx_setup_title')}</div>
              <div className="dx-two">
                <label className="dx-field"><span>{t('dx_response')}</span><input className="dx-txt" value={inp.response} onChange={e => set({ response: e.target.value })} /></label>
                <label className="dx-field"><span>{t('dx_response_unit')}</span><input className="dx-txt" value={inp.unit} onChange={e => set({ unit: e.target.value })} /></label>
              </div>
              <div>
                <div className="tl-label">{t('dx_factors')}</div>
                <div className="dx-seg" role="group" aria-label={t('dx_factors')}>
                  {[2, 3, 4, 5].map(n => <button key={n} type="button" aria-pressed={k === n} onClick={() => setCount(n)}>{n}</button>)}
                </div>
              </div>
              <div className="dx-factors">
                <div className="dx-frow dx-fhead"><span /><span>{t('dx_factor_name')}</span><span>{t('dx_low')}</span><span>{t('dx_high')}</span></div>
                {inp.factors.map((f, i) => (
                  <div key={i} className="dx-frow">
                    <span className="dx-letter">{LETTERS[i]}</span>
                    <input className="dx-txt" value={f.name} maxLength={40} aria-label={`${t('dx_factor_name')} ${LETTERS[i]}`} onChange={e => setFactor(i, { name: e.target.value })} />
                    <input className="dx-txt" inputMode="decimal" value={f.low} aria-label={`${LETTERS[i]} ${t('dx_low')}`} onChange={e => setFactor(i, { low: e.target.value })} />
                    <input className="dx-txt" inputMode="decimal" value={f.high} aria-label={`${LETTERS[i]} ${t('dx_high')}`} onChange={e => setFactor(i, { high: e.target.value })} />
                  </div>
                ))}
                {levelsBad && <div className="tl-error">{t('dx_err_levels')}</div>}
              </div>
              <div>
                <div className="tl-label">{t('dx_replicates')}</div>
                <div className="dx-seg" role="group" aria-label={t('dx_replicates')}>
                  {[1, 2, 3, 4].map(n => <button key={n} type="button" aria-pressed={inp.replicates === n} onClick={() => setReps(n)}>{n}</button>)}
                </div>
                <div className="tl-hint">{t('dx_rep_hint')}</div>
              </div>
              <div>
                <button type="button" className="tl-xbtn" onClick={shuffle}>⤮ {t('dx_randomize')}</button>
                {inp.randomized && <button type="button" className="tl-xbtn tl-xbtn-sm" style={{ marginInlineStart: 8 }} onClick={unshuffle}>{t('dx_standard_order')}</button>}
                <div className="tl-hint">{t('dx_randomize_hint')}</div>
              </div>
            </section>

            <div className="tl-col">
              {/* ── DATA ──────────────────────────────────────────────── */}
              <section className="tl-panel tl-card" data-active={mobileTab === 'data'} aria-label={t('spc_tab_data')}>
                <DataCardHead
                  countLabel={fill(t('dx_data_count'), { runs: rows.length, n: filled })}
                  onUpload={gridImport.openFilePicker}
                  onClear={clearAll}
                  extra={<gridImport.FileInput />}
                />
                {gridImport.fileError && <div className="tl-error" style={{ marginBottom: 10 }}>{gridImport.fileError}</div>}
                <SheetPicker sheetNames={gridImport.sheetNames} activeSheet={gridImport.activeSheet} onSelect={gridImport.selectSheet} accentColor={c.accent} textColor={c.text} mutedColor={c.muted} borderColor={c.border} />
                <div className="tl-sg-wrap">
                  <table className="tl-sg dx-grid">
                    <thead>
                      <tr>
                        <th>{t('dx_col_run')}</th>
                        <th>{t('dx_col_std')}</th>
                        {inp.replicates > 1 && <th>{t('dx_col_rep')}</th>}
                        {inp.factors.map((f, i) => <th key={i} title={f.name}>{LETTERS[i]}</th>)}
                        <th style={{ minWidth: 100 }}>{ltr(yLabel)}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(r => {
                        const key = keyOf(r)
                        return (
                          <tr key={key}>
                            <td className="tl-sg-n">{r.runOrder}</td>
                            <td className="dx-n">{r.standardOrder}</td>
                            {inp.replicates > 1 && <td className="dx-n">{r.replicate}</td>}
                            {r.coded.map((v, i) => <td key={i} className={`dx-lv ${v > 0 ? 'hi' : 'lo'}`}>{v > 0 ? inp.factors[i].high : inp.factors[i].low}</td>)}
                            <td><input inputMode="decimal" value={inp.values[key] ?? ''} aria-label={`${t('dx_col_run')} ${r.runOrder}`} onChange={e => setValue(key, e.target.value)} /></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="tl-paste">{t('dx_paste')}</div>
              </section>

              {/* ── RESULTS ───────────────────────────────────────────── */}
              <section className="tl-panel tl-results" data-active={mobileTab === 'results'} aria-label={t('spc_tab_results')}>
                {errText && <div className="tl-error">{errText}</div>}
                {!res ? (
                  !errText && <div className="tl-card tl-empty">{pending ? t('icmsf_loading') : complete ? t('dx_empty') : fill(t('dx_missing'), { n: rows.length - filled, total: rows.length })}</div>
                ) : (
                  <>
                    <div className="tl-verdicts" aria-live="polite">
                      <div className="tl-verdict" style={{ background: tint(sigColor, 8), border: `1px solid ${tint(sigColor, 35)}` }}>
                        <span className="tl-verdict-icon" aria-hidden="true" style={{ background: tint(sigColor, 16), color: sigColor }}>{res.significant.length ? '✓' : '!'}</span>
                        <div>
                          <div style={{ fontSize: 12, color: 'var(--qh-muted)', marginBottom: 2 }}>{t(res.method === 'anova' ? 'dx_v_sig' : 'dx_v_active')}</div>
                          <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 4, color: sigColor }}>{sigHead(D, res)}</div>
                          <div style={{ fontSize: 13, color: 'var(--qh-muted)', lineHeight: 1.6 }}>{sigSub(D, res, lang === 'ar')}</div>
                        </div>
                      </div>
                      {biggest && (
                        <div className="tl-verdict" style={{ background: tint(bigColor, 8), border: `1px solid ${tint(bigColor, 35)}` }}>
                          <span className="tl-verdict-icon" aria-hidden="true" style={{ background: tint(bigColor, 16), color: bigColor }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M4 18h4V9H4zM10 18h4V4h-4zM16 18h4v-6h-4z" /></svg>
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 12, color: 'var(--qh-muted)', marginBottom: 2 }}>{t('dx_v_big')}</div>
                            <div className="dx-big">{ltr(bigHead(res))}</div>
                            <div style={{ fontSize: 13, color: 'var(--qh-muted)', lineHeight: 1.6 }}>{bigSub(D, res, lang === 'ar')}</div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="tl-kpis tl-kpis-4">
                      <div className="tl-kpi"><span>R²</span><b>{fixed(res.r2 * 100, 2)}%</b></div>
                      <div className="tl-kpi"><span>R² (adj)</span><b>{res.r2Adj !== null ? `${fixed(res.r2Adj * 100, 2)}%` : '—'}</b></div>
                      <div className="tl-kpi"><span>R² (pred)</span><b>{res.r2Pred !== null ? `${fixed(res.r2Pred * 100, 2)}%` : '—'}</b></div>
                      <div className="tl-kpi"><span>{res.s !== null ? 'S' : 'PSE'}</span><b>{g4(res.s ?? res.lenth!.pse)}</b></div>
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
                        pngLabel={t('dx_x_png')}
                        save={
                          <SaveAnalysisButton
                            theme={theme}
                            tool="doe"
                            defaultName={`DOE — ${yName} — ${new Date().toLocaleDateString('en-US')}`}
                            compact={compactSave}
                            getPayload={() => ({
                              input_data: {
                                response: inp.response, unit: inp.unit,
                                factors: factorsNum.map((f, i) => ({ name: f.name, low: f.low, high: f.high, letter: LETTERS[i] })),
                                replicates: inp.replicates, order: inp.order,
                                responseMap: Object.fromEntries(rows.map(r => [keyOf(r), num(inp.values[keyOf(r)])])),
                              },
                              results: { method: res.method, significant: res.significant, r2: res.r2, r2Adj: res.r2Adj, terms: res.terms.map(x => ({ term: x.term, effect: x.effect, pValue: x.pValue })) },
                            })}
                          />
                        }
                      />
                    </div>

                    <div className="tl-chart">
                      <h3>{t('dx_pareto_title')}</h3>
                      <div className="tl-chart-sub">
                        {res.method === 'anova'
                          ? fill(t('dx_pareto_sub_anova'), { t: g4(res.paretoLine), df: res.error!.df })
                          : fill(t('dx_pareto_sub_lenth'), { me: g4(res.lenth!.me), pse: g4(res.lenth!.pse) })}
                      </div>
                      <div className="tl-chart-inner" style={{ height: paretoH }}>
                        {paretoData && <Chart ref={paretoRef} type="bar" data={paretoData} options={paretoOptions} plugins={[refLine]} />}
                      </div>
                    </div>

                    <div className="dx-charts2">
                      <div className="tl-chart">
                        <h3>{t('dx_main_title')}</h3>
                        <div className="tl-chart-sub">{fill(t('dx_main_sub'), { y: yName })}</div>
                        <div className="tl-chart-inner" style={{ height: 260 }}>
                          {mainData && <Chart ref={mainRef} type="scatter" data={mainData} options={mainOptions} plugins={[panelNames]} />}
                        </div>
                      </div>
                      <div className="tl-chart">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <h3 style={{ margin: 0 }}>{t('dx_inter_title')}</h3>
                          {pairs.length > 1 && (
                            <select className="dx-txt" style={{ width: 'auto', padding: '4px 8px', fontSize: 12 }} aria-label={t('dx_inter_pair')} value={pairKey} onChange={e => setPair(e.target.value)}>
                              {pairs.map(p => <option key={`${p.a}-${p.b}`} value={`${p.a}-${p.b}`}>{LETTERS[p.a]}×{LETTERS[p.b]}</option>)}
                            </select>
                          )}
                        </div>
                        <div className="tl-chart-sub">{fill(t('dx_inter_sub'), { y: yName })}</div>
                        <div className="tl-chart-inner" style={{ height: 260 }}>
                          {interData && interOptions && <Chart ref={interRef} type="scatter" data={interData} options={interOptions} />}
                        </div>
                      </div>
                    </div>

                    <details className="tl-more">
                      <summary>{t('dx_more')}</summary>
                      <div className="tl-more-body">
                        <div style={{ overflowX: 'auto' }}>
                          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{t('dx_coef_title')}</div>
                          <table className="tl-table">
                            <thead>
                              <tr>
                                <th>{t('dx_col_term')}</th>
                                <th className="num">{t('dx_col_effect')}</th>
                                <th className="num">{t('dx_col_coef')}</th>
                                {res.method === 'anova' && <><th className="num">{t('dx_col_se')}</th><th className="num">T</th><th className="num">P</th></>}
                                <th className="num">{t('dx_col_contrib')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <td>{t('dx_constant')}</td><td className="num" /><td className="num">{ltr(g4(res.grandMean))}</td>
                                {res.method === 'anova' && <><td className="num">{ltr(g4(res.terms[0].seCoef ?? 0))}</td><td className="num" /><td className="num" /></>}
                                <td className="num" />
                              </tr>
                              {res.terms.map(x => (
                                <tr key={x.term}>
                                  <td className={x.significant ? 'dx-sig' : undefined} title={termName(x.term)}>{termName(x.term)}</td>
                                  <td className="num">{ltr(g4(x.effect))}</td>
                                  <td className="num">{ltr(g4(x.coef))}</td>
                                  {res.method === 'anova' && <>
                                    <td className="num">{ltr(g4(x.seCoef ?? 0))}</td>
                                    <td className="num">{ltr(fixed(x.tValue ?? 0, 2))}</td>
                                    <td className={`num${x.significant ? ' dx-sig' : ''}`}>{ltr(pCell(x.pValue))}</td>
                                  </>}
                                  <td className="num">{ltr(`${fixed(x.contribution, 2)}%`)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {res.lenth && <div className="tl-hint">{fill(t('dx_lenth_note'), { s0: g4(res.lenth.s0), pse: g4(res.lenth.pse), df: fixed(res.lenth.df, 2), me: g4(res.lenth.me) })}</div>}
                        </div>
                        {res.method === 'anova' && (
                          <div style={{ overflowX: 'auto' }}>
                            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{t('dx_anova_title')}</div>
                            <table className="tl-table">
                              <thead>
                                <tr><th>{t('dx_col_source')}</th><th className="num">DF</th><th className="num">SS</th><th className="num">MS</th><th className="num">F</th><th className="num">P</th></tr>
                              </thead>
                              <tbody>
                                {anovaRows(res).map((row, i) => (
                                  <tr key={i}>
                                    <td>{row[0] === 'Model' ? t('dx_src_model') : row[0] === 'Error' ? t('dx_src_error') : row[0] === 'Total' ? t('dx_src_total') : termName(String(row[0]))}</td>
                                    <td className="num">{row[1]}</td>
                                    {row.slice(2).map((v, j) => <td key={j} className="num">{typeof v === 'number' ? ltr(j === 3 ? formatPValue(v) : j === 2 ? fixed(v, 2) : g4(v)) : v}</td>)}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{t('dx_eq_title')}</div>
                          <div className="dx-eq">{eqText(res)}</div>
                          <div className="tl-hint">{t('dx_eq_note')}</div>
                        </div>
                      </div>
                    </details>

                    <details className="tl-more">
                      <summary>{t('dx_method_title')}</summary>
                      <div className="tl-more-body">
                        {(['dx_method_1', 'dx_method_2', 'dx_method_3', 'dx_method_4'] as TKey[]).map(key => <p key={key} style={{ margin: 0, fontSize: 13, lineHeight: 1.7 }}>{t(key)}</p>)}
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
