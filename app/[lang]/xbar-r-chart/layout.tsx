import type { Metadata } from 'next'
import { localizedPageMetadata } from '@/lib/i18n/metadata'

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

export default function XbarRChartLayout({ children }: { children: React.ReactNode }) {
  return children
}
