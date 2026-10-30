import type { Metadata } from 'next'
import DPMOCalculator from '@/components/DPMOCalculator'
import { localizedPageMetadata } from '@/lib/i18n/metadata'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  return localizedPageMetadata(lang, '/dpmo',
    {
      title: 'DPMO & Six Sigma Level Calculator',
      description: 'Free DPMO calculator — convert defects per million opportunities to Sigma level instantly. Built for Six Sigma quality engineers.',
    },
    {
      title: 'حاسبة DPMO ومستوى Six Sigma',
      description: 'حاسبة DPMO مجانية — حوّل عدد العيوب لكل مليون فرصة إلى مستوى Sigma فوريًا. مصممة لمهندسي جودة Six Sigma.',
    })
}

export default function DPMOPage() {
  return <DPMOCalculator />
}