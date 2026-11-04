import type { Metadata } from 'next'
import { localizedAlternates } from '@/lib/i18n/metadata'
import SampleReportsClient from './SampleReportsClient'

// Canonical + hreflang (English / Arabic twin) for this page; the page itself stays a client component.
export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  return { alternates: localizedAlternates(lang, '/sample-reports') }
}

export default function Page() {
  return <SampleReportsClient />
}
