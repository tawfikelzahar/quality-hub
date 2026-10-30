'use client'

import Link from '@/components/LocaleLink'
import { COLORS, getSharedStyles, usePersistedTheme, tint } from '@/lib/theme'
import Nav from '@/components/Nav'
import { useLanguage } from '@/lib/i18n/context'
import type { TKey } from '@/lib/i18n/translations'
import { LEGAL_UPDATED, type LegalDoc } from '@/lib/legal'

// /privacy and /terms: short summary, clickable contents, numbered sections
// with anchors, and a contact block at the end. Same reading width and type
// as the About page.
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
  const paragraph: React.CSSProperties = { fontSize: 15, color: bodyColor, lineHeight: 1.85, margin: '0 0 10px' }
  const num = (i: number) => (lang === 'ar' ? (i + 1).toLocaleString('ar-EG') : String(i + 1))

  return (
    <div style={s.page}>
      <style>{`
        .lg-toc a { color: var(--qh-text); text-decoration: none; }
        .lg-toc a:hover { color: var(--qh-accent); text-decoration: underline; }
        .lg-sec { scroll-margin-top: 80px; }
        .lg-anchor { color: var(--qh-muted); text-decoration: none; opacity: 0; margin-inline-start: 6px; font-weight: 400; }
        .lg-sec h2:hover .lg-anchor { opacity: 1; }
        @media print {
          nav, header.qh-nav, .lg-noprint { display: none !important; }
          body { background: #fff !important; color: #000 !important; }
        }
      `}</style>
      <Nav theme={theme} setTheme={setTheme} breadcrumbKey={breadcrumbKey} showGetPro={false} />
      <main className="qh-main" style={{ ...s.main, alignItems: 'center' }}>
        <article style={{ maxWidth: 720, width: '100%', marginTop: 20, marginBottom: 60 }}>
          <header style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: c.accent, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>{d.kicker}</div>
            <h1 style={{ fontSize: 34, fontWeight: 800, color: c.text, margin: '0 0 10px', lineHeight: 1.28, letterSpacing: -0.5 }}>{d.title}</h1>
            <div style={{ fontSize: 13, color: c.muted }}>{d.updated}: {LEGAL_UPDATED[lang]}</div>
          </header>

          <p style={{ ...paragraph, fontSize: 16, textAlign: 'center', marginBottom: 28 }}>{d.intro}</p>

          <nav aria-label={d.toc} className="lg-toc" style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 14, padding: '18px 22px', marginBottom: 36 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: c.muted, textTransform: 'uppercase', letterSpacing: 1 }}>{d.toc}</span>
              <button type="button" className="lg-noprint" onClick={() => window.print()} style={{ background: 'transparent', border: `1px solid ${c.border}`, color: c.text, borderRadius: 8, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                {lang === 'ar' ? 'طباعة' : 'Print'}
              </button>
            </div>
            <ol style={{ margin: 0, paddingInlineStart: 22, listStyle: lang === 'ar' ? 'arabic-indic' : 'decimal', columns: '2 240px', columnGap: 28, fontSize: 14, lineHeight: 2 }}>
              {d.sections.map(sec => <li key={sec.id}><a href={`#${sec.id}`}>{sec.h}</a></li>)}
            </ol>
          </nav>

          {d.sections.map((sec, i) => (
            <section key={sec.id} id={sec.id} className="lg-sec" style={{ marginBottom: 26 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: c.text, margin: '0 0 10px', display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span style={{ color: c.accent, fontVariantNumeric: 'tabular-nums', minWidth: 22 }}>{num(i)}.</span>
                <span>{sec.h}<a className="lg-anchor" href={`#${sec.id}`} aria-label={sec.h}>#</a></span>
              </h2>
              {sec.list && (
                <ul style={{ margin: '0 0 10px', paddingInlineStart: 52, listStyle: 'disc' }}>
                  {sec.list.map((li, j) => <li key={j} style={{ ...paragraph, margin: '0 0 6px' }}>{li}</li>)}
                </ul>
              )}
              {sec.p?.map((txt, j) => <p key={j} style={{ ...paragraph, paddingInlineStart: 32 }}>{txt}</p>)}
            </section>
          ))}

          <aside style={{ marginTop: 36, background: tint(c.accent, 6), border: `1px solid ${c.border}`, borderRadius: 14, padding: '20px 22px', textAlign: 'center' }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: c.text, marginBottom: 6 }}>{d.questionTitle}</div>
            <div style={{ fontSize: 14, color: bodyColor, marginBottom: 14 }}>{d.questionText}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }} className="lg-noprint">
              <Link href="/contact" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 40, padding: '0 16px', borderRadius: 10, background: 'var(--qh-accent)', color: 'var(--qh-onAccent)', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>{t('footer_contact')}</Link>
              <Link href={other.href} style={{ display: 'inline-flex', alignItems: 'center', minHeight: 40, padding: '0 16px', borderRadius: 10, border: `1px solid ${c.border}`, color: c.text, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>{t(other.label)}</Link>
            </div>
          </aside>
        </article>
      </main>
    </div>
  )
}
