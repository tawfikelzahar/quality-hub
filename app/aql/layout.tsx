import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'AQL Sampling Plan Calculator — ISO 2859-1:2026',
  description:
    'Free AQL sampling plan calculator checked cell by cell against ISO 2859-1:2026. Get the code letter, sample size and Ac/Re for each defect class, then the lot decision.',
  alternates: { canonical: '/aql' },
}

export default function AqlLayout({ children }: { children: React.ReactNode }) {
  return children
}
