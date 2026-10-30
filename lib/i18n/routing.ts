// ─────────────────────────────────────────────────────────────────────────
// Language in the URL.
//
// English pages keep their old addresses (/spc), Arabic pages live under
// /ar (/ar/spc). Internally every page sits in app/[lang]/…; middleware.ts
// rewrites /spc to /en/spc so the English URL never shows "/en".
//
// Used by middleware.ts (server) and by LocaleLink / LanguageProvider and
// the metadata helpers, so the rules are written once.
// ─────────────────────────────────────────────────────────────────────────

export const LOCALES = ['en', 'ar'] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'en'

/** Cookie that remembers the language a visitor chose (set by the toggle and by visiting /ar). */
export const LANG_COOKIE = 'qh-lang'

export function isLocale(v: string | undefined | null): v is Locale {
  return v === 'en' || v === 'ar'
}

/** Paths that never carry a language prefix (APIs, auth callback, files). */
export function isUnlocalizedPath(path: string): boolean {
  return /^\/(api|auth|_next|brand|icons|downloads)(\/|$)/.test(path)
    || /\.[a-z0-9]+$/i.test(path) // sitemap.xml, robots.txt, sw.js, google….html, images
}

/** "/ar/spc" → "/spc" · "/ar" → "/" · "/en/spc" → "/spc" · "/spc" → "/spc" */
export function stripLocale(path: string): string {
  const m = path.match(/^\/(en|ar)(\/.*)?$/)
  if (!m) return path || '/'
  return m[2] || '/'
}

/** Language a path is in ("/ar/…" = ar, anything else = en). */
export function localeOfPath(path: string): Locale {
  return /^\/ar(\/|$)/.test(path) ? 'ar' : 'en'
}

/**
 * The address of a page in a language: localizePath("/spc", "ar") = "/ar/spc".
 * Keeps ?query and #hash; leaves external links, #anchors and unlocalized paths alone.
 */
export function localizePath(href: string, lang: Locale): string {
  if (!href.startsWith('/') || href.startsWith('//')) return href
  const cut = href.search(/[?#]/)
  const path = cut === -1 ? href : href.slice(0, cut)
  const rest = cut === -1 ? '' : href.slice(cut)
  if (isUnlocalizedPath(path)) return href
  const base = stripLocale(path)
  if (lang === 'en') return base + rest
  return (base === '/' ? '/ar' : `/ar${base}`) + rest
}

/** In the browser: the address of a page in the language of the page we're on. */
export function hereLocalized(href: string): string {
  if (typeof window === 'undefined') return href
  return localizePath(href, localeOfPath(window.location.pathname))
}
