import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Quality Hub pricing — free SPC control charts, capability indices, and calculators, with Pro tiers unlocking attribute charts, Nelson Rules, Gage R&R, AQL, and Stability Study tools.',
  alternates: { canonical: '/pricing' },
}

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children
}
