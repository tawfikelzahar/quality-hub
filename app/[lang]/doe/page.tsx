import DoeStudy from '@/components/DoeStudy'
import ToolGuide from '@/components/tool/ToolGuide'
import { DOE_GUIDE } from '@/lib/guides/models'

export default async function DoePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return <DoeStudy guide={<ToolGuide guide={DOE_GUIDE} lang={lang} />} />
}
