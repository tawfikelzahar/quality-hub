import IcmsfCalculator from '@/components/IcmsfCalculator'
import ToolGuide from '@/components/tool/ToolGuide'
import { ICMSF_GUIDE } from '@/lib/guides/food'

// Metadata lives in app/icmsf/layout.tsx.
export default async function IcmsfPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return <IcmsfCalculator guide={<ToolGuide guide={ICMSF_GUIDE} lang={lang} />} />
}
