import type { Metadata } from 'next'
import ParetoChart from '@/components/ParetoChart'

export const metadata: Metadata = {
  title: 'Pareto Chart Maker Online — 80/20 Analysis',
  description:
    'Build Pareto charts online for defect and root-cause analysis. Free 80/20 analysis tool with instant charts and exports — no spreadsheet setup required.',
  alternates: { canonical: '/pareto' },
}

export default function ParetoPage() {
  return <ParetoChart />
}