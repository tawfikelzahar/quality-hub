import type { MetadataRoute } from 'next'
import { SITE } from '@/lib/site'

const SITE_URL = SITE.url

// ─────────────────────────────────────────────────────────────────────────
// The tool routes no longer require login (see middleware.ts), so they're
// allowed here. Only genuinely private/no-value-to-index paths stay
// disallowed: API routes, auth flows, and personal account pages — listed
// both unprefixed (English) and under /ar (Arabic), since each is its own
// crawlable URL now (see lib/i18n/routing.ts).
// ─────────────────────────────────────────────────────────────────────────
const PRIVATE_PATHS = ['/login', '/account', '/dashboard', '/admin']

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/auth/',
        ...PRIVATE_PATHS,
        ...PRIVATE_PATHS.map((p) => `/ar${p}`),
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
