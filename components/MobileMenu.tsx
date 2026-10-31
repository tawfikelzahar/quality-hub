'use client'

import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { createPortal } from 'react-dom'
import Link from '@/components/LocaleLink'
import { usePathname } from 'next/navigation'
import GetProLink from '@/components/GetProLink'
import { createClient } from '@/lib/supabase'
import { track } from '@/lib/analytics'
import { useLanguage } from '@/lib/i18n/context'
import { TOOL_GROUPS } from '@/lib/tools'
import type { ThemeMode } from '@/lib/theme'
import type { TKey } from '@/lib/i18n/translations'
import { hereLocalized } from '@/lib/i18n/routing'
import { useAuthState } from '@/lib/authState'

// ─────────────────────────────────────────────────────────────────────────
// Phone / tablet menu: a ☰ button in the top nav that opens a drawer with
// tool search, every tool grouped like the sidebar and the landing page
// (from TOOL_GROUPS, so a new tool appears here by itself), the site links
// and the theme switch. The language toggle stays in the nav on purpose.
//
//   variant="tool"    → shown below 1100px, where ToolSidebar disappears
//   variant="landing" → shown below 769px, where the landing links hide
//
// The drawer is portalled to <body>: the landing nav uses backdrop-filter,
// which would otherwise trap a position:fixed child inside the nav.
// ─────────────────────────────────────────────────────────────────────────

const SITE_LINKS: { href: string; key: TKey }[] = [
  { href: '/tools', key: 'bc_tools' },
  { href: '/pricing', key: 'nav_pricing' },
  { href: '/guide', key: 'footer_guide' },
  { href: '/sample-reports', key: 'footer_sample_reports' },
  { href: '/account', key: 'bc_account' },
  { href: '/about', key: 'nav_about' },
  { href: '/contact', key: 'nav_contact' },
  { href: '/download', key: 'nav_getapp' },
]

interface Props {
  theme: ThemeMode
  setTheme: Dispatch<SetStateAction<ThemeMode>>
  variant?: 'tool' | 'landing'
}

