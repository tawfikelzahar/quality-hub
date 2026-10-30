import type { Metadata } from 'next'
import OEECalculator from '@/components/OEECalculator'
import ToolGuide from '@/components/tool/ToolGuide'
import { OEE_GUIDE } from '@/lib/guides/performance'
import { localizedPageMetadata } from '@/lib/i18n/metadata'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  return localizedPageMetadata(lang, '/oee',
    {
      title: 'OEE Calculator Online — Availability, Performance, Quality',
      description: 'Free Overall Equipment Effectiveness (OEE) calculator using the Nakajima/JIPM TPM standard. Track the Six Big Losses and benchmark against world-class OEE.',
    },
    {
      title: 'حاسبة OEE أونلاين — التوفر والأداء والجودة',
      description: 'حاسبة الفعالية الشاملة للمعدات (OEE) المجانية وفق معيار Nakajima/JIPM TPM. تتبّع الخسائر الست الكبرى وقارن بمستوى OEE العالمي.',
    })
}

export default async function OEEPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return <OEECalculator guide={<ToolGuide guide={OEE_GUIDE} lang={lang} />} />
}
