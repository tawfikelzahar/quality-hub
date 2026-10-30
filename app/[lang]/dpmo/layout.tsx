import { ToolJsonLd } from '@/components/JsonLd'

export default async function DpmoLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return (
    <>
      {/* WebApplication structured data for search engines (lib/seo/schema.ts) */}
      <ToolJsonLd lang={lang} href="/dpmo" />
      {children}
    </>
  )
}
