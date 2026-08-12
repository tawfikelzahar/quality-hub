'use client'

import { useLanguage } from '@/lib/i18n/context'
import { COLORS, type ThemeMode } from '@/lib/theme'

// ─────────────────────────────────────────────────────────────────────────
// Drop this next to the existing dark/light ThemeToggle button in any nav.
// Deliberately styled to match s.themeBtn / the landing page's theme
// button exactly, so the two toggles look like a matched pair.
//
// Usage (landing page nav):
//   <LanguageToggle theme={dark ? 'dark' : 'light'} />
//
// Usage (tool pages, which already have `theme` + `c` in scope):
//   <LanguageToggle theme={theme} />
// ─────────────────────────────────────────────────────────────────────────

export default function LanguageToggle({
  theme,
  className,
}: {
  theme: ThemeMode
  className?: string
}) {
  const { lang, toggleLang } = useLanguage()
  const c = COLORS[theme]

  return (
    <button
      onClick={toggleLang}
      className={className}
      title={lang === 'ar' ? 'Switch to English' : 'التبديل للعربي'}
      style={{
        background: theme === 'dark' ? 'rgba(255,255,255,0.08)' : c.surface2,
        border: `1px solid ${c.border}`,
        borderRadius: 20,
        padding: '5px 14px',
        color: c.text,
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {lang === 'ar' ? 'EN' : 'AR'}
    </button>
  )
}
