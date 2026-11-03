'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLanguage } from '@/lib/i18n/context'
import { tint } from '@/lib/theme'
import { track } from '@/lib/analytics'
import Link from '@/components/LocaleLink'
import { formatPEquals } from '@/lib/stats/format'
import type { CapabilityVerdict } from '@/lib/spc/verdict'
import { getReportBranding } from '@/lib/reportBranding'
import {
  EMPTY_REPORT_DETAILS, REPORT_DETAILS_MAX, loadSavedReportDetails, saveReportDetails, setReportDetails,
  type ReportDetails,
} from '@/lib/reportDetails'

// ─────────────────────────────────────────────────────────────────────────
// Building blocks shared by the tool pages. Styling lives in ToolStyles
// (tl-* classes); these components only render existing results.
// ─────────────────────────────────────────────────────────────────────────

export type MobileTab = 'setup' | 'data' | 'results'

// ── Page header: title, intro, How to use, Try an example ───────────────
export interface ToolRoute {
  text: string
  href: string
  label: string
}

export function ToolHeader({ title, intro, route, onHelp, onExample, exampleDisabled }: {
  title: string
  intro: string
  /** one line pointing to a related tool, under the intro */
  route?: ToolRoute
  onHelp: () => void
  onExample: () => void
  exampleDisabled?: boolean
}) {
  const { t } = useLanguage()
  return (
    <header className="tl-head">
      <div style={{ minWidth: 0, flex: '1 1 320px' }}>
        <h1>{title}</h1>
        <p>{intro}</p>
        {route && (
          <p className="tl-route">
            <span aria-hidden="true">⇄</span>
            <span>{route.text} <Link href={route.href}>{route.label}</Link></span>
          </p>
        )}
      </div>
      <div className="tl-head-actions">
        <button type="button" className="tl-xbtn" onClick={onHelp} aria-haspopup="dialog">
          <span aria-hidden="true">?</span> {t('spc_help_btn')}
        </button>
        <button type="button" className="tl-xbtn" onClick={() => { track('example_loaded'); onExample() }} disabled={exampleDisabled}>{t('spc_example_btn')}</button>
      </div>
    </header>
  )
}

// ── Hint under a field, with a link to the chart that fits better ───────
export function HintLink({ text, href, label }: ToolRoute) {
  return <div className="tl-hint tl-hint-route">{text} <Link href={href}>{label}</Link></div>
}

// ── How to use: side panel ───────────────────────────────────────────────
export function HelpPanel({ open, onClose, title, steps, onExample, showCapability = true, tip }: {
  open: boolean
  onClose: () => void
  title: string
  steps: { t: string; d: string }[]
  onExample: () => void
  showCapability?: boolean
  tip?: string
}) {
  const { t } = useLanguage()
  if (!open) return null
  return (
    <div className="tl-help-overlay" onClick={onClose}>
      <aside className="tl-help" role="dialog" aria-modal="true" aria-labelledby="tl-help-title" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <h2 id="tl-help-title" style={{ margin: 0, fontSize: 19 }}>{title}</h2>
          <button type="button" className="tl-xbtn" onClick={onClose} aria-label={t('spc_help_close')} autoFocus>✕</button>
        </div>
        <ol className="tl-help-steps">
          {steps.map((s, i) => (
            <li key={i}>
              <b>{s.t}</b>
              <span>{s.d}</span>
            </li>
          ))}
        </ol>
        {showCapability && (
          <div className="tl-help-box">
            <b>{t('spc_help_read_t')}</b>
            <ul>
              <li><span style={{ color: 'var(--qh-good)', fontWeight: 700 }}>≥ 1.33</span> {t('spc_help_read_capable')}</li>
              <li><span style={{ color: 'var(--qh-amber)', fontWeight: 700 }}>1.00 – 1.33</span> {t('spc_help_read_marginal')}</li>
              <li><span style={{ color: 'var(--qh-danger)', fontWeight: 700 }}>&lt; 1.00</span> {t('spc_help_read_not')}</li>
            </ul>
            <p>{t('spc_help_read_note')}</p>
          </div>
        )}
        <p style={{ fontSize: 13, color: 'var(--qh-muted)', lineHeight: 1.7, margin: '14px 0' }}>{tip ?? t('spc_help_tip')}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button type="button" className="tl-xbtn" onClick={() => { onClose(); onExample() }}>{t('spc_example_btn')}</button>
          <Link className="tl-xbtn" href="/guide" style={{ textDecoration: 'none' }}>{t('spc_help_guide')}</Link>
        </div>
      </aside>
    </div>
  )
}

