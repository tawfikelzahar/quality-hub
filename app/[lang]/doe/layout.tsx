import type { Metadata } from 'next'
import { localizedPageMetadata } from '@/lib/i18n/metadata'
import { ToolJsonLd } from '@/components/JsonLd'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  return localizedPageMetadata(lang, '/doe',
    {
      title: 'Design of Experiments (DOE) — Full Factorial 2^k Calculator',
      description: 'Free online DOE tool: generate a coded 2^k full factorial design matrix for 2–5 factors, enter your trial results, and get effects, Pareto of effects, ANOVA, and the fitted regression equation.',
    },
    {
      title: 'تصميم التجارب (DOE) — حاسبة التصميم العاملي الكامل 2^k',
      description: 'أداة DOE مجانية عبر الإنترنت: أنشئ مصفوفة تصميم عاملي كامل مرمزة 2^k لعدد 2 إلى 5 عوامل، أدخل نتائج التجارب، واحصل على التأثيرات وPareto للتأثيرات وANOVA ومعادلة الانحدار الناتجة.',
    })
}

export default async function DoeLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return (
    <>
      {/* WebApplication structured data for search engines (lib/seo/schema.ts) */}
      <ToolJsonLd lang={lang} href="/doe" />
      {children}
    </>
  )
}
