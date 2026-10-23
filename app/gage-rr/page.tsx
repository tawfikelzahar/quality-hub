import type { Metadata } from 'next'
import GageRR from '@/components/GageRR'

export const metadata: Metadata = {
  title: 'Gage R&R Calculator Online — AIAG MSA (Average & Range, ANOVA)',
  description:
    'Free Gage R&R / MSA calculator following the AIAG MSA 4th edition (6σ study variation). Average & Range and ANOVA methods with %Tolerance and %Study Variation.',
  alternates: { canonical: '/gage-rr' },
}

export default function GageRRPage() {
  return <GageRR />
}
