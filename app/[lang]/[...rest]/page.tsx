import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

// Any address that matches no page (/ar/xyz, /xyz, /tools/old-name) lands
// here and is handed to app/[lang]/not-found.tsx, so the visitor gets the
// branded 404 in their language with the site's menu, instead of the plain
// white built-in one. The answer is still a real 404 and is not indexed.
export const dynamicParams = true
// Metadata from a page that calls notFound() must be static to be used.
// The Arabic tab title is set by app/[lang]/not-found.tsx itself.
export const metadata: Metadata = { title: 'Page not found', robots: { index: false, follow: false } }

export default function CatchAll() {
  notFound()
}
