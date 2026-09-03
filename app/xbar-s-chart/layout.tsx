import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Xbar-S Chart Online — X̄ and Standard Deviation Chart, Nelson Rules, Cpk',
  description:
    'Free online Xbar-S control chart for larger subgroups (n ≥ 10): X̄ and Standard Deviation charting, all 8 Nelson Rules screening, and process capability (Cp/Cpk/Pp/Ppk).',
  alternates: { canonical: '/xbar-s-chart' },
}

export default function XbarSChartLayout({ children }: { children: React.ReactNode }) {
  return children
}
