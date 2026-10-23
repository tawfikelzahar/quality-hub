'use client'

import type { CSSProperties } from 'react'
import Link from 'next/link'
import { useSubscription } from '@/lib/useSubscription'

// "Get Pro" call to action in the navs. Hidden for Pro accounts, and hidden
// while the plan is still loading so a Pro user never sees it flash.
export default function GetProLink({ label, style, className }: { label: string; style: CSSProperties; className?: string }) {
  const { isPro, loading } = useSubscription()
  if (loading || isPro) return null
  return (
    <Link href="/pricing" className={className} style={style}>
      {label}
    </Link>
  )
}
