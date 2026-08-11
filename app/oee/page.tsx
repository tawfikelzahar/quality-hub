import type { Metadata } from 'next'
import OEECalculator from '@/components/OEECalculator'

export const metadata: Metadata = {
  title: 'OEE Calculator Online — Availability, Performance, Quality',
  description:
    'Free Overall Equipment Effectiveness (OEE) calculator using the Nakajima/JIPM TPM standard. Track the Six Big Losses and benchmark against world-class OEE.',
  alternates: { canonical: '/oee' },
}

export default function OEEPage() {
  return <OEECalculator />
}
