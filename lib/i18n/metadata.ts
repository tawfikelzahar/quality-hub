import type { Metadata } from 'next'
import { localizePath } from './routing'

// ─────────────────────────────────────────────────────────────────────────
// One call builds a page's full bilingual <head>: title, description,
// canonical and the hreflang alternates Google uses to match the English
// and Arabic version of the same page. `path` is the English (unprefixed)
// address, e.g. "/spc" — the Arabic one ("/ar/spc") is derived from it.
// ─────────────────────────────────────────────────────────────────────────

type Copy = { title: string; description: string }

/** Builds a page's metadata in whichever language it renders in (params.lang), with hreflang alternates pointing at both. */
export function localizedPageMetadata(lang: string, path: string, en: Copy, ar: Copy): Metadata {
  const copy = lang === 'ar' ? ar : en
  return {
    title: copy.title,
    description: copy.description,
    alternates: localizedAlternates(lang, path),
  }
}

/** Only the canonical + hreflang links, for pages that keep the site-wide title and description. */
export function localizedAlternates(lang: string, path: string): NonNullable<Metadata['alternates']> {
  return {
    canonical: localizePath(path, lang === 'ar' ? 'ar' : 'en'),
    languages: {
      en: path,
      ar: localizePath(path, 'ar'),
      'x-default': path,
    },
  }
}
