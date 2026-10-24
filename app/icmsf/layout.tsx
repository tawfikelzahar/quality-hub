import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'ICMSF Microbiological Sampling Plan Calculator',
  description:
    'Free ICMSF microbiological sampling plan tool. Pick the hazard (with ICMSF organism examples) and conditions of use to get the Case and n, c, m, M, then the lot decision from your unit results, with the OC curve.',
  alternates: { canonical: '/icmsf' },
}

export default function IcmsfLayout({ children }: { children: React.ReactNode }) {
  return children
}
