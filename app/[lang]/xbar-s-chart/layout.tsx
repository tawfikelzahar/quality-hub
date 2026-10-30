import type { Metadata } from 'next'
import { localizedPageMetadata } from '@/lib/i18n/metadata'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  return localizedPageMetadata(lang, '/xbar-s-chart',
    {
      title: 'Xbar-S Chart Online — X̄ and Standard Deviation Chart, Nelson Rules, Cpk',
      description: 'Free online Xbar-S control chart for larger subgroups (n ≥ 9): X̄ and Standard Deviation charting, all 8 Nelson Rules screening, and process capability (Cp/Cpk/Pp/Ppk).',
    },
    {
      title: 'خريطة Xbar-S أونلاين — خريطتا X̄ والانحراف المعياري، قواعد Nelson، Cpk',
      description: 'خريطة ضبط Xbar-S مجانية عبر الإنترنت للمجموعات الفرعية الكبيرة (n ≥ 9): خريطتا X̄ والانحراف المعياري، فحص قواعد Nelson الثمانية، وقدرة العملية (Cp/Cpk/Pp/Ppk).',
    })
}

export default function XbarSChartLayout({ children }: { children: React.ReactNode }) {
  return children
}
