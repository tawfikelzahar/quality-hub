import dynamic from 'next/dynamic'

const ParetoChart = dynamic(() => import('@/components/ParetoChart'), {
  ssr: false,
  loading: () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0f1e', color: '#6b89b4' }}>
      Loading chart...
    </div>
  ),
})

export default function ParetoPage() {
  return <ParetoChart />
}