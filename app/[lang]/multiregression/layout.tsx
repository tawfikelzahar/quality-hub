import type { Metadata } from 'next'
import { localizedPageMetadata } from '@/lib/i18n/metadata'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  return localizedPageMetadata(lang, '/multiregression',
    {
      title: 'Multiple Regression Calculator Online — VIF, ANOVA, Prediction Intervals',
      description: 'Free online multiple regression tool: two or more predictors, VIF collinearity checks, ANOVA and coefficient diagnostics, and prediction intervals.',
    },
    {
      title: 'حاسبة الانحدار المتعدد أونلاين — VIF، ANOVA، فترات التنبؤ',
      description: 'أداة انحدار متعدد مجانية عبر الإنترنت: متغيرين تنبؤيين أو أكثر، فحص التداخل الخطي VIF، تشخيصات ANOVA والمعاملات، وفترات التنبؤ.',
    })
}

export default function MultiregressionLayout({ children }: { children: React.ReactNode }) {
  return children
}
