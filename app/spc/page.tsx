import type { Metadata } from 'next'
import SPCEngine from '@/components/SPCEngine'

export const metadata: Metadata = {
  title: 'SPC Control Charts Online — I-MR, X̄-R, Nelson Rules, Cpk',
  description:
    'Free online SPC software: I-MR and X̄-R control charts, attribute charts (p/np/c/u), all 8 Nelson Rules, and Cp/Cpk/Pp/Ppk capability indices. No install, no Minitab license.',
  alternates: { canonical: '/spc' },
}

export default function SPCPage() {
  return <SPCEngine />
}
