import type { Metadata } from 'next'
import ResultClient from './ResultClient'

// /checkout/result — where Paymob sends the customer back after paying.
// The address carries Paymob's result, but it is not trusted: the page asks
// /api/paymob/status, which reflects the signed callback.
export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  return { title: lang === 'ar' ? 'نتيجة الدفع' : 'Payment result', robots: { index: false, follow: false } }
}

export default function Page() {
  return <ResultClient />
}
