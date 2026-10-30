import type { Metadata } from 'next'
import { SITE } from '@/lib/site'
import { localizedPageMetadata } from '@/lib/i18n/metadata'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  return localizedPageMetadata(lang, '/guide',
    {
      title: `How to Use ${SITE.name} — Guide & Tool Directory`,
      description: `A quick guide to using ${SITE.name}: how the platform works, plus a full directory of every statistical quality engineering tool (SPC, Gage R&R, AQL, DOE, OEE, and more).`,
    },
    {
      title: `كيفية استخدام ${SITE.name} — دليل الاستخدام ودليل الأدوات`,
      description: `دليل سريع لاستخدام ${SITE.name}: كيف تعمل المنصة، بالإضافة إلى دليل كامل لكل أداة هندسة جودة إحصائية (SPC وGage R&R وAQL وDOE وOEE والمزيد).`,
    })
}

export default function GuideLayout({ children }: { children: React.ReactNode }) {
  return children
}