// ── Phone tabs and action bar ─────────────────────────────────────────────
export function PhoneTabs({ tab, onTab, dataCount, hideSetup }: { tab: MobileTab; onTab: (t: MobileTab) => void; dataCount: number | null; hideSetup?: boolean }) {
  const { t } = useLanguage()
  // dataCount null: the tool has no data grid (OEE), so only Setup and Results.
  // hideSetup: the tool has nothing to set up (Descriptive), so Data and Results.
  const two = dataCount === null || hideSetup
  return (
    <div className="tl-tabs" role="tablist" aria-label={t('spc_tabs_label')} style={two ? { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' } : undefined}>
      {!hideSetup && <button type="button" role="tab" aria-selected={tab === 'setup'} onClick={() => onTab('setup')}>{t('spc_tab_setup')}</button>}
      {dataCount !== null && <button type="button" role="tab" aria-selected={tab === 'data'} onClick={() => onTab('data')}>{t('spc_tab_data')} · {dataCount}</button>}
      <button type="button" role="tab" aria-selected={tab === 'results'} onClick={() => onTab('results')}>{t('spc_tab_results')}</button>
    </div>
  )
}

export function PhoneBar({ showResultActions, loading, onAnalyze, onEdit, analyzeLabel }: {
  showResultActions: boolean
  loading?: boolean
  onAnalyze: () => void
  onEdit: () => void
  analyzeLabel?: string
}) {
  const { t } = useLanguage()
  return (
    <div className="tl-bar">
      {showResultActions ? (
        <>
          <button type="button" className="tl-bar-ghost" onClick={() => { onEdit(); window.scrollTo({ top: 0 }) }}>{t('spc_bar_edit')}</button>
          <button type="button" className="tl-bar-primary" onClick={() => document.getElementById('tl-export')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>{t('spc_bar_export')}</button>
        </>
      ) : (
        <button type="button" className="tl-bar-primary tl-bar-wide" onClick={onAnalyze} disabled={loading}>
          {loading ? t('spc_analyzing') : analyzeLabel ?? t('spc_analyze_btn')}
        </button>
      )}
    </div>
  )
}

// ── Results header: title, data points, normality, export row ────────────
export function ResultsHead({ nPoints, ad, isNormal, hasSpec, children }: {
  nPoints: number
  /** normality test: undefined = not applicable (attribute data), null = too few points */
  ad?: { p: number } | null
  isNormal: boolean
  hasSpec: boolean
  children: ReactNode
}) {
  const { t } = useLanguage()
  return (
    <div className="tl-results-head">
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '6px 12px' }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{t('spc_tab_results')}</h2>
        <span className="tl-chip">{t('spc_n_points').replace('{n}', String(nPoints))}</span>
        {ad === undefined ? null : ad ? (
          isNormal ? (
            <span className="tl-chip" style={{ color: 'var(--qh-good)' }}>
              ✓ {t('spc_normal')} · {t('spc_ad_label').replace('{p}', formatPEquals(ad.p))}
            </span>
          ) : (
            <span className="tl-chip tl-chip-warn">
              <b>{t('spc_nonnormal')}</b>
              {hasSpec && <> · {t('spc_nonnormal_effect')}</>}
              {' · '}{t('spc_ad_label').replace('{p}', formatPEquals(ad.p))}
            </span>
          )
        ) : (
          <span className="tl-chip">{t('spc_ad_need8')}</span>
        )}
      </div>
      {children}
    </div>
  )
}

export function ExportRow({ isPro, isLoggedIn, hasResult, onCSV, onPNG, onExcel, onPDF, save, pngLabel, pngDisabled }: {
  isPro: boolean
  isLoggedIn: boolean
  hasResult: boolean
  onCSV: () => void
  onPNG: () => void
  onExcel: () => void
  onPDF: () => void
  save: ReactNode
  /** label of the PNG button when the image is not a chart */
  pngLabel?: string
  /** no image to export (e.g. no chart on screen) */
  pngDisabled?: boolean
}) {
  const { t } = useLanguage()
  useCalculateTracking(hasResult)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const exp = (format: 'csv' | 'png' | 'excel' | 'pdf', allowed: boolean, run: () => void) => () => {
    if (allowed) track('file_export', { file_format: format })
    run()
  }
  // Pro PDF: study details, notes and sign-off names first (lib/reportDetails.ts)
  const pdfClick = () => {
    if (isPro) setDetailsOpen(true)
    else onPDF()
  }
  const exportWith = (d: ReportDetails | null) => {
    setDetailsOpen(false)
    setReportDetails(d)
    track('file_export', { file_format: 'pdf' })
    // after the panel has closed, so chart snapshots see the page as usual
    window.setTimeout(onPDF, 0)
  }
  return (
    <div id="tl-export" className="tl-exports">
      {detailsOpen && <ReportDetailsPanel onClose={() => setDetailsOpen(false)} onExport={exportWith} />}
      {!isLoggedIn && <span style={{ fontSize: 12, color: 'var(--qh-muted)' }}>{t('spc_free_with_account')}</span>}
      <button className="tl-xbtn" onClick={exp('csv', isLoggedIn, onCSV)} disabled={!hasResult}>CSV</button>
      <button className="tl-xbtn" onClick={exp('png', isLoggedIn, onPNG)} disabled={!hasResult || pngDisabled}>{pngLabel ?? t('spc_x_png')}</button>
      <button className="tl-xbtn tl-xbtn-pro" onClick={exp('excel', isPro, onExcel)}>Excel{!isPro && <span className="tl-pro">PRO</span>}</button>
      <button className="tl-xbtn tl-xbtn-pro" onClick={pdfClick} disabled={!hasResult}>{t('spc_x_pdf')}{!isPro && <span className="tl-pro">PRO</span>}</button>
      {save}
    </div>
  )
}

/**
 * Before a Pro PDF: what the study is about, the person's notes and the
 * sign-off names, all optional. Results are never edited here — the PDF
 * prints these as the person's own text (lib/pdf/reportDesign.ts).
 */
function ReportDetailsPanel({ onClose, onExport }: { onClose: () => void; onExport: (d: ReportDetails | null) => void }) {
  const { t } = useLanguage()
  const [d, setD] = useState<ReportDetails>(() => {
    const saved = loadSavedReportDetails()
    const b = getReportBranding()
    return {
      ...EMPTY_REPORT_DETAILS,
      preparedBy: b?.preparedBy.trim() ?? '',
      signOff: !!(b && (b.signPrepared || b.signApproved)),
      ...saved,
    }
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const set = (k: keyof ReportDetails) => (e: { target: { value: string } }) => setD(prev => ({ ...prev, [k]: e.target.value }))
  const field = (k: keyof ReportDetails, label: string, ph?: string, autoFocus?: boolean) => (
    <label className="tl-field">
      <span>{label}</span>
      <input value={d[k] as string} onChange={set(k)} placeholder={ph} maxLength={REPORT_DETAILS_MAX.field} autoFocus={autoFocus} dir="auto" />
    </label>
  )
  const submit = () => { saveReportDetails(d); onExport(d) }
  return (
    <div className="tl-help-overlay" onClick={onClose}>
      <aside className="tl-help tl-rd" role="dialog" aria-modal="true" aria-labelledby="tl-rd-title" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <h2 id="tl-rd-title" style={{ margin: 0, fontSize: 19 }}>{t('rd_title')}</h2>
          <button type="button" className="tl-xbtn" onClick={onClose} aria-label={t('spc_help_close')}>✕</button>
        </div>
        <p className="tl-rd-sub">{t('rd_sub')}</p>

        <h3>{t('rd_study')}</h3>
        <div className="tl-rd-grid">
          {field('part', t('rd_part'), t('rd_part_ph'), true)}
          {field('characteristic', t('rd_char'), t('rd_char_ph'))}
          {field('location', t('rd_location'), t('rd_location_ph'))}
          {field('period', t('rd_period'), t('rd_period_ph'))}
          {field('reportNo', t('rd_report_no'), t('rd_report_no_ph'))}
        </div>
        <p className="tl-rd-hint">{t('rd_company_hint')} <Link href="/account">{t('rd_company_link')}</Link></p>

        <h3>{t('rd_notes')}</h3>
        <textarea value={d.notes} onChange={set('notes')} maxLength={REPORT_DETAILS_MAX.notes} placeholder={t('rd_notes_ph')} dir="auto" aria-label={t('rd_notes')} />
        <p className="tl-rd-hint">{t('rd_notes_hint')}</p>

        <h3>{t('rd_signoff')}</h3>
        <label className="tl-rd-check">
          <input type="checkbox" checked={d.signOff} onChange={e => setD(prev => ({ ...prev, signOff: e.target.checked }))} />
          {t('rd_signoff_add')}
        </label>
        {d.signOff && (
          <div className="tl-rd-grid three">
            {field('preparedBy', t('rd_prepared'), t('rd_name_ph'))}
            {field('reviewedBy', t('rd_reviewed'), t('rd_name_ph'))}
            {field('approvedBy', t('rd_approved'), t('rd_name_ph'))}
          </div>
        )}
        {!d.signOff && (
          <div className="tl-rd-grid">{field('preparedBy', t('rd_prepared'), t('rd_name_ph'))}</div>
        )}

        <div className="tl-rd-actions">
          <button type="button" className="tl-analyze" onClick={submit}>{t('rd_export')}</button>
          <button type="button" className="tl-xbtn" onClick={() => onExport(null)}>{t('rd_skip')}</button>
        </div>
        <p className="tl-rd-hint">{t('rd_remember')}</p>
      </aside>
    </div>
  )
}

/**
 * Sends tool_calculate once per page view: the first time a result is on
 * screen after the visitor typed, pasted or uploaded data in the page
 * (typing in the nav or the phone menu doesn't count). Results that come
 * from "Try an example" alone are counted by example_loaded instead.
 */
function useCalculateTracking(hasResult: boolean) {
  const hasResultRef = useRef(hasResult)
  const edited = useRef(false)
  const sent = useRef(false)

  useEffect(() => {
    hasResultRef.current = hasResult
    if (hasResult && edited.current && !sent.current) {
      sent.current = true
      track('tool_calculate')
    }
  }, [hasResult])

  useEffect(() => {
    let timer = 0
    const onEdit = (e: Event) => {
      const el = e.target as Element | null
      if (!el || typeof el.closest !== 'function' || el.closest('nav, .qh-nav, .qh-mm')) return
      edited.current = true
      // live tools already show a result: check once the new numbers settle
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        if (hasResultRef.current && !sent.current) {
          sent.current = true
          track('tool_calculate')
        }
      }, 1500)
    }
    document.addEventListener('input', onEdit, true)
    document.addEventListener('paste', onEdit, true)
    document.addEventListener('change', onEdit, true)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('input', onEdit, true)
      document.removeEventListener('paste', onEdit, true)
      document.removeEventListener('change', onEdit, true)
    }
  }, [])
}

/** Props for SaveAnalysisButton's compact look, so Save matches the Pro export buttons */
export function useCompactSave() {
  const { t } = useLanguage()
  return { className: 'tl-xbtn tl-xbtn-pro', badgeClassName: 'tl-pro', label: t('spc_x_save') }
}

// ── Verdict cards: stability + capability ────────────────────────────────
export function VerdictCards({ stable, nPoints, nSubgroups, signals, verdict, reason }: {
  stable: boolean
  nPoints: number
  /** Subgroup count when n > 1; the stability line then counts subgroups, not readings. */
  nSubgroups?: number
  signals: number
  verdict: CapabilityVerdict | null
  reason: string | null
}) {
  const { t } = useLanguage()
  const sc = stable ? 'var(--qh-good)' : 'var(--qh-amber)'
  return (
    <div className="tl-verdicts">
      <div className="tl-verdict" style={{ background: tint(sc, 8), border: `1px solid ${tint(sc, 35)}` }}>
        <span className="tl-verdict-icon" aria-hidden="true" style={{ background: tint(sc, 16), color: sc }}>{stable ? '✓' : '!'}</span>
        <div>
          <div style={{ fontSize: 12, color: 'var(--qh-muted)', marginBottom: 2 }}>{t('spc_verdict_stability')}</div>
          <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 4 }}>{stable ? t('spc_stable_title') : t('spc_unstable_title')}</div>
          <div style={{ fontSize: 13, color: 'var(--qh-muted)', lineHeight: 1.6 }}>
            {stable ? (nSubgroups ? t('spc_stable_sub_sg').replace('{n}', String(nSubgroups)) : t('spc_stable_sub').replace('{n}', String(nPoints))) : t('spc_unstable_sub').replace('{k}', String(signals))}
          </div>
        </div>
      </div>
      {verdict && (
        <div className="tl-verdict" style={{ background: tint(verdict.color, 8), border: `1px solid ${tint(verdict.color, 35)}` }}>
          <span className="tl-verdict-icon" aria-hidden="true" style={{ background: tint(verdict.color, 16), color: verdict.color }}>{verdict.color === 'var(--qh-good)' ? '✓' : '!'}</span>
          <div>
            <div style={{ fontSize: 12, color: 'var(--qh-muted)', marginBottom: 2 }}>{t('spc_verdict_capability')}</div>
            <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 4, color: verdict.color }}>{verdict.text}</div>
            <div style={{ fontSize: 13, color: 'var(--qh-muted)', lineHeight: 1.6 }}>{reason ?? verdict.sub}</div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Number cards (10 = 5 × 2 on desktop) ─────────────────────────────────
export interface KpiInput {
  mu: number
  sigma: number
  sdOverall: number
  Cp: number | null
  Cpk: number | null
  Pp: number | null
  Ppk: number | null
  ppmD_lt: { total: number } | null
  sigLvl_st: number | null
  sigLvl_lt: number | null
}

const kfmt = (n: number | null | undefined, d = 3) => (n === null || n === undefined || !isFinite(n) ? '—' : n.toFixed(d))

export function KpiGrid({ r, hasSpec, pkName, displayMode = 'both', capColor }: {
  r: KpiInput
  hasSpec: boolean
  pkName: 'Cpk' | 'Ppk' | null
  displayMode?: 'both' | 'capability' | 'benchmark'
  /** colour for a capability index value (same scale as the verdict) */
  capColor: (v: number | null) => string
}) {
  const { t } = useLanguage()
  const pk = (name: 'Cpk' | 'Ppk', v: number | null) => (
    <div className="tl-kpi" style={pkName === name && v !== null ? { borderColor: tint(capColor(v), 45) } : undefined}>
      <span>{name}</span>
      <b style={{ color: v !== null ? capColor(v) : undefined }}>{kfmt(v)}</b>
    </div>
  )
  return (
    <div className="tl-kpis">
      <div className="tl-kpi"><span>{t('spc_kpi_mean')}</span><b>{kfmt(r.mu)}</b></div>
      <div className="tl-kpi"><span>{t('spc_kpi_sigma_within')}</span><b>{kfmt(r.sigma)}</b></div>
      <div className="tl-kpi"><span>{t('spc_kpi_sigma_overall')}</span><b>{kfmt(r.sdOverall)}</b></div>
      {hasSpec && (displayMode === 'capability' || displayMode === 'both') && (
        <>
          <div className="tl-kpi"><span>Cp</span><b>{kfmt(r.Cp)}</b></div>
          {pk('Cpk', r.Cpk)}
          <div className="tl-kpi"><span>Pp</span><b>{kfmt(r.Pp)}</b></div>
          {pk('Ppk', r.Ppk)}
          {r.ppmD_lt && <div className="tl-kpi"><span>{t('spc_kpi_ppm_overall')}</span><b>{r.ppmD_lt.total.toFixed(2)}</b></div>}
        </>
      )}
      {hasSpec && (displayMode === 'benchmark' || displayMode === 'both') && (
        <>
          <div className="tl-kpi"><span>{t('spc_stat_sigma_st')}</span><b>{kfmt(r.sigLvl_st)}σ</b></div>
          <div className="tl-kpi"><span>{t('spc_stat_sigma_lt')}</span><b>{kfmt(r.sigLvl_lt)}σ</b></div>
        </>
      )}
    </div>
  )
}

// ── Data entry: single readings (numbered grid) ──────────────────────────
/** Pads a plain decimal to d decimals for display ("24" → "24.0"); anything else is returned as typed */
export function padDecimals(v: string, d: number): string {
  const s = v.trim()
  if (d === 0 || !/^-?\d+(\.\d*)?$/.test(s)) return v
  const [i, f = ''] = s.split('.')
  return `${i}.${f.padEnd(d, '0')}`
}

function maxDecimals(values: string[]): number {
  return values.reduce((m, v) => {
    const d = /^-?\d*\.(\d+)$/.exec(v.trim())
    return Math.max(m, d ? d[1].length : 0)
  }, 0)
}

export function ReadingsGrid({ values, onChange, onRemove, onAdd }: {
  values: string[]
  onChange: (i: number, v: string) => void
  onRemove: (i: number) => void
  onAdd: () => void
}) {
  const { t } = useLanguage()
  const [editing, setEditing] = useState<number | null>(null)
  const dec = maxDecimals(values)
  return (
    <>
      <div className="tl-cells">
        {values.map((v, i) => (
          <div key={i} className="tl-cell">
            <span className="tl-cell-n">{i + 1}</span>
            <input
              type="number"
              value={editing === i ? v : padDecimals(v, dec)}
              aria-label={`${t('spc_col_value')} ${i + 1}`}
              onFocus={() => setEditing(i)}
              onBlur={() => setEditing(null)}
              onChange={e => onChange(i, e.target.value)}
            />
            <button type="button" className="tl-cell-x" aria-label={`${t('spc_remove')} ${i + 1}`} onClick={() => onRemove(i)}>✕</button>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginTop: 10 }}>
        <button type="button" className="tl-xbtn tl-add" onClick={onAdd}>{t('spc_add_reading')}</button>
      </div>
      <div className="tl-paste">{t('spc_paste_anywhere')}</div>
    </>
  )
}

// ── Data entry: subgroups (one row per subgroup) ─────────────────────────
export function SubgroupTable({ rows, n, onChange, onRemove, onAdd }: {
  rows: string[][]
  n: number
  onChange: (row: number, col: number, v: string) => void
  onRemove: (row: number) => void
  onAdd: () => void
}) {
  const { t } = useLanguage()
  return (
    <>
      <div className="tl-sg-wrap">
        <table className="tl-sg">
          <thead>
            <tr>
              <th>#</th>
              {Array.from({ length: n }, (_, i) => <th key={i}>x{i + 1}</th>)}
              <th aria-label={t('spc_remove')}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                <td className="tl-sg-n">{r + 1}</td>
                {Array.from({ length: n }, (_, c) => (
                  <td key={c}>
                    <input
                      type="number"
                      value={row[c] ?? ''}
                      aria-label={`${t('spc_subgroup_label')} ${r + 1}, x${c + 1}`}
                      onChange={e => onChange(r, c, e.target.value)}
                    />
                  </td>
                ))}
                <td><button type="button" className="tl-sg-x" aria-label={`${t('spc_remove_subgroup')} ${r + 1}`} onClick={() => onRemove(r)}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginTop: 10 }}>
        <button type="button" className="tl-xbtn tl-add" onClick={onAdd}>{t('spc_add_subgroup_short')}</button>
      </div>
      <div className="tl-paste">{t('spc_paste_rows')}</div>
    </>
  )
}

