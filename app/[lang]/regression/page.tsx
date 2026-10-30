import RegressionStudy from '@/components/RegressionStudy'
import ToolGuide from '@/components/tool/ToolGuide'
import { REGRESSION_GUIDE } from '@/lib/guides/models'

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return <RegressionStudy mode="simple" guide={<ToolGuide guide={REGRESSION_GUIDE} lang={lang} />} />
}
