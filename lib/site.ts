// ─────────────────────────────────────────────────────────────────────────
// SITE — every piece of brand and contact data in ONE place.
//
// Change a value here and it updates everywhere: header and footer logo,
// page titles and link previews (WhatsApp / Facebook / LinkedIn), the
// installable app name, About and Contact pages, PDF and Excel reports,
// chart watermarks, sitemap and robots.txt, and every translated sentence
// that mentions the site.
//
// The live URL can also be overridden per environment with the
// NEXT_PUBLIC_SITE_URL variable in Vercel (used when set).
// ─────────────────────────────────────────────────────────────────────────

export const SITE = {
  /** Brand name shown in the header, titles, reports and texts */
  name: 'Mizan Quality',
  /** Name under the app icon on a phone (keep it short) */
  shortName: 'Mizan Quality',
  /** One-line description after the name in browser titles and link previews */
  tagline: 'Quality Engineering Platform',

  /** Public website address, without a trailing slash */
  url: process.env.NEXT_PUBLIC_SITE_URL || 'https://qualityhub-zeta.vercel.app',
  /** Short domain printed on chart watermarks and report footers */
  domain: 'mizanquality.com',

  /** Person behind the site (footer, About page, report author) */
  owner: 'Tawfik Elzahar',
  /** Year shown in the copyright line */
  copyrightYear: 2026,

  /** Logo files in public/brand (SVG). Swap the files to change the logo everywhere. */
  logo: {
    /** Navy + gold, for light backgrounds */
    light: '/brand/logo.svg',
    /** White + gold, for dark backgrounds */
    dark: '/brand/logo-white.svg',
    /** Square icon (A with the balance) */
    icon: '/brand/icon.svg',
  },
  /** Link-preview image for WhatsApp, Facebook, LinkedIn (1200 x 630) */
  ogImage: '/og-image.png',

  contact: {
    email: 'tawfik.elzahar1@gmail.com',
    /** WhatsApp number in international format, digits only */
    whatsapp: '201224491539',
    /** How the WhatsApp number is displayed */
    whatsappDisplay: '+20 122 449 1539',
    /** LinkedIn profile handle (linkedin.com/in/<handle>) */
    linkedin: 'tawfikelzahar',
  },
} as const

/** Ready-made links built from SITE.contact */
export const SITE_LINKS = {
  email: `mailto:${SITE.contact.email}`,
  whatsapp: `https://wa.me/${SITE.contact.whatsapp}`,
  linkedin: `https://www.linkedin.com/in/${SITE.contact.linkedin}`,
  linkedinDisplay: `in/${SITE.contact.linkedin}`,
} as const

/** "Quality Hub — Statistical Quality Engineering Tools Online" */
export const SITE_TITLE = `${SITE.name} — ${SITE.tagline}`

/** Logo text split for the two-colour logo: first words + last word */
export function siteNameParts(): [string, string] {
  const i = SITE.name.lastIndexOf(' ')
  return i > 0 ? [SITE.name.slice(0, i), SITE.name.slice(i + 1)] : [SITE.name, '']
}

/** "mizan-quality" — the name as used in downloaded file names */
export const SITE_SLUG = SITE.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
