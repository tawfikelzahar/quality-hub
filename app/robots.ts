import type { MetadataRoute } from 'next'
import { SITE } from '@/lib/site'

const SITE_URL = SITE.url

// ─────────────────────────────────────────────────────────────────────────
// The tool routes no longer require login (see middleware.ts), so they're
// allowed here. Only genuinely private/no-value-to-index paths stay
// disallowed: API routes, auth flows, and personal account pages.
// ─────────────────────────────────────────────────────────────────────────
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/login', '/auth/', '/account', '/dashboard'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
