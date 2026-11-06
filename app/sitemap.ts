import type { MetadataRoute } from 'next'
import { SITE } from '@/lib/site'
import { localizePath } from '@/lib/i18n/routing'

const SITE_URL = SITE.url

// ─────────────────────────────────────────────────────────────────────────
// Every page exists in English (/path) and Arabic (/ar/path) — see
// lib/i18n/routing.ts. Each entry below lists once; the Arabic twin and
// the hreflang alternates linking the two are generated automatically.
//
// The tool routes are reachable without login (see middleware.ts), so
// they belong here too. Pro-gated ones (aql, gage-rr, stability) still
// render real, indexable content for anonymous visitors — either the tool
// itself or the LockedPage upsell — so they're included as well.
// ─────────────────────────────────────────────────────────────────────────

const PAGES: { path: string; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']; priority: number }[] = [
  { path: '/', changeFrequency: 'weekly', priority: 1 },
  { path: '/tools', changeFrequency: 'monthly', priority: 0.9 },
  { path: '/spc', changeFrequency: 'monthly', priority: 0.9 },
  { path: '/pareto', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/dpmo', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/aql', changeFrequency: 'monthly', priority: 0.9 },
  { path: '/icmsf', changeFrequency: 'monthly', priority: 0.9 },
  { path: '/gage-rr', changeFrequency: 'monthly', priority: 0.9 },
  { path: '/stability', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/oee', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/descriptive', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/doe', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/imr-chart', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/xbar-r-chart', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/xbar-s-chart', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/attribute-charts', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/regression', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/multiregression', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/guide', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/sample-reports', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/about', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/pricing', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/contact', changeFrequency: 'yearly', priority: 0.4 },
  { path: '/verification', changeFrequency: 'weekly', priority: 0.6 },
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/terms', changeFrequency: 'yearly', priority: 0.3 },
]

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  const entries: MetadataRoute.Sitemap = []

  for (const { path, changeFrequency, priority } of PAGES) {
    const enPath = path
    const arPath = localizePath(path, 'ar')
    const alternates = {
      languages: {
        en: `${SITE_URL}${enPath}`,
        ar: `${SITE_URL}${arPath}`,
      },
    }
    entries.push({ url: `${SITE_URL}${enPath}`, lastModified: now, changeFrequency, priority, alternates })
    entries.push({ url: `${SITE_URL}${arPath}`, lastModified: now, changeFrequency, priority, alternates })
  }

  return entries
}
