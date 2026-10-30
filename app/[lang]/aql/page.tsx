import AQLCalculator from '@/components/AQLCalculator'
import ToolGuide from '@/components/tool/ToolGuide'
import { AQL_GUIDE } from '@/lib/guides/aql'

// Metadata lives in app/aql/layout.tsx.
export default async function AQLPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return <AQLCalculator guide={<ToolGuide guide={AQL_GUIDE} lang={lang} />} />
}
