import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Design of Experiments (DOE) — Full Factorial 2^k Calculator',
  description:
    'Free online DOE tool: generate a coded 2^k full factorial design matrix for 2–5 factors, enter your trial results, and get effects, Pareto of effects, ANOVA, and the fitted regression equation.',
  alternates: { canonical: '/doe' },
}

export default function DoeLayout({ children }: { children: React.ReactNode }) {
  return children
}
