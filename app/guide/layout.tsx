import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'How to Use Quality Hub — Guide & Tool Directory',
  description:
    'A quick guide to using Quality Hub: how the platform works, plus a full directory of every statistical quality engineering tool (SPC, Gage R&R, AQL, DOE, OEE, and more).',
  alternates: { canonical: '/guide' },
}

export default function GuideLayout({ children }: { children: React.ReactNode }) {
  return children
}
