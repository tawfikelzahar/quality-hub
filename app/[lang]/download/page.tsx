import type { Metadata } from 'next'
import { localizedPageMetadata } from '@/lib/i18n/metadata'
import DownloadClient from './DownloadClient'

// Title, description, link preview and hreflang for this page; the page itself stays a client component.
export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  return localizedPageMetadata(lang, '/download',
    { title: 'Android App', description: 'The full Mizan Quality platform as an Android app: the same tools, the same account and the same subscription. Install it on your phone.' },
    { title: 'تطبيق أندرويد', description: 'منصة Mizan Quality كاملة في تطبيق أندرويد: الأدوات نفسها والحساب نفسه والاشتراك نفسه. ثبّته على هاتفك.' })
}

export default function Page() {
  return <DownloadClient />
}