// ── Data card header: title, count, upload, clear ────────────────────────
export function DataCardHead({ countLabel, onUpload, onClear, extra }: {
  countLabel: string
  onUpload: () => void
  onClear: () => void
  extra?: ReactNode
}) {
  const { t } = useLanguage()
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12 }}>
      <div style={{ fontWeight: 700, fontSize: 15 }}>
        {t('spc_tab_data')}
        <span style={{ fontWeight: 400, fontSize: 13, color: 'var(--qh-muted)' }}>{' · '}{countLabel}</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <button type="button" className="tl-xbtn tl-xbtn-sm" onClick={onUpload}>{t('spc_upload_file')}</button>
        <button type="button" className="tl-xbtn tl-xbtn-sm" style={{ color: 'var(--qh-danger)' }} onClick={onClear}>{t('spc_clear_short')}</button>
        {extra}
      </div>
    </div>
  )
}

// ── Spec limits: LSL / Target / USL in one row ───────────────────────────
export function SpecLimits({ lsl, target, usl, onLsl, onTarget, onUsl }: {
  lsl: string
  target: string
  usl: string
  onLsl: (v: string) => void
  onTarget: (v: string) => void
  onUsl: (v: string) => void
}) {
  const { t } = useLanguage()
  const field = (label: string, aria: string, value: string, on: (v: string) => void) => (
    <label className="tl-field">
      <span>{label}</span>
      <input type="number" value={value} placeholder="—" aria-label={aria} onChange={e => on(e.target.value)} />
    </label>
  )
  return (
    <div>
      <div className="tl-label">{t('spc_spec_limits')}</div>
      <div className="tl-spec">
        {field('LSL', t('spc_lsl'), lsl, onLsl)}
        {field(t('spc_target_short'), t('spc_target'), target, onTarget)}
        {field('USL', t('spc_usl'), usl, onUsl)}
      </div>
      <div style={{ fontSize: 11, color: 'var(--qh-muted)', marginTop: 6 }}>{t('spc_spec_optional')}</div>
    </div>
  )
}

