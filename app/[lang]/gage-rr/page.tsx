import type { Metadata } from 'next'
import GageRR from '@/components/GageRR'
import ToolGuide from '@/components/tool/ToolGuide'
import { GAGE_GUIDE } from '@/lib/guides/gage'
import { localizedPageMetadata } from '@/lib/i18n/metadata'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  return localizedPageMetadata(lang, '/gage-rr',
    {
      title: 'Gage R&R Calculator Online — AIAG MSA (Average & Range, ANOVA)',
      description: 'Free Gage R&R / MSA calculator following the AIAG MSA 4th edition (6σ study variation). Average & Range and ANOVA methods with %Tolerance and %Study Variation.',
    },
    {
      title: 'حاسبة Gage R&R أونلاين — AIAG MSA (Average & Range، ANOVA)',
      description: 'حاسبة Gage R&R / MSA مجانية وفق الإصدار الرابع من AIAG MSA (تباين الدراسة 6σ). طريقتا Average & Range وANOVA مع %Tolerance و%Study Variation.',
    })
}

export default async function GageRRPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return <GageRR guide={<ToolGuide guide={GAGE_GUIDE} lang={lang} />} />
}
