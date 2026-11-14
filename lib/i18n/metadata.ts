import type { Metadata } from 'next'
import { localizePath } from './routing'
import { SITE, SITE_TITLE } from '@/lib/site'

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
    ...shareMetadata(lang, path, copy.title, copy.description),
  }
}

/**
 * The link preview (WhatsApp, LinkedIn, Facebook, X) of one page: its own
 * title, description, address and language. Next.js replaces openGraph and
 * twitter as a whole instead of merging them, so the image and site name are
 * repeated here; without this every shared link showed the home page title.
 * `title` null = the site title (home page).
 */
export function shareMetadata(lang: string, path: string, title: string | null, description: string): Pick<Metadata, 'openGraph' | 'twitter'> {
  const ar = lang === 'ar'
  const full = title ? `${title} | ${SITE.name}` : SITE_TITLE
  return {
    openGraph: {
      type: 'website',
      siteName: SITE.name,
      title: full,
      description,
      url: localizePath(path, ar ? 'ar' : 'en'),
      locale: ar ? 'ar_EG' : 'en_US',
      alternateLocale: ar ? ['en_US'] : ['ar_EG'],
      images: [{ url: SITE.ogImage, width: 1200, height: 630, alt: full }],
    },
    twitter: {
      card: 'summary_large_image',
      title: full,
      description,
      images: [SITE.ogImage],
    },
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
