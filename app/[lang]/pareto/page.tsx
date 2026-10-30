import type { Metadata } from 'next'
import ParetoChart from '@/components/ParetoChart'
import ToolGuide from '@/components/tool/ToolGuide'
import { PARETO_GUIDE } from '@/lib/guides/problem'
import { localizedPageMetadata } from '@/lib/i18n/metadata'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  return localizedPageMetadata(lang, '/pareto',
    {
      title: 'Pareto Chart Maker Online — 80/20 Analysis',
      description: 'Build Pareto charts online for defect and root-cause analysis. Free 80/20 analysis tool with instant charts and exports — no spreadsheet setup required.',
    },
    {
      title: 'أداة رسم خريطة باريتو أونلاين — تحليل 80/20',
      description: 'ارسم خرائط باريتو عبر الإنترنت لتحليل العيوب والأسباب الجذرية. أداة تحليل 80/20 مجانية برسم فوري وتصدير النتائج — بدون إعداد جداول بيانات.',
    })
}

export default async function ParetoPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return <ParetoChart guide={<ToolGuide guide={PARETO_GUIDE} lang={lang} />} />
}