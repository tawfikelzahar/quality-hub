import type { Metadata } from 'next'
import { SITE } from '@/lib/site'
import { localizedPageMetadata } from '@/lib/i18n/metadata'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  return localizedPageMetadata(lang, '/privacy',
    {
      title: 'Privacy Policy',
      description: `What ${SITE.name} collects, why, who processes it and how to delete your data.`,
    },
    {
      title: 'سياسة الخصوصية',
      description: `ما الذي تجمعه ${SITE.name}، ولماذا، ومن يعالجه، وكيف تحذف بياناتك.`,
    })
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
