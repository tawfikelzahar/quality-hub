import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'AQL Sampling Plan Calculator — ISO 2859-1',
  description:
    'Free AQL sampling plan calculator verified cell-by-cell against ISO 2859-1. Get sample size, Ac/Re values, and inspection level in seconds.',
  alternates: { canonical: '/aql' },
}

export default function AqlLayout({ children }: { children: React.ReactNode }) {
  return children
}
