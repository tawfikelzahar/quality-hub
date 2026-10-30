import { SITE, SITE_LINKS } from '@/lib/site'
import { localizePath, type Locale } from '@/lib/i18n/routing'
import { translations } from '@/lib/i18n/translations'
import { TOOL_GROUPS, type ToolRow } from '@/lib/tools'

// ─────────────────────────────────────────────────────────────────────────
// Structured data (schema.org JSON-LD) that tells Google what each page is:
//   • every page  → Organization + WebSite (from the root layout)
//   • tool pages  → WebApplication with the tool's name and description
// Names and descriptions come from the same dictionary and tools list the
// pages show, so the structured data can never say something the page does
// not. Rendered by components/JsonLd.tsx.
// ─────────────────────────────────────────────────────────────────────────

type Json = Record<string, unknown>

const abs = (path: string) => `${SITE.url}${path === '/' ? '' : path}`
const ORG_ID = `${SITE.url}/#organization`
const SITE_ID = `${SITE.url}/#website`

/** Organization + WebSite, one graph per page */
export function siteSchema(lang: Locale, description: string): Json {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': ORG_ID,
        name: SITE.name,
        url: SITE.url,
        logo: abs(SITE.logo.icon),
        email: SITE.contact.email,
        founder: { '@type': 'Person', name: SITE.owner, sameAs: [SITE_LINKS.linkedin] },
        sameAs: [SITE_LINKS.linkedin],
      },
      {
        '@type': 'WebSite',
        '@id': SITE_ID,
        name: SITE.name,
        description,
        url: abs(localizePath('/', lang)),
        inLanguage: lang,
        publisher: { '@id': ORG_ID },
      },
    ],
  }
}

/** The tools list row for a path ("/spc"), or null */
export function toolRow(href: string): ToolRow | null {
  for (const g of TOOL_GROUPS) for (const r of g.rows) if (r.href === href) return r
  return null
}

/** WebApplication for one tool page */
export function toolSchema(lang: Locale, href: string): Json | null {
  const row = toolRow(href)
  if (!row) return null
  const t = translations[lang]
  const url = abs(localizePath(href, lang))
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    '@id': `${url}#app`,
    name: t[row.titleKey],
    description: t[row.descKey],
    url,
    inLanguage: lang,
    applicationCategory: 'BusinessApplication',
    applicationSubCategory: 'Quality engineering',
    operatingSystem: 'Any (web browser)',
    browserRequirements: 'Requires JavaScript',
    isAccessibleForFree: !row.pro,
    // Free tools: the calculation costs nothing. Pro-only tools carry no price
    // until paid plans are published.
    ...(row.pro ? {} : { offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } }),
    publisher: { '@id': ORG_ID },
    isPartOf: { '@id': SITE_ID },
  }
}

/** JSON for a <script type="application/ld+json">, safe to inline in HTML */
export function jsonLdString(data: Json): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
