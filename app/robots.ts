import type { MetadataRoute } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://qualityhub-zeta.vercel.app'

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
