'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from '@/components/LocaleLink'
import { useLanguage } from '@/lib/i18n/context'
import { TOOL_GROUPS, TOOL_COUNT, LANDING_COLUMN_ORDER } from '@/lib/tools'
import { track } from '@/lib/analytics'

// ─────────────────────────────────────────────────────────────────────────
// Every tool, grouped by the question a quality engineer is asking, with a
// search box. One component for the landing page's tools section and the
// /tools page, so both always list the same tools (from lib/tools.ts).
//
// Each tool row is a link and has to look like one: an arrow at the end, a
// tinted background and a moving arrow on hover, and a visible focus ring
// for keyboard users (visitors did not realise the rows were clickable).
// ─────────────────────────────────────────────────────────────────────────

const IconSearch = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
)
const IconChevron = () => (
  <svg className="td-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
)
const IconGo = () => (
  <svg className="td-go" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
)

/** true on phone widths: tool groups start collapsed there */
function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)')
    const update = () => setNarrow(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return narrow
}

/** How many columns the groups show (matches the .td-groups media queries). */
function useToolColumns(): 1 | 2 | 3 {
  const [cols, setCols] = useState<1 | 2 | 3>(3)
  useEffect(() => {
    const one = window.matchMedia('(max-width: 720px)')
    const two = window.matchMedia('(max-width: 1100px)')
    const update = () => setCols(one.matches ? 1 : two.matches ? 2 : 3)
    update()
    one.addEventListener('change', update)
    two.addEventListener('change', update)
    return () => { one.removeEventListener('change', update); two.removeEventListener('change', update) }
  }, [])
  return cols
}

const CSS = `
  .td-head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-end; gap: 20px; margin-bottom: 32px; }
  .td-title { margin: 0 0 10px; font-size: clamp(24px, 3.4vw, 34px); font-weight: 700; letter-spacing: -0.5px; line-height: 1.25; color: var(--qh-text); }
  [dir="rtl"] .td-title { letter-spacing: 0; }
  .td-sub { margin: 0; font-size: 16px; line-height: 1.7; color: color-mix(in srgb, var(--qh-text) 76%, var(--qh-bg)); max-width: 640px; }
  .td-search { position: relative; display: flex; align-items: center; gap: 10px; height: 46px; padding: 0 14px; border: 1px solid var(--qh-border); border-radius: 10px; background: var(--qh-bg); width: 320px; max-width: 100%; color: var(--qh-muted); }
  .td-search input { flex: 1; min-width: 0; background: transparent; border: 0; outline: none; color: var(--qh-text); font: inherit; font-size: 14px; }
  .td-search:focus-within { border-color: var(--qh-accent); }
  .td-groups { column-count: 3; column-gap: 16px; }
  .td-group { break-inside: avoid; display: block; margin-bottom: 16px; padding: 0 12px; background: var(--qh-surface); border: 1px solid var(--qh-border); border-radius: 14px; }
  @media (max-width: 1100px) { .td-groups { column-count: 2; } }
  @media (max-width: 720px) { .td-groups { column-count: 1; } }
  .td-group summary { list-style: none; cursor: pointer; padding: 20px 10px 14px; display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
  .td-group summary::-webkit-details-marker { display: none; }
  .td-label { display: block; font-size: 12px; font-weight: 600; color: var(--qh-muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
  [dir="rtl"] .td-label { text-transform: none; letter-spacing: 0; }
  .td-q { display: block; font-size: 18px; font-weight: 600; color: var(--qh-text); }
  .td-chev { color: var(--qh-muted); transition: transform .2s ease; margin-top: 4px; display: none; flex: none; }
  .td-group[open] .td-chev { transform: rotate(180deg); }
  .td-row { display: flex; align-items: center; gap: 12px; padding: 12px 10px; border-top: 1px solid var(--qh-border); color: var(--qh-text); min-height: 52px; border-radius: 8px; text-decoration: none; transition: background-color .15s ease; }
  .td-row:last-child { margin-bottom: 10px; }
  .td-row-main { flex: 1; min-width: 0; }
  .td-row-title { display: block; font-weight: 600; font-size: 15px; }
  .td-row-desc { display: block; font-size: 13px; color: var(--qh-muted); line-height: 1.6; }
  .td-go { flex: none; color: var(--qh-muted); transition: transform .15s ease, color .15s ease; }
  [dir="rtl"] .td-go { transform: scaleX(-1); }
  .td-row:hover, .td-row:focus-visible { background: var(--qh-surface2); border-top-color: transparent; }
  .td-row:hover + .td-row, .td-row:focus-visible + .td-row { border-top-color: transparent; }
  .td-row:hover .td-row-title, .td-row:focus-visible .td-row-title { color: var(--qh-gold); }
  .td-row:hover .td-go, .td-row:focus-visible .td-go { color: var(--qh-gold); transform: translateX(3px); }
  [dir="rtl"] .td-row:hover .td-go, [dir="rtl"] .td-row:focus-visible .td-go { transform: scaleX(-1) translateX(3px); }
  .td-row:focus-visible { outline: 2px solid var(--qh-gold); outline-offset: -2px; }
  .td-pro { font-size: 11px; font-weight: 800; letter-spacing: .5px; color: var(--qh-onGold); background: var(--qh-gold); border-radius: 5px; padding: 2px 7px; white-space: nowrap; flex: none; }
  .td-hint { margin: 0 10px; padding: 12px 0 18px; border-top: 1px solid var(--qh-border); font-size: 13px; line-height: 1.6; color: var(--qh-muted); }
  .td-empty { margin: 0; font-size: 15px; color: var(--qh-muted); }
  @media (max-width: 640px) {
    .td-group { padding: 0 6px; }
    .td-group summary { padding: 14px 8px; min-height: 52px; align-items: center; }
    .td-chev { display: block; }
  }
`

