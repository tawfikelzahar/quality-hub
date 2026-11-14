import type { Metadata } from 'next'
import ResetPasswordClient from './ResetPasswordClient'

// Reached only from the link in a password-reset email (via /auth/callback),
// so it is kept out of search results.
export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  return { title: lang === 'ar' ? 'اختر كلمة مرور جديدة' : 'Choose a new password', robots: { index: false, follow: false } }
}

export default function Page() {
  return <ResetPasswordClient />
}
