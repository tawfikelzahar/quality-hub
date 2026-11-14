import type { Metadata } from 'next'
import { localizedAlternates, shareMetadata } from '@/lib/i18n/metadata'
import { SITE_DESCRIPTION } from '@/lib/site'
import HomeClient from './HomeClient'

// Canonical + hreflang (English / Arabic twin) for this page; the page itself stays a client component.
export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  return {
    alternates: localizedAlternates(lang, '/'),
    ...shareMetadata(lang, '/', null, lang === 'ar' ? SITE_DESCRIPTION.ar : SITE_DESCRIPTION.en),
  }
}

export default function Page() {
  return <HomeClient />
}
