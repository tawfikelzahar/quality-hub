import type { Metadata } from 'next'
import { SITE } from '@/lib/site'
import { localizedPageMetadata } from '@/lib/i18n/metadata'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  return localizedPageMetadata(lang, '/terms',
    {
      title: 'Terms of Use',
      description: `The terms that apply to everyone who uses ${SITE.name}.`,
    },
    {
      title: 'شروط الاستخدام',
      description: `الشروط التي تنطبق على كل من يستخدم ${SITE.name}.`,
    })
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
