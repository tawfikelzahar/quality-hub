import type { Metadata } from 'next'
import { localizedPageMetadata } from '@/lib/i18n/metadata'
import { ToolJsonLd } from '@/components/JsonLd'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  return localizedPageMetadata(lang, '/regression',
    {
      title: 'Linear Regression Calculator Online — Fitted Line, ANOVA, Prediction Intervals',
      description: 'Free online simple linear regression tool: fitted-line plot, ANOVA and coefficient diagnostics, residual plots, and prediction intervals.',
    },
    {
      title: 'حاسبة الانحدار الخطي البسيط أونلاين — خط الانحدار، ANOVA، فترات التنبؤ',
      description: 'أداة انحدار خطي بسيط مجانية عبر الإنترنت: رسم خط الانحدار، تشخيصات ANOVA والمعاملات، رسم البواقي، وفترات التنبؤ.',
    })
}

export default async function RegressionLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return (
    <>
      {/* WebApplication structured data for search engines (lib/seo/schema.ts) */}
      <ToolJsonLd lang={lang} href="/regression" />
      {children}
    </>
  )
}
