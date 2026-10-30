import type { Metadata } from 'next'
import { localizedPageMetadata } from '@/lib/i18n/metadata'
import { ToolJsonLd } from '@/components/JsonLd'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  return localizedPageMetadata(lang, '/xbar-r-chart',
    {
      title: 'Xbar-R Chart Online — X̄ and Range Chart, Nelson Rules, Cpk',
      description: 'Free online Xbar-R control chart for subgrouped data: X̄ and Range charting, all 8 Nelson Rules screening, and process capability (Cp/Cpk/Pp/Ppk).',
    },
    {
      title: 'خريطة Xbar-R أونلاين — خريطتا X̄ وRange، قواعد Nelson، Cpk',
      description: 'خريطة ضبط Xbar-R مجانية عبر الإنترنت للبيانات المجمّعة في مجموعات فرعية: خريطتا X̄ وRange، فحص قواعد Nelson الثمانية، وقدرة العملية (Cp/Cpk/Pp/Ppk).',
    })
}

export default async function XbarRChartLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return (
    <>
      {/* WebApplication structured data for search engines (lib/seo/schema.ts) */}
      <ToolJsonLd lang={lang} href="/xbar-r-chart" />
      {children}
    </>
  )
}
