import type { Metadata } from 'next'
import { SITE } from '@/lib/site'
import { localizedPageMetadata } from '@/lib/i18n/metadata'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  return localizedPageMetadata(lang, '/refund-policy',
    {
      title: 'Refund & Cancellation Policy',
      description: `How refunds and cancellation work for ${SITE.name} Pro: a one-time payment with no automatic renewal, and a full refund within 7 days if Pro has not been used.`,
    },
    {
      title: 'سياسة الاسترجاع والإلغاء',
      description: `كيف يعمل الاسترداد والإلغاء في باقة ${SITE.name} Pro: دفعة واحدة دون تجديد تلقائي، واسترداد كامل خلال 7 أيام إذا لم تُستخدم Pro.`,
    })
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
