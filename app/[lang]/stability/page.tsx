import type { Metadata } from 'next'
import StabilityStudy from '@/components/StabilityStudy'
import ToolGuide from '@/components/tool/ToolGuide'
import { STABILITY_GUIDE } from '@/lib/guides/food'
import { localizedPageMetadata } from '@/lib/i18n/metadata'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  return localizedPageMetadata(lang, '/stability',
    {
      title: 'Stability Study & Shelf-Life Calculator — ICH Q1E',
      description: 'Free shelf-life estimation tool using ICH Q1E regression and poolability ANCOVA. Built for pharmaceutical and product stability studies.',
    },
    {
      title: 'حاسبة دراسة الثبات ومدة الصلاحية — ICH Q1E',
      description: 'أداة مجانية لتقدير مدة الصلاحية باستخدام انحدار ICH Q1E وتحليل التجميع ANCOVA. مصممة لدراسات ثبات الأدوية والمنتجات.',
    })
}

export default async function StabilityPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return <StabilityStudy guide={<ToolGuide guide={STABILITY_GUIDE} lang={lang} />} />
}
