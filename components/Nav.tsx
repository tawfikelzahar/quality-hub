'use client'

import type { Dispatch, SetStateAction } from 'react'
import Link from 'next/link'
import AuthStatus from '@/components/AuthStatus'
import LanguageToggle from '@/components/LanguageToggle'
import { useLanguage } from '@/lib/i18n/context'
import { getSharedStyles, type ThemeMode } from '@/lib/theme'
import type { TKey } from '@/lib/i18n/translations'

// ─────────────────────────────────────────────────────────────────────────
// Shared top nav — logo + breadcrumb + theme toggle + auth + Get Pro CTA.
// Used by every tool page and app page (SPC, Pareto, DPMO, AQL, Gage R&R,
// Stability, OEE, Descriptive, About, Contact, Pricing, Account, Dashboard)
// so the nav looks and behaves identically everywhere. Previously each page
// had its own copy-pasted version of this markup — this is the single
// source of truth now.
//
// The landing page (app/page.tsx) has its own different marketing nav
// (with Tools/Pricing/About/Contact links) and is NOT meant to use this —
// that's a different nav for a different purpose (visitor nav vs. app nav).
// The login page also stays custom on purpose (minimal, no breadcrumb/auth).
//
// Usage:
//   const [theme, setTheme] = usePersistedTheme();
//   <Nav theme={theme} setTheme={setTheme} breadcrumbKey="bc_spc" />
// ─────────────────────────────────────────────────────────────────────────

interface NavProps {
  theme: ThemeMode
  setTheme: Dispatch<SetStateAction<ThemeMode>>
  breadcrumbKey: TKey
  showGetPro?: boolean
}

export default function Nav({ theme, setTheme, breadcrumbKey, showGetPro = true }: NavProps) {
  const { t } = useLanguage()
  const s = getSharedStyles(theme)

  return (
    <nav className="qh-nav" style={s.nav}>
      <div className="qh-nav-left" style={s.navLeft}>
        <Link href="/" style={s.logo}>
          <div style={s.logoIcon}>σ</div>
          QualityTools
        </Link>
        <span className="qh-breadcrumb-sep" style={s.separator}>/</span>
        <span className="qh-breadcrumb" style={s.breadcrumb}>{t(breadcrumbKey)}</span>
      </div>
      <div className="qh-nav-right" style={s.navRight}>
        <button
          style={s.themeBtn}
          onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
        >
          {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
        </button>
        <LanguageToggle theme={theme} />
        <AuthStatus />
        {showGetPro && (
          <Link href="/pricing" className="qh-hide-mobile" style={s.ctaBtn}>
            {t('nav_getpro')} →
          </Link>
        )}
      </div>
    </nav>
  )
}
