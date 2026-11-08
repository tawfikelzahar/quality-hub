import type { Metadata } from 'next'
import { localizedPageMetadata } from '@/lib/i18n/metadata'
import { ToolJsonLd } from '@/components/JsonLd'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  return localizedPageMetadata(lang, '/five-whys',
    {
      title: '5 Whys Root Cause Analysis Online — Occurrence and Detection, with Actions',
      description: 'Free online 5 Whys tool: find the root cause of why a problem happened and why it was not detected, with branching causes, a built-in review of your chain, actions with owners and dates, and a PDF report.',
    },
    {
      title: 'تحليل 5 Whys أونلاين — لماذا حدثت ولماذا لم تُكتشف، مع الإجراءات',
      description: 'أداة 5 Whys مجانية عبر الإنترنت: الوصول إلى السبب الجذري لحدوث المشكلة وعدم اكتشافها، بفروع للأسباب، ومراجعة تلقائية للسلسلة، وإجراءات بمسؤول وتاريخ، وتقرير PDF.',
    })
}

export default async function FiveWhysLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return (
    <>
      {/* WebApplication structured data for search engines (lib/seo/schema.ts) */}
      <ToolJsonLd lang={lang} href="/five-whys" />
      {children}
    </>
  )
}