export default function ToolsDirectory({ as = 'h2', where }: {
  /** h1 on the /tools page, h2 inside the landing page */
  as?: 'h1' | 'h2'
  /** analytics: where the search was used */
  where: 'home' | 'tools'
}) {
  const { t } = useLanguage()
  const narrow = useNarrow()
  const cols = useToolColumns()
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()

  // One column reads the groups in their natural order; two or three columns
  // use an order that keeps the column heights close (groups flow top to bottom)
  const groups = useMemo(() => {
    if (cols === 1) return TOOL_GROUPS
    const order = LANDING_COLUMN_ORDER[cols]
    return [...TOOL_GROUPS].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
  }, [cols])
  const visible = useMemo(() => {
    if (!q) return groups
    return groups
      .map(g => ({ ...g, rows: g.rows.filter(r => `${t(r.titleKey)} ${t(r.descKey)} ${r.keywords}`.toLowerCase().includes(q)) }))
      .filter(g => g.rows.length > 0)
  }, [q, t, groups])

  const Title = as
  return (
    <>
      <style>{CSS}</style>
      <div className="td-head">
        <div>
          <Title className="td-title">{t('home_tools_title')}</Title>
          <p className="td-sub">{t('home_tools_sub').replace('{n}', String(TOOL_COUNT))}</p>
        </div>
        <label className="td-search">
          <IconSearch />
          <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{t('home_search_label')}</span>
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onBlur={() => { const v = query.trim(); if (v) track('search', { search_term: v.slice(0, 100), where }) }}
            placeholder={t('home_search_placeholder')}
          />
        </label>
      </div>

      {visible.length === 0 ? (
        <p className="td-empty">{t('home_search_empty').replace('{q}', query.trim())}</p>
      ) : (
        <div className="td-groups">
          {visible.map((g, gi) => (
            // Re-mount when the layout or search changes so the open state resets:
            // all open on desktop and while searching, only the first open on phones.
            <details key={`${g.id}-${narrow ? 'n' : 'w'}-${q ? 's' : ''}`} className="td-group" open={!narrow || !!q || gi === 0}>
              <summary>
                <span>
                  <span className="td-label">{t(g.labelKey)}</span>
                  <span className="td-q">{t(g.questionKey)}</span>
                </span>
                <IconChevron />
              </summary>
              {g.rows.map(r => (
                <Link key={r.href} href={r.href} className="td-row">
                  <span className="td-row-main">
                    <span className="td-row-title">{t(r.titleKey)}</span>
                    <span className="td-row-desc">{t(r.descKey)}</span>
                  </span>
                  {r.pro && <span className="td-pro">PRO</span>}
                  <IconGo />
                </Link>
              ))}
              {g.id === 'stability' && !q && <p className="td-hint">{t('home_stability_hint')}</p>}
            </details>
          ))}
        </div>
      )}
    </>
  )
}