export default function MobileMenu({ theme, setTheme, variant = 'tool' }: Props) {
  const { t, lang } = useLanguage()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [mounted, setMounted] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  // eslint-disable-next-line react-hooks/set-state-in-effect -- portal target only exists after mount
  useEffect(() => { setMounted(true) }, [])

  // Lock page scroll, close on Escape, move focus in and back out.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    const btn = btnRef.current
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
      btn?.focus()
    }
  }, [open])

  // Who is signed in (the nav shows only the avatar on phones, so the name and
  // Sign Out sit here). Shared state, no extra request (lib/authState.ts).
  const { user: authUser } = useAuthState()
  const signedIn = useMemo(() => {
    if (!authUser) return null
    const m = (authUser.user_metadata ?? {}) as Record<string, unknown>
    const name = (m.full_name as string) || (m.name as string) || [m.first_name, m.last_name].filter(Boolean).join(' ').trim() || authUser.email || ''
    return { name }
  }, [authUser])

  async function signOut() {
    await createClient().auth.signOut()
    window.location.href = hereLocalized('/')
  }

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return TOOL_GROUPS
    return TOOL_GROUPS
      .map(g => ({ ...g, rows: g.rows.filter(r => `${t(r.titleKey)} ${t(r.descKey)} ${r.keywords}`.toLowerCase().includes(q)) }))
      .filter(g => g.rows.length > 0)
  }, [query, t])

  const close = () => {
    const q = query.trim()
    if (q) track('search', { search_term: q.slice(0, 100), results: groups.reduce((n, g) => n + g.rows.length, 0), where: 'menu' })
    setOpen(false); setQuery('')
  }
  const upper = lang === 'ar' ? {} : { textTransform: 'uppercase' as const, letterSpacing: 0.8 }

  return (
    <>
      <style>{`
        .qh-mm-btn { display: none; align-items: center; justify-content: center; width: 40px; height: 40px; flex: none;
          border-radius: 10px; border: 1px solid var(--qh-border); background: var(--qh-surface2); color: var(--qh-text); cursor: pointer; padding: 0; }
        @media (max-width: 1099px) { .qh-mm-tool { display: inline-flex; } .qh-theme-tool { display: none !important; } }
        @media (max-width: 768px) { .qh-mm-landing { display: inline-flex; } .qh-theme-landing { display: none !important; } }

        .qh-mm-backdrop { position: fixed; inset: 0; z-index: 1000; background: rgba(4, 9, 18, .55); animation: qhmmFade .18s ease-out; }
        .qh-mm { position: fixed; top: 0; bottom: 0; inset-inline-end: 0; z-index: 1001; width: min(340px, 88vw);
          background: var(--qh-bg); border-inline-start: 1px solid var(--qh-border); box-shadow: 0 0 40px rgba(0,0,0,.35);
          display: flex; flex-direction: column; animation: qhmmIn .22s ease-out; }
        [dir="rtl"] .qh-mm { animation-name: qhmmInRtl; }
        @keyframes qhmmFade { from { opacity: 0 } }
        @keyframes qhmmIn { from { transform: translateX(100%) } }
        @keyframes qhmmInRtl { from { transform: translateX(-100%) } }
        @media (prefers-reduced-motion: reduce) { .qh-mm, .qh-mm-backdrop { animation: none; } }

        .qh-mm-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 14px 16px 10px; }
        .qh-mm-title { font-size: 15px; font-weight: 700; color: var(--qh-text); }
        .qh-mm-search { display: flex; align-items: center; gap: 8px; margin: 0 16px 6px; height: 44px; padding: 0 12px;
          border: 1px solid var(--qh-border); border-radius: 10px; background: var(--qh-surface); color: var(--qh-muted); }
        .qh-mm-search:focus-within { border-color: var(--qh-accent); }
        .qh-mm-search input { flex: 1; min-width: 0; background: transparent; border: 0; outline: none; color: var(--qh-text); font: inherit; font-size: 16px; }
        .qh-mm-body { flex: 1; overflow-y: auto; padding: 4px 8px 16px; overscroll-behavior: contain; }
        .qh-mm-h { font-size: 11px; font-weight: 700; color: var(--qh-muted); padding: 14px 10px 4px; }
        .qh-mm-body a.qh-mm-link { display: flex; justify-content: space-between; align-items: center; gap: 8px; min-height: 44px;
          padding: 0 10px; border-radius: 8px; color: var(--qh-text); font-size: 15px; text-decoration: none; }
        .qh-mm-body a.qh-mm-link:active, .qh-mm-body a.qh-mm-link:hover { background: var(--qh-surface); }
        .qh-mm-body a.qh-mm-link[aria-current="page"] { font-weight: 700; background: var(--qh-surface2); box-shadow: inset 3px 0 0 var(--qh-gold); }
        [dir="rtl"] .qh-mm-body a.qh-mm-link[aria-current="page"] { box-shadow: inset -3px 0 0 var(--qh-gold); }
        .qh-mm-pro { font-size: 10px; font-weight: 800; letter-spacing: .5px; color: var(--qh-onGold); background: var(--qh-gold); border-radius: 4px; padding: 1px 5px; flex: none; }
        .qh-mm-sep { height: 1px; background: var(--qh-border); margin: 12px 10px 4px; }
        .qh-mm-empty { padding: 16px 10px; color: var(--qh-muted); font-size: 14px; }
        .qh-mm-foot { border-top: 1px solid var(--qh-border); padding: 12px 16px calc(12px + env(safe-area-inset-bottom)); display: flex; flex-direction: column; gap: 12px; }
        .qh-mm-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 14px; color: var(--qh-text); }
        .qh-mm-seg { display: inline-flex; border: 1px solid var(--qh-border); border-radius: 999px; padding: 3px; background: var(--qh-surface); }
        .qh-mm-seg button { border: 0; background: transparent; color: var(--qh-muted); font: inherit; font-size: 13px; font-weight: 600;
          padding: 6px 14px; border-radius: 999px; cursor: pointer; min-height: 32px; }
        .qh-mm-seg button[aria-pressed="true"] { background: var(--qh-accent); color: var(--qh-onAccent); }
        .qh-mm-out { flex: none; border: 1px solid var(--qh-border); background: transparent; color: var(--qh-text); font: inherit; font-size: 13px;
          font-weight: 600; border-radius: 8px; padding: 0 14px; min-height: 36px; cursor: pointer; }
        .qh-mm-legal { display: flex; gap: 14px; font-size: 12px; }
        .qh-mm-legal a { color: var(--qh-muted); text-decoration: none; }
        .qh-mm-close { width: 40px; height: 40px; border-radius: 10px; border: 1px solid var(--qh-border); background: transparent; color: var(--qh-text);
          display: inline-flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; }
      `}</style>

      <button
        ref={btnRef}
        type="button"
        className={`qh-mm-btn qh-mm-${variant}`}
        aria-label={t('nav_menu')}
        aria-expanded={open}
        aria-controls="qh-mobile-menu"
        onClick={() => { track('menu_open'); setOpen(true) }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
      </button>

      {mounted && open && createPortal(
        <>
          <div className="qh-mm-backdrop" onClick={close} aria-hidden="true" />
          <div id="qh-mobile-menu" className="qh-mm" role="dialog" aria-modal="true" aria-label={t('nav_menu')}>
            <div className="qh-mm-head">
              <span className="qh-mm-title">{t('nav_menu')}</span>
              <button ref={closeRef} type="button" className="qh-mm-close" onClick={close} aria-label={t('nav_menu_close')}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>

            <label className="qh-mm-search">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
              <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{t('home_search_label')}</span>
              <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={t('home_search_placeholder')} />
            </label>

            <nav className="qh-mm-body" aria-label={t('nav_tools')}>
              {groups.length === 0 && (
                <p className="qh-mm-empty">{t('home_search_empty').replace('{q}', query.trim())}</p>
              )}
              {groups.map(g => (
                <div key={g.id}>
                  <div className="qh-mm-h" style={upper}>{t(g.labelKey)}</div>
                  {g.rows.map(r => (
                    <Link key={r.href} href={r.href} className="qh-mm-link" onClick={close} aria-current={r.href === pathname ? 'page' : undefined}>
                      <span>{t(r.titleKey)}</span>
                      {r.pro && <span className="qh-mm-pro">PRO</span>}
                    </Link>
                  ))}
                </div>
              ))}

              {!query.trim() && (
                <>
                  <div className="qh-mm-sep" />
                  {SITE_LINKS.map(l => (
                    <Link key={l.href} href={l.href} className="qh-mm-link" onClick={close} aria-current={l.href === pathname ? 'page' : undefined}>
                      <span>{t(l.key)}</span>
                    </Link>
                  ))}
                </>
              )}
            </nav>

            <div className="qh-mm-foot">
              <div className="qh-mm-row">
                <span>{t('nav_appearance')}</span>
                <div className="qh-mm-seg" role="group" aria-label={t('nav_appearance')}>
                  <button type="button" aria-pressed={theme === 'light'} onClick={() => setTheme('light')}>{t('theme_light')}</button>
                  <button type="button" aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}>{t('theme_dark')}</button>
                </div>
              </div>
              <GetProLink
                label={t('nav_getpro')}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, borderRadius: 10, background: 'var(--qh-gold)', color: 'var(--qh-onGold)', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}
              />
              {signedIn && (
                <div className="qh-mm-row">
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--qh-muted)' }}>{signedIn.name}</span>
                  <button type="button" onClick={signOut} className="qh-mm-out">{t('nav_signout')}</button>
                </div>
              )}
              <div className="qh-mm-legal">
                <Link href="/privacy" onClick={close}>{t('footer_privacy')}</Link>
                <Link href="/terms" onClick={close}>{t('footer_terms')}</Link>
              </div>
            </div>
          </div>
        </>,
        document.body,
      )}
    </>
  )
}
