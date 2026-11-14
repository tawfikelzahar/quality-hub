import type { Metadata } from 'next'
import { localizedPageMetadata } from '@/lib/i18n/metadata'
import SampleReportsClient from './SampleReportsClient'

// Title, description, link preview and hreflang for this page; the page itself stays a client component.
export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  return localizedPageMetadata(lang, '/sample-reports',
    { title: 'Sample PDF & Excel Reports', description: 'Real PDF and Excel reports made by Mizan Quality, with the same layout, statistics and branding you get from your own data. Download them, no signup needed.' },
    { title: 'نماذج تقارير PDF وExcel', description: 'تقارير PDF وExcel حقيقية من Mizan Quality بالتصميم والحسابات نفسها التي تحصل عليها من بياناتك. حمّلها دون تسجيل.' })
}

export default function Page() {
  return <SampleReportsClient />
}
