import type { Metadata } from 'next'
import { localizedPageMetadata } from '@/lib/i18n/metadata'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  return localizedPageMetadata(lang, '/imr-chart',
    {
      title: 'I-MR Chart Online — Individuals & Moving Range, Nelson Rules, Cpk',
      description: 'Free online I-MR control chart: Individuals and Moving Range charting for one measurement at a time, all 8 Nelson Rules screening, and process capability (Cp/Cpk/Pp/Ppk).',
    },
    {
      title: 'خريطة I-MR أونلاين — Individuals وMoving Range، قواعد Nelson، Cpk',
      description: 'خريطة ضبط I-MR مجانية عبر الإنترنت: خريطتا Individuals وMoving Range لقياس واحد في كل مرة، فحص قواعد Nelson الثمانية، وقدرة العملية (Cp/Cpk/Pp/Ppk).',
    })
}

export default function ImrChartLayout({ children }: { children: React.ReactNode }) {
  return children
}
