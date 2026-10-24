'use client'

import { useEffect, useState } from 'react'
import { COLORS, getSharedStyles, usePersistedTheme, tint } from '@/lib/theme'
import Nav from '@/components/Nav'
import ToolSidebar from '@/components/ToolSidebar'
import ToolStyles from '@/components/tool/ToolStyles'
import { ToolHeader, HelpPanel, PhoneTabs, PhoneBar, ExportRow, useCompactSave, type MobileTab } from '@/components/tool/ToolParts'
import SaveAnalysisButton from '@/components/SaveAnalysisButton'
import { useSubscription } from '@/lib/useSubscription'
import { goToLogin, goToPricing } from '@/lib/exportGate'
import { useLanguage } from '@/lib/i18n/context'
import { translations, type TKey } from '@/lib/i18n/translations'
import { createReport, nowStamp, type Tone } from '@/lib/excelReport'
import { createReport as createPdfReport, addSignOff, calloutBox, dataTable, finalizeReport, REPORT_COLORS } from '@/lib/pdf/reportDesign'
import {
  AQL_OPTIONS, LEVELS, TYPES, MIN_LOT_SIZE, MAX_LOT_SIZE, MAX_STAGES, MAX_CLASSES, DEFAULT_DEFECT_CLASSES, levelName,
  type InspectionLevel, type InspectionType, type AqlStageRequest, type AqlStageResult, type Decision,
} from '@/lib/aql/options'

// ─────────────────────────────────────────────────────────────────────────
// AQL page on the shared tool layout. The ISO 2859-1:2026 tables and the
// plan lookup run on the server (/api/aql); this page sends the stages and
// draws the reply. Each defect class gets its own plan; the lot decision
// follows 11.2 (found ≤ Ac accepted, found ≥ Re not accepted).
// ─────────────────────────────────────────────────────────────────────────

interface ClassRow { id: string; name: string; aql: number; found: string }
interface Stage { id: string; name: string; lotSize: string; level: InspectionLevel; type: InspectionType; classes: ClassRow[] }

const newId = () => Math.random().toString(36).slice(2, 9)
const EN = translations.en

