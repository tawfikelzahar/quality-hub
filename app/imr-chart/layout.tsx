import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'I-MR Chart Online — Individuals & Moving Range, Nelson Rules, Cpk',
  description:
    'Free online I-MR control chart: Individuals and Moving Range charting for one measurement at a time, all 8 Nelson Rules screening, and process capability (Cp/Cpk/Pp/Ppk).',
  alternates: { canonical: '/imr-chart' },
}

export default function ImrChartLayout({ children }: { children: React.ReactNode }) {
  return children
}
