import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'ICMSF Microbiological Sampling Plan Calculator',
  description:
    'Free ICMSF microbiological sampling plan tool. Select your Case from hazard level and conditions of use, enter your m/M limits, get n/c and an Operating Characteristic curve. Methodology aligned with Codex Alimentarius CAC/GL 21.',
  alternates: { canonical: '/icmsf' },
}

export default function IcmsfLayout({ children }: { children: React.ReactNode }) {
  return children
}
