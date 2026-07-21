'use client'

import dynamic from 'next/dynamic'

const ParetoChart = dynamic(() => import('@/components/ParetoChart'), {
  ssr: false,
})

export default function ParetoPage() {
  return <ParetoChart />
}