'use client'
import LegalPage from '@/components/LegalPage'
import { TERMS } from '@/lib/legal'

export default function TermsPage() {
  return <LegalPage doc={TERMS} breadcrumbKey="bc_terms" other={{ href: '/privacy', label: 'footer_privacy' }} />
}
