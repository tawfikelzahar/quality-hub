import type { Metadata } from 'next'
import DescriptiveStats from '@/components/DescriptiveStats'

export const metadata: Metadata = {
  title: 'Descriptive Statistics Calculator — Histogram, Box Plot, Normality Test',
  description:
    'Free descriptive statistics tool with combined histogram and box plot, plus Anderson-Darling normality testing and confidence intervals.',
  alternates: { canonical: '/descriptive' },
}

export default function DescriptivePage() {
  return <DescriptiveStats />
}
