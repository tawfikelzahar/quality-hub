import type { Metadata } from 'next'
import { SITE } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    `${SITE.name} pricing — every analysis tool is free, including SPC control charts, capability, AQL, Stability, Regression and DOE. Pro (coming soon) adds Gage R&R, PDF/Excel reports, saved projects and AI Insights.`,
  alternates: { canonical: '/pricing' },
}

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children
}
