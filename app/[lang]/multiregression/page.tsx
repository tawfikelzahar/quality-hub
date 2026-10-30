import RegressionStudy from '@/components/RegressionStudy'
import ToolGuide from '@/components/tool/ToolGuide'
import { MULTIREGRESSION_GUIDE } from '@/lib/guides/models'

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return <RegressionStudy mode="multiple" guide={<ToolGuide guide={MULTIREGRESSION_GUIDE} lang={lang} />} />
}
