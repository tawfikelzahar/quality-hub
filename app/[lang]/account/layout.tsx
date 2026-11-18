import type { Metadata } from 'next'

// Tab title for this signed-in page, and keep it out of search results
// (robots.txt already blocks crawling it; this makes the page say the same).
export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  return {
    title: lang === 'ar' ? 'الحساب' : 'Account',
    robots: { index: false, follow: true },
  }
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
