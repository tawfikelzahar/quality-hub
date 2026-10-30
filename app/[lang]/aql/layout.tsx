import type { Metadata } from 'next'
import { localizedPageMetadata } from '@/lib/i18n/metadata'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  return localizedPageMetadata(lang, '/aql',
    {
      title: 'AQL Sampling Plan Calculator — ISO 2859-1:2026',
      description: 'Free AQL sampling plan calculator checked cell by cell against ISO 2859-1:2026. Get the code letter, sample size and Ac/Re for each defect class, then the lot decision.',
    },
    {
      title: 'حاسبة خطة عينات AQL — ISO 2859-1:2026',
      description: 'حاسبة خطة عينات AQL مجانية ومُتحقق منها خلية بخلية مقابل ISO 2859-1:2026. احصل على حرف الكود وحجم العينة وAc/Re لكل مستوى عيوب، ثم قرار قبول أو رفض الدفعة.',
    })
}

export default function AqlLayout({ children }: { children: React.ReactNode }) {
  return children
}
