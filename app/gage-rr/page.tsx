import type { Metadata } from 'next'
import GageRR from '@/components/GageRR'

export const metadata: Metadata = {
  title: 'Gage R&R Calculator Online — AIAG MSA (Average & Range, ANOVA)',
  description:
    'Free Gage R&R / MSA calculator using the AIAG 4th edition standard (5.15σ). Average & Range and ANOVA methods with %Tolerance and %Study Variation.',
  alternates: { canonical: '/gage-rr' },
}

export default function GageRRPage() {
  return <GageRR />
}
