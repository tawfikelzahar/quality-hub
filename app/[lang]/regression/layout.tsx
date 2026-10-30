import type { Metadata } from 'next'
import { localizedPageMetadata } from '@/lib/i18n/metadata'

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

export default function RegressionLayout({ children }: { children: React.ReactNode }) {
  return children
}
