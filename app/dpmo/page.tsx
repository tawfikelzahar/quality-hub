import type { Metadata } from 'next'
import DPMOCalculator from '@/components/DPMOCalculator'

export const metadata: Metadata = {
  title: 'DPMO & Six Sigma Level Calculator',
  description:
    'Free DPMO calculator — convert defects per million opportunities to Sigma level instantly. Built for Six Sigma quality engineers.',
  alternates: { canonical: '/dpmo' },
}

export default function DPMOPage() {
  return <DPMOCalculator />
}