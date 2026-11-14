'use client'

import NextLink from 'next/link'
import type { ComponentProps } from 'react'
import { useLanguage } from '@/lib/i18n/context'
import { localizePath } from '@/lib/i18n/routing'
import { stashDraftIfLeavingFor } from '@/lib/draft'

// ─────────────────────────────────────────────────────────────────────────
// next/link that keeps the visitor in their language: on an Arabic page
// href="/spc" goes to /ar/spc. Use it for every link inside the site
// (import Link from '@/components/LocaleLink'). External links, #anchors,
// /api and files pass through unchanged.
//
// A link to sign-in, pricing, account or checkout also keeps the analysis
// on screen, so the visitor finds it again when they come back (lib/draft.ts).
// ─────────────────────────────────────────────────────────────────────────

type Props = ComponentProps<typeof NextLink>

export default function LocaleLink({ href, onClick, ...rest }: Props) {
  const { lang } = useLanguage()
  const localized = typeof href === 'string'
    ? localizePath(href, lang)
    : { ...href, pathname: href.pathname ? localizePath(href.pathname, lang) : href.pathname }
  const path = typeof localized === 'string' ? localized : localized.pathname ?? ''
  return (
    <NextLink
      href={localized}
      onClick={(e) => { stashDraftIfLeavingFor(path); onClick?.(e) }}
      {...rest}
    />
  )
}

/** Same rule for places that build an address in code (window.location, router.push). */
export function useLocalePath() {
  const { lang } = useLanguage()
  return (href: string) => localizePath(href, lang)
}
