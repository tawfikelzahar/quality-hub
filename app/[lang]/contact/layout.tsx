import type { Metadata } from 'next'
import { SITE } from '@/lib/site'
import { localizedPageMetadata } from '@/lib/i18n/metadata'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  return localizedPageMetadata(lang, '/contact',
    {
      title: 'Contact',
      description: `Get in touch with ${SITE.name} — email, WhatsApp, or LinkedIn for questions about billing, accounts, or the quality engineering tools.`,
    },
    {
      title: 'تواصل معنا',
      description: `تواصل مع ${SITE.name} عبر البريد الإلكتروني أو واتساب أو LinkedIn للاستفسار عن الفواتير أو الحسابات أو أدوات هندسة الجودة.`,
    })
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children
}
