import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Xbar-R Chart Online — X̄ and Range Chart, Nelson Rules, Cpk',
  description:
    'Free online Xbar-R control chart for subgrouped data: X̄ and Range charting, all 8 Nelson Rules screening, and process capability (Cp/Cpk/Pp/Ppk).',
  alternates: { canonical: '/xbar-r-chart' },
}

export default function XbarRChartLayout({ children }: { children: React.ReactNode }) {
  return children
}
