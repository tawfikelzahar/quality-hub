'use client'

import Link from 'next/link'
import { getSharedStyles, usePersistedTheme } from '@/lib/theme'
import Nav from '@/components/Nav'
import { useLanguage } from '@/lib/i18n/context'

// Branded 404: same nav, colours and type as the rest of the site, with a
// way back to the home page, SPC Engine and the tool list.
export default function NotFound() {
  const [theme, setTheme] = usePersistedTheme()
  const { t } = useLanguage()
  const s = getSharedStyles(theme)
  const btn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, padding: '0 18px', borderRadius: 10, fontSize: 14, fontWeight: 600, textDecoration: 'none' }
  return (
    <div style={s.page}>
      <Nav theme={theme} setTheme={setTheme} breadcrumbKey="bc_notfound" />
      <main style={{ maxWidth: 560, margin: '0 auto', padding: '96px 20px 120px', textAlign: 'center' }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--qh-muted)', marginBottom: 14 }}>{t('nf_kicker')}</div>
        <h1 style={{ fontSize: 34, lineHeight: 1.2, margin: '0 0 14px', color: 'var(--qh-text)' }}>{t('nf_title')}</h1>
        <p style={{ fontSize: 16, lineHeight: 1.7, color: 'var(--qh-muted)', margin: '0 0 32px' }}>{t('nf_sub')}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
          <Link href="/" style={{ ...btn, background: 'var(--qh-accent)', color: 'var(--qh-onAccent)' }}>{t('nf_home')}</Link>
          <Link href="/spc" style={{ ...btn, border: '1px solid var(--qh-border)', color: 'var(--qh-text)' }}>{t('nf_spc')}</Link>
          <Link href="/guide" style={{ ...btn, border: '1px solid var(--qh-border)', color: 'var(--qh-text)' }}>{t('nf_guide')}</Link>
        </div>
      </main>
    </div>
  )
}
