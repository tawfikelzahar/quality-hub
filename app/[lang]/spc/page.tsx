import type { Metadata } from 'next'
import SPCEngine from '@/components/SPCEngine'
import { localizedPageMetadata } from '@/lib/i18n/metadata'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  return localizedPageMetadata(lang, '/spc',
    {
      title: 'SPC Control Charts Online — I-MR, X̄-R, Nelson Rules, Cpk',
      description: 'Free online SPC software: I-MR and X̄-R control charts, attribute charts (p/np/c/u), all 8 Nelson Rules, and Cp/Cpk/Pp/Ppk capability indices. No install needed.',
    },
    {
      title: 'خرائط ضبط SPC أونلاين — I-MR، X̄-R، قواعد Nelson، Cpk',
      description: 'برنامج SPC مجاني عبر الإنترنت: خرائط ضبط I-MR وX̄-R، خرائط الصفات (p/np/c/u)، قواعد Nelson الثمانية، ومؤشرات القدرة Cp/Cpk/Pp/Ppk. بدون تثبيت.',
    })
}

export default function SPCPage() {
  return <SPCEngine />
}
