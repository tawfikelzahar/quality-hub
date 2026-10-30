import type { Metadata } from 'next'
import { SITE } from '@/lib/site'
import { localizedPageMetadata } from '@/lib/i18n/metadata'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  return localizedPageMetadata(lang, '/pricing',
    {
      title: 'Pricing',
      description: `${SITE.name} pricing — every analysis tool is free, including SPC control charts, capability, AQL, Stability, Regression and DOE. Pro (coming soon) adds Gage R&R, PDF/Excel reports and saved projects.`,
    },
    {
      title: 'الأسعار',
      description: `أسعار ${SITE.name} — كل أدوات التحليل مجانية، بما فيها خرائط ضبط SPC والقدرة وAQL والثبات والانحدار وDOE. الخطة Pro (قريبًا) تضيف Gage R&R وتقارير PDF/Excel والمشاريع المحفوظة.`,
    })
}

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children
}
