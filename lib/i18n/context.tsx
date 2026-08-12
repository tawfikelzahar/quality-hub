'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { translations, type Lang, type Dict, type TKey } from './translations'

// ─────────────────────────────────────────────────────────────────────────
// Site-wide language switcher — mirrors the existing usePersistedTheme
// pattern in lib/theme.ts (same localStorage-on-mount approach), so it
// behaves consistently with the dark/light toggle already in the app.
//
// Usage:
//   const { lang, setLang, t, dict, dir } = useLanguage()
//   <h1>{t('hero_title_1')}</h1>
//   {dict.pill_1}  // for reading array/object fields directly if ever added
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
const STORAGE_KEY = 'qh-lang'

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Default to English on first paint (matches server-rendered <html lang="en">
  // in app/layout.tsx) — the stored preference is applied after mount to
  // avoid a hydration mismatch.
  const [lang, setLangState] = useState<Lang>('en')

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'ar' || stored === 'en') setLangState(stored)
  }, [])

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
    localStorage.setItem(STORAGE_KEY, lang)
  }, [lang])

  const setLang = (l: Lang) => setLangState(l)
  const toggleLang = () => setLangState((prev) => (prev === 'ar' ? 'en' : 'ar'))

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
