import type { Metadata } from 'next'
import { SITE } from '@/lib/site'
import { localizedPageMetadata } from '@/lib/i18n/metadata'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  return localizedPageMetadata(lang, '/about',
    {
      title: 'About',
      description: `${SITE.name} is built by ${SITE.owner}, a quality engineering professional with 10+ years in manufacturing and continuous improvement. Statistical tools built to ISO, AIAG, and ICH standards.`,
    },
    {
      title: 'من نحن',
      description: `${SITE.name} من بناء ${SITE.owner}، مهندس جودة بخبرة أكثر من 10 سنوات في التصنيع والتحسين المستمر. أدوات إحصائية مبنية على معايير ISO وAIAG وICH.`,
    })
}

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children
}
