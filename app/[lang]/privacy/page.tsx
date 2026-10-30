'use client'
import LegalPage from '@/components/LegalPage'
import { PRIVACY } from '@/lib/legal'

export default function PrivacyPage() {
  return <LegalPage doc={PRIVACY} breadcrumbKey="bc_privacy" other={{ href: '/terms', label: 'bc_terms' }} />
}
