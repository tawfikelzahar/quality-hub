'use client'

import { useEffect, useRef, useState } from 'react'
import 'chart.js/auto'
import { Chart } from 'react-chartjs-2'
import type { Chart as ChartJSInstance } from 'chart.js'
import { COLORS, getSharedStyles, usePersistedTheme, tint } from '@/lib/theme'
import Nav from '@/components/Nav'
import ToolSidebar from '@/components/ToolSidebar'
import ToolStyles from '@/components/tool/ToolStyles'
import { ToolHeader, HelpPanel, PhoneTabs, PhoneBar, ExportRow, useCompactSave, type MobileTab } from '@/components/tool/ToolParts'
import SaveAnalysisButton from '@/components/SaveAnalysisButton'
import { useSubscription } from '@/lib/useSubscription'
import { goToLogin, goToPricing } from '@/lib/exportGate'
import { watermarkOptions, watermarkLayout, withWatermarksDisabled } from '@/lib/watermarkHelpers'
import { useLanguage } from '@/lib/i18n/context'
import { translations, type TKey } from '@/lib/i18n/translations'
import { createReport, nowStamp } from '@/lib/excelReport'
import { createReport as createPdfReport, addChartImage, addSignOff, calloutBox, dataTable, finalizeReport, REPORT_COLORS } from '@/lib/pdf/reportDesign'
import { fixed } from '@/lib/stats/format'
import {
  HAZARD_LEVEL_ORDER, CONDITION_EFFECT_ORDER, HAZARD_EXAMPLES, MAX_RESULT,
  type HazardLevel, type ConditionEffect, type ResultMode, type IcmsfRequest, type IcmsfResult, type IcmsfRiskResult, type UnitClass,
} from '@/lib/icmsf/options'

// ─────────────────────────────────────────────────────────────────────────
// ICMSF page on the shared tool layout. Table 6-1, the decision and every
// curve run on the server (/api/icmsf; risk by concentration is Pro,
// /api/icmsf/risk). This page sends the inputs and draws the replies.
// ─────────────────────────────────────────────────────────────────────────

const UNITS = ['CFU/g', 'CFU/ml', 'CFU/cm²'] as const
type Unit = (typeof UNITS)[number]
const EN = translations.en
/** charts in the PDF: full width, a little shorter than on screen, so a lot fits on one page with the sign-off */
const PDF_CHART = { width: 900, height: 170 }
/** one source line in the reports; the full method stays on screen */
const SOURCE_LINE = 'Source: ICMSF Table 6-1 (1974, as printed by NAP 1985) · organism examples: ICMSF 2020 · OC curve: binomial · risk curve: FAO/WHO lognormal model · m and M from your standard.'
type Dict = Readonly<Record<string, string>>
const say = (d: Dict, k: TKey) => d[k]

const ltr = (v: string) => `⁦${v}⁩`
const pct = (v: number) => fixed(v * 100, 1)
const csvCell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
/** counts as typed: whole numbers with thousands separators, small values as is */
const countText = (v: number) => (v >= 1000 ? Math.round(v).toLocaleString('en-US') : String(Number(v.toPrecision(4))))
const parseNum = (s: string): number | null => {
  const t = s.trim().replace(/,/g, '')
  if (t === '') return null
  const v = Number(t)
  return Number.isFinite(v) && v >= 0 && v <= MAX_RESULT ? v : null
}

interface Inputs {
  hazard: HazardLevel
  condition: ConditionEffect
  mode: ResultMode
  unit: Unit
  weight: string
  m: string
  M: string
  positives: string
  results: string[]
  riskP: string
  sd: string
  point: string
}

const EXAMPLE: Inputs = {
  hazard: 'low', condition: 'none', mode: 'count', unit: 'CFU/g', weight: '25 g',
  m: '100', M: '1000', positives: '', results: ['40', '250', '90', '600', '1500'], riskP: '10', sd: '0.8', point: '30',
}

