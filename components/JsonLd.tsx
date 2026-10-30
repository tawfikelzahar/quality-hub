import { jsonLdString, toolSchema } from '@/lib/seo/schema'
import { isLocale } from '@/lib/i18n/routing'

/** Structured data for search engines (server-rendered, invisible on the page) */
export default function JsonLd({ data }: { data: Record<string, unknown> | null }) {
  if (!data) return null
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(data) }} />
}

/** WebApplication structured data for a tool page; `href` is the English path ("/spc") */
export function ToolJsonLd({ lang, href }: { lang: string; href: string }) {
  return <JsonLd data={toolSchema(isLocale(lang) ? lang : 'en', href)} />
}
