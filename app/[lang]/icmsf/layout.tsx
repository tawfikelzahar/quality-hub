import type { Metadata } from 'next'
import { localizedPageMetadata } from '@/lib/i18n/metadata'
import { ToolJsonLd } from '@/components/JsonLd'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  return localizedPageMetadata(lang, '/icmsf',
    {
      title: 'ICMSF Microbiological Sampling Plan Calculator',
      description: 'Free ICMSF microbiological sampling plan tool. Pick the hazard (with ICMSF organism examples) and conditions of use to get the Case and n, c, m, M, then the lot decision from your unit results, with the OC curve.',
    },
    {
      title: 'حاسبة خطة العينات الميكروبيولوجية ICMSF',
      description: 'أداة مجانية لخطة العينات الميكروبيولوجية وفق ICMSF. اختر الخطورة (مع أمثلة كائنات ICMSF) وظروف الاستخدام للحصول على Case وn وc وm وM، ثم قرار قبول الدفعة من نتائج عيناتك، مع منحنى OC.',
    })
}

export default async function IcmsfLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return (
    <>
      {/* WebApplication structured data for search engines (lib/seo/schema.ts) */}
      <ToolJsonLd lang={lang} href="/icmsf" />
      {children}
    </>
  )
}
