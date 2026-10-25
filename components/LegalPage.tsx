'use client'

import Link from 'next/link'
import { COLORS, getSharedStyles, usePersistedTheme } from '@/lib/theme'
import Nav from '@/components/Nav'
import { useLanguage } from '@/lib/i18n/context'
import type { TKey } from '@/lib/i18n/translations'
import { LEGAL_UPDATED, type LegalDoc } from '@/lib/legal'

// /privacy and /terms: same reading layout as the About page.
export default function LegalPage({ doc, breadcrumbKey, other }: {
  doc: Record<'en' | 'ar', LegalDoc>
  breadcrumbKey: TKey
  other: { href: string; label: TKey }
}) {
  const [theme, setTheme] = usePersistedTheme()
  const { t, lang } = useLanguage()
  const c = COLORS[theme]
  const s = getSharedStyles(theme)
  const d = doc[lang]
  const bodyColor = theme === 'dark' ? 'rgba(226,232,240,0.82)' : 'rgba(30,41,59,0.82)'
  const paragraph: React.CSSProperties = { fontSize: 15, color: bodyColor, lineHeight: 1.85, margin: '0 0 12px' }

  return (
    <div style={s.page}>
      <Nav theme={theme} setTheme={setTheme} breadcrumbKey={breadcrumbKey} showGetPro={false} />
      <main className="qh-main" style={{ ...s.main, alignItems: 'center' }}>
        <article style={{ maxWidth: 720, width: '100%', marginTop: 20, marginBottom: 60 }}>
          <header style={{ textAlign: 'center', marginBottom: 36 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: c.accent, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>{d.kicker}</div>
            <h1 style={{ fontSize: 34, fontWeight: 800, color: c.text, margin: '0 0 10px', lineHeight: 1.28, letterSpacing: -0.5 }}>{d.title}</h1>
            <div style={{ fontSize: 13, color: c.muted }}>{d.updated}: {LEGAL_UPDATED[lang]}</div>
          </header>
          <p style={{ ...paragraph, fontSize: 16, marginBottom: 32 }}>{d.intro}</p>
          {d.sections.map((sec, i) => (
            <section key={i} style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: c.text, margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span aria-hidden="true" style={{ width: 4, height: 17, borderRadius: 2, background: c.accent, flexShrink: 0 }} />
                {sec.h}
              </h2>
              {sec.list && (
                <ul style={{ margin: '0 0 12px', paddingInlineStart: 22, listStyle: 'disc' }}>
                  {sec.list.map((li, j) => <li key={j} style={{ ...paragraph, margin: '0 0 6px' }}>{li}</li>)}
                </ul>
              )}
              {sec.p?.map((txt, j) => <p key={j} style={paragraph}>{txt}</p>)}
            </section>
          ))}
          <div style={{ borderTop: `1px solid ${c.border}`, paddingTop: 20, fontSize: 14, color: c.muted, display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            <Link href={other.href} style={{ color: c.text, fontWeight: 600 }}>{t(other.label)}</Link>
            <Link href="/contact" style={{ color: c.text, fontWeight: 600 }}>{t('footer_contact')}</Link>
          </div>
        </article>
      </main>
    </div>
  )
}
