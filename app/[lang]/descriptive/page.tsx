import type { Metadata } from 'next'
import DescriptiveStats from '@/components/DescriptiveStats'
import { localizedPageMetadata } from '@/lib/i18n/metadata'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  return localizedPageMetadata(lang, '/descriptive',
    {
      title: 'Descriptive Statistics Calculator — Histogram, Box Plot, Normality Test',
      description: 'Free descriptive statistics tool with combined histogram and box plot, plus Anderson-Darling normality testing and confidence intervals.',
    },
    {
      title: 'حاسبة الإحصاء الوصفي — هيستوجرام، Box Plot، اختبار التوزيع الطبيعي',
      description: 'أداة إحصاء وصفي مجانية بهيستوجرام وBox Plot مدمجَين، مع اختبار Anderson-Darling للتوزيع الطبيعي وفترات الثقة.',
    })
}

export default function DescriptivePage() {
  return <DescriptiveStats />
}
