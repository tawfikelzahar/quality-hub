'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/context'

// ─────────────────────────────────────────────────────────────────────────
// Saved projects (Pro), shared by the account page and /dashboard.
//   • SavedProjectsList — the user's projects (open, rename, delete)
//   • SavedProjectsLocked — what a free account sees: a faded example and
//     a way to Pro, so the feature is visible without pretending it works
// ─────────────────────────────────────────────────────────────────────────

export type SavedTool = 'spc' | 'pareto' | 'dpmo' | 'oee' | 'gage_rr' | 'stability' | 'aql' | 'icmsf' | 'regression' | 'multiregression' | 'imr' | 'xbar_r' | 'xbar_s' | 'doe'

export interface SavedAnalysis {
  id: string
  tool: SavedTool
  name: string
  created_at: string
  updated_at: string
}

export const TOOL_LABELS: Record<SavedTool, string> = {
  spc: 'SPC Engine',
  pareto: 'Pareto Chart',
  dpmo: 'DPMO & Sigma',
  oee: 'OEE Calculator',
  gage_rr: 'Gage R&R',
  stability: 'Stability Study',
  aql: 'AQL Sampling Plan',
  icmsf: 'ICMSF Microbiological Sampling Plan',
  regression: 'Simple Linear Regression',
  multiregression: 'Multiple Linear Regression',
  imr: 'I-MR Chart',
  xbar_r: 'Xbar-R Chart',
  xbar_s: 'Xbar-S Chart',
  doe: 'Design of Experiments (Full Factorial)',
}

export const TOOL_ROUTES: Record<SavedTool, string> = {
  spc: '/spc',
  pareto: '/pareto',
  dpmo: '/dpmo',
  oee: '/oee',
  gage_rr: '/gage-rr',
  stability: '/stability',
  aql: '/aql',
  icmsf: '/icmsf',
  regression: '/regression',
  multiregression: '/multiregression',
  imr: '/imr-chart',
  xbar_r: '/xbar-r-chart',
  xbar_s: '/xbar-s-chart',
  doe: '/doe',
}

export const SAVED_LIMIT = 50

function useDateFormat() {
  const { lang } = useLanguage()
  return (iso: string) =>
    new Date(iso).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** The user's saved projects. `limit` shows only the most recent ones (read-only rows). */
export function SavedProjectsList({ limit, onCount }: { limit?: number; onCount?: (n: number) => void }) {
  const { t } = useLanguage()
  const fmt = useDateFormat()
  const [items, setItems] = useState<SavedAnalysis[] | null>(null)
  const [error, setError] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  useEffect(() => {
    fetch('/api/saved-analyses')
      .then(async res => ({ ok: res.ok, json: await res.json() }))
      .then(({ ok, json }) => {
        if (!ok) { setError(t('acc_saved_load_err')); setItems([]); return }
        setItems(json.analyses)
        onCount?.(json.analyses.length)
      })
      .catch(() => { setError(t('acc_saved_load_err')); setItems([]) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function remove(id: string) {
    if (!confirm(t('acc_confirm_delete'))) return
    const res = await fetch(`/api/saved-analyses/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setItems(prev => {
        const next = prev?.filter(a => a.id !== id) ?? null
        if (next) onCount?.(next.length)
        return next
      })
    } else {
      const json = await res.json().catch(() => ({}))
      alert(json.error ?? 'Failed to delete.')
    }
  }

  async function rename(id: string) {
    if (!renameValue.trim()) { setRenamingId(null); return }
    const res = await fetch(`/api/saved-analyses/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: renameValue.trim() }),
    })
    if (res.ok) {
      const json = await res.json()
      setItems(prev => prev?.map(a => (a.id === id ? { ...a, name: json.analysis.name } : a)) ?? null)
    } else {
      const json = await res.json().catch(() => ({}))
      alert(json.error ?? 'Failed to rename.')
    }
    setRenamingId(null)
  }

  if (items === null) return <div className="ac-muted">{t('acc_loading')}</div>
  const shown = limit ? items.slice(0, limit) : items

  return (
    <div>
      {error && <div className="ac-error">{error}</div>}
      {!error && items.length === 0 && <div className="ac-empty">{t('acc_saved_empty')}</div>}
      {shown.map(a => (
        <div key={a.id} className="ac-row">
          <div style={{ minWidth: 0, flex: '1 1 220px' }}>
            {renamingId === a.id ? (
              <input
                className="ac-input"
                autoFocus
                aria-label={t('acc_rename')}
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') rename(a.id)
                  if (e.key === 'Escape') setRenamingId(null)
                }}
                onBlur={() => rename(a.id)}
              />
            ) : (
              <div className="ac-row-title">{a.name}</div>
            )}
            <div className="ac-row-sub">{TOOL_LABELS[a.tool] ?? a.tool} · {t('acc_updated').replace('{d}', fmt(a.updated_at))}</div>
          </div>
          <div className="ac-row-actions">
            <Link href={`${TOOL_ROUTES[a.tool]}?id=${a.id}`} className="ac-btn">{t('acc_open')}</Link>
            {!limit && (
              <>
                <button type="button" className="ac-btn" onClick={() => { setRenamingId(a.id); setRenameValue(a.name) }}>{t('acc_rename')}</button>
                <button type="button" className="ac-btn ac-btn-danger" onClick={() => remove(a.id)}>{t('acc_delete')}</button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

const EXAMPLES: Array<[string, SavedTool]> = [
  ['Shaft diameter — Line 2', 'spc'],
  ['Filter housing height', 'xbar_r'],
  ['Caliper MSA — QC lab', 'gage_rr'],
]

/** Free accounts: the feature, visible, with a faded example and a way to Pro. */
export function SavedProjectsLocked() {
  const { t } = useLanguage()
  return (
    <div>
      <p className="ac-lead">{t('acc_saved_pro_text')}</p>
      <div className="ac-example" aria-hidden="true">
        {EXAMPLES.map(([name, tool]) => (
          <div key={name} className="ac-row">
            <div>
              <div className="ac-row-title" dir="ltr">{name}</div>
              <div className="ac-row-sub">{TOOL_LABELS[tool]}</div>
            </div>
            <span className="ac-btn ac-btn-ghost">{t('acc_open')}</span>
          </div>
        ))}
      </div>
      <div className="ac-cta-row">
        <Link href="/pricing" className="ac-btn ac-btn-gold">{t('acc_see_pro')}</Link>
        <span className="ac-muted">{t('acc_example_only')}</span>
      </div>
    </div>
  )
}
