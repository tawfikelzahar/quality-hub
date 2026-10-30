import type { Metadata } from 'next'
import SPCEngine from '@/components/SPCEngine'
import { localizedPageMetadata } from '@/lib/i18n/metadata'
import ToolGuide from '@/components/tool/ToolGuide'
import { SPC_GUIDE } from '@/lib/guides/spc'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  return localizedPageMetadata(lang, '/spc',
    {
      title: 'SPC Control Charts Online — I-MR, X̄-R, X̄-S, Nelson Rules, Cpk',
      description: 'Free online SPC software: I-MR, X̄-R and X̄-S control charts, attribute charts (p/np/c/u), tests for special causes (Nelson Rules), and Cp/Cpk/Pp/Ppk capability with PPM. No install needed.',
    },
    {
      title: 'خرائط ضبط SPC أونلاين — I-MR، X̄-R، X̄-S، قواعد Nelson، Cpk',
      description: 'برنامج SPC مجاني عبر الإنترنت: خرائط ضبط I-MR وX̄-R وX̄-S، خرائط الصفات (p/np/c/u)، اختبارات الأسباب الخاصة (قواعد Nelson)، ومؤشرات القدرة Cp/Cpk/Pp/Ppk مع PPM. بدون تثبيت.',
    })
}

export default async function SPCPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return <SPCEngine guide={<ToolGuide guide={SPC_GUIDE} lang={lang} />} />
}
