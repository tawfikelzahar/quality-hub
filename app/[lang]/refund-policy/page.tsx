'use client'
import LegalPage from '@/components/LegalPage'
import { REFUND } from '@/lib/legal'

export default function RefundPolicyPage() {
  return <LegalPage doc={REFUND} breadcrumbKey="bc_refund" other={{ href: '/terms', label: 'bc_terms' }} />
}
