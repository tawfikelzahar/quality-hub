import type { Metadata } from 'next'
import { SITE } from '@/lib/site'
import { localizedPageMetadata } from '@/lib/i18n/metadata'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  return localizedPageMetadata(lang, '/pricing',
    {
      title: 'Pricing',
      description: `${SITE.name} pricing — every tool is free to run with its main results, including SPC control charts, capability, AQL, Stability, Regression and DOE. Pro, from EGP 299 or $9.99 a month, adds Gage R&R on your own data, deeper diagnostics, PDF/Excel reports and saved projects.`,
    },
    {
      title: 'الأسعار',
      description: `أسعار ${SITE.name} — كل الأدوات مجانية الاستخدام بنتائجها الأساسية، بما فيها خرائط ضبط SPC والقدرة وAQL والثبات والانحدار وDOE. وتضيف الخطة Pro، من 299 ج.م أو 9.99$ شهريًا، Gage R&R على بياناتك وتشخيصًا أعمق وتقارير PDF/Excel والمشاريع المحفوظة.`,
    })
}

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children
}