/** AQL as printed in the tables: 0.010, 0.10, 1.0 */
const aqlText = (v: number) => (v >= 1 ? v.toFixed(1) : v >= 0.1 ? v.toFixed(2) : v.toFixed(3))
const int = (v: number) => v.toLocaleString('en-US')
const ltr = (v: string) => `⁦${v}⁩`
const csvCell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`

function parseLot(v: string): number {
  const n = Number(v.trim())
  return Number.isInteger(n) && n >= 0 && n <= MAX_LOT_SIZE ? n : 0
}
function parseFound(v: string): number | null {
  if (v.trim() === '') return null
  const n = Number(v.trim())
  return Number.isInteger(n) && n >= 0 && n <= MAX_LOT_SIZE ? n : null
}

const exampleStages = (): Stage[] => [{
  id: newId(), name: '', lotSize: '1000', level: 'II', type: 'Normal',
  classes: [
    { id: newId(), name: 'Critical', aql: 0.065, found: '0' },
    { id: newId(), name: 'Major', aql: 2.5, found: '3' },
    { id: newId(), name: 'Minor', aql: 4.0, found: '9' },
  ],
}]
const blankStage = (): Stage => ({
  id: newId(), name: '', lotSize: '1000', level: 'II', type: 'Normal',
  classes: DEFAULT_DEFECT_CLASSES.map(d => ({ id: newId(), name: d.name, aql: d.aql, found: '' })),
})

/** Saved projects: new shape { stages } or the old array of rows */
function fromSaved(input: unknown): Stage[] | null {
  const list = Array.isArray(input) ? input : (input as { stages?: unknown })?.stages
  if (!Array.isArray(list)) return null
  const stages = list.map((r: Record<string, unknown>) => {
    const classes = (r.classes ?? r.defects) as Record<string, unknown>[] | undefined
    return {
      id: newId(),
      name: String(r.name ?? r.stageName ?? ''),
      lotSize: String(r.lotSize ?? ''),
      level: (LEVELS.includes(r.level as InspectionLevel) ? r.level : 'II') as InspectionLevel,
      type: (TYPES.includes((r.type ?? r.inspectionType) as InspectionType) ? (r.type ?? r.inspectionType) : 'Normal') as InspectionType,
      classes: (classes ?? []).map(c => ({
        id: newId(),
        name: String(c.name ?? ''),
        aql: AQL_OPTIONS.includes(c.aql as never) ? (c.aql as number) : 2.5,
        found: c.found === null || c.found === undefined ? '' : String(c.found),
      })),
    }
  })
  return stages.length ? stages.slice(0, MAX_STAGES) : null
}

// ── Server call: plans + decisions for every stage ──
interface Reply { key: string; stages: AqlStageResult[] | null; why: 'rate' | 'error' | null }

function useAqlPlans(requests: AqlStageRequest[]) {
  const key = JSON.stringify(requests)
  const [reply, setReply] = useState<Reply | null>(null)
  useEffect(() => {
    const ctrl = new AbortController()
    const timer = setTimeout(() => {
      fetch('/api/aql', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stages: JSON.parse(key) }), signal: ctrl.signal })
        .then(async res => {
          if (!res.ok) { setReply({ key, stages: null, why: res.status === 429 ? 'rate' : 'error' }); return }
          const json = (await res.json()) as { stages: AqlStageResult[] }
          setReply({ key, stages: json.stages, why: null })
        })
        .catch(() => { if (!ctrl.signal.aborted) setReply({ key, stages: null, why: 'error' }) })
    }, 200)
    return () => { clearTimeout(timer); ctrl.abort() }
  }, [key])
  const current = reply && reply.key === key ? reply : null
  // keep showing the last reply while a new one is on its way, so the numbers don't flicker
  const shown = current ?? (reply?.stages && reply.stages.length === requests.length ? reply : null)
  return { stages: shown?.stages ?? null, pending: current === null, failed: current?.why ?? null }
}

export default function AQLCalculator() {
  const { isPro, isLoggedIn } = useSubscription()
  const [theme, setTheme] = usePersistedTheme()
  const { t, lang } = useLanguage()
  const c = COLORS[theme]
  const s = getSharedStyles(theme)
  const compactSave = useCompactSave()

  const [stages, setStages] = useState<Stage[]>(() => exampleStages())
  const [mobileTab, setMobileTab] = useState<MobileTab>('data')
  const [helpOpen, setHelpOpen] = useState(false)
  const [loadedProjectName, setLoadedProjectName] = useState('')
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id')
    if (!id) return
    fetch(`/api/saved-analyses/${id}`)
      .then(res => (res.ok ? res.json() : Promise.reject()))
      .then(({ analysis }) => {
        const loaded = fromSaved(analysis.input_data)
        if (!loaded) throw new Error('shape')
        setStages(loaded)
        setLoadedProjectName(analysis.name as string)
      })
      .catch(() => setLoadError(lang === 'ar' ? 'تعذر تحميل المشروع المحفوظ.' : 'Could not load the saved project.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Results from the server ──
  const requests: AqlStageRequest[] = stages.map(st => ({
    lotSize: parseLot(st.lotSize),
    level: st.level,
    inspectionType: st.type,
    classes: st.classes.map(cl => ({ aql: cl.aql, found: parseFound(cl.found) })),
  }))
  const { stages: results, pending, failed } = useAqlPlans(requests)
  const ready = results !== null && results.length === stages.length
  const view = ready ? stages.map((st, i) => ({ st, r: results![i], req: requests[i] })) : []
  const anyPlan = view.some(v => !v.r.error && v.r.classes.length > 0)

  // ── Editing ──
  const patchStage = (id: string, p: Partial<Stage>) => setStages(prev => prev.map(st => (st.id === id ? { ...st, ...p } : st)))
  const patchClass = (sid: string, cid: string, p: Partial<ClassRow>) =>
    setStages(prev => prev.map(st => (st.id === sid ? { ...st, classes: st.classes.map(cl => (cl.id === cid ? { ...cl, ...p } : cl)) } : st)))
  const addClass = (sid: string) =>
    setStages(prev => prev.map(st => (st.id === sid && st.classes.length < MAX_CLASSES ? { ...st, classes: [...st.classes, { id: newId(), name: t('aql_class_new'), aql: 1.0, found: '' }] } : st)))
  const removeClass = (sid: string, cid: string) => setStages(prev => prev.map(st => (st.id === sid ? { ...st, classes: st.classes.filter(cl => cl.id !== cid) } : st)))
  const addStage = () => setStages(prev => (prev.length < MAX_STAGES ? [...prev, blankStage()] : prev))
  const removeStage = (id: string) => setStages(prev => prev.filter(st => st.id !== id))
  const loadExample = () => { setStages(exampleStages()); setMobileTab('results') }

  // ── Words for one stage (UI language or English for exports) ──
  type Dict = Readonly<Record<string, string>>
  const say = (d: Dict, k: TKey) => d[k]
  const stageNotes = (d: Dict, v: (typeof view)[number]) => {
    const notes: string[] = []
    v.r.classes.forEach((cr, i) => {
      const cls = v.st.classes[i]?.name || `#${i + 1}`
      if (cr.letter !== v.r.codeLetter) notes.push(say(d, 'aql_note_redirect').replace('{cls}', cls).replace('{from}', v.r.codeLetter ?? '').replace('{aql}', aqlText(v.req.classes[i].aql)).replace('{to}', cr.letter).replace('{n}', int(cr.n)))
      if (cr.fullLot) notes.push(say(d, 'aql_note_full').replace('{cls}', cls).replace('{n}', int(cr.n)).replace('{lot}', int(v.req.lotSize)))
    })
    const sizes = new Set(v.r.classes.map(cr => cr.inspect))
    if (sizes.size > 1) notes.push(say(d, 'aql_note_mixed').replace('{n}', int(Math.max(...sizes))))
    return notes
  }
  const lotSub = (d: Dict, v: (typeof view)[number]) => {
    if (v.r.lot === 'accept') return say(d, 'aql_lot_accept_sub')
    if (v.r.lot === 'reject') {
      const list = v.r.classes
        .map((cr, i) => ({ cr, i }))
        .filter(x => x.cr.decision === 'reject')
        .map(x => say(d, 'aql_reject_item').replace('{cls}', v.st.classes[x.i]?.name || `#${x.i + 1}`).replace('{found}', String(v.req.classes[x.i].found)).replace('{re}', String(x.cr.re)))
        .join(' · ')
      return say(d, 'aql_lot_reject_sub').replace('{list}', list)
    }
    return say(d, 'aql_lot_pending_sub')
  }
  const nextLot = (d: Dict, v: (typeof view)[number]) => (v.r.lot ? `${say(d, 'aql_next')} ${say(d, `aql_next_${v.st.type}_${v.r.lot}` as TKey)}` : null)
  const decisionColor = (dc: Decision | null) => (dc === 'accept' ? 'var(--qh-good)' : dc === 'reject' ? 'var(--qh-danger)' : 'var(--qh-muted)')
  /** stage name, or the default one when left empty (first stage = incoming inspection) */
  const nameOf = (name: string, i: number, d: Dict) => name.trim() || (i === 0 ? d.aql_stage_default : d.aql_stage_n.replace('{n}', String(i + 1)))
  const stageTitle = (v: (typeof view)[number], i: number) => nameOf(v.st.name, i, EN)

  // ── Flat rows for every export (English) ──
  const flat = view.flatMap((v, i) =>
    v.r.error
      ? []
      : v.r.classes.map((cr, j) => ({
          stageIndex: i,
          stage: stageTitle(v, i), lot: v.req.lotSize, level: levelName(v.st.level), type: v.st.type, code: v.r.codeLetter ?? '',
          cls: v.st.classes[j]?.name || `#${j + 1}`, aql: aqlText(v.req.classes[j].aql), letter: cr.letter, n: cr.n, inspect: cr.inspect,
          ac: cr.ac, re: cr.re, found: v.req.classes[j].found, result: cr.decision === 'accept' ? 'Accept' : cr.decision === 'reject' ? 'Not accepted' : '',
          lotResult: v.r.lot === 'accept' ? 'Accepted' : v.r.lot === 'reject' ? 'Not accepted' : '', decision: cr.decision,
        })),
  )
  const RULES = (['NT', 'TN', 'TS', 'NR', 'RN', 'RS', 'SN'] as const).map(k => ({ t: `aql_rule_${k}_t` as TKey, d: `aql_rule_${k}_d` as TKey }))

  const exportCSV = () => {
    if (!isLoggedIn) { goToLogin('aql', 'csv'); return }
    if (!flat.length) return
    const lines = [
      'Stage,Lot Size,Level,Inspection,Code Letter,Defect Class,AQL %,Plan Letter,Plan Sample (n),Sample to Inspect,Ac,Re,Found,Result,Lot Result',
      ...flat.map(r => [csvCell(r.stage), r.lot, r.level, r.type, r.code, csvCell(r.cls), r.aql, r.letter, r.n, r.inspect, r.ac, r.re, r.found ?? '', r.result, r.lotResult].join(',')),
    ]
    const blob = new Blob(['\uFEFF', lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'aql-sampling-plan.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportExcel = async () => {
    if (!isPro) { goToPricing('aql', 'excel'); return }
    if (!flat.length) return
    const report = createReport({ toolName: 'AQL Sampling Plan' })
    const sh = report.addSheet('Sampling Plan')
    sh.titleBand('AQL Sampling Plan & Lot Decision', `${view.length} inspection stage${view.length === 1 ? '' : 's'} · ISO 2859-1:2026 single sampling`)
    sh.metaStrip([
      ['Generated on', nowStamp()],
      ['Standard', 'ISO 2859-1:2026, Tables 1 to 4 · decision per 11.2: found <= Ac accepted, found >= Re not accepted'],
    ])
    sh.sectionHeading('Lot Decision')
    sh.kpiRow(view.filter(v => !v.r.error).map((v, i) => ({
      label: stageTitle(v, i),
      value: v.r.lot === 'accept' ? 'Accepted' : v.r.lot === 'reject' ? 'Not accepted' : 'Not entered',
      tone: (v.r.lot === 'accept' ? 'good' : v.r.lot === 'reject' ? 'danger' : 'neutral') as Tone,
    })))
    view.forEach((v, i) => { if (!v.r.error) sh.note(`${stageTitle(v, i)}: ${lotSub(EN, v)}${nextLot(EN, v) ? ` ${nextLot(EN, v)}` : ''}`, v.r.lot === 'accept' ? 'good' : v.r.lot === 'reject' ? 'danger' : 'neutral') })
    sh.sectionHeading('Sampling Plan Detail')
    sh.table({
      headers: [
        { header: 'Stage', key: 'stage', align: 'left', width: 20 },
        { header: 'Lot Size', key: 'lot', align: 'right', numFmt: '#,##0' },
        { header: 'Level', key: 'level', align: 'center' },
        { header: 'Inspection', key: 'type', align: 'center', width: 12 },
        { header: 'Code Letter', key: 'code', align: 'center' },
        { header: 'Defect Class', key: 'cls', align: 'left', width: 16 },
        { header: 'AQL %', key: 'aql', align: 'right' },
        { header: 'Plan Letter', key: 'letter', align: 'center' },
        { header: 'Plan Sample (n)', key: 'n', align: 'right', numFmt: '#,##0', width: 14 },
        { header: 'Sample to Inspect', key: 'inspect', align: 'right', numFmt: '#,##0', width: 15 },
        { header: 'Ac', key: 'ac', align: 'center' },
        { header: 'Re', key: 're', align: 'center' },
        { header: 'Found', key: 'found', align: 'center' },
        { header: 'Result', key: 'result', align: 'left', width: 14 },
      ],
      rows: flat.map(r => ({ ...r, found: r.found ?? '' })),
      rowTones: flat.map(r => (r.decision === 'reject' ? 'danger' : r.decision === 'accept' ? 'good' : undefined)),
    })
    const notes = view.flatMap(v => (v.r.error ? [] : stageNotes(EN, v)))
    notes.forEach(n => sh.note(n, 'warning'))
    sh.sectionHeading('Switching Rules (ISO 2859-1:2026, 9.3 to 9.5)')
    sh.table({
      headers: [
        { header: 'Switch', key: 'rule', align: 'left', width: 28 },
        { header: 'When', key: 'when', align: 'left', width: 90 },
      ],
      rows: [...RULES.map(r => ({ rule: say(EN, r.t), when: say(EN, r.d) })), { rule: EN.aql_score_t, when: EN.aql_score_d }],
    })
    sh.freezeHeader(2)
    await report.download('aql-sampling-plan.xlsx')
  }

  const exportPDF = () => {
    if (!isPro) { goToPricing('aql', 'pdf'); return }
    if (!flat.length) return
    const ctx = createPdfReport('AQL Sampling Plan & Lot Decision', 'aql')
    view.forEach((v, i) => {
      if (v.r.error) return
      const head = v.r.lot === 'accept' ? EN.aql_lot_accept : v.r.lot === 'reject' ? EN.aql_lot_reject : EN.aql_lot_pending
      const next = nextLot(EN, v)
      calloutBox(ctx, `${stageTitle(v, i)} (lot ${int(v.req.lotSize)}, level ${levelName(v.st.level)}, ${v.st.type}, code letter ${v.r.codeLetter}): ${head}. ${lotSub(EN, v)}${next ? ` ${next}` : ''}`, v.r.lot === 'accept' ? 'good' : v.r.lot === 'reject' ? 'bad' : 'info')
    })
    const w = ctx.pageWidth - ctx.margin * 2
    const tone = (d: Decision | null) => (d === 'accept' ? REPORT_COLORS.good : d === 'reject' ? REPORT_COLORS.bad : null)
    // one table per stage: the stage details go in the title, not in every row
    view.forEach((v, i) => {
      if (v.r.error) return
      const rows = flat.filter(r => r.stageIndex === i)
      dataTable(
        ctx,
        `${stageTitle(v, i)} · lot ${int(v.req.lotSize)} · level ${levelName(v.st.level)} · ${v.st.type} · code letter ${v.r.codeLetter}`,
        [
          { header: 'CLASS', width: w - 356 },
          { header: 'AQL %', width: 50, align: 'right' },
          { header: 'LETTER', width: 50, align: 'center' },
          { header: 'SAMPLE (n)', width: 64, align: 'right' },
          { header: 'AC', width: 34, align: 'right' },
          { header: 'RE', width: 34, align: 'right' },
          { header: 'FOUND', width: 50, align: 'right' },
          { header: 'RESULT', width: 74 },
        ],
        rows.map(r => [r.cls, r.aql, r.letter, `${int(r.inspect)}${r.inspect < r.n ? ' (100%)' : ''}`, String(r.ac), String(r.re), r.found === null ? '-' : String(r.found), r.result || '-']),
        { cellColors: rows.map(r => [null, null, null, null, null, null, null, tone(r.decision)]) },
      )
      const notes = stageNotes(EN, v)
      if (notes.length) calloutBox(ctx, notes.join(' '), 'warn')
    })
    calloutBox(ctx, EN.aql_source, 'info')
    // signature under the results; the switching rules are reference material after it
    addSignOff(ctx)
    dataTable(
      ctx,
      'Reference: Switching Rules (ISO 2859-1:2026, 9.3 to 9.5)',
      [{ header: 'SWITCH', width: 130 }, { header: 'WHEN', width: w - 130 }],
      [...RULES.map(r => [say(EN, r.t).replace('→', 'to'), say(EN, r.d)]), [EN.aql_score_t, EN.aql_score_d]],
    )
    finalizeReport(ctx)
    ctx.pdf.save('aql-report.pdf')
  }

  // PNG: the plan table drawn as an image (white, like the reports)
  const exportPNG = () => {
    if (!isLoggedIn) { goToLogin('aql', 'png'); return }
    if (!flat.length) return
    const cols = [
      { h: 'Stage', w: 170 }, { h: 'Lot', w: 70 }, { h: 'Level', w: 50 }, { h: 'Class', w: 110 }, { h: 'AQL %', w: 60 },
      { h: 'Letter', w: 55 }, { h: 'Sample (n)', w: 85 }, { h: 'Ac', w: 40 }, { h: 'Re', w: 40 }, { h: 'Found', w: 55 }, { h: 'Result', w: 105 },
    ]
    const width = cols.reduce((a, b) => a + b.w, 0) + 40
    const rowH = 28
    const height = 96 + rowH * (flat.length + 1) + 30
    const scale = 2
    const canvas = document.createElement('canvas')
    canvas.width = width * scale
    canvas.height = height * scale
    const g = canvas.getContext('2d')
    if (!g) return
    g.scale(scale, scale)
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, width, height)
    g.fillStyle = '#0f172a'
    g.font = 'bold 18px system-ui, sans-serif'
    g.fillText('AQL Sampling Plan & Lot Decision', 20, 36)
    g.fillStyle = '#64748b'
    g.font = '12px system-ui, sans-serif'
    g.fillText(`ISO 2859-1:2026 single sampling · ${nowStamp()}`, 20, 58)
    let y = 76
    g.fillStyle = '#f1f5f9'
    g.fillRect(20, y, width - 40, rowH)
    g.fillStyle = '#334155'
    g.font = 'bold 12px system-ui, sans-serif'
    let x = 20
    cols.forEach(col => { g.fillText(col.h, x + 6, y + 18); x += col.w })
    y += rowH
    g.font = '12px system-ui, sans-serif'
    flat.forEach(r => {
      const cells = [r.stage, int(r.lot), r.level, r.cls, r.aql, r.letter, int(r.inspect), String(r.ac), String(r.re), r.found === null ? '-' : String(r.found), r.result || '-']
      x = 20
      cells.forEach((v, ci) => {
        g.fillStyle = ci === 10 && r.decision ? (r.decision === 'accept' ? '#15803d' : '#b91c1c') : '#0f172a'
        let text = v
        while (g.measureText(text).width > cols[ci].w - 10 && text.length > 1) text = text.slice(0, -1)
        g.fillText(text, x + 6, y + 18)
        x += cols[ci].w
      })
      g.strokeStyle = '#e2e8f0'
      g.beginPath(); g.moveTo(20, y + rowH); g.lineTo(width - 20, y + rowH); g.stroke()
      y += rowH
    })
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = 'aql-sampling-plan.png'
    a.click()
  }

  // ── Page ──
  const helpSteps = [1, 2, 3, 4].map(k => ({ t: t(`aql_help_s${k}_t` as TKey), d: t(`aql_help_s${k}_d` as TKey) }))
  const resultFor = (i: number) => (ready ? results![i] : null)

  return (
    <div style={s.page}>
      <ToolStyles />
      <style>{`
        .aq-fields { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-bottom: 14px; }
        .aq-fields label > span, .aq-letter > span { display: block; font-size: 12px; color: var(--qh-muted); margin-bottom: 4px; }
        .aq-fields select { width: 100%; box-sizing: border-box; background: color-mix(in srgb, var(--qh-bg) 70%, var(--qh-surface)); border: 1px solid var(--qh-border); border-radius: 7px; color: var(--qh-text); padding: 8px 10px; font: inherit; font-size: 14px; outline: none; }
        .aq-letter { background: var(--qh-surface2); border-radius: 8px; padding: 6px 12px; }
        .aq-letter b { font: 700 20px ui-monospace, 'SF Mono', Menlo, monospace; }
        .aq-letter small { color: var(--qh-muted); font-size: 12px; margin-inline-start: 6px; }
        .aq-name::placeholder { color: var(--qh-text); opacity: 1; }
        .aq-name-wrap { flex: 0 1 auto; min-width: 0; max-width: 100%; margin-inline-end: auto; display: inline-flex; align-items: center; gap: 8px; cursor: text; border-bottom: 1px dashed var(--qh-border); padding-bottom: 2px; }
        .aq-name-wrap:focus-within { border-bottom-color: var(--qh-accent); }
        .aq-name { field-sizing: content; background: transparent; border: 0; color: var(--qh-text); font: inherit; font-size: 16px; font-weight: 700; outline: none; padding: 2px 0; min-width: 0; max-width: 100%; }
        .aq-pen { color: var(--qh-muted); font-size: 15px; }
        .aq-name-wrap:hover .aq-pen, .aq-name-wrap:focus-within .aq-pen { color: var(--qh-accent); }
        .tl-sg select.aq-aql { width: auto; background: transparent; border: 1px solid var(--qh-border); border-radius: 6px; color: var(--qh-text); padding: 5px 6px; font: 600 13px ui-monospace, 'SF Mono', Menlo, monospace; }
        .tl-sg td.aq-v { font: 600 13px ui-monospace, 'SF Mono', Menlo, monospace; white-space: nowrap; }
        .tl-sg td.aq-v small { display: block; font: 500 10px system-ui, sans-serif; color: var(--qh-amber); }
        .aq-chip { display: inline-block; font-size: 12px; font-weight: 700; border-radius: 999px; padding: 2px 10px; white-space: nowrap; }
        .aq-stage-notes { margin-top: 10px; display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--qh-amber); line-height: 1.6; }
        .aq-next { margin-top: 6px; font-size: 13px; color: var(--qh-text); }
        .aq-rules { display: flex; flex-direction: column; gap: 8px; }
        .aq-rule { border: 1px solid var(--qh-border); border-radius: 10px; padding: 10px 14px; background: var(--qh-surface2); }
        .aq-rule b { display: block; font-size: 13px; margin-bottom: 2px; }
        .aq-rule span { font-size: 13px; color: color-mix(in srgb, var(--qh-text) 80%, var(--qh-bg)); line-height: 1.6; }
        .tl-sg input.aq-cls { min-width: 100px; }
        .tl-sg input.aq-found { min-width: 56px; }
        @media (min-width: 769px) {
          .aq-classes { table-layout: fixed; }
          .aq-classes .aq-w-aql { width: 110px; }
          .aq-classes .aq-w-n { width: 96px; }
          .aq-classes .aq-w-num { width: 56px; }
          .aq-classes .aq-w-found { width: 96px; }
          .aq-classes .aq-w-res { width: 130px; }
          .aq-classes th:last-child { width: 36px; }
        }
        @media (max-width: 768px) {
          .aq-fields { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .aq-res { display: none; }
          .tl-sg input.aq-cls { min-width: 64px; }
          .tl-sg input.aq-found { min-width: 40px; }
          .tl-sg select.aq-aql { padding: 5px 2px; }
          .tl-sg th, .tl-sg td { padding-inline: 3px; }
        }
      `}</style>
      <Nav theme={theme} setTheme={setTheme} breadcrumbKey="bc_aql" />

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
        <ToolSidebar current="/aql" />

        <div className="tl-main">
          <ToolHeader title={t('aql_title')} intro={t('aql_intro')} onHelp={() => setHelpOpen(true)} onExample={loadExample} />
          <HelpPanel open={helpOpen} onClose={() => setHelpOpen(false)} title={t('aql_help_title')} steps={helpSteps} onExample={loadExample} showCapability={false} tip={t('aql_help_tip')} />
          <PhoneTabs tab={mobileTab} onTab={setMobileTab} dataCount={stages.length} hideSetup />

          {/* ── DATA: one card per inspection stage ───────────────────── */}
          <section className="tl-panel" data-active={mobileTab === 'data'} aria-label={t('spc_tab_data')} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {stages.map((st, si) => {
              const r = resultFor(si)
              const lotBad = parseLot(st.lotSize) < MIN_LOT_SIZE
              return (
                <div key={st.id} className="tl-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                    <label className="aq-name-wrap" title={t('aql_stage_rename')}>
                      <input className="aq-name" value={st.name} placeholder={nameOf('', si, translations[lang])} size={Math.max(8, (st.name || nameOf('', si, translations[lang])).length + 1)} aria-label={t('aql_stage_name')} onChange={e => patchStage(st.id, { name: e.target.value })} />
                      <span className="aq-pen" aria-hidden="true">✎</span>
                    </label>
                    {stages.length > 1 && <button type="button" className="tl-xbtn tl-xbtn-sm" onClick={() => removeStage(st.id)}>{t('aql_remove_stage')}</button>}
                  </div>
                  <div className="aq-fields">
                    <label className="tl-field">
                      <span>{t('aql_lot_size')}</span>
                      <input type="number" min={MIN_LOT_SIZE} step={1} value={st.lotSize} onChange={e => patchStage(st.id, { lotSize: e.target.value })} />
                    </label>
                    <label>
                      <span>{t('aql_level')}</span>
                      <select value={st.level} onChange={e => patchStage(st.id, { level: e.target.value as InspectionLevel })}>
                        {LEVELS.map(l => <option key={l} value={l}>{t(`aql_level_${l}` as TKey)}</option>)}
                      </select>
                    </label>
                    <label>
                      <span>{t('aql_type')}</span>
                      <select value={st.type} onChange={e => patchStage(st.id, { type: e.target.value as InspectionType })}>
                        {TYPES.map(ty => <option key={ty} value={ty}>{t(`aql_type_${ty}` as TKey)}</option>)}
                      </select>
                    </label>
                    <div className="aq-letter" aria-live="polite">
                      <span>{t('aql_letter')}</span>
                      <b>{r && !r.error ? r.codeLetter : '—'}</b>
                      {r && !r.error && r.sampleSize !== null && <small>{t('aql_letter_sub').replace('{n}', int(r.sampleSize))}</small>}
                    </div>
                  </div>
                  {lotBad && <div className="tl-error" style={{ marginBottom: 12 }}>{t('aql_err_lot')}</div>}
                  <div className="tl-sg-wrap" style={{ maxHeight: 'none' }}>
                    <table className="tl-sg aq-classes">
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'start' }}>{t('aql_col_class')}</th>
                          <th className="aq-w-aql">{t('aql_col_aql')}</th>
                          <th className="aq-w-n">{t('aql_col_n')}</th>
                          <th className="aq-w-num">{t('aql_col_ac')}</th>
                          <th className="aq-w-num">{t('aql_col_re')}</th>
                          <th className="aq-w-found">{t('aql_col_found')}</th>
                          <th className="aq-res aq-w-res">{t('aql_col_result')}</th>
                          <th aria-label={t('spc_remove')} style={{ width: 28 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {st.classes.map((cl, ci) => {
                          const cr = r && !r.error ? r.classes[ci] : null
                          return (
                            <tr key={cl.id}>
                              <td><input value={cl.name} aria-label={t('aql_col_class')} onChange={e => patchClass(st.id, cl.id, { name: e.target.value })} className="aq-cls" style={{ textAlign: 'start', fontFamily: 'inherit', fontWeight: 500 }} /></td>
                              <td>
                                <select className="aq-aql" value={cl.aql} aria-label={t('aql_col_aql')} onChange={e => patchClass(st.id, cl.id, { aql: Number(e.target.value) })}>
                                  {AQL_OPTIONS.map(v => <option key={v} value={v}>{aqlText(v)}</option>)}
                                </select>
                              </td>
                              <td className="aq-v">
                                {cr ? int(cr.inspect) : '—'}
                                {cr && cr.letter !== r!.codeLetter && <small>{ltr(`${t('aql_col_letter')} ${cr.letter}`)}</small>}
                                {cr && cr.fullLot && <small>100%</small>}
                              </td>
                              <td className="aq-v" style={{ color: 'var(--qh-good)' }}>{cr ? cr.ac : '—'}</td>
                              <td className="aq-v" style={{ color: 'var(--qh-danger)' }}>{cr ? cr.re : '—'}</td>
                              <td><input type="number" min={0} step={1} value={cl.found} placeholder="—" aria-label={t('aql_col_found')} onChange={e => patchClass(st.id, cl.id, { found: e.target.value })} className="aq-found" style={cr?.decision ? { color: decisionColor(cr.decision), background: tint(decisionColor(cr.decision), 12) } : undefined} /></td>
                              <td className="aq-res">
                                {cr?.decision && (
                                  <span className="aq-chip" style={{ color: decisionColor(cr.decision), background: tint(decisionColor(cr.decision), 12) }}>
                                    {cr.decision === 'accept' ? t('aql_accept') : t('aql_reject')}
                                  </span>
                                )}
                              </td>
                              <td><button type="button" className="tl-sg-x" aria-label={t('spc_remove')} onClick={() => removeClass(st.id, cl.id)}>✕</button></td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  {st.classes.length < MAX_CLASSES && (
                    <div style={{ marginTop: 10 }}>
                      <button type="button" className="tl-xbtn tl-add" onClick={() => addClass(st.id)}>{t('aql_add_class')}</button>
                    </div>
                  )}
                </div>
              )
            })}
            {stages.length < MAX_STAGES && (
              <button type="button" className="tl-xbtn tl-add" style={{ justifyContent: 'center', minHeight: 46 }} onClick={addStage}>{t('aql_add_stage')}</button>
            )}
          </section>

          {/* ── RESULTS ──────────────────────────────────────────────── */}
          <section className="tl-panel tl-results" data-active={mobileTab === 'results'} aria-label={t('spc_tab_results')}>
            {failed && <div className="tl-error">{failed === 'rate' ? t('aql_rate') : t('aql_failed')}</div>}
            {!ready ? (
              <div className="tl-card tl-empty">{pending ? t('aql_loading') : t('aql_failed')}</div>
            ) : !anyPlan ? (
              <div className="tl-card tl-empty">{t('aql_empty')}</div>
            ) : (
              <>
                <div className="tl-verdicts">
                  {view.map((v, i) => {
                    if (v.r.error || v.r.classes.length === 0) return null
                    const col = decisionColor(v.r.lot)
                    const notes = stageNotes(translations[lang], v)
                    const next = nextLot(translations[lang], v)
                    return (
                      <div key={v.st.id} className="tl-verdict" style={{ background: tint(col, 8), border: `1px solid ${tint(col, 35)}` }}>
                        <span className="tl-verdict-icon" aria-hidden="true" style={{ background: tint(col, 16), color: col }}>{v.r.lot === 'accept' ? '✓' : v.r.lot === 'reject' ? '✕' : '…'}</span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12, color: 'var(--qh-muted)', marginBottom: 2 }}>
                            {t('aql_lot_head').replace('{stage}', nameOf(v.st.name, i, translations[lang])).replace('{lot}', ltr(int(v.req.lotSize)))} · {ltr(`${levelName(v.st.level)} · ${v.r.codeLetter}`)} · {t(`aql_type_${v.st.type}` as TKey)}
                          </div>
                          <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 4, color: col }}>
                            {v.r.lot === 'accept' ? t('aql_lot_accept') : v.r.lot === 'reject' ? t('aql_lot_reject') : t('aql_lot_pending')}
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--qh-muted)', lineHeight: 1.6 }}>{lotSub(translations[lang], v)}</div>
                          {next && <div className="aq-next">{next}</div>}
                          {notes.length > 0 && <div className="aq-stage-notes">{notes.map((n, k) => <div key={k}>{n}</div>)}</div>}
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="tl-results-head">
                  <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{t('spc_tab_results')}</h2>
                  <ExportRow
                    isPro={isPro}
                    isLoggedIn={isLoggedIn}
                    hasResult={flat.length > 0}
                    onCSV={exportCSV}
                    onPNG={exportPNG}
                    onExcel={exportExcel}
                    onPDF={exportPDF}
                    pngLabel={t('aql_x_png')}
                    save={
                      <SaveAnalysisButton
                        theme={theme}
                        tool="aql"
                        defaultName={`AQL — ${new Date().toLocaleDateString('en-US')}`}
                        compact={compactSave}
                        getPayload={() => ({
                          input_data: {
                            stages: stages.map((st, i) => ({
                              name: st.name, lotSize: requests[i].lotSize, level: st.level, type: st.type,
                              classes: st.classes.map((cl, j) => ({ name: cl.name, aql: cl.aql, found: requests[i].classes[j].found })),
                            })),
                          },
                          results: { stages: results },
                        })}
                      />
                    }
                  />
                </div>

                <div className="tl-card">
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>{t('aql_plan_title')}</div>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="tl-table">
                      <thead>
                        <tr>
                          <th>{t('aql_col_stage')}</th>
                          <th>{t('aql_col_class')}</th>
                          <th className="num">{t('aql_col_aql')}</th>
                          <th style={{ textAlign: 'center' }}>{t('aql_col_letter')}</th>
                          <th className="num">{t('aql_col_n')}</th>
                          <th className="num">{t('aql_col_ac')}</th>
                          <th className="num">{t('aql_col_re')}</th>
                          <th className="num">{t('aql_col_found')}</th>
                          <th>{t('aql_col_result')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {view.flatMap((v, i) =>
                          v.r.error ? [] : v.r.classes.map((cr, j) => (
                            <tr key={`${v.st.id}-${j}`}>
                              <td>{j === 0 ? nameOf(v.st.name, i, translations[lang]) : ''}</td>
                              <td style={{ whiteSpace: 'normal' }}>{v.st.classes[j]?.name}</td>
                              <td className="num">{aqlText(v.req.classes[j].aql)}</td>
                              <td style={{ textAlign: 'center', fontWeight: 600 }}>{cr.letter}</td>
                              <td className="num">{int(cr.inspect)}</td>
                              <td className="num">{cr.ac}</td>
                              <td className="num">{cr.re}</td>
                              <td className="num">{v.req.classes[j].found ?? '—'}</td>
                              <td style={{ fontWeight: 600, color: decisionColor(cr.decision) }}>{cr.decision === 'accept' ? t('aql_accept') : cr.decision === 'reject' ? t('aql_reject') : '—'}</td>
                            </tr>
                          )),
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="tl-hint">{t('aql_source')}</div>
                </div>

                <details className="tl-more">
                  <summary>{t('aql_rules_title')}</summary>
                  <div className="tl-more-body">
                    <div className="tl-hint" style={{ marginTop: 0, fontSize: 13 }}>{t('aql_rules_intro')}</div>
                    <div className="aq-rules">
                      {RULES.map(r => (
                        <div key={r.t} className="aq-rule"><b>{t(r.t)}</b><span>{t(r.d)}</span></div>
                      ))}
                      <div className="aq-rule"><b>{t('aql_score_t')}</b><span>{t('aql_score_d')}</span></div>
                    </div>
                    <div className="tl-hint" style={{ marginTop: 0 }}>{t('aql_rules_src')}</div>
                  </div>
                </details>
              </>
            )}
          </section>
        </div>
      </div>

      <PhoneBar
        showResultActions={mobileTab === 'results' && anyPlan}
        onAnalyze={() => { setMobileTab('results'); window.scrollTo({ top: 0 }) }}
        onEdit={() => setMobileTab('data')}
        analyzeLabel={t('aql_bar_results')}
      />
    </div>
  )
}
