'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useLanguage } from '@/lib/i18n/context'
import { stripLocale } from '@/lib/i18n/routing'
import type { TKey } from '@/lib/i18n/translations'
import { COLORS, tint, usePersistedTheme } from '@/lib/theme'
import { SITE, SITE_LINKS, whatsappLink } from '@/lib/site'
import { track } from '@/lib/analytics'

// ─────────────────────────────────────────────────────────────────────────
// Floating "Contact us" button (bottom corner). Every number, address and
// link comes from lib/site.ts, so changing them there updates this too.
//
// Shown on every page except those in HIDE_ON. So it never covers the end
// of a page (a table row, an export button), the page gets room for it at
// the bottom, and on phones it sits above a tool's Analyze / Export bar.
//
// GA4: each choice sends contact_click with channel = billing | question |
// suggest | email. Subscription & payment is highlighted in gold as the main topic, and opening the panel sends contact_open.
// ─────────────────────────────────────────────────────────────────────────

// Pages where the button stays hidden: Contact already lists every channel,
// and /admin is for the site owner only.
const HIDE_ON = ['/contact', '/admin']

type Topic = { key: 'billing' | 'question' | 'suggest'; icon: string; title: TKey; sub: TKey; msg: TKey }

const TOPICS: Topic[] = [
  { key: 'billing', icon: '💳', title: 'cw_billing_title', sub: 'cw_billing_sub', msg: 'cw_billing_msg' },
  { key: 'question', icon: '💬', title: 'cw_question_title', sub: 'cw_question_sub', msg: 'cw_question_msg' },
  { key: 'suggest', icon: '💡', title: 'cw_suggest_title', sub: 'cw_suggest_sub', msg: 'cw_suggest_msg' },
]

const NAVY = '#0B1F3F'
const GOLD = '#CDAA62'
const IVORY = '#F1ECE1'

function WhatsAppIcon({ size = 18, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.2-.2-.5-.3z"/>
    </svg>
  )
}

export default function ContactWidget() {
  const pathname = usePathname() || '/'
  const { t, lang } = useLanguage()
  const [theme] = usePersistedTheme()
  const c = COLORS[theme]
  const [open, setOpen] = useState(false)

  // Close with Escape
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const path = stripLocale(pathname)
  if (HIDE_ON.some(p => path === p || path.startsWith(p + '/'))) return null

  const toggle = () => {
    if (!open) track('contact_open')
    setOpen(o => !o)
  }

  const rowStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
    border: `1px solid ${c.border}`, borderRadius: 14, background: c.surface,
    textDecoration: 'none', color: c.text,
  }

  return (
    <div className="qh-cw" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {open && (
        <div
          id="qh-cw-panel"
          role="dialog"
          aria-label={t('cw_title')}
          className="qh-cw-panel"
          style={{ background: c.surface, border: `1px solid ${c.border}`, color: c.text }}
        >
          <div style={{ background: NAVY, color: IVORY, padding: '16px 18px', borderBottom: `2px solid ${GOLD}` }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{t('cw_title')}</div>
            <div style={{ fontSize: 12.5, opacity: 0.8, marginTop: 4 }}>{t('cw_reply_time')}</div>
          </div>

          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {TOPICS.map(tp => (
              <a
                key={tp.key}
                href={whatsappLink(t(tp.msg))}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => track('contact_click', { channel: tp.key })}
                className="qh-cw-row"
                style={tp.key === 'billing'
                  ? { ...rowStyle, borderColor: tint(c.gold, 55), background: tint(c.gold, 10) }
                  : rowStyle}
              >
                <span style={{ fontSize: 20, width: 28, textAlign: 'center' }} aria-hidden="true">{tp.icon}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontWeight: 600, fontSize: 14 }}>{t(tp.title)}</span>
                  <span style={{ display: 'block', fontSize: 12, color: c.muted, marginTop: 2 }}>{t(tp.sub)}</span>
                </span>
                <WhatsAppIcon size={18} color={c.muted} />
              </a>
            ))}

            <a
              href={SITE_LINKS.email}
              onClick={() => track('contact_click', { channel: 'email' })}
              className="qh-cw-row"
              style={{ ...rowStyle, justifyContent: 'center', padding: '10px 8px', fontSize: 12.5, background: c.surface2, marginTop: 2 }}
            >
              <span aria-hidden="true">✉️</span>
              <span dir="ltr">{SITE.contact.email}</span>
            </a>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls="qh-cw-panel"
        aria-label={open ? t('cw_close') : t('cw_open')}
        className="qh-cw-fab"
        style={{ background: NAVY, color: IVORY, border: `2px solid ${GOLD}` }}
      >
        {open
          ? <span style={{ fontSize: 22, lineHeight: 1 }} aria-hidden="true">✕</span>
          : <WhatsAppIcon size={26} color={IVORY} />}
      </button>

      <style>{`
        .qh-cw { position: fixed; bottom: 20px; inset-inline-end: 20px; z-index: 900;
          display: flex; flex-direction: column; align-items: flex-end; gap: 12px; }
        .qh-cw-fab { width: 56px; height: 56px; border-radius: 50%; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 8px 24px rgba(4, 9, 18, .35); transition: transform .15s ease; }
        .qh-cw-fab:hover { transform: scale(1.06); }
        .qh-cw-fab:focus-visible, .qh-cw-row:focus-visible { outline: 2px solid ${GOLD}; outline-offset: 2px; }
        .qh-cw-panel { width: min(320px, calc(100vw - 40px)); border-radius: 18px; overflow: hidden;
          box-shadow: 0 16px 40px rgba(4, 9, 18, .35); animation: qhcwIn .18s ease-out; }
        .qh-cw-row { transition: border-color .15s ease; }
        .qh-cw-row:hover { border-color: ${GOLD} !important; }
        @keyframes qhcwIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        @media (max-width: 640px) {
          .qh-cw { bottom: 14px; inset-inline-end: 14px; }
          .qh-cw-fab { width: 50px; height: 50px; }
        }
        body:has(.qh-cw) { padding-bottom: 88px; background: var(--qh-bg); }
        .qh-cw-panel { max-height: calc(100vh - 120px); overflow-y: auto; }
        @media (max-width: 768px) {
          body:has(.tl-bar) .qh-cw { bottom: calc(86px + env(safe-area-inset-bottom, 0px)); }
          body:has(.tl-bar) .qh-cw-panel { max-height: calc(100vh - 200px); }
        }
        @media print { .qh-cw { display: none; } body:has(.qh-cw) { padding-bottom: 0; } }
      `}</style>
    </div>
  )
}
