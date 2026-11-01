'use client'

import { useMemo, useState, type CSSProperties } from 'react'
import Link from '@/components/LocaleLink'
import { useLanguage } from '@/lib/i18n/context'
import { TOOL_GROUPS, TOOL_COUNT } from '@/lib/tools'
import { track } from '@/lib/analytics'

// ─────────────────────────────────────────────────────────────────────────
// Every tool, grouped by the question a quality engineer is asking, with a
// search box and question filters. One component for the landing page's
// tools section and the /tools page, so both always list the same tools
// (from lib/tools.ts).
//
// Layout: one band per question — the question with its icon on one side,
// its tools as cards on the other (two columns on wide screens, one on
// phones, where the question sits above its tools and the filters scroll
// sideways). Each tool card is a link and looks like one: an arrow at the
// end, a gold border and title on hover, and a focus ring for keyboards.
// ─────────────────────────────────────────────────────────────────────────

const IconSearch = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
)
const IconGo = () => (
  <svg className="td-go" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
)

/** "4 tools" / "4 أدوات" with the Arabic dual and plural forms. */
function toolCount(n: number, lang: string): string {
  if (lang !== 'ar') return n === 1 ? '1 tool' : `${n} tools`
  if (n === 1) return 'أداة واحدة'
  if (n === 2) return 'أداتان'
  return n <= 10 ? `${n} أدوات` : `${n} أداة`
}

const CSS = `
  .td-head { text-align: center; margin-bottom: 24px; }
  .td-title { margin: 0 0 10px; font-size: clamp(26px, 3.6vw, 38px); font-weight: 700; letter-spacing: -0.5px; line-height: 1.25; color: var(--qh-text); }
  [dir="rtl"] .td-title { letter-spacing: 0; }
  .td-sub { margin: 0 auto; font-size: 16px; line-height: 1.7; color: color-mix(in srgb, var(--qh-text) 76%, var(--qh-bg)); max-width: 640px; }
  .td-search { position: relative; display: flex; align-items: center; gap: 10px; height: 52px; padding: 0 16px; margin: 24px auto 16px; border: 1px solid var(--qh-border); border-radius: 14px; background: var(--qh-surface); width: 560px; max-width: 100%; color: var(--qh-muted); box-sizing: border-box; }
  .td-search input { flex: 1; min-width: 0; background: transparent; border: 0; outline: none; color: var(--qh-text); font: inherit; font-size: 15px; }
  .td-search:focus-within { border-color: var(--qh-accent); }
  .td-chips { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin: 0 0 32px; padding: 0; list-style: none; }
  .td-chip { border: 1px solid var(--qh-border); border-radius: 999px; padding: 8px 16px; min-height: 38px; font: inherit; font-size: 13.5px; color: var(--qh-muted); background: transparent; cursor: pointer; white-space: nowrap; transition: color .15s ease, border-color .15s ease; }
  .td-chip:hover { color: var(--qh-text); border-color: color-mix(in srgb, var(--qh-text) 35%, transparent); }
  .td-chip[aria-pressed="true"] { background: var(--qh-text); color: var(--qh-bg); border-color: var(--qh-text); font-weight: 700; }
  .td-chip:focus-visible { outline: 2px solid var(--qh-gold); outline-offset: 2px; }

  .td-band { --g: var(--gd); display: grid; grid-template-columns: minmax(220px, 300px) 1fr; gap: 32px; padding: 28px 0; border-top: 1px solid var(--qh-border); }
  :root[data-qh-theme="light"] .td-band { --g: var(--gl); }
  .td-ic { width: 38px; height: 38px; border-radius: 10px; display: grid; place-items: center; color: var(--g); background: color-mix(in srgb, var(--g) 14%, transparent); margin-bottom: 12px; }
  .td-label { display: block; font-size: 12.5px; font-weight: 700; color: var(--g); text-transform: uppercase; letter-spacing: 1px; }
  [dir="rtl"] .td-label { text-transform: none; letter-spacing: 0; }
  .td-q { margin: 6px 0; font-size: 22px; font-weight: 700; line-height: 1.35; color: var(--qh-text); }
  .td-n { font-size: 13px; color: var(--qh-muted); }
  .td-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; align-content: start; }
  .td-row { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 16px; min-height: 72px; box-sizing: border-box; border: 1px solid var(--qh-border); border-radius: 12px; background: var(--qh-surface); color: var(--qh-text); text-decoration: none; transition: border-color .15s ease, background-color .15s ease; }
  .td-row-main { min-width: 0; }
  .td-row-title { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-weight: 600; font-size: 15px; transition: color .15s ease; }
  .td-row-desc { display: block; margin-top: 4px; font-size: 13px; color: var(--qh-muted); line-height: 1.55; }
  .td-row-end { display: flex; align-items: center; gap: 10px; flex: none; }
  .td-std { font-size: 11.5px; color: var(--qh-muted); border: 1px solid var(--qh-border); border-radius: 999px; padding: 2px 9px; white-space: nowrap; direction: ltr; }
  .td-go { flex: none; color: var(--qh-muted); transition: transform .15s ease, color .15s ease; }
  [dir="rtl"] .td-go { transform: scaleX(-1); }
  .td-row:hover, .td-row:focus-visible { border-color: var(--qh-gold); background: var(--qh-surface2); }
  .td-row:hover .td-row-title, .td-row:focus-visible .td-row-title { color: var(--qh-gold); }
  .td-row:hover .td-go, .td-row:focus-visible .td-go { color: var(--qh-gold); transform: translateX(3px); }
  [dir="rtl"] .td-row:hover .td-go, [dir="rtl"] .td-row:focus-visible .td-go { transform: scaleX(-1) translateX(3px); }
  .td-row:focus-visible { outline: 2px solid var(--qh-gold); outline-offset: 2px; }
  .td-pro { font-size: 10.5px; font-weight: 800; letter-spacing: .5px; color: var(--qh-onGold); background: var(--qh-gold); border-radius: 5px; padding: 2px 6px; white-space: nowrap; }
  .td-start { font-size: 11px; font-weight: 700; color: var(--qh-gold); border: 1px solid color-mix(in srgb, var(--qh-gold) 55%, transparent); border-radius: 999px; padding: 1px 8px; white-space: nowrap; }
  .td-hint { grid-column: 1 / -1; margin: 4px 2px 0; font-size: 13px; line-height: 1.6; color: var(--qh-muted); }
  .td-empty { margin: 0; padding: 28px 0; border-top: 1px solid var(--qh-border); text-align: center; font-size: 15px; color: var(--qh-muted); }

  @media (max-width: 900px) {
    .td-band { grid-template-columns: 1fr; gap: 16px; padding: 24px 0; }
    .td-q-side { display: grid; grid-template-columns: auto 1fr; column-gap: 12px; align-items: center; }
    .td-ic { grid-row: span 2; margin-bottom: 0; }
    .td-q { margin: 2px 0 0; font-size: 19px; }
    .td-n { display: none; }
  }
  @media (max-width: 640px) {
    .td-chips { flex-wrap: nowrap; justify-content: flex-start; overflow-x: auto; margin-inline: -16px; padding-inline: 16px; scrollbar-width: none; }
    .td-chips::-webkit-scrollbar { display: none; }
    .td-list { grid-template-columns: 1fr; }
    .td-std { display: none; }
  }
`