// ── Tests for special causes: list of signals ────────────────────────────
export interface ViolationItem {
  rule: number
  label: string
  desc: string
  chart: string
  points: number[]
}

/** "3, 7, 12" for rule 1, otherwise the run "14–16" */
export function violationPointsText(v: { rule: number; points: number[] }): string {
  if (v.rule === 1) return v.points.join(', ')
  const [a, b] = v.points
  return a === b ? String(a) : `${a}–${b}`
}

export function ViolationsCard({ items, allTests }: { items: ViolationItem[]; allTests: boolean }) {
  const { t } = useLanguage()
  return (
    <div className="tl-card">
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{t('spc_nelson_title')}</div>
      <div style={{ fontSize: 12, color: 'var(--qh-muted)', marginBottom: 10 }}>
        {t('spc_tests_label')}: {t(allTests ? 'spc_tests_all' : 'spc_tests_assistant')}
      </div>
      {items.length === 0 ? (
        <div style={{ color: 'var(--qh-good)', fontSize: 13 }}>{t('spc_no_violations')}</div>
      ) : (
        items.map((v, i) => (
          <div key={i} className="tl-violation">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <span style={{ fontWeight: 700, color: 'var(--qh-danger)', fontSize: 13 }}>{t('spc_rule_label').replace('{n}', String(v.rule))} {v.label}</span>
              <span style={{ fontSize: 11, color: 'var(--qh-muted)' }}>{v.chart}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--qh-muted)', marginTop: 2 }}>{v.desc}</div>
            <div style={{ fontSize: 12, marginTop: 2 }}>{t('spc_viol_points').replace('{p}', violationPointsText(v))}</div>
          </div>
        ))
      )}
    </div>
  )
}

// ── Data adequacy (how much confidence the sample size allows) ──────────
export function AdequacyCard({ adequacy }: { adequacy: { n: number; tier: 'low' | 'moderate' | 'adequate'; label: string } }) {
  const { t } = useLanguage()
  const color = adequacy.tier === 'adequate' ? 'var(--qh-good)' : adequacy.tier === 'moderate' ? 'var(--qh-amber)' : 'var(--qh-danger)'
  const icon = adequacy.tier === 'adequate' ? '🟢' : adequacy.tier === 'moderate' ? '🟡' : '⚠️'
  return (
    <div className="tl-card" style={{ display: 'flex', gap: 12, alignItems: 'center', borderColor: tint(color, 33) }}>
      <div style={{ fontSize: 20 }} aria-hidden="true">{icon}</div>
      <div>
        <div style={{ fontWeight: 700, fontSize: 13, color }}>{adequacy.label}</div>
        <div style={{ fontSize: 12, color: 'var(--qh-muted)', marginTop: 2 }}>{t('spc_adequacy_note').replace('{n}', String(adequacy.n))}</div>
      </div>
    </div>
  )
}
