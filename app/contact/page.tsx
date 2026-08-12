'use client'

import Link from 'next/link'
import { COLORS, getSharedStyles, usePersistedTheme } from '@/lib/theme'
import Nav from '@/components/Nav'

// ─────────────────────────────────────────────────────────────────────────
// Static contact page. Same three channels as the "Meet the Builder"
// section on /about — kept in sync manually since this is a tiny,
// low-churn list. Update both files if any of these change.
// ─────────────────────────────────────────────────────────────────────────
const CHANNELS = [
  {
    key: 'email',
    title: 'Email',
    detail: 'tawfik.elzahar1@gmail.com',
    sub: 'Best for detailed questions, billing, or account issues.',
    href: 'mailto:tawfik.elzahar1@gmail.com',
    cta: 'Send an email',
  },
  {
    key: 'whatsapp',
    title: 'WhatsApp',
    detail: '+20 122 449 1539',
    sub: 'Best for quick questions before you subscribe.',
    href: 'https://wa.me/201224491539',
    cta: 'Open WhatsApp',
  },
  {
    key: 'linkedin',
    title: 'LinkedIn',
    detail: 'in/tawfikelzahar',
    sub: 'Connect, follow updates, or send a message.',
    href: 'https://www.linkedin.com/in/tawfikelzahar',
    cta: 'View profile',
  },
] as const

// Inline SVGs instead of emoji — emoji glyphs render inconsistently (or as
// blank boxes) across OSes/browsers; these look identical everywhere.
function ChannelIcon({ channelKey }: { channelKey: (typeof CHANNELS)[number]['key'] }) {
  const common = { width: 22, height: 22 }
  if (channelKey === 'email') {
    return (
      <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16v16H4z" />
        <path d="m4 6 8 7 8-7" />
      </svg>
    )
  }
  if (channelKey === 'whatsapp') {
    return (
      <svg {...common} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12.04 2c-5.52 0-10 4.48-10 10 0 1.77.46 3.45 1.27 4.9L2 22l5.25-1.38A9.94 9.94 0 0 0 12.04 22c5.52 0 10-4.48 10-10s-4.48-10-10-10Zm5.72 14.24c-.24.68-1.4 1.3-1.94 1.35-.5.05-1.02.24-3.4-.71-2.9-1.16-4.76-4.1-4.9-4.3-.14-.2-1.17-1.55-1.17-2.96 0-1.4.74-2.09 1-2.38.26-.28.57-.35.76-.35h.5c.17 0 .38-.02.6.46.24.55.8 1.94.87 2.08.07.14.12.31.02.5-.1.2-.15.3-.29.47-.14.16-.3.36-.43.48-.14.14-.3.28-.13.55.17.28.75 1.24 1.62 2.01 1.11 1 2.05 1.3 2.32 1.45.28.14.44.12.6-.07.17-.2.7-.82.9-1.1.19-.28.38-.24.63-.14.26.1 1.64.77 1.92.91.28.14.47.2.53.32.07.12.07.68-.17 1.36Z" />
      </svg>
    )
  }
  return (
    <svg {...common} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.38-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29ZM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13ZM7.12 20.45H3.56V9h3.56v11.45Z" />
    </svg>
  )
}

export default function ContactPage() {
  const [theme, setTheme] = usePersistedTheme()
  const c = COLORS[theme]
  const s = getSharedStyles(theme)
  const dark = theme === 'dark'

  // Same reasoning as /about: paragraph copy reads better with a bit more
  // contrast than the app's default `muted` (tuned for small captions).
  const bodyColor = dark ? 'rgba(226,232,240,0.82)' : 'rgba(30,41,59,0.82)'
  const subColor = dark ? 'rgba(226,232,240,0.62)' : 'rgba(30,41,59,0.62)'

  return (
    <div style={s.page}>
      <Nav theme={theme} setTheme={setTheme} breadcrumbKey="bc_contact" showGetPro={false} />

      <main className="qh-main" style={{ ...s.main, alignItems: 'center' }}>
        <div style={{ maxWidth: 760, width: '100%', textAlign: 'center', marginTop: 20, marginBottom: 8 }}>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: c.text, margin: '0 0 12px', letterSpacing: -0.5 }}>
            Get in touch
          </h1>
          <p style={{ fontSize: 15, color: bodyColor, lineHeight: 1.7, margin: '0 auto', maxWidth: 480 }}>
            Questions, feedback, or a feature request — reach out directly. You&apos;ll be talking
            to the person building Quality Hub, not a support queue.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', maxWidth: 780, width: '100%', marginTop: 36, justifyContent: 'center' }}>
          {CHANNELS.map((ch) => (
            <div
              key={ch.key}
              style={{
                ...s.card,
                flex: '1 1 230px',
                minWidth: 230,
                maxWidth: 260,
                padding: 24,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                gap: 4,
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  background: `${c.accent}14`,
                  border: `1px solid ${c.accent}30`,
                  color: c.accent,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 12,
                }}
              >
                <ChannelIcon channelKey={ch.key} />
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: c.text }}>{ch.title}</div>
              <div style={{ fontSize: 13, color: c.accent, fontWeight: 600, wordBreak: 'break-word' }}>
                {ch.detail}
              </div>
              <div style={{ fontSize: 12.5, color: subColor, lineHeight: 1.65, margin: '4px 0 14px' }}>
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

        <div style={{ fontSize: 13, color: subColor, marginTop: 40, marginBottom: 24 }}>
          Want to know more about the project first?{' '}
          <Link href="/about" style={{ color: c.accent, textDecoration: 'none', fontWeight: 600 }}>
            Read the About page
          </Link>
        </div>
      </main>
    </div>
  )
}