export default function ToolsDirectory({ as = 'h2', where }: {
  /** h1 on the /tools page, h2 inside the landing page */
  as?: 'h1' | 'h2'
  /** analytics: where the search was used */
  where: 'home' | 'tools'
}) {
  const { t, lang } = useLanguage()
  const [query, setQuery] = useState('')
  const [only, setOnly] = useState<string | null>(null)
  const q = query.trim().toLowerCase()

  const visible = useMemo(() => {
    return TOOL_GROUPS
      .filter(g => !only || g.id === only)
      .map(g => ({ ...g, rows: q ? g.rows.filter(r => `${t(r.titleKey)} ${t(r.descKey)} ${r.keywords}`.toLowerCase().includes(q)) : g.rows }))
      .filter(g => g.rows.length > 0)
  }, [q, t, only])

  const Title = as
  return (
    <>
      <style>{CSS}</style>
      <div className="td-head">
        <Title className="td-title">{t('home_tools_title')}</Title>
        <p className="td-sub">{t('home_tools_sub').replace('{n}', String(TOOL_COUNT))}</p>
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

      <ul className="td-chips" aria-label={t('home_filter_label')}>
        <li><button type="button" className="td-chip" aria-pressed={only === null} onClick={() => setOnly(null)}>{t('home_filter_all')}</button></li>
        {TOOL_GROUPS.map(g => (
          <li key={g.id}>
            <button type="button" className="td-chip" aria-pressed={only === g.id} onClick={() => setOnly(only === g.id ? null : g.id)}>{t(g.labelKey)}</button>
          </li>
        ))}
      </ul>

      {visible.length === 0 ? (
        <p className="td-empty">{t('home_search_empty').replace('{q}', query.trim())}</p>
      ) : (
        visible.map(g => (
          <section key={g.id} className="td-band" style={{ '--gd': g.color[0], '--gl': g.color[1] } as CSSProperties} aria-labelledby={`td-q-${g.id}`}>
            <div className="td-q-side">
              <span className="td-ic" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={g.icon} /></svg>
              </span>
              <span className="td-label">{t(g.labelKey)}</span>
              <h3 className="td-q" id={`td-q-${g.id}`}>{t(g.questionKey)}</h3>
              <span className="td-n">{toolCount(g.rows.length, lang)}</span>
            </div>
            <div className="td-list">
              {g.rows.map(r => (
                <Link key={r.href} href={r.href} className="td-row">
                  <span className="td-row-main">
                    <span className="td-row-title">
                      {t(r.titleKey)}
                      {r.pro && <span className="td-pro">PRO</span>}
                      {r.start && !q && <span className="td-start">{t('home_start_here')}</span>}
                    </span>
                    <span className="td-row-desc">{t(r.descKey)}</span>
                  </span>
                  <span className="td-row-end">
                    {r.std && <span className="td-std">{r.std}</span>}
                    <IconGo />
                  </span>
                </Link>
              ))}
              {g.id === 'stability' && !q && <p className="td-hint">{t('home_stability_hint')}</p>}
            </div>
          </section>
        ))
      )}
    </>
  )
}
