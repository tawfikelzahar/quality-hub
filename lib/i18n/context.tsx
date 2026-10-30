'use client'

import { createContext, useCallback, useContext, useEffect, type ReactNode } from 'react'
import { translations, type Lang, type Dict, type TKey } from './translations'
import { setLanguageProperty } from '@/lib/analytics'
import { LANG_COOKIE, localizePath } from './routing'

// ─────────────────────────────────────────────────────────────────────────
// Site language. The language comes from the URL (/ar/… = Arabic, anything
// else = English, see lib/i18n/routing.ts): app/[lang]/layout.tsx passes it
// in, so the server already renders the page in the right language and
// search engines see both versions.
//
// Switching language opens the same page at the other address and stores
// the choice in the qh-lang cookie (middleware.ts sends returning visitors
// to their language).
//
// Usage:
//   const { lang, setLang, t, dict, dir } = useLanguage()
//   <h1>{t('hero_title_1')}</h1>
// ─────────────────────────────────────────────────────────────────────────

interface LangContextValue {
  lang: Lang
  setLang: (l: Lang) => void
  toggleLang: () => void
  t: (key: TKey) => string
  dict: Dict
  dir: 'ltr' | 'rtl'
}

const LangContext = createContext<LangContextValue | null>(null)

function rememberLang(l: Lang) {
  document.cookie = `${LANG_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`
  try { localStorage.setItem(LANG_COOKIE, l) } catch {}
}

export function LanguageProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
    setLanguageProperty(lang)
  }, [lang])

  // Visitors from before the language moved into the URL kept their choice
  // in localStorage only: carry an Arabic choice over to the cookie once and
  // open the Arabic address.
  useEffect(() => {
    if (document.cookie.split('; ').some(c => c.startsWith(`${LANG_COOKIE}=`))) return
    let stored: string | null = null
    try { stored = localStorage.getItem(LANG_COOKIE) } catch {}
    if (stored === 'ar' && lang === 'en') {
      rememberLang('ar')
      const { pathname, search, hash } = window.location
      window.location.replace(localizePath(pathname, 'ar') + search + hash)
    } else {
      rememberLang(lang)
    }
  }, [lang])

  const setLang = useCallback((l: Lang) => {
    if (l === lang) return
    rememberLang(l)
    const { pathname, search, hash } = window.location
    window.location.assign(localizePath(pathname, l) + search + hash)
  }, [lang])
  const toggleLang = useCallback(() => setLang(lang === 'ar' ? 'en' : 'ar'), [lang, setLang])

  const dict = translations[lang]
  const t = (key: TKey): string => dict[key] ?? translations.en[key] ?? key

  return (
    <LangContext.Provider
      value={{ lang, setLang, toggleLang, t, dict, dir: lang === 'ar' ? 'rtl' : 'ltr' }}
    >
      {children}
    </LangContext.Provider>
  )
}

export function useLanguage(): LangContextValue {
  const ctx = useContext(LangContext)
  if (!ctx) {
    throw new Error('useLanguage() must be used within a <LanguageProvider>')
  }
  return ctx
}
