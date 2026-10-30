import type { Metadata } from 'next'
import { localizedPageMetadata } from '@/lib/i18n/metadata'
import { TOOL_COUNT } from '@/lib/tools'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  return localizedPageMetadata(lang, '/tools',
    {
      title: 'All Quality Engineering Tools — SPC, Gage R&R, AQL, DOE',
      description: `All ${TOOL_COUNT} quality engineering tools in one place, grouped by the question you need to answer: process stability and capability, measurement systems, problem solving, sampling, performance and shelf life.`,
    },
    {
      title: 'كل أدوات هندسة الجودة — SPC وGage R&R وAQL وDOE',
      description: `كل أدوات هندسة الجودة (${TOOL_COUNT} أداة) في مكان واحد، مرتبة حسب السؤال الذي تريد إجابته: استقرار العملية وقدرتها، وأنظمة القياس، وحل المشكلات، والعينات، والأداء، ومدة الصلاحية.`,
    })
}

export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  return children
}