// ── Server calls ──
function usePlan(body: IcmsfRequest) {
  const key = JSON.stringify(body)
  const [reply, setReply] = useState<{ key: string; r: IcmsfResult | null; why: 'rate' | 'error' | null } | null>(null)
  useEffect(() => {
    const ctrl = new AbortController()
    const timer = setTimeout(() => {
      fetch('/api/icmsf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: key, signal: ctrl.signal })
        .then(async res => setReply({ key, r: res.ok ? ((await res.json()) as IcmsfResult) : null, why: res.ok ? null : res.status === 429 ? 'rate' : 'error' }))
        .catch(() => { if (!ctrl.signal.aborted) setReply({ key, r: null, why: 'error' }) })
    }, 200)
    return () => { clearTimeout(timer); ctrl.abort() }
  }, [key])
  const current = reply?.key === key ? reply : null
  return { r: current?.r ?? reply?.r ?? null, pending: current === null, failed: current?.why ?? null }
}

function useRisk(body: object | null, enabled: boolean) {
  const key = body && enabled ? JSON.stringify(body) : null
  const [reply, setReply] = useState<{ key: string; r: IcmsfRiskResult | null } | null>(null)
  useEffect(() => {
    if (!key) return
    const ctrl = new AbortController()
    const timer = setTimeout(() => {
      fetch('/api/icmsf/risk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: key, signal: ctrl.signal })
        .then(async res => setReply({ key, r: res.ok ? ((await res.json()) as IcmsfRiskResult) : null }))
        .catch(() => { if (!ctrl.signal.aborted) setReply({ key, r: null }) })
    }, 250)
    return () => { clearTimeout(timer); ctrl.abort() }
  }, [key])
  if (!key) return { r: null, failed: false, pending: false }
  const current = reply?.key === key ? reply : null
  return { r: current?.r ?? null, failed: current !== null && current.r === null, pending: current === null }
}

export default function IcmsfCalculator() {
  const { isPro, isLoggedIn } = useSubscription()
  const [theme, setTheme] = usePersistedTheme()
  const { t, lang } = useLanguage()
  const c = COLORS[theme]
  const s = getSharedStyles(theme)
  const compactSave = useCompactSave()
  const ocRef = useRef<ChartJSInstance<'line'>>(null)
  const riskRef = useRef<ChartJSInstance<'line'>>(null)

  const [inp, setInp] = useState<Inputs>(EXAMPLE)
  const [mobileTab, setMobileTab] = useState<MobileTab>('data')
  const [helpOpen, setHelpOpen] = useState(false)
  const [loadedProjectName, setLoadedProjectName] = useState('')
  const [loadError, setLoadError] = useState('')
  const set = (p: Partial<Inputs>) => setInp(prev => ({ ...prev, ...p }))

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id')
    if (!id) return
    fetch(`/api/saved-analyses/${id}`)
      .then(res => (res.ok ? res.json() : Promise.reject()))
      .then(({ analysis }) => {
        const d = analysis.input_data as Record<string, unknown>
        const str = (v: unknown, dflt = '') => (v === null || v === undefined ? dflt : String(v))
        const hazard = HAZARD_LEVEL_ORDER.includes(d.hazard as HazardLevel) ? (d.hazard as HazardLevel) : HAZARD_LEVEL_ORDER.includes(d.hazardLevel as HazardLevel) ? (d.hazardLevel as HazardLevel) : 'low'
        const condition = CONDITION_EFFECT_ORDER.includes(d.condition as ConditionEffect) ? (d.condition as ConditionEffect) : CONDITION_EFFECT_ORDER.includes(d.conditionEffect as ConditionEffect) ? (d.conditionEffect as ConditionEffect) : 'none'
        const limits = (d.limits ?? {}) as { m?: number | null; M?: number | null }
        setInp({
          hazard, condition,
          mode: d.mode === 'presence' ? 'presence' : d.testType === 'qualitative' ? 'presence' : 'count',
          unit: UNITS.includes(d.unit as Unit) ? (d.unit as Unit) : 'CFU/g',
          weight: str(d.weight, '25 g'),
          m: str(d.m ?? limits.m), M: str(d.M ?? limits.M), positives: str(d.positives),
          results: Array.isArray(d.results) ? (d.results as unknown[]).map(v => str(v)) : [],
          riskP: str(d.riskP, '10'), sd: str(d.sd, '0.8'), point: str(d.point, ''),
        })
        setLoadedProjectName(analysis.name as string)
      })
      .catch(() => setLoadError(lang === 'ar' ? 'تعذر تحميل المشروع المحفوظ.' : 'Could not load the saved project.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Request ──
  const body: IcmsfRequest = {
    hazard: inp.hazard,
    condition: inp.condition,
    mode: inp.mode,
    m: parseNum(inp.m),
    M: parseNum(inp.M),
    positives: (() => { const v = parseNum(inp.positives); return v !== null && Number.isInteger(v) && v <= 60 ? v : null })(),
    results: inp.results.slice(0, 60).map(parseNum),
    riskP: Math.min(100, Math.max(0, parseNum(inp.riskP) ?? 10)),
  }
  const { r, pending, failed } = usePlan(body)
  const three = r?.planClass === 3
  const mode: ResultMode = three ? 'count' : inp.mode
  const n = r?.n ?? 0

  // Pro risk curve: counts only
  const riskBody = r && mode === 'count' && body.m !== null && body.m > 0 && (!three || (body.M !== null && body.M > body.m))
    ? { hazard: inp.hazard, condition: inp.condition, m: body.m, M: three ? body.M : null, sd: Math.min(3, Math.max(0.05, parseNum(inp.sd) ?? 0.8)), point: Math.log10(Math.max(1e-6, parseNum(inp.point) ?? (body.m / 10))) }
    : null
  const risk = useRisk(riskBody, isPro)

  // ── Editing results grid ──
  const resultsFor = (count: number) => Array.from({ length: count }, (_, i) => inp.results[i] ?? '')
  const setResult = (i: number, v: string) => setInp(prev => { const next = resultsFor(Math.max(n, prev.results.length)); next[i] = v; return { ...prev, results: next } })
  const loadExample = () => { setInp(EXAMPLE); setMobileTab('results') }

  // ── Words ──
  const clsLabel = (u: UnitClass, d: Dict = translations[lang]) =>
    u === 'acceptable' ? say(d, 'icmsf_cls_acceptable') : u === 'marginal' ? say(d, 'icmsf_cls_marginal') : say(d, three ? 'icmsf_cls_defective' : 'icmsf_cls_defective2')
  const clsColor = (u: UnitClass | null) => (u === 'acceptable' ? 'var(--qh-good)' : u === 'marginal' ? 'var(--qh-amber)' : u === 'defective' ? 'var(--qh-danger)' : 'var(--qh-muted)')
  const decisionColor = r?.decision === 'accept' ? 'var(--qh-good)' : r?.decision === 'reject' ? 'var(--qh-danger)' : 'var(--qh-muted)'
  const fill = (str: string, vars: Record<string, string | number>) => Object.entries(vars).reduce((a, [k, v]) => a.split(`{${k}}`).join(String(v)), str)
  const why = (d: Dict) => r ? fill(say(d, three ? 'icmsf_why_3' : r.c === 0 ? 'icmsf_why_2_c0' : 'icmsf_why_2'), { k: r.caseNumber, n: r.n, c: r.c }) : ''
  const sub = (d: Dict) => {
    if (!r) return ''
    const v = { n: r.n, c: r.c, d: r.defective, mg: r.marginal, e: r.entered }
    const p = mode === 'presence'
    if (r.decision === 'accept') return fill(say(d, three ? 'icmsf_sub_accept_3' : p ? 'icmsf_sub_accept_p' : 'icmsf_sub_accept_2'), v)
    if (r.reason === 'over_M') return fill(say(d, 'icmsf_sub_overM'), v)
    if (r.reason === 'over_c') return fill(say(d, three ? 'icmsf_sub_overc_3' : p ? 'icmsf_sub_overc_p' : 'icmsf_sub_overc_2'), v)
    return fill(say(d, 'icmsf_sub_pending'), v)
  }
  const headline = (d: Dict) => (r?.decision === 'accept' ? say(d, 'icmsf_lot_accept') : r?.decision === 'reject' ? say(d, 'icmsf_lot_reject') : say(d, 'icmsf_lot_pending'))
  const limitsText = (d: Dict) =>
    mode === 'presence' ? fill(say(d, 'icmsf_presence_line'), { w: inp.weight || '25 g' })
      : `m = ${body.m !== null ? countText(body.m) : '—'}${three ? ` · M = ${body.M !== null ? countText(body.M) : '—'}` : ''} ${inp.unit}`
  const fromLog = (x: number) => countText(Math.pow(10, x))
  /** band limits: two significant figures (0.88, 30, 1,500) */
  const round2 = (x: number) => { const v = Number(Math.pow(10, x).toPrecision(2)); return v >= 1000 ? v.toLocaleString('en-US') : String(v) }
  const riskLines = (d: Dict) => {
    if (!risk.r) return [] as string[]
    const p = risk.r.point
    const out = [fill(say(d, three ? 'icmsf_point_line' : 'icmsf_point_line_2'), { x: fromLog(p.logMean), unit: inp.unit, pa: pct(p.pAccept), pm: pct(p.pMarginalRegion), pd: pct(p.pUnacceptableRegion) })]
    if (risk.r.accept95 !== null && risk.r.reject95 !== null) out.push(fill(say(d, 'icmsf_band'), { a: round2(risk.r.accept95), r: round2(risk.r.reject95), unit: inp.unit }))
    return out
  }

  // ── Charts ──
  const chartOptions = (xTitle: string, xMin: number, xMax: number, xTick: (v: number) => string, step: number) => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: false as const,
    devicePixelRatio: 2,
    parsing: false as const,
    layout: watermarkLayout(),
    plugins: { legend: { display: false }, tooltip: { enabled: false }, watermark: watermarkOptions('light') },
    scales: {
      x: { type: 'linear' as const, min: xMin, max: xMax, ticks: { color: c.muted, font: { size: 11 }, stepSize: step, callback: (v: string | number) => xTick(Number(v)) }, grid: { display: false }, border: { color: c.border }, title: { display: true, text: xTitle, color: c.muted, font: { size: 11 } } },
      y: { min: 0, max: 100, ticks: { color: c.muted, font: { size: 11 }, stepSize: 25, callback: (v: string | number) => `${v}%` }, grid: { color: c.grid }, border: { color: c.border }, title: { display: true, text: t('icmsf_oc_y'), color: c.muted, font: { size: 11 } } },
    },
  })
  const marker = (x: number, y: number) => ({ type: 'scatter' as const, data: [{ x, y }], backgroundColor: c.amber, borderColor: theme === 'dark' ? '#000' : '#fff', borderWidth: 1.5, pointRadius: 5 })
  const ocData = r?.oc
    ? { datasets: [
        { type: 'line' as const, data: r.oc.map((pa, p) => ({ x: p, y: pa * 100 })), borderColor: c.data, borderWidth: 2.5, pointRadius: 0, tension: 0 },
        ...(r.riskPa !== null ? [marker(body.riskP, r.riskPa * 100)] : []),
      ] }
    : null
  const riskData = risk.r
    ? { datasets: [
        { type: 'line' as const, data: risk.r.curve.map(p => ({ x: p.logMean, y: p.pAccept * 100 })), borderColor: c.data, borderWidth: 2.5, pointRadius: 0, tension: 0 },
        marker(risk.r.point.logMean, risk.r.point.pAccept * 100),
      ] }
    : null
  const riskMin = risk.r ? risk.r.curve[0].logMean : 0
  const riskMax = risk.r ? risk.r.curve[risk.r.curve.length - 1].logMean : 1

  // ── Exports (English) ──
  const examples = (h: HazardLevel) => HAZARD_EXAMPLES[h].examples.join(', ')
  const hazardEn = say(EN, `icmsf_hazard_${inp.hazard}` as TKey)
  const condEn = say(EN, `icmsf_cond_${inp.condition}` as TKey)
  const unitRows = r && mode === 'count' ? r.units.map((u, i) => ({ i: i + 1, value: body.results[i], cls: u })) : []

  const exportCSV = () => {
    if (!isLoggedIn) { goToLogin('icmsf', 'csv'); return }
    if (!r) return
    const lines = [
      'Hazard,Conditions,Case,Plan,n,c,Limits,Lot Result',
      [csvCell(hazardEn), csvCell(condEn), r.caseNumber, `${r.planClass}-class`, r.n, r.c, csvCell(limitsText(EN)), csvCell(r.decision ? headline(EN) : 'Decision pending')].join(','),
      '',
      ...(mode === 'presence'
        ? ['Positive Units', String(body.positives ?? '')]
        : ['Unit,Result,Class', ...unitRows.map(u => [u.i, u.value ?? '', u.cls ? clsLabel(u.cls, EN) : ''].join(','))]),
    ]
    const blob = new Blob(['﻿', lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'icmsf-sampling-plan.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const runExcel = async () => {
    if (!isPro) { goToPricing('icmsf', 'excel'); return }
    if (!r) return
    const report = createReport({ toolName: 'ICMSF Sampling Plan' })
    const sh = report.addSheet('ICMSF Plan')
    sh.titleBand('ICMSF Sampling Plan & Lot Decision', `Case ${r.caseNumber} · ${r.planClass}-class · n ${r.n} · c ${r.c}`)
    sh.metaStrip([
      ['Generated on', nowStamp()],
      ['Hazard', `${hazardEn} (examples: ${examples(inp.hazard)})`],
      ['Conditions', condEn],
      ['Limits', limitsText(EN)],
    ])
    sh.sectionHeading('Lot Decision')
    sh.kpiRow([
      { label: 'Lot', value: r.decision ? headline(EN) : 'Decision pending', tone: r.decision === 'accept' ? 'good' : r.decision === 'reject' ? 'danger' : 'neutral' },
      { label: 'Case', value: String(r.caseNumber), tone: 'neutral' },
      { label: 'n · c', value: `${r.n} · ${r.c}`, tone: 'neutral' },
    ])
    sh.note(`${why(EN)} ${sub(EN)}`, r.decision === 'accept' ? 'good' : r.decision === 'reject' ? 'danger' : 'neutral')
    if (mode === 'count' && unitRows.length) {
      sh.sectionHeading('Sample Units')
      sh.table({
        headers: [
          { header: 'Unit', key: 'i', align: 'center' },
          { header: `Result (${inp.unit})`, key: 'v', align: 'right', width: 16 },
          { header: 'Class', key: 'cls', align: 'left', width: 16 },
        ],
        rows: unitRows.map(u => ({ i: u.i, v: u.value ?? '', cls: u.cls ? clsLabel(u.cls, EN) : '' })),
        rowTones: unitRows.map(u => (u.cls === 'defective' ? 'danger' : u.cls === 'marginal' ? 'warning' : u.cls ? 'good' : undefined)),
      })
    } else if (mode === 'presence') {
      sh.note(`Positive units found: ${body.positives ?? '—'} of ${r.n}`, 'neutral')
    }
    if (ocRef.current && r.oc) {
      sh.sectionHeading('Operating Characteristic (OC) Curve')
      await sh.image(ocRef.current.toBase64Image('image/png', 1), { widthCm: 16, heightCm: 8 })
      if (r.riskPa !== null) sh.note(fill(EN.icmsf_check, { p: fixed(body.riskP, 1), pa: pct(r.riskPa) }), 'neutral')
    }
    if (risk.r && riskRef.current) {
      sh.sectionHeading('Risk by Concentration (lognormal, FAO/WHO model)')
      await sh.image(riskRef.current.toBase64Image('image/png', 1), { widthCm: 16, heightCm: 8 })
      riskLines(EN).forEach(l => sh.note(l, 'neutral'))
    }
    sh.note(SOURCE_LINE, 'neutral')
    sh.freezeHeader(2)
    await report.download('icmsf-sampling-plan.xlsx')
  }

  const runPDF = () => {
    if (!isPro) { goToPricing('icmsf', 'pdf'); return }
    if (!r) return
    const ctx = createPdfReport('ICMSF Sampling Plan & Lot Decision', 'icmsf')
    calloutBox(ctx, `${r.decision ? headline(EN) : 'Decision pending'}. ${sub(EN)}`, r.decision === 'accept' ? 'good' : r.decision === 'reject' ? 'bad' : 'info')
    const w = ctx.pageWidth - ctx.margin * 2
    dataTable(ctx, 'Sampling Plan', [{ header: 'ITEM', width: 130 }, { header: 'VALUE', width: w - 130 }], [
      ['Hazard', `${hazardEn} (ICMSF examples: ${examples(inp.hazard)})`],
      ['Conditions after sampling', condEn],
      ['ICMSF Case', `Case ${r.caseNumber} · ${r.planClass}-class`],
      ['n · c', `${r.n} · ${r.c}`],
      ['Limits', limitsText(EN)],
      ['Rule', why(EN)],
      ['Source', SOURCE_LINE.replace('Source: ', '')],
    ])
    if (mode === 'count' && unitRows.some(u => u.value !== null)) {
      const tone = (u: UnitClass | null) => (u === 'acceptable' ? REPORT_COLORS.good : u === 'marginal' ? REPORT_COLORS.warn : u === 'defective' ? REPORT_COLORS.bad : null)
      // entered units only, three per row (unit · result · class), so 20–60 units stay short
      const done = unitRows.filter(u => u.value !== null)
      const PER = 3
      const colW = w / PER
      const cols = Array.from({ length: PER }, () => [
        { header: '#', width: colW * 0.17, align: 'center' as const },
        { header: 'RESULT', width: colW * 0.35, align: 'right' as const },
        { header: 'CLASS', width: colW * 0.48 },
      ]).flat()
      const lines = Math.ceil(done.length / PER)
      const rowsOut: string[][] = []
      const colors: (typeof REPORT_COLORS.good | null)[][] = []
      for (let li = 0; li < lines; li++) {
        const row: string[] = []
        const col: (typeof REPORT_COLORS.good | null)[] = []
        for (let k = 0; k < PER; k++) {
          const u = done[k * lines + li]
          row.push(u ? String(u.i) : '', u ? countText(u.value as number) : '', u && u.cls ? clsLabel(u.cls, EN) : '')
          col.push(null, null, u ? tone(u.cls) : null)
        }
        rowsOut.push(row)
        colors.push(col)
      }
      dataTable(ctx, `Sample Units (${inp.unit})`, cols, rowsOut, { cellColors: colors, allowSplit: true })
      const missing = r.n - done.length
      if (missing > 0) calloutBox(ctx, `${missing} of ${r.n} units not entered yet.`, 'info')
    } else if (mode === 'presence') {
      calloutBox(ctx, `Positive units found: ${body.positives ?? '-'} of ${r.n} (c = ${r.c}).`, 'info')
    }
    if (ocRef.current && r.oc) {
      addChartImage(ctx, ocRef.current, 'Operating Characteristic (OC) Curve', PDF_CHART)
      if (r.riskPa !== null) calloutBox(ctx, fill(EN.icmsf_check, { p: fixed(body.riskP, 1), pa: pct(r.riskPa) }), 'info')
    }
    if (risk.r && riskRef.current) {
      addChartImage(ctx, riskRef.current, 'Risk by Concentration (lognormal, FAO/WHO model)', PDF_CHART)
      calloutBox(ctx, riskLines(EN).join(' '), 'info')
    }
    addSignOff(ctx)
    finalizeReport(ctx)
    ctx.pdf.save('icmsf-report.pdf')
  }

  const runPNG = () => {
    if (!isLoggedIn) { goToLogin('icmsf', 'png'); return }
    const chart = riskRef.current ?? ocRef.current
    if (!chart) return
    const a = document.createElement('a')
    a.href = chart.toBase64Image('image/png', 1)
    a.download = 'icmsf-curve.png'
    a.click()
  }
  const charts = () => [ocRef.current, riskRef.current]
  const exportExcel = () => (isPro ? withWatermarksDisabled(charts(), runExcel) : runExcel())
  const exportPDF = () => (isPro ? withWatermarksDisabled(charts(), runPDF) : runPDF())
  const exportPNG = () => (isLoggedIn ? withWatermarksDisabled(charts(), runPNG) : runPNG())

  const helpSteps = [1, 2, 3, 4].map(k => ({ t: t(`icmsf_help_s${k}_t` as TKey), d: t(`icmsf_help_s${k}_d` as TKey) }))
  const mBad = mode === 'count' && body.m === null
  const MBad = three && body.m !== null && body.M !== null && body.M <= body.m
  const cells = resultsFor(n)

  return (
    <div style={s.page}>
      <ToolStyles />
      <style>{`
        .ic-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
        .ic-grid label > span, .ic-f > span { display: block; font-size: 12px; color: var(--qh-muted); margin-bottom: 4px; }
        .ic-sel { width: 100%; box-sizing: border-box; background: color-mix(in srgb, var(--qh-bg) 70%, var(--qh-surface)); border: 1px solid var(--qh-border); border-radius: 7px; color: var(--qh-text); padding: 8px 10px; font: inherit; font-size: 14px; outline: none; }
        .ic-ex { font-size: 12px; color: var(--qh-muted); margin-top: 6px; line-height: 1.6; }
        .ic-plan { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
        .ic-plan > div { background: var(--qh-surface2); border-radius: 8px; padding: 8px 14px; min-width: 84px; }
        .ic-plan small { display: block; font-size: 12px; color: var(--qh-muted); }
        .ic-plan b { font: 700 20px ui-monospace, 'SF Mono', Menlo, monospace; }
        .ic-why { font-size: 13px; line-height: 1.7; margin-top: 10px; }
        .ic-seg { display: inline-flex; border: 1px solid var(--qh-border); border-radius: 8px; overflow: hidden; }
        .ic-seg button { border: 0; background: transparent; color: var(--qh-text); font: inherit; font-size: 13px; font-weight: 600; padding: 8px 14px; cursor: pointer; }
        .ic-seg button[aria-pressed="true"] { background: var(--qh-accent); color: var(--qh-onAccent); }
        .ic-limits { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 12px; }
        .ic-units { display: grid; grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); gap: 8px; margin-top: 8px; }
        .ic-unit { border: 1px solid var(--qh-border); border-radius: 8px; padding: 6px 8px; background: var(--qh-bg); }
        .ic-unit small { display: block; font-size: 11px; color: var(--qh-muted); }
        .ic-unit input { width: 100%; box-sizing: border-box; background: transparent; border: 0; outline: none; color: var(--qh-text); font: 600 14px ui-monospace, 'SF Mono', Menlo, monospace; padding: 2px 0; text-align: end; }
        .ic-unit span { display: block; font-size: 11px; font-weight: 700; }
        .ic-row { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-top: 10px; font-size: 13px; }
        .ic-row input { width: 90px; }
        @media (max-width: 768px) { .ic-grid, .ic-limits { grid-template-columns: minmax(0, 1fr); } }
      `}</style>
      <Nav theme={theme} setTheme={setTheme} breadcrumbKey="bc_icmsf" />

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
        <ToolSidebar current="/icmsf" />

        <div className="tl-main">
          <ToolHeader title={t('icmsf_title')} intro={t('icmsf_intro')} onHelp={() => setHelpOpen(true)} onExample={loadExample} />
          <HelpPanel open={helpOpen} onClose={() => setHelpOpen(false)} title={t('icmsf_help_title')} steps={helpSteps} onExample={loadExample} showCapability={false} tip={t('icmsf_help_tip')} />
          <PhoneTabs tab={mobileTab} onTab={setMobileTab} dataCount={n || null} hideSetup />

          {/* ── DATA: plan, limits, results ───────────────────────────── */}
          <section className="tl-panel" data-active={mobileTab === 'data'} aria-label={t('spc_tab_data')} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="tl-card">
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>{t('icmsf_plan_title')}</div>
              <div className="ic-grid">
                <label>
                  <span>{t('icmsf_hazard')}</span>
                  <select className="ic-sel" value={inp.hazard} onChange={e => set({ hazard: e.target.value as HazardLevel })}>
                    {HAZARD_LEVEL_ORDER.map(h => <option key={h} value={h}>{t(`icmsf_hazard_${h}` as TKey)}</option>)}
                  </select>
                  <div className="ic-ex">{t('icmsf_examples').replace('{list}', examples(inp.hazard))}</div>
                </label>
                <label>
                  <span>{t('icmsf_condition')}</span>
                  <select className="ic-sel" value={inp.condition} onChange={e => set({ condition: e.target.value as ConditionEffect })}>
                    {CONDITION_EFFECT_ORDER.map(cd => <option key={cd} value={cd}>{t(`icmsf_cond_${cd}` as TKey)}</option>)}
                  </select>
                </label>
              </div>
              {r && (
                <>
                  <div className="ic-plan" aria-live="polite">
                    <div><small>{t('icmsf_case')}</small><b>{r.caseNumber}</b></div>
                    <div><small>{t('icmsf_plan_class')}</small><b>{ltr(t(r.planClass === 3 ? 'icmsf_class_3' : 'icmsf_class_2'))}</b></div>
                    <div><small>n · c</small><b>{ltr(`${r.n} · ${r.c}`)}</b></div>
                  </div>
                  <div className="ic-why">{why(translations[lang])}</div>
                </>
              )}
              <div className="tl-hint">{t('icmsf_sensitive')}</div>
            </div>

            {r && (
              <div className="tl-card">
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>{t('icmsf_results_title')}</div>
                {!three && (
                  <div className="ic-f">
                    <span>{t('icmsf_mode')}</span>
                    <div className="ic-seg" role="group" aria-label={t('icmsf_mode')}>
                      <button type="button" aria-pressed={inp.mode === 'presence'} onClick={() => set({ mode: 'presence' })}>{t('icmsf_mode_presence')}</button>
                      <button type="button" aria-pressed={inp.mode === 'count'} onClick={() => set({ mode: 'count' })}>{t('icmsf_mode_count')}</button>
                    </div>
                  </div>
                )}
                {mode === 'presence' ? (
                  <div className="ic-limits">
                    <label className="tl-field"><span>{t('icmsf_unit_weight')}</span><input value={inp.weight} placeholder={t('icmsf_unit_weight_ph')} onChange={e => set({ weight: e.target.value })} /></label>
                    <label className="tl-field"><span>{t('icmsf_positives')}</span><input type="number" min={0} max={n} step={1} value={inp.positives} placeholder="—" onChange={e => set({ positives: e.target.value })} /></label>
                    <div className="ic-f"><span>m</span><div style={{ fontSize: 14, paddingTop: 8 }}>{t('icmsf_presence_line').replace('m = ', '').replace('{w}', inp.weight || '25 g')}</div></div>
                  </div>
                ) : (
                  <>
                    <div className="ic-limits">
                      <label className="tl-field"><span>{t('icmsf_m')} · {t(three ? 'icmsf_m_help_3' : 'icmsf_m_help_2')}</span><input inputMode="decimal" value={inp.m} onChange={e => set({ m: e.target.value })} /></label>
                      {three && <label className="tl-field"><span>{t('icmsf_M')} · {t('icmsf_M_help')}</span><input inputMode="decimal" value={inp.M} onChange={e => set({ M: e.target.value })} /></label>}
                      <label><span style={{ display: 'block', fontSize: 11, color: 'var(--qh-muted)', marginBottom: 3 }}>{t('icmsf_unit')}</span>
                        <select className="ic-sel" value={inp.unit} onChange={e => set({ unit: e.target.value as Unit })}>{UNITS.map(u => <option key={u} value={u}>{u}</option>)}</select>
                      </label>
                    </div>
                    <div className="tl-hint">{t('icmsf_limits_from')}</div>
                    {mBad && <div className="tl-error" style={{ marginTop: 10 }}>{t('icmsf_err_m')}</div>}
                    {MBad && <div className="tl-error" style={{ marginTop: 10 }}>{t('icmsf_err_limits')}</div>}
                    <div style={{ fontSize: 13, fontWeight: 600, marginTop: 14 }}>{t('icmsf_units_title').replace('{unit}', inp.unit)}</div>
                    <div className="ic-units">
                      {cells.map((v, i) => {
                        const u = r.units[i] ?? null
                        return (
                          <div key={i} className="ic-unit" style={u ? { borderColor: tint(clsColor(u), 55), background: tint(clsColor(u), 8) } : undefined}>
                            <small>#{i + 1}</small>
                            <input inputMode="decimal" value={v} placeholder="—" aria-label={`#${i + 1}`} onChange={e => setResult(i, e.target.value)} />
                            <span style={{ color: clsColor(u) }}>{u ? clsLabel(u) : ' '}</span>
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
          </section>

          {/* ── RESULTS ──────────────────────────────────────────────── */}
          <section className="tl-panel tl-results" data-active={mobileTab === 'results'} aria-label={t('spc_tab_results')}>
            {failed && <div className="tl-error">{failed === 'rate' ? t('icmsf_rate') : t('icmsf_failed')}</div>}
            {!r ? (
              <div className="tl-card tl-empty">{pending ? t('icmsf_loading') : t('icmsf_empty')}</div>
            ) : (
              <>
                <div className="tl-verdicts">
                  <div className="tl-verdict" style={{ background: tint(decisionColor, 8), border: `1px solid ${tint(decisionColor, 35)}` }}>
                    <span className="tl-verdict-icon" aria-hidden="true" style={{ background: tint(decisionColor, 16), color: decisionColor }}>{r.decision === 'accept' ? '✓' : r.decision === 'reject' ? '✕' : '…'}</span>
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--qh-muted)', marginBottom: 2 }}>{ltr(`Case ${r.caseNumber} · ${r.planClass}-class · n ${r.n} · c ${r.c}`)} · {mode === 'presence' ? limitsText(translations[lang]) : ltr(limitsText(EN))}</div>
                      <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 4, color: decisionColor }}>{headline(translations[lang])}</div>
                      <div style={{ fontSize: 13, color: 'var(--qh-muted)', lineHeight: 1.6 }}>{sub(translations[lang])}</div>
                    </div>
                  </div>
                </div>

                <div className="tl-results-head">
                  <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{t('spc_tab_results')}</h2>
                  <ExportRow
                    isPro={isPro}
                    isLoggedIn={isLoggedIn}
                    hasResult={!!r}
                    onCSV={exportCSV}
                    onPNG={exportPNG}
                    onExcel={exportExcel}
                    onPDF={exportPDF}
                    pngLabel={t('icmsf_x_png')}
                    pngDisabled={!r.oc && !risk.r}
                    save={
                      <SaveAnalysisButton
                        theme={theme}
                        tool="icmsf"
                        defaultName={`ICMSF — ${new Date().toLocaleDateString('en-US')}`}
                        compact={compactSave}
                        getPayload={() => ({
                          input_data: { hazard: inp.hazard, condition: inp.condition, mode, unit: inp.unit, weight: inp.weight, m: body.m, M: body.M, positives: body.positives, results: body.results.slice(0, n), riskP: body.riskP, sd: inp.sd, point: inp.point },
                          results: { plan: r, risk: risk.r ? { accept95: risk.r.accept95, reject95: risk.r.reject95, point: risk.r.point } : null },
                        })}
                      />
                    }
                  />
                </div>

                {ocData && (
                  <div className="tl-chart">
                    <h3>{t('icmsf_oc_title')}</h3>
                    <div className="tl-chart-sub">{t('icmsf_oc_sub')}</div>
                    <div className="tl-chart-inner" style={{ height: 280 }}>
                      <Chart ref={ocRef} type="line" data={ocData} options={chartOptions(t('icmsf_oc_x'), 0, 100, v => `${Math.round(v)}%`, 20)} />
                    </div>
                    <div className="ic-row">
                      <label>{t('icmsf_check_label')} <input className="tl-input" type="number" min={0} max={100} step={1} value={inp.riskP} onChange={e => set({ riskP: e.target.value })} /></label>
                      {r.riskPa !== null && <span>{t('icmsf_check').replace('{p}', ltr(fixed(body.riskP, 1))).replace('{pa}', ltr(pct(r.riskPa)))}</span>}
                    </div>
                  </div>
                )}

                <div className="tl-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{t('icmsf_risk_title')}</span>
                    <span className="tl-pro">PRO</span>
                  </div>
                  <div className="tl-chart-sub" style={{ fontSize: 12, color: 'var(--qh-muted)', marginBottom: 12 }}>{t('icmsf_risk_sub')}</div>
                  {mode === 'presence' ? (
                    <div style={{ fontSize: 13, color: 'var(--qh-muted)' }}>{t('icmsf_risk_presence')}</div>
                  ) : !isPro ? (
                    <>
                      <p aria-hidden="true" style={{ margin: 0, fontSize: 14, lineHeight: 1.8, opacity: 0.45, userSelect: 'none' }}>{t('icmsf_risk_sample')}</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 10 }}>
                        <span style={{ fontSize: 13, color: 'var(--qh-muted)' }}>{t('icmsf_risk_locked')}</span>
                        <button type="button" className="tl-xbtn tl-xbtn-pro" onClick={() => goToPricing('icmsf', 'insight')}>{t('oee_next_getpro')}</button>
                      </div>
                    </>
                  ) : !riskBody ? (
                    <div style={{ fontSize: 13, color: 'var(--qh-muted)' }}>{t('icmsf_risk_need')}</div>
                  ) : (
                    <>
                      <div className="ic-row" style={{ marginTop: 0 }}>
                        <label>{t('icmsf_sd')} <input className="tl-input" inputMode="decimal" value={inp.sd} onChange={e => set({ sd: e.target.value })} /></label>
                        <label>{t('icmsf_point').replace('{unit}', inp.unit)} <input className="tl-input" inputMode="decimal" value={inp.point} placeholder={countText((body.m ?? 10) / 10)} onChange={e => set({ point: e.target.value })} /></label>
                      </div>
                      <div className="tl-hint">{t('icmsf_sd_help')}</div>
                      {risk.failed && <div className="tl-error" style={{ marginTop: 10 }}>{t('icmsf_risk_error')}</div>}
                      {riskData && (
                        <div className="tl-chart-inner" style={{ height: 280, marginTop: 12 }}>
                          <Chart ref={riskRef} type="line" data={riskData} options={chartOptions(t('icmsf_risk_x').replace('{unit}', inp.unit), riskMin, riskMax, v => fixed(v, 1), 1)} />
                        </div>
                      )}
                      {riskLines(translations[lang]).map((l, i) => <p key={i} style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.7 }}>{l}</p>)}
                    </>
                  )}
                </div>

                <details className="tl-more">
                  <summary>{t('icmsf_method_title')}</summary>
                  <div className="tl-more-body">
                    {(['icmsf_method_1', 'icmsf_method_2', 'icmsf_method_3', 'icmsf_method_4'] as TKey[]).map(k => <p key={k} style={{ margin: 0, fontSize: 13, lineHeight: 1.7 }}>{t(k)}</p>)}
                  </div>
                </details>
              </>
            )}
          </section>
        </div>
      </div>

      <PhoneBar
        showResultActions={mobileTab === 'results' && !!r}
        onAnalyze={() => { setMobileTab('results'); window.scrollTo({ top: 0 }) }}
        onEdit={() => setMobileTab('data')}
        analyzeLabel={t('icmsf_bar_results')}
      />
    </div>
  )
}
