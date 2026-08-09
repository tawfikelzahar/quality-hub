'use client'

import Link from 'next/link'
import { COLORS, getSharedStyles, usePersistedTheme } from '@/lib/theme'
import AuthStatus from '@/components/AuthStatus'

// ─────────────────────────────────────────────────────────────────────────
// Static contact page. Same three channels as the "Meet the Builder"
// section on /about — kept in sync manually since this is a tiny,
// low-churn list. Update both files if any of these change.
// ─────────────────────────────────────────────────────────────────────────
const CHANNELS = [
  {
    key: 'email',
    icon: '✉️',
    title: 'Email',
    detail: 'tawfik.elzahar1@gmail.com',
    sub: 'Best for detailed questions, billing, or account issues.',
    href: 'mailto:tawfik.elzahar1@gmail.com',
    cta: 'Send an email',
  },
  {
    key: 'whatsapp',
    icon: '💬',
    title: 'WhatsApp',
    detail: '+20 122 449 1539',
    sub: 'Best for quick questions before you subscribe.',
    href: 'https://wa.me/201224491539',
    cta: 'Open WhatsApp',
  },
  {
    key: 'linkedin',
    icon: '🔗',
    title: 'LinkedIn',
    detail: 'in/tawfikelzahar',
    sub: 'Connect, follow updates, or send a message.',
    href: 'https://www.linkedin.com/in/tawfikelzahar',
    cta: 'View profile',
  },
] as const

export default function ContactPage() {
  const [theme, setTheme] = usePersistedTheme()
  const c = COLORS[theme]
  const s = getSharedStyles(theme)

  return (
    <div style={s.page}>
      <nav className="qh-nav" style={s.nav}>
        <div className="qh-nav-left" style={s.navLeft}>
          <Link href="/" style={s.logo}>
            <div style={s.logoIcon}>σ</div>
            QualityTools
          </Link>
          <span className="qh-breadcrumb-sep" style={s.separator}>/</span>
          <span className="qh-breadcrumb" style={s.breadcrumb}>Contact</span>
        </div>
        <div className="qh-nav-right" style={s.navRight}>
          <button style={s.themeBtn} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </button>
          <AuthStatus />
        </div>
      </nav>

      <main className="qh-main" style={{ ...s.main, alignItems: 'center' }}>
        <div style={{ maxWidth: 760, width: '100%', textAlign: 'center', marginTop: 20, marginBottom: 8 }}>
          <h1 style={{ fontSize: 30, fontWeight: 800, color: c.text, margin: '0 0 10px' }}>
            Get in touch
          </h1>
          <p style={{ fontSize: 14, color: c.muted, margin: 0 }}>
            Questions, feedback, or a feature request — reach out directly. You&apos;ll be talking
            to the person building Quality Hub, not a support queue.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', maxWidth: 760, width: '100%', marginTop: 32, justifyContent: 'center' }}>
          {CHANNELS.map((ch) => (
            <div
              key={ch.key}
              style={{
                ...s.card,
                flex: '1 1 220px',
                minWidth: 220,
                maxWidth: 260,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                gap: 6,
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 4 }}>{ch.icon}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: c.text }}>{ch.title}</div>
              <div style={{ fontSize: 13, color: c.accent, fontWeight: 600, wordBreak: 'break-word' }}>
                {ch.detail}
              </div>
              <div style={{ fontSize: 12, color: c.muted, lineHeight: 1.6, marginBottom: 10 }}>
                {ch.sub}
              </div>
              <a
                href={ch.href}
                target={ch.key === 'email' ? undefined : '_blank'}
                rel={ch.key === 'email' ? undefined : 'noopener noreferrer'}
                style={{ ...s.exportBtn, textDecoration: 'none', width: '100%' }}
              >
                {ch.cta}
              </a>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 12, color: c.muted, marginTop: 36, marginBottom: 20 }}>
          Want to know more about the project first?{' '}
          <Link href="/about" style={{ color: c.accent, textDecoration: 'none', fontWeight: 600 }}>
            Read the About page
          </Link>
        </div>
      </main>
    </div>
  )
}
