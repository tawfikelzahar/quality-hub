import type { Metadata } from 'next'
import StabilityStudy from '@/components/StabilityStudy'

export const metadata: Metadata = {
  title: 'Stability Study & Shelf-Life Calculator — ICH Q1E',
  description:
    'Free shelf-life estimation tool using ICH Q1E regression and poolability ANCOVA. Built for pharmaceutical and product stability studies.',
  alternates: { canonical: '/stability' },
}

export default function StabilityPage() {
  return <StabilityStudy />
}
