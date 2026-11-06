import type { Metadata } from 'next'
import { localizedPageMetadata } from '@/lib/i18n/metadata'
import { ToolJsonLd } from '@/components/JsonLd'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  return localizedPageMetadata(lang, '/attribute-charts',
    {
      title: 'p, np, c and u Charts Online — Attribute Control Charts for Defectives and Defects',
      description: 'Free online attribute control charts: p chart and np chart for defective units, c chart and u chart for defects, with limits that follow each sample size, tests for special causes, % defective, PPM and DPU.',
    },
    {
      title: 'مخططات p وnp وc وu أونلاين — مخططات ضبط الصفات للمعيب والعيوب',
      description: 'مخططات ضبط الصفات مجانًا عبر الإنترنت: مخطط p ومخطط np للوحدات المعيبة، ومخطط c ومخطط u للعيوب، بحدود تتبع حجم كل عينة، واختبارات الأسباب الخاصة، ونسبة المعيب وPPM وDPU.',
    })
}

export default async function AttributeChartsLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return (
    <>
      {/* WebApplication structured data for search engines (lib/seo/schema.ts) */}
      <ToolJsonLd lang={lang} href="/attribute-charts" />
      {children}
    </>
  )
}
