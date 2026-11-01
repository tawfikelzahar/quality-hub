import type { Metadata } from 'next'
import { SITE } from '@/lib/site'
import { localizedPageMetadata } from '@/lib/i18n/metadata'
import { VERIFICATION } from '@/lib/verification/content'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const n = VERIFICATION.total.toLocaleString('en-US')
  return localizedPageMetadata(lang, '/verification',
    {
      title: 'How we verify every result',
      description: `${n} automated checks verify ${SITE.name} against AIAG, ISO 2859-1:2026, ICH Q1E, ICMSF, NIST certified data, textbook worked examples and specialised statistical software — tool by tool.`,
    },
    {
      title: 'كيف نتحقق من كل نتيجة',
      description: `${n} فحصًا آليًا تتحقق من ${SITE.name} مقابل AIAG و ISO 2859-1:2026 و ICH Q1E و ICMSF وبيانات NIST المعتمدة والأمثلة المحلولة في المراجع والبرامج الإحصائية المتخصصة، أداةً أداة.`,
    })
}

export default function VerificationLayout({ children }: { children: React.ReactNode }) {
  return children
}
